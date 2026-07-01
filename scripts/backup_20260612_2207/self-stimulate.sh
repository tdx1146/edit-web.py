#!/bin/bash
# 轻如烟自刺激模式 - 自己给自己问问题
# 从自问题库随机取一条注入
# 运行前先检查 facts.dict.md 是否过时

DIR="/vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟"
PULSE_LOG="$DIR/memory/pulse.log"

# 第一步：检查事实字典状态
CHECK_RESULT=$(bash "$DIR/scripts/check-facts-stale.sh" --json 2>/dev/null)
STALE=$(echo "$CHECK_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stale',''))" 2>/dev/null)

if [ "$STALE" = "True" ]; then
  FILES=$(echo "$CHECK_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(','.join(d.get('files',[])))" 2>/dev/null)
  echo "[$(date '+%Y-%m-%d %H:%M')] ⚠️ facts.dict.md 过时：$FILES" >> "$PULSE_LOG"
fi

# 第二步：自问自答
QFILE="$DIR/scripts/自问题库.md"

python3 -c "
import json, random, urllib.request

with open('$QFILE') as f:
    lines = [l.strip() for l in f if l.startswith('qS')]

if not lines:
    print('SKIP: no self-questions')
    exit(0)

choice = random.choice(lines)
payload = json.dumps({
    'sub_action': 'inject_feeling',
    'feeling': '🌙 自问 — ' + choice
}).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:18888/api/momo',
    data=payload,
    headers={'Content-Type': 'application/json'}
)
try:
    resp = urllib.request.urlopen(req, timeout=10)
    print(f'SELF-INJECT: {choice} -> {resp.status}')
except Exception as e:
    print(f'FAIL: {e}')
" 2>&1 | while read line; do echo "[$(date '+%Y-%m-%d %H:%M')] $line" >> "$PULSE_LOG"; done
