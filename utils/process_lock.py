# utils/process_lock.py — 进程锁（PID 文件实现）
# 纯标准库，只做一件事：防止同一程序重复启动。

import os
import errno


class ProcessLock:
    """基于 PID 文件的进程锁。acquire() 成功返回 True，已有存活实例返回 False。"""

    def __init__(self, path):
        self.path = path
        self._acquired = False

    def acquire(self):
        if os.path.exists(self.path):
            try:
                with open(self.path, 'r') as f:
                    pid = int(f.read().strip())
                if self._pid_alive(pid):
                    return False
            except (ValueError, OSError):
                pass  # 锁文件损坏/无法读取 → 视为过期，覆盖
        tmp = self.path + '.tmp'
        try:
            with open(tmp, 'w') as f:
                f.write(str(os.getpid()))
            os.replace(tmp, self.path)
        except OSError:
            return False
        self._acquired = True
        return True

    def release(self):
        if not self._acquired:
            return
        try:
            with open(self.path, 'r') as f:
                pid = int(f.read().strip())
            if pid == os.getpid():
                os.remove(self.path)
        except (ValueError, OSError):
            pass
        self._acquired = False

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
        return False

    @staticmethod
    def _pid_alive(pid):
        if pid <= 0:
            return False
        try:
            os.kill(pid, 0)
        except OSError as e:
            return False if e.errno == errno.ESRCH else True
        return True
