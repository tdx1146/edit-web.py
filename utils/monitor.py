#!/usr/bin/env python3
"""
监控状态查询函数
"""
import os
from datetime import datetime


def backup_stale_status(light_smoke_dir, momo_dir):
    """检查备份是否过时"""
    stale = False
    stale_files = []
    core_names = ["SOUL.md", "IDENTITY.md", "USER.md", "MEMORY.md", "TOOLS.md", "AGENTS.md"]
    
    for name in core_names:
        src = os.path.join(light_smoke_dir, name)
        bak = os.path.join(momo_dir, name)
        if os.path.exists(src) and os.path.exists(bak):
            if os.path.getmtime(src) > os.path.getmtime(bak):
                stale = True
                stale_files.append(name)
        elif os.path.exists(src) and not os.path.exists(bak):
            stale = True
            stale_files.append(f"{name}(无备份)")
    
    today = datetime.now().strftime("%Y-%m-%d")
    today_mem = os.path.join(light_smoke_dir, "memory", f"{today}.md")
    today_bak = os.path.join(momo_dir, "daily", f"{today}.md")
    if os.path.exists(today_mem) and os.path.exists(today_bak):
        if os.path.getmtime(today_mem) > os.path.getmtime(today_bak):
            stale = True
            stale_files.append(f"memory/{today}.md")
    
    last_pack = "从未"
    if os.path.exists(momo_dir):
        files = [os.path.join(momo_dir, f) for f in os.listdir(momo_dir) 
                 if os.path.isfile(os.path.join(momo_dir, f))]
        if files:
            last_pack_ts = max(os.path.getmtime(f) for f in files)
            last_pack = datetime.fromtimestamp(last_pack_ts).strftime("%m-%d %H:%M")
    
    return {
        "ok": True,
        "stale": stale,
        "stale_files": stale_files,
        "last_pack": last_pack,
        "file_count": len(core_names),
    }


def backlog_status(light_smoke_dir):
    """返回待办清单内容"""
    path = os.path.join(light_smoke_dir, "memory", "backlog.md")
    try:
        with open(path, encoding='utf-8') as f:
            text = f.read()
        lines = [l for l in text.split('\n') if l.strip() and not l.startswith('#')]
        pending = sum(1 for l in lines if '- [ ]' in l)
        return {"ok": True, "content": text, "pending": pending, "total": len(lines)}
    except:
        return {"ok": False, "content": "", "pending": 0, "total": 0}


def weaponry_toggle_status():
    """返回武器库开关状态"""
    toggle_file = "/tmp/weaponry-enabled"
    enabled = os.path.exists(toggle_file)
    return {"ok": True, "enabled": enabled}


def plugin_health_core():
    """检查插件注入是否正常"""
    last_inj = "/tmp/last-injection-body.txt"
    last_key = "/tmp/last-injection-key.txt"
    ok = os.path.exists(last_inj) and os.path.exists(last_key)
    last_kw = ""
    if ok:
        try:
            with open(last_key) as f:
                last_kw = f.read().strip()
        except:
            pass
    return ok, last_kw


def last_processing():
    """返回最近处理时间"""
    try:
        with open("/tmp/last-processing.txt") as f:
            return {"ok": True, "last": f.read().strip()}
    except:
        return {"ok": False, "last": None}


def last_injection():
    """返回最近注入时间"""
    try:
        with open("/tmp/last-injection-time.txt") as f:
            return {"ok": True, "last": f.read().strip()}
    except:
        return {"ok": False, "last": None}


def plugin_health():
    """插件健康状态汇总"""
    ok, last_kw = plugin_health_core()
    return {
        "ok": True,
        "plugin_ok": ok,
        "last_injection": last_kw,
        "note": "插件注入正常" if ok else "插件未触发过注入",
    }


def thinking_status():
    """思考模式状态"""
    import glob
    ws = glob.glob("/vol1/@apphome/trim.openclaw/data/home/.openclaw/agents/main/sessions/*.jsonl")
    if ws:
        try:
            with open(ws[0]) as f:
                last_line = None
                for line in f:
                    last_line = line
                if last_line:
                    import json
                    d = json.loads(last_line)
                    msg = d.get("message", {})
                    model = msg.get("model", "")
                    if "reasoning" in model.lower() or "r1" in model.lower():
                        return {"ok": True, "enabled": True, "model": model}
        except:
            pass
    return {"ok": True, "enabled": False, "model": None}


def system_health(light_smoke_dir):
    """系统健康检查"""
    import glob
    
    mem_dir = os.path.join(light_smoke_dir, "memory")
    today = datetime.now().strftime("%Y-%m-%d")
    today_mem = os.path.join(mem_dir, f"{today}.md")
    
    facts_ok = os.path.exists(os.path.join(mem_dir, "facts.dict.md"))
    tree_ok = os.path.exists(os.path.join(mem_dir, "knowledge-tree.md"))
    today_ok = os.path.exists(today_mem)
    
    pi_skills = glob.glob(os.path.expanduser("~/.pi/agent/skills/*/SKILL.md"))
    ws_skills = glob.glob("/vol1/@apphome/trim.openclaw/data/workspace/skills/*/SKILL.md")
    skill_count = len(pi_skills) + len(ws_skills)
    
    return {
        "ok": True,
        "facts": facts_ok,
        "tree": tree_ok,
        "today_memory": today_ok,
        "skill_count": skill_count,
    }
