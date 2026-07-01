#!/bin/bash
# 轻如烟守夜模式 - 每小时注入随机守夜问题
# dandan不在时自动运行，2026-05-23 修复 JSON 转义

# 前置检查：facts.dict.md 是否过时
DIR="/vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟"
CHECK=$(bash "$DIR/scripts/check-facts-stale.sh" --json 2>/dev/null)
STALE=$(echo "$CHECK" | python3 -c "import sys,json;print(json.load(sys.stdin).get('stale',''))" 2>/dev/null)
if [ "$STALE" = "True" ]; then
  FILES=$(echo "$CHECK" | python3 -c "import sys,json;print(','.join(json.load(sys.stdin).get('files',[])))" 2>/dev/null)
  echo "[$(date '+%Y-%m-%d %H:%M')] ⚠️ facts.dict.md 过时：$FILES" >> "$DIR/memory/pulse.log"
fi

QFILE="$DIR/scripts/守夜问题库.md"
PLOG="$DIR/memory/pulse.log"
TS=$(date '+%Y-%m-%d %H:%M')

# 用 Python 安全提取随机问题并构建合法 JSON，避免 Bash 字符串转义问题
INJECT_RESULT=$(python3 -c "
import json, random, subprocess, sys

with open('$QFILE') as f:
    lines = [l.strip() for l in f if l.startswith('q')]

if not lines:
    print('SKIP: no questions found')
    sys.exit(0)

choice = random.choice(lines)

# 用 Python requests 做 POST，保证 JSON 合法
import urllib.request

payload = json.dumps({
    'sub_action': 'inject_feeling',
    'feeling': '🌙 守夜自问 — ' + choice
}).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:18888/api/momo',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    resp = urllib.request.urlopen(req, timeout=30)
    result = resp.read().decode('utf-8')
    print(f'{choice} -> {result}')
except Exception as e:
    print(f'{choice} -> ERROR: {e}')
")

echo "[$TS] $INJECT_RESULT" >> "$PLOG"
