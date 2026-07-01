#!/bin/bash
# 连续自注踱步窗 — 15分钟自驱循环
END=900
start=$SECONDS
URL="http://127.0.0.1:18888/api/inject"
COUNT=0

echo "[pacing] 15分钟踱步窗开始 $(date +%H:%M:%S)"

while [ $((SECONDS - start)) -lt $END ]; do
    COUNT=$((COUNT + 1))
    curl -s --max-time 3 "$URL" -X POST \
        -H 'Content-Type: application/json' \
        -d "{\"message\":\"继续\"}" > /dev/null
    echo "  [$COUNT] inject at +$((SECONDS - start))s"
    sleep $((30 + RANDOM % 30))
done

# 收束
curl -s --max-time 3 "$URL" -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"message\":\"🌫️踱步窗结束——停下来\"}" > /dev/null
echo "  [done] 收束 inject sent at +$((SECONDS - start))s"

echo "[pacing] 踱步窗结束 $(date +%H:%M:%S) — $COUNT 次注入"
