#!/bin/bash
# 轻如烟自愈脚本 v3 — 2026-08-04 Phase6 路径修正版
# 原 v2 指向已删除的 /vol1/@team/qh团队/... → 修正为真实路径 /vol2/1000/AI专用/所有自动化/轻如烟
DIR="/vol2/1000/AI专用/所有自动化/轻如烟"
LOG="/tmp/pulse-status.json"
TS=$(date '+%Y-%m-%d %H:%M')

# 1. 检查编辑器（端口 18888）
if ! curl -sf http://127.0.0.1:18888/ > /dev/null 2>&1; then
    if [ -f "$DIR/scripts/edit-web.py" ]; then
        cd "$DIR" && nohup python3 scripts/edit-web.py > /tmp/edit-web-restart.log 2>&1 &
        echo "[$TS] 🩺 自愈：编辑器挂了 → 已重启 (PID $!)" >> "$LOG"
    else
        echo "[$TS] ⚠️ 编辑器未运行且脚本缺失，跳过自愈" >> "$LOG"
    fi
fi

# 2. 检查 sandglass MCP（端口 8765，如果有 socat 版的话）
if ! curl -sf http://127.0.0.1:8765/ > /dev/null 2>&1; then
    # socat 版可能不跑 HTTP，跳过
    true
fi
