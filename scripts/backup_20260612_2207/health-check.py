#!/usr/bin/env python3
"""🌫️ 轻如烟系统健康巡检 — 每天 06:00 / 21:00 运行
检查：备份新鲜度、文档更新、文件完整性、系统存活"""
import os, json, urllib.request, subprocess
from datetime import datetime, timedelta

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECOVER_DIR = os.path.join(os.path.dirname(BASE), "找回自己")
BACKUPS_DIR = os.path.join(os.path.dirname(BASE), "backups")
PULSE_LOG = os.path.join(BASE, "memory", "pulse.log")
MEM_FILE = os.path.join(BASE, "memory", datetime.now().strftime("%Y-%m-%d") + ".md")
WARNINGS = []
NOW = datetime.now().strftime("%Y-%m-%d %H:%M")

def warn(msg):
    WARNINGS.append(msg)
    print(f"⚠️ {msg}")

# 1. 检查服务器是否在跑
try:
    r = urllib.request.urlopen("http://127.0.0.1:18888/api/status", timeout=5)
    status = json.loads(r.read())
    print(f"✅ 编辑器 :18888 在线")
except Exception as e:
    warn(f"编辑器 :18888 离线：{str(e)[:40]}")

# 2. 检查最近备份
backup_files = []
for root, dirs, files in os.walk(RECOVER_DIR):
    for f in files:
        if f.endswith((".md", ".py", ".mjs", ".sh")):
            path = os.path.join(root, f)
            mtime = datetime.fromtimestamp(os.path.getmtime(path))
            backup_files.append((mtime, f))

backup_files.sort(reverse=True)
newest_backup = backup_files[0][0] if backup_files else None
if newest_backup:
    age = datetime.now() - newest_backup
    if age > timedelta(days=2):
        warn(f"找回自己/ 最新备份已是 {age.days} 天前！")
    else:
        print(f"✅ 找回自己/ 最新：{age.total_seconds()/3600:.0f}小时前")
else:
    warn("找回自己/ 目录为空！")

# 3. 检查轮感文件是否存活
if os.path.exists(MEM_FILE):
    with open(MEM_FILE) as f:
        content = f.read()
    if len(content.strip()) < 50:
        warn(f"今日轮感文件 ({os.path.basename(MEM_FILE)}) 内容过少")
    else:
        lines = [l for l in content.split("\n") if l.strip()]
        print(f"✅ 今日轮感：{len(lines)}行")
else:
    warn("今日轮感文件不存在！")

# 4. 检查关键文件是否完整
critical = [
    ("SOUL.md", BASE),
    ("IDENTITY.md", BASE),
    ("USER.md", BASE),
    ("MEMORY.md", BASE),
    ("AGENTS.md", BASE),
    ("TOOLS.md", BASE),
    ("scripts/edit-web.py", BASE),
    ("scripts/inject-helper.mjs", BASE),
    ("memory/facts.dict.md", BASE),
    ("memory/pulse.log", BASE),
]
missing = []
for name, base in critical:
    path = os.path.join(base, name)
    if not os.path.exists(path):
        missing.append(name)
        warn(f"关键文件缺失：{name}")
if not missing:
    print(f"✅ 关键文件：{len(critical)}个完整")

# 5. 检查 找回自己/ 同步状态
sync_issues = []
for name in ["MEMORY.md", "TOOLS.md", "AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md"]:
    live = os.path.join(BASE, name)
    backup = os.path.join(RECOVER_DIR, name)
    if os.path.exists(live) and os.path.exists(backup):
        live_mtime = os.path.getmtime(live)
        backup_mtime = os.path.getmtime(backup)
        if live_mtime > backup_mtime + 3600:  # 超过1小时不同步
            sync_issues.append(name)
if sync_issues:
    warn(f"找回自己/ 未同步：{', '.join(sync_issues)}，请手动 cp")
else:
    print("✅ 找回自己/ 与轻如烟/ 同步状态正常")

# 6. 记录到 pulse.log
with open(PULSE_LOG, "a") as f:
    f.write(f"[{NOW}] 🌫️ 健康巡检：{'✅ 全部正常' if not WARNINGS else f'⚠️ {len(WARNINGS)}项异常'}\n")
    for w in WARNINGS:
        f.write(f"  {w}\n")

# 7. 如果有严重警告，注入到轮感文件
if WARNINGS:
    with open(MEM_FILE, "a") as f:
        f.write(f"\n⚠️ [健康巡检 {NOW}] {len(WARNINGS)}项异常：\n")
        for w in WARNINGS:
            f.write(f"  • {w}\n")

print(f"\n巡检完成：{len(WARNINGS)}项警告")
