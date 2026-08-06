#!/usr/bin/env python3
"""
消化循环状态查询
"""
import os
import json
import datetime
import glob

def get_status(light_smoke_dir):
    """返回当前消化状态摘要 + 摸摸候选"""
    result = {
        "last_digest": None,
        "candidates": [],
        "candidate_count": 0,
        "assertion_count": 0,
        "has_conflicts": False
    }
    
    mem_dir = os.path.join(light_smoke_dir, "memory")
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    log_path = os.path.join(mem_dir, f"{today}.md")
    try:
        with open(log_path, encoding='utf-8') as f:
            lines = f.readlines()
        for line in reversed(lines):
            if "消化" in line and "扫描" in line:
                result["last_digest"] = line.strip()
                break
    except:
        pass
    
    cand_path = os.path.join(mem_dir, "摸摸候选.json")
    try:
        with open(cand_path, encoding='utf-8') as f:
            result["candidates"] = json.load(f)
        result["candidate_count"] = len(result["candidates"])
        result["has_conflicts"] = any(c.get("type") == "conflict" for c in result["candidates"])
    except:
        pass
    
    facts_path = os.path.join(light_smoke_dir, "memory", "facts.dict.md")
    try:
        with open(facts_path, encoding='utf-8') as f:
            text = f.read()
        result["assertion_count"] = sum(1 for l in text.split('\n') if '✅' in l or '⏳' in l or '❌' in l)
    except:
        pass
    
    return result


def get_skill_status(light_smoke_dir, plugin_health_func=None):
    """监控栏状态 - 只返回真数据"""
    result = {
        "last_digest_time": None,
        "pending_assertions": 0,
        "total_assertions": 0,
        "skill_count": 0,
        "plugin_ok": False,
        "plugin_last": None,
    }
    
    mem_dir = os.path.join(light_smoke_dir, "memory")
    
    # 最近有效消化时间
    digest_out = "/tmp/digestion-last-output.txt"
    try:
        with open(digest_out) as f:
            first = f.readline().strip()
            if first:
                result["last_digest_time"] = first.lstrip("# ").strip()
    except:
        pass
    
    # 下次消化时间
    CRON_JSON = "/vol1/@apphome/trim.openclaw/data/home/.openclaw/cron/jobs.json"
    try:
        with open(CRON_JSON) as f:
            cron_cfg = json.load(f)
        for j in cron_cfg.get("jobs", []):
            if "消化" in j.get("name", ""):
                next_ms = j.get("state", {}).get("nextRunAtMs")
                if next_ms:
                    next_dt = datetime.datetime.fromtimestamp(next_ms / 1000)
                    result["next_digest_time"] = next_dt.strftime("%Y-%m-%d %H:%M")
                break
    except:
        pass
    
    # 断言计数
    facts_path = os.path.join(mem_dir, "facts.dict.md")
    try:
        with open(facts_path, encoding='utf-8') as f:
            text = f.read()
        lines = text.split('\n')
        total = 0
        pending = 0
        for l in lines:
            if '|' in l and ('✅' in l or '⏳' in l):
                total += 1
                if '⏳' in l:
                    pending += 1
        result["total_assertions"] = total
        result["pending_assertions"] = pending
    except:
        pass
    
    # 插件健康
    if plugin_health_func:
        try:
            pk, pl = plugin_health_func()
            result["plugin_ok"] = pk
            result["plugin_last"] = pl
        except:
            pass
    
    # skill 数量
    pi_skills = set(os.path.basename(os.path.dirname(p))
                   for p in glob.glob(os.path.expanduser("~/.pi/agent/skills/*/SKILL.md")))
    ws_skills = set(os.path.basename(os.path.dirname(p))
                    for p in glob.glob("/vol1/@apphome/trim.openclaw/data/workspace/skills/*/SKILL.md"))
    result["skill_count"] = len(pi_skills | ws_skills)
    
    return result


def get_history(light_smoke_dir, max_entries=10):
    """返回最近消化循环历史"""
    history_path = os.path.join(light_smoke_dir, 'memory', 'digest-history.jsonl')
    CRON_RUNS = "/vol1/@apphome/trim.openclaw/data/home/.openclaw/cron/runs/66e8fb9b-cbc6-4fd8-a62f-da4754cb8965.jsonl"
    entries = []
    
    try:
        with open(history_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line: continue
                try:
                    d = json.loads(line)
                    entries.append(d)
                except: continue
    except:
        pass
    
    if len(entries) < 5:
        cron_paths = [CRON_RUNS, CRON_RUNS + ".migrated"]
        for cron_path in cron_paths:
            try:
                with open(cron_path, encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if not line: continue
                        try:
                            d = json.loads(line)
                            action = d.get("action", "")
                            if action != "finished": continue
                            entries.append({
                                "ts": d.get("ts", 0),
                                "status": d.get("status", "ok"),
                                "summary": (d.get("summary", "") or "")[:120],
                            })
                        except: continue
                if len(entries) >= 5:
                    break
            except:
                pass
    
    return entries[-max_entries:]