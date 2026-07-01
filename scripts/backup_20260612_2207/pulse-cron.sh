#!/bin/bash
# Pulse check for 轻如烟 - called from crontab
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18888/api/momo \
  -X POST -H 'Content-Type: application/json' \
  -d '{"sub_action":"status"}' >> /fs/1000/ftp/AI专用/所有自动化/轻如烟/memory/pulse.log 2>&1 \
  && echo " $(date '+%H:%M') pulse-ok" >> /fs/1000/ftp/AI专用/所有自动化/轻如烟/memory/pulse.log
