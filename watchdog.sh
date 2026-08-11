#!/bin/bash
# edit-web 监督：挂了自动重启
# 2026-08-10 部署统一化：路径/端口读配置或相对推导，零硬编码

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

while true; do
  if ! curl -s -o /dev/null "http://127.0.0.1:$EDITOR_PORT/" --connect-timeout 5 2>/dev/null; then
    echo "$(date): edit-web 挂了，正在重启" >> /tmp/edit-web-watchdog.log
    cd "$LIGHT_HOME" && nohup python3 "$EDITOR_HOME/edit-web.py" > /tmp/edit-web-restart.log 2>&1 &
    echo "$(date): 已重启 PID=$!" >> /tmp/edit-web-watchdog.log
  fi
  sleep 30
done
