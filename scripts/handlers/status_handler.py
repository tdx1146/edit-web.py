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
    # ⚠️ 元凶修复 2026-07-16: pgrep 模式必须匹配真实进程 cmdline
    # 调度器从 iso-sand/ 目录启动: `python3 src/task_scheduler.py`
    # 也可能从别的路径启动，使用最终文件名匹配而非完整路径
    try:
        result = subprocess.run(
            ["pgrep", "-f", "task_scheduler.py"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            pids = [p for p in result.stdout.strip().split() if p.strip()]
            # 排除 pgrep 自身（自身 PID 不可能出现在 pgrep 输出，但排除 Shell 进程）
            pids = [p for p in pids if p != str(os.getpid())]
            # 进一步验证：确保这些 PID 确实指向一个 Python 进程
            valid_pids = []
            for pid in pids:
                try:
                    cmdline = open(f'/proc/{pid}/cmdline', 'r').read().replace('\x00', ' ')
                    if 'python' in cmdline and 'task_scheduler' in cmdline:
                        valid_pids.append(pid)
                except: pass
            data["scheduler"]["running"] = len(valid_pids) > 0
            data["scheduler"]["pid"] = valid_pids[0] if valid_pids else None
    except: pass
    
    return data
