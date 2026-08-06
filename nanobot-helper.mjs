#!/usr/bin/env node
/**
 * nanobot-helper.mjs — Nanobot WebSocket 注入助手
 * 
 * 用法:
 *   node nanobot-helper.mjs <message> [send|abort]
 *     send  : 发送消息到 Nanobot
 *     abort : 停止当前 AI 生成
 * 
 * 环境变量:
 *   NANOBOT_WS_URL    — WebSocket URL (默认 ws://127.0.0.1:8765/)
 *   NANOBOT_AUTH_URL  — Token 获取 URL (默认 http://127.0.0.1:8765/auth/token)
 *   NANOBOT_SECRET    — 认证 secret (默认 971334)
 *   NANOBOT_CHAT_ID   — 目标 chat ID (可选，不传则自动获取)
 *   NANOBOT_TIMEOUT   — 超时秒数 (默认 send=60, abort=5)
 */

import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

const WS_URL        = process.env.NANOBOT_WS_URL   || 'ws://127.0.0.1:8765/';
const AUTH_URL      = process.env.NANOBOT_AUTH_URL || 'http://127.0.0.1:8765/auth/token';
const SECRET        = process.env.NANOBOT_SECRET   || '971334';
const CHAT_ID       = process.env.NANOBOT_CHAT_ID  || '';
const TIMEOUT_SEND  = parseInt(process.env.NANOBOT_TIMEOUT || '60', 10);
const TIMEOUT_ABORT = 5;

const message = process.argv[2];
const method  = process.argv[3] || 'send';

if (!message && method !== 'abort') {
  process.stderr.write('Usage: node nanobot-helper.mjs <message> [send|abort]\n');
  process.exit(1);
}

// ── 1. 获取 token ──────────────────────────────────────────
async function getToken() {
  const resp = await fetch(AUTH_URL, {
    headers: { 'Authorization': `Bearer ${SECRET}` },
  });
  if (!resp.ok) {
    throw new Error(`Token request failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.token;
}

// ── 2. 连接并通信 ──────────────────────────────────────────
async function main() {
  const token = await getToken();
  const clientId = `nanobot-helper-${randomUUID().slice(0, 8)}`;
  const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}&client_id=${clientId}`;

  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen  = resolve;
    ws.onerror = () => reject(new Error('WebSocket connection failed'));
  });

  // 等待 ready 事件
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for ready')), 5000);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        if (data.event === 'ready') {
          clearTimeout(timeout);
          resolve(data);
        }
      } catch {}
    };
  });

  const chatId = CHAT_ID || ready.chat_id;

  if (method === 'abort') {
    // 发送 /stop 消息来停止当前生成
    ws.send(JSON.stringify({
      type: 'message',
      chat_id: chatId,
      content: '/stop',
    }));
    ws.close();
    process.stdout.write(JSON.stringify({ ok: true }));
    return;
  }

  // 发送消息
  ws.send(JSON.stringify({
    type: 'message',
    chat_id: chatId,
    content: message,
  }));

  // 收集回复
  const result = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ ok: true, content: fullContent, note: 'timeout' });
    }, TIMEOUT_SEND * 1000);

    let fullContent = '';
    let turnEnded = false;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        
        if (data.event === 'delta' && data.text) {
          fullContent += data.text;
        }
        
        if (data.event === 'turn_end') {
          turnEnded = true;
          clearTimeout(timeout);
          resolve({
            ok: true,
            content: fullContent,
            latency_ms: data.latency_ms,
            finish_reason: 'stop',
          });
        }
        
        if (data.event === 'error') {
          clearTimeout(timeout);
          resolve({ ok: false, error: data.detail || data.text || 'unknown error' });
        }
      } catch {}
    };

    ws.onclose = () => {
      if (!turnEnded) {
        clearTimeout(timeout);
        resolve({ ok: true, content: fullContent, note: 'connection closed' });
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      if (!turnEnded) resolve({ ok: false, error: 'WebSocket error' });
    };
  });

  ws.close();
  process.stdout.write(JSON.stringify(result));
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
