#!/bin/bash
# 轻如烟 Editor 启动脚本（手动 / cron 调用）
# 用法: ./start-editor.sh

cd /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts

OPENCLAW_HOME=/vol1/@apphome/trim.openclaw/data/home/.openclaw
GATEWAY_PORT=24020
LOG=/tmp/editor.log
PIDFILE=/tmp/editor.pid

# 检查是否已在运行
if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
    echo "editor already running (PID $(cat $PIDFILE))"
    exit 0
fi

nohup python3 edit-web.py > "$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "editor started (PID $(cat $PIDFILE))"
