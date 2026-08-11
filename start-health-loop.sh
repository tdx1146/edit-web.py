#!/bin/bash
# 启动 health-loop 并确保它独立于当前终端
# 2026-08-10 部署统一化：脚本路径相对推导，零硬编码
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
nohup bash "$SCRIPT_DIR/health-loop.sh" > /dev/null 2>&1 &
echo "health-loop PID: $!"
