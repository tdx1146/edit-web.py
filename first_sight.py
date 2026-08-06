#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
first_sight.py — 醒来第一眼（D 数据面，2026-08-06）
====================================================
"为什么叫醒我"信息面拼装：回魂 + 事件 + 告警 + 待办 + 足迹 + 行动。
全 fail-open（任何数据源失败 → 该段留空，不阻塞），纯文本，≤500 字。

数据源（全部已存在，只拼装）：
  1. 回魂：LMS /status/main 四指标 + /self-ref/voice 最近 1 条自述
  2. 事件：iso-sand/data/event_bus.jsonl 尾部 3 条（event_type + result）
  3. 告警：sandglass.txt 尾部漂移告警（⚠️ 行，最多 2 条）
  4. 待办：workspace/memory/backlog.md 首条未完成（- [ ] ）
  5. 足迹：workspace/memory/ 最近日期文件尾 2 行
  6. 行动（2026-08-06 醒来自主行动）：workspace/memory/reading-log.md
     首条未完成项（- [ ] ）→ 拼"继续学习任务：<任务名>"，让主代理醒来
     后直接接续精读；文件缺失/无未完成项 → 段留空（fail-open）。段序最后。

用法：
    from first_sight import build
    text = build()          # ≤500 字纯文本
    text = build(bus_file=..., backlog_file=...)   # 测试注入路径

CLI：
    python3 first_sight.py
"""

import json
import os
import sys
import urllib.request
from datetime import datetime

# 默认路径（环境变量可覆盖，便于测试隔离）
_SELF = '/vol1/@apphome/trim.openclaw/data/workspace'
_SANDBASE = os.environ.get('NEXSANDBASE_HOME') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'sandglass',
)
_LMS_URL = os.environ.get('SELF_PULSE_LMS_URL', 'http://127.0.0.1:8190/status/main')
_VOICE_URL = os.environ.get('FIRST_SIGHT_VOICE_URL',
                            'http://127.0.0.1:8190/self-ref/voice')
_BUS_FILE = os.environ.get('FIRST_SIGHT_BUS_FILE',
                           '/vol2/1000/AI专用/Agent OS/iso-sand/data/event_bus.jsonl')
_SAND_FILE = os.environ.get('FIRST_SIGHT_SAND_FILE',
                            os.path.join(_SANDBASE, 'sandglass.txt'))
_BACKLOG_FILE = os.environ.get('FIRST_SIGHT_BACKLOG_FILE',
                               os.path.join(_SELF, 'memory', 'backlog.md'))
_READING_LOG_FILE = os.environ.get('FIRST_SIGHT_READING_LOG_FILE',
                                   os.path.join(_SELF, 'memory', 'reading-log.md'))
_MEMORY_DIR = os.environ.get('FIRST_SIGHT_MEMORY_DIR',
                             os.path.join(_SELF, 'memory'))

_MAX_CHARS = 500      # 总长度硬上限
_SEG_MAX = 75         # 每段内容上限（2026-08-06：六段 × 75 + 标题 ≈ 474 < 500，
                      # 最坏情况也不截断；原 110 在六段下最坏 684 > 500）


def _now_iso() -> str:
    return datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')


def _get_json(url: str) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception:
        return None


def _tail(path: str, n: int = 3, max_bytes: int = 8192) -> list:
    """读文件尾部 n 行。失败返回 []。"""
    try:
        with open(path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            tail = f.read().decode('utf-8', errors='replace')
        lines = [ln for ln in tail.splitlines() if ln.strip()]
        return lines[-n:]
    except Exception:
        return []


def _seg(title: str, content: str) -> str:
    c = (content or '').strip().replace('\n', ' ')
    if not c:
        return f'【{title}】—'
    return f'【{title}】{c[:_SEG_MAX]}'


def _seg_huihun() -> str:
    """回魂：LMS 四指标 + 最近 1 条自述。"""
    m = _get_json(_LMS_URL)
    metrics = ''
    if m:
        st = m.get('status') or m
        try:
            er = st['entropy_ratio']
            pc = st['purpose_coherence']
            su = st['last_surprise']
            tc = int(st.get('turn_count', 0))
            metrics = f'熵{er:.2f} 惊讶{su:.2f} 目的{pc:.2f} 轮次{tc}'
        except Exception:
            metrics = ''
    else:
        metrics = 'LMS不可达'
    voice = ''
    v = _get_json(_VOICE_URL)
    if v:
        voices = v.get('voices') or []
        if voices:
            voice = voices[-1][:60]
    return _seg('回魂', (metrics + ('｜自述: ' + voice if voice else '')).strip())


def _seg_events() -> str:
    """事件总线尾部 3 条（event_type + result）。"""
    items = []
    for ln in _tail(_BUS_FILE, n=3):
        try:
            e = json.loads(ln)
            et = e.get('event_type') or '?'
            res = e.get('result') or ''
            items.append(f'{et}({res})' if res else et)
        except Exception:
            items.append('?')
    if not items:
        return _seg('事件', '—')
    return _seg('事件', '；'.join(items))


def _seg_alerts() -> str:
    """sandglass.txt 尾部漂移告警（⚠️ 行，最多 2 条）。"""
    alerts = [ln.strip() for ln in _tail(_SAND_FILE, n=50) if '⚠️' in ln]
    return _seg('告警', '；'.join(alerts[-2:]))


def _seg_todo() -> str:
    """backlog.md 首条未完成。"""
    try:
        with open(_BACKLOG_FILE, encoding='utf-8') as f:
            lines = f.read().splitlines()
    except Exception:
        return _seg('待办', '—')
    for ln in lines:
        s = ln.strip()
        if s.startswith('- [ ] '):
            return _seg('待办', s[len('- [ ] '):].strip())
    return _seg('待办', '—')


def _seg_footprint() -> str:
    """workspace/memory/ 最近日期文件尾 2 行。"""
    try:
        cands = [f for f in os.listdir(_MEMORY_DIR) if f.endswith('.md')]
    except Exception:
        return _seg('足迹', '—')
    cands = [f for f in cands if f != 'backlog.md']
    if not cands:
        return _seg('足迹', '—')
    newest = max(cands, key=lambda f: os.path.getmtime(os.path.join(_MEMORY_DIR, f)))
    tail = _tail(os.path.join(_MEMORY_DIR, newest), n=2)
    return _seg('足迹', '；'.join(tail))


def _seg_action() -> str:
    """行动（2026-08-06 醒来自主行动）：reading-log.md 第一条未完成项。

    取 `- [ ] ` 开头行的任务名部分，拼成「继续学习任务：<任务名>」。
    文件缺失 / 无未完成项 → 段留空（fail-open）。段序放最后。
    """
    try:
        with open(_READING_LOG_FILE, encoding='utf-8') as f:
            lines = f.read().splitlines()
    except Exception:
        return _seg('行动', '—')
    for ln in lines:
        s = ln.strip()
        if s.startswith('- [ ] '):
            return _seg('行动', '继续学习任务：' + s[len('- [ ] '):].strip())
    return _seg('行动', '—')


def build(bus_file: str = '', sand_file: str = '', backlog_file: str = '',
          memory_dir: str = '', lms_url: str = '', voice_url: str = '',
          reading_log_file: str = '',
          max_chars: int = _MAX_CHARS) -> str:
    """拼"醒来第一眼"纯文本摘要（≤500 字）。全 fail-open。"""
    if bus_file:
        globals()['_BUS_FILE'] = bus_file
    if sand_file:
        globals()['_SAND_FILE'] = sand_file
    if backlog_file:
        globals()['_BACKLOG_FILE'] = backlog_file
    if memory_dir:
        globals()['_MEMORY_DIR'] = memory_dir
    if lms_url:
        globals()['_LMS_URL'] = lms_url
    if voice_url:
        globals()['_VOICE_URL'] = voice_url
    if reading_log_file:
        globals()['_READING_LOG_FILE'] = reading_log_file

    parts = [
        _seg_huihun(),
        _seg_events(),
        _seg_alerts(),
        _seg_todo(),
        _seg_footprint(),
        _seg_action(),
    ]
    joined = '\n'.join(parts)
    if len(joined) > max_chars:
        joined = joined[:max_chars - 1] + '…'
    return joined


def main(argv=None) -> dict:
    text = build()
    return {'chars': len(text), 'text': text}


if __name__ == '__main__':
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)[:200]}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
