#!/bin/bash
# 踱步窗 v3 - qh.instance
# 空闲检测 >30 分钟 → 触发踱步（文件锚点模式）
DATE=$(date +%Y-%m-%d)
TIME=$(date +%s)
SD="/vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟"
PD="${SD}/.踱步"
TF="${PD}/think_${DATE}.md"
UF="${PD}/.last_user_msg"
LF="${PD}/.pacing_lock"
ENDPOINT="http://127.0.0.1:18888/api/inject"

mkdir -p "$PD"

# 读最后用户消息时间
LAST_MSG=$(cat "$UF" 2>/dev/null || echo 0)
DIFF=$((TIME - LAST_MSG))

# 不够 30 分钟 → 退出
[ "$DIFF" -lt 1800 ] && exit 0

# 锁检查——1小时内已触发过 → 跳过
if [ -f "$LF" ]; then
    LOCK_TIME=$(cat "$LF")
    LOCK_AGE=$((TIME - LOCK_TIME))
    [ "$LOCK_AGE" -lt 3600 ] && exit 0
fi

# 上锁
echo "$TIME" > "$LF"

# 深度判定
DEPTH="中"
[ "$DIFF" -gt 3600 ] && DEPTH="深"
[ "$DIFF" -gt 7200 ] && DEPTH="极深"

# 轮数统计
ROUNDS=0
[ -f "$TF" ] && ROUNDS=$(grep -c "^## 踱步" "$TF" 2>/dev/null)
ROUNDS=${ROUNDS:-0}

# 新建 think 文件
if ! grep -q "$DATE" "$TF" 2>/dev/null; then
    {
        echo ""
        echo "---"
        echo "# ${DATE} 踱步会话"
        echo "---"
        echo ""
    } >> "$TF"
fi

# 注入触发消息
curl -s --max-time 5 "$ENDPOINT" -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"message\":\"🌫️[踱步v3] 用户已离线 ${DIFF} 秒。深度: ${DEPTH}。\\n\\n操作: exec 读 ${TF} → 追加第 $((ROUNDS + 1)) 轮思考。\\n不回复用户。文件是锚点。\"}"

echo "v3 $(date +%H:%M:%S) DIFF=${DIFF}s D=${DEPTH} R=${ROUNDS}" >> "${PD}/.pacing_log"
