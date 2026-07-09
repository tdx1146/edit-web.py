"""
status_handler.py — 系统守护进程状态接口
返回玄鉴和调度器的运行状态。
"""
import os
import subprocess

def get_system_status():
    """检查玄鉴和调度器进程是否存活"""
    data = {
        "zanjian": {"running": False, "pid": None},
        "scheduler": {"running": False, "pid": None}
    }
    
    # 检查玄鉴 verify_daemon.py
    try:
        result = subprocess.run(
            ["pgrep", "-f", "verify_daemon.py"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            pids = result.stdout.strip().split()
            data["zanjian"]["running"] = True
            data["zanjian"]["pid"] = pids[0] if pids else None
    except: pass
    
    # 检查调度器 task_scheduler.py
    try:
        result = subprocess.run(
            ["pgrep", "-f", "task_scheduler.py"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            pids = result.stdout.strip().split()
            # 排除 pgrep 命令自身
            pids = [p for p in pids if p != str(os.getpid())]
            data["scheduler"]["running"] = True
            data["scheduler"]["pid"] = pids[0] if pids else None
    except: pass
    
    return data
