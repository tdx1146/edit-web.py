#!/usr/bin/env python3
"""
编辑器sessions目录清理脚本

功能：
1. 删除trajectory文件（子代理运行轨迹）
2. 删除不在sessions.json中的孤儿session文件

运行频率：每天凌晨3点
"""

import os
import json
import glob
import time
from datetime import datetime

DATA_DIR = "/vol1/@apphome/trim.openclaw/data/home/.openclaw/agents/main/sessions"
LOG_FILE = "/vol2/1000/AI专用/所有自动化/轻如烟/logs/session-cleanup.log"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except:
        pass

def main():
    log("=== 开始清理 ===")
    
    # 1. 统计trajectory文件
    trajectory_files = glob.glob(os.path.join(DATA_DIR, "*.trajectory.jsonl"))
    trajectory_size = sum(os.path.getsize(f) for f in trajectory_files)
    log(f"trajectory文件: {len(trajectory_files)}个, {trajectory_size/1024/1024:.1f}MB")
    
    # 2. 统计孤儿session文件
    store_file = os.path.join(DATA_DIR, "sessions.json")
    registered = set()
    if os.path.exists(store_file):
        with open(store_file) as f:
            store = json.load(f)
        for k, v in store.items():
            sf = v.get("sessionFile", "")
            if sf:
                registered.add(os.path.basename(sf))
    
    all_jsonl = glob.glob(os.path.join(DATA_DIR, "*.jsonl"))
    orphan_files = []
    orphan_size = 0
    for fp in all_jsonl:
        basename = os.path.basename(fp)
        if ".trajectory." in basename or ".checkpoint." in basename:
            continue
        if basename not in registered:
            # 安全检查：只删除超过24小时的孤儿文件（避免删除正在写入的）
            mtime = os.path.getmtime(fp)
            age_hours = (time.time() - mtime) / 3600
            if age_hours > 24:
                orphan_files.append(fp)
                orphan_size += os.path.getsize(fp)
    
    log(f"孤儿session文件: {len(orphan_files)}个, {orphan_size/1024/1024:.1f}MB")
    
    # 3. 删除trajectory
    deleted_traj = 0
    for f in trajectory_files:
        try:
            os.unlink(f)
            deleted_traj += 1
        except Exception as e:
            log(f"  删除失败 {f}: {e}")
    log(f"删除trajectory: {deleted_traj}个")
    
    # 4. 删除孤儿session
    deleted_orphan = 0
    for f in orphan_files:
        try:
            os.unlink(f)
            deleted_orphan += 1
        except Exception as e:
            log(f"  删除失败 {f}: {e}")
    log(f"删除孤儿session: {deleted_orphan}个")
    
    # 5. 统计剩余文件
    remaining = glob.glob(os.path.join(DATA_DIR, "*.jsonl"))
    log(f"剩余文件: {len(remaining)}个")
    
    # 6. 计算释放空间
    freed_mb = (trajectory_size + orphan_size) / 1024 / 1024
    log(f"释放空间: {freed_mb:.1f}MB")
    log("=== 清理完成 ===")
    
    return {
        "trajectory_deleted": deleted_traj,
        "orphan_deleted": deleted_orphan,
        "freed_mb": freed_mb,
        "remaining_files": len(remaining)
    }

if __name__ == "__main__":
    result = main()
    print(json.dumps(result, indent=2))