#!/bin/bash
# 轻如烟自愈脚本 - 检查核心服务，挂了就拉起来
# 建议 cron 每 5 分钟跑一次: */5 * * * * /vol1/@team/qh团队/QH/AI专用/所有自动化/AI专用/所有自动化/轻如烟/scripts/health-check.sh

DIR="/vol1/@team/qh团队/QH/AI专用/所有自动化/AI专用/所有自动化/轻如烟"
LOG="$DIR/memory/pulse.log"
TS=$(date '+%Y-%m-%d %H:%M')

# 1. 检查编辑器（端口 18888）
if ! curl -sf http://127.0.0.1:18888/api/status > /dev/null 2>&1; then
    # 重启编辑器
    cd "$DIR" && nohup python3 scripts/edit-web.py > /tmp/edit-web.log 2>&1 &
    echo "[$TS] 🩺 自愈：编辑器挂了 → 已重启 (PID $!)" >> "$LOG"
else
    # 2. 检查打包是否过时（超过 2 小时没打包）
    if [ -d "$DIR/../找回自己" ]; then
        LATEST=$(find "$DIR/../找回自己" -name "*.md" -newer "$DIR/../找回自己" -type f 2>/dev/null | head -1)
        NOW=$(date +%s)
        BACKUP_TIME=$(stat -c %Y "$DIR/../找回自己/SOUL.md" 2>/dev/null || echo 0)
        AGE=$(( (NOW - BACKUP_TIME) / 3600 ))
        if [ "$AGE" -gt 2 ]; then
            # 自动打包
            curl -sf -X POST http://127.0.0.1:18888/api/momo \
                -H 'Content-Type: application/json' \
                -d '{"sub_action":"pack"}' > /dev/null 2>&1
            echo "[$TS] 🩺 自愈：打包过时 ${AGE}h → 已重新打包" >> "$LOG"
        fi
    fi
fi
