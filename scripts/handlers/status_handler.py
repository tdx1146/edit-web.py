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
    
    # 检查调度器 task_scheduler.py（排除 pgrep 自身和子进程）
    try:
        # 用更精确的模式避免匹配到 pgrep 自身
        result = subprocess.run(
            ["pgrep", "-f", "python3.*src/task_scheduler"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            pids = [p for p in result.stdout.strip().split() if p.strip()]
            pids = [p for p in pids if p != str(os.getpid())]
            data["scheduler"]["running"] = len(pids) > 0
            data["scheduler"]["pid"] = pids[0] if pids else None
    except: pass
    
    return data
