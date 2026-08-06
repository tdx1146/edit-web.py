#!/usr/bin/env python3
"""
nanobot-helper.py — Nanobot WebSocket 注入助手

用法:
  python3 nanobot-helper.py <message> [send|abort]

流程:
  1. 连接 WebSocket
  2. 如果指定了 NANOBOT_CHAT_ID，先发送 attach 命令挂载到已有会话
  3. 发送 message
  4. 等待响应（delta/turn_end）或超时返回

环境变量:
  NANOBOT_WS_URL     — WebSocket URL (默认 ws://127.0.0.1:8765/)
  NANOBOT_AUTH_URL   — Token 获取 URL (默认 http://127.0.0.1:8765/auth/token)
  NANOBOT_SECRET     — 认证 secret (默认 971334)
  NANOBOT_CHAT_ID    — 目标 chat ID (可选，不传则使用新会话)
  NANOBOT_TIMEOUT    — 超时秒数 (默认 send=60, abort=5)
"""

import asyncio
import json
import os
import sys
import urllib.request
import uuid

WS_URL = os.environ.get('NANOBOT_WS_URL', 'ws://127.0.0.1:8765/')
AUTH_URL = os.environ.get('NANOBOT_AUTH_URL', 'http://127.0.0.1:8765/auth/token')
SECRET = os.environ.get('NANOBOT_SECRET', '971334')
CHAT_ID = os.environ.get('NANOBOT_CHAT_ID', '')
TIMEOUT_SEND = int(os.environ.get('NANOBOT_TIMEOUT', '60'))


async def get_token():
    req = urllib.request.Request(AUTH_URL, headers={
        'Authorization': f'Bearer {SECRET}',
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return data['token']


async def send_message(message):
    import websockets
    
    token = await get_token()
    client_id = f'nanobot-helper-{uuid.uuid4().hex[:8]}'
    uri = f'{WS_URL}?token={token}&client_id={client_id}'
    
    async with websockets.connect(uri) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        chat_id = CHAT_ID or ready['chat_id']
        
        # 如果指定了 CHAT_ID，先 attach 到已有会话
        if CHAT_ID:
            await ws.send(json.dumps({
                'type': 'attach',
                'chat_id': chat_id,
            }))
            # 等待 attached 确认
            attach_resp = await asyncio.wait_for(ws.recv(), timeout=5)
            attach_data = json.loads(attach_resp)
            if attach_data.get('event') == 'error':
                return {'ok': False, 'error': f'attach failed: {attach_data.get("detail", "unknown")}'}
        
        # 发送消息
        await ws.send(json.dumps({
            'type': 'message',
            'chat_id': chat_id,
            'content': message,
        }))
        
        # 等待响应（delta / turn_end / error）
        content_parts = []
        deadline = asyncio.get_event_loop().time() + TIMEOUT_SEND
        while asyncio.get_event_loop().time() < deadline:
            try:
                resp = await asyncio.wait_for(ws.recv(), timeout=2)
                data = json.loads(resp)
                if data.get('event') == 'delta' and data.get('text'):
                    content_parts.append(data['text'])
                elif data.get('event') == 'turn_end':
                    full_content = ''.join(content_parts)
                    return {'ok': True, 'content': full_content}
                elif data.get('event') == 'error':
                    return {'ok': False, 'error': data.get('detail', 'unknown error')}
            except asyncio.TimeoutError:
                break  # 超时 = 消息已发送，等待后端处理
        
        full_content = ''.join(content_parts)
        if full_content:
            return {'ok': True, 'content': full_content, 'note': 'partial'}
        return {'ok': True, 'note': 'sent (async)'}


async def abort_generation():
    import websockets

    token = await get_token()
    client_id = f'nanobot-helper-abort-{uuid.uuid4().hex[:8]}'
    uri = f'{WS_URL}?token={token}&client_id={client_id}'

    async with websockets.connect(uri) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        chat_id = CHAT_ID or ready['chat_id']

        # 如果指定了 CHAT_ID，先 attach
        if CHAT_ID:
            await ws.send(json.dumps({
                'type': 'attach',
                'chat_id': chat_id,
            }))
            await asyncio.wait_for(ws.recv(), timeout=5)

        await ws.send(json.dumps({
            'type': 'message',
            'chat_id': chat_id,
            'content': '/stop',
        }))

        await asyncio.sleep(3)
        return {'ok': True}


async def main():
    message = sys.argv[1] if len(sys.argv) > 1 else ''
    method = sys.argv[2] if len(sys.argv) > 2 else 'send'
    
    if not message and method != 'abort':
        print(json.dumps({'ok': False, 'error': 'Usage: nanobot-helper.py <message> [send|abort]'}))
        sys.exit(1)
    
    if method == 'abort':
        result = await abort_generation()
    else:
        result = await send_message(message)
    
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
