#!/bin/bash
# health-loop.sh — 自愈循环，每5分钟检查 edit-web.py（:18888）
# 2026-08-10 部署统一化：端口/目录从 Agent OS/env.local 读取，缺失时相对推导
# 用法：nohup bash health-loop.sh &

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIGHT_HOME="$(cd "$SCRIPT_DIR/.." && pwd)"
_AGENT_OS="${AGENT_OS_HOME:-}"
if [ -z "$_AGENT_OS" ] && [ -d "$LIGHT_HOME/../Agent OS" ]; then
    _AGENT_OS="$(cd "$LIGHT_HOME/../Agent OS" && pwd)"
fi
if [ -n "$_AGENT_OS" ] && [ -f "$_AGENT_OS/env.local" ]; then
    set -a; . "$_AGENT_OS/env.local"; set +a
fi
EDITOR_HOME="${EDITOR_HOME:-$LIGHT_HOME/scripts}"
EDITOR_PORT="${EDITOR_PORT:-18888}"
LOG="/tmp/pulse-status.json"

while true; do
    TS=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 检查 $EDITOR_PORT 是否活着
    if ! curl -sf "http://127.0.0.1:$EDITOR_PORT" > /dev/null 2>&1; then
        echo "[$TS] ❌ edit-web 挂了 → 尝试重启" >> "$LOG"
        cd "$EDITOR_HOME"
        python3 edit-web.py 2>&1 &
        echo "[$TS] ✅ 已重启 (PID $!)" >> "$LOG"
    else
        echo "[$TS] ✅ edit-web 正常" >> "$LOG"
    fi
    
    sleep 300  # 5分钟
done
