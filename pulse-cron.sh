#!/bin/bash
# pulse-cron.sh — 沙漏自治脉冲（Phase6 重建，2026-08-04）
# ======================================================
# 原文件缺失但 crontab 每 10 分钟仍在调用（审计断口②：沙漏自治停搏 8/2）。
# 重建为：调用 scripts/self_pulse_cli.py 触发自主脉冲 + 更新 /tmp/pulse-status.json。
# v2（2026-08-05 真任务化）：self_pulse_cli.py 输出分级——正常态只写
# metrics.jsonl 不写 sandglass.txt；漂移/新待办才写 sandglass.txt + 发总线事件。
# 本脚本无需改动：CLI 自包含（LMS 采集/漂移判定/总线直写均在其内，stdlib only）。
#
# 部署：crontab 已有条目，无需改 crontab：
#   */10 * * * * /vol2/1000/AI专用/所有自动化/轻如烟/scripts/pulse-cron.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export NEXSANDBASE_HOME="/vol2/1000/AI专用/所有自动化/轻如烟/sandglass"

# 1. 自主脉冲（self_pulse：推进待办 / 画像漂移检查；输出分级见 CLI 文档）
OUT=$(python3 "$SCRIPT_DIR/self_pulse_cli.py" 2>/dev/null)
RC=$?

# 2. 更新状态文件（保留其他字段）
TS=$(date '+%H:%M')
python3 - "$TS" "$RC" "$OUT" << 'PYEOF' 2>/dev/null || true
import json, sys
ts, rc, out = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    d = json.load(open('/tmp/pulse-status.json'))
except Exception:
    d = {}
d['last_pulse'] = ts
d['pulse_rc'] = int(rc)
try:
    d['pulse_result'] = json.loads(out)
except Exception:
    d['pulse_result'] = out[:200]
json.dump(d, open('/tmp/pulse-status.json', 'w'))
PYEOF

exit 0
