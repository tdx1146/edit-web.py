"""snapshot_handler.py — 版本快照监控接口"""
import os, json

SNAPSHOTS_DIR = "/vol1/@team/qh团队/QH/AI专用/Agent OS/kernel/snapshots"
VERSION_FILE = "/vol1/@team/qh团队/QH/AI专用/Agent OS/kernel/VERSION"

def get_snapshot_data():
    data = {"total": 0, "latest": "", "version": "", "latest_trigger": "", "list": []}
    try:
        if os.path.exists(VERSION_FILE):
            with open(VERSION_FILE) as f:
                data["version"] = f.read().strip()
        if os.path.exists(SNAPSHOTS_DIR):
            snapshots = sorted(
                [d for d in os.listdir(SNAPSHOTS_DIR) if d.startswith("snapshot_")],
                reverse=True
            )
            data["total"] = len(snapshots)
            if snapshots:
                data["latest"] = snapshots[0]
                mf = os.path.join(SNAPSHOTS_DIR, snapshots[0], "manifest.json")
                if os.path.exists(mf):
                    with open(mf) as f:
                        m = json.load(f)
                    data["latest_trigger"] = m.get("trigger", "")
                # 取最近20条快照详情
                for s in snapshots[:20]:
                    entry = {"id": s, "version": data["version"], "trigger": "", "time": ""}
                    sm = os.path.join(SNAPSHOTS_DIR, s, "manifest.json")
                    if os.path.exists(sm):
                        try:
                            with open(sm) as f:
                                m = json.load(f)
                            entry["version"] = m.get("version", data["version"])
                            entry["trigger"] = m.get("trigger", "")
                            entry["time"] = m.get("created_at", "")[:19]
                        except: pass
                    data["list"].append(entry)
    except: pass
    return data
