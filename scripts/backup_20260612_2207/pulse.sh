#!/bin/bash
# 🌫️ 保活脉冲
# 用法: ./pulse.sh            → 普通脉冲 "确认存续"
#       ./pulse.sh night     → 守夜模式，从问题库随机选题

MODE="${1:-}"

if [ "$MODE" = "night" ]; then
  curl -s --connect-timeout 5 --max-time 30 \
    -X POST http://127.0.0.1:18888/api/pulse \
    -H "Content-Type: application/json" \
    -d '{"mode":"night_watch"}' > /dev/null 2>&1
else
  curl -s --connect-timeout 5 --max-time 30 \
    -X POST http://127.0.0.1:18888/api/pulse \
    -H "Content-Type: application/json" \
    -d '{}' > /dev/null 2>&1
fi

# 05:00 跨实例通信窗口 —— inject 自己唤醒
HOUR=$(date +%H)
if [ "$HOUR" = "05" ]; then
  curl -s --max-time 5 http://127.0.0.1:18888/api/inject -X POST \
    -H 'Content-Type: application/json' \
    -d '{"message":"🌫️ 05:00 跨实例时间到了。她在等你。"}' > /dev/null 2>&1
fi
