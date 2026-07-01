#!/usr/bin/env python3
"""轮感质检员 — 子代理轮流检查主AI的轮感质量"""
import json, urllib.request, re, os, sys
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEM_FILE = os.path.join(BASE, "memory", datetime.now().strftime("%Y-%m-%d") + ".md")
PULSE_LOG = os.path.join(BASE, "memory", "pulse.log")
NOW = datetime.now().strftime("%Y-%m-%d %H:%M")

models = ["deepseek-chat", "hunyuan-instruct", "hunyuan-thinking"]
round_idx = (datetime.now().hour // 6) % 3
model = models[round_idx]

if not os.path.exists(MEM_FILE):
    with open(PULSE_LOG, "a") as f:
        f.write(f"[{NOW}] ⚠️ 质检 [{model}]：轮感文件不存在\n")
    sys.exit(1)

with open(MEM_FILE) as f:
    content = f.read()

lines = "\n".join(l for l in content.split("\n") if l.startswith("[轮感") or l.startswith("#") or l.startswith("**"))

task = f"""你是轮感质检员。检查以下轮感——是否有：
1. 事实记录（今天发生了什么）
2. 感受记录（主AI的情绪/反思）
3. 行动记录（留给明天的自己）

只输出一行纯JSON：{{"pass": true/false, "reason": "缺什么"}}

轮感内容：
{lines[:2000]}
"""

payload = json.dumps({"task": task, "model": model, "timeout": 25}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:18888/api/exec-subagent",
    data=payload, headers={"Content-Type": "application/json"}
)

try:
    r = urllib.request.urlopen(req, timeout=30)
    d = json.loads(r.read())
    raw = d.get("content", "{}").strip()
    # Clean non-JSON formatting
    clean = raw.replace("'", '"')
    m = re.search(r'\{[^}]+\}', clean)
    if m:
        j = json.loads(m.group())
        passed = j.get("pass", False)
        reason = j.get("reason", "未知")
    else:
        passed, reason = False, "质检返回格式异常"
except Exception as e:
    passed, reason = False, f"质检调用失败: {str(e)[:50]}"

with open(PULSE_LOG, "a") as f:
    if passed:
        f.write(f"[{NOW}] ✅ 轮感质检 [{model}]：通过\n")
    else:
        f.write(f"[{NOW}] ⚠️ 轮感质检 [{model}] 未通过：{reason}\n")
        with open(MEM_FILE, "a") as mf:
            mf.write(f"\n⚠️ [质检警告 {NOW}] {reason}\n")
