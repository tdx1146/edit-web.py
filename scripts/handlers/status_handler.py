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
    
        # 检查调度器 — 从 PID 文件读取（比 pgrep 可靠）
    sch_pid_file = "/vol1/@team/qh团队/QH/AI专用/Agent OS/iso-sand/data/scheduler.pid"
    try:
        if os.path.exists(sch_pid_file):
            with open(sch_pid_file) as f:
                pid = f.read().strip()
            if pid:
                # kill -0 检查进程存活
                try:
                    os.kill(int(pid), 0)
                    data["scheduler"]["running"] = True
                    data["scheduler"]["pid"] = pid
                except OSError:
                    pass
    except: pass
    return data
