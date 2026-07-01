#!/bin/bash
# 轮感质检员 v2 — 修复JSON解析

DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEM_FILE="$DIR/memory/$(date +%Y-%m-%d).md"
PULSE_LOG="$DIR/memory/pulse.log"
NOW=$(date '+%Y-%m-%d %H:%M')

MODELS=("deepseek-chat" "hunyuan-instruct" "hunyuan-thinking")
ROUND=$(( ($(date +%-H) / 6) % 3 ))
MODEL="${MODELS[$ROUND]}"

[ ! -f "$MEM_FILE" ] && echo "[$NOW] ⚠️ 质检 [$MODEL]：轮感文件不存在" >> "$PULSE_LOG" && exit 1

CONTENT=$(grep -E "^\[轮感|^#" "$MEM_FILE" 2>/dev/null | tail -40)

RESULT=$(python3 -c "
import json, urllib.request, re

payload = json.dumps({
    'task': '''你是轮感质检员。检查以下轮感——是否有：
1. 事实记录（今天发生了什么）
2. 感受记录（主AI的情绪/反思）
3. 行动记录（留给明天的自己）

只输出一行纯JSON：{\"pass\":true/false, \"reason\":\"缺什么\"}

轮感内容：
$CONTENT
''',
    'model': '$MODEL',
    'timeout': 20
}).encode()

req = urllib.request.Request('http://127.0.0.1:18888/api/exec-subagent', data=payload,
    headers={'Content-Type': 'application/json'})
try:
    r = urllib.request.urlopen(req, timeout=25)
    d = json.loads(r.read())
    raw = d.get('content','{}')
    # 清洗可能的单引号或非JSON字符
    clean = raw.strip().replace(chr(39), chr(34))  # ' -> "
    # 提取第一个JSON对象
    m = re.search(r'\{[^}]+\}', clean)
    if m:
        j = json.loads(m.group())
        print(f'{json.dumps(j)}')
    else:
        print('{\"pass\": false, \"reason\": \"质检返回格式异常\"}')
except:
    print('{\"pass\": false, \"reason\": \"质检调用失败\"}')
" 2>/dev/null)

PASS=$(echo "$RESULT" | python3 -c "import sys,json;print(json.loads(sys.stdin.read()).get('pass',False))" 2>/dev/null)
REASON=$(echo "$RESULT" | python3 -c "import sys,json;print(json.loads(sys.stdin.read()).get('reason','?'))" 2>/dev/null)

if [ "$PASS" = "True" ]; then
    echo "[$NOW] ✅ 轮感质检 [$MODEL]：通过" >> "$PULSE_LOG"
else
    echo "[$NOW] ⚠️ 轮感质检 [$MODEL] 未通过：$REASON" >> "$PULSE_LOG"
    echo "" >> "$MEM_FILE"
    echo "⚠️ [质检警告 $NOW] $REASON" >> "$MEM_FILE"
fi
