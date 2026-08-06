"""
进程锁模块：基于 Linux flock 的原子 PID 文件锁

用途：防止同一服务被重复启动

使用示例：
    from utils.process_lock import ProcessLock

    lock = ProcessLock('/tmp/my-service.pid.lock')
    if not lock.acquire():
        print("已有实例运行，退出")
        sys.exit(0)
    # ... 正常启动逻辑 ...
"""

import os
import fcntl
import atexit


class ProcessLock:
    """基于 flock 的原子进程锁"""

    def __init__(self, lock_file: str):
        """
        初始化锁

        Args:
            lock_file: 锁文件路径（建议用 .lock 后缀，区别于普通 PID 文件）
        """
        self.lock_file = lock_file
        self.fd = None

    def acquire(self) -> bool:
        """
        尝试获取锁（原子操作）

        Returns:
            True  = 成功获取锁，可以继续启动
            False = 已有实例持有锁，应该退出
        """
        # 确保目录存在
        lock_dir = os.path.dirname(self.lock_file)
        if lock_dir and not os.path.exists(lock_dir):
            os.makedirs(lock_dir, mode=0o755, exist_ok=True)

        # 打开/创建锁文件
        try:
            self.fd = os.open(self.lock_file, os.O_CREAT | os.O_RDWR, 0o644)
        except OSError as e:
            print(f"[ProcessLock] 无法创建锁文件 {self.lock_file}: {e}")
            return False

        # 尝试获取排他锁（非阻塞）
        try:
            fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (IOError, OSError):
            # 锁被占用 = 已有实例运行
            os.close(self.fd)
            self.fd = None
            return False

        # 成功获取锁，写入当前 PID
        try:
            os.ftruncate(self.fd, 0)
            os.lseek(self.fd, 0, os.SEEK_SET)
            os.write(self.fd, f"{os.getpid()}\n".encode())
        except OSError:
            pass  # 写入失败不影响锁的有效性

        # 注册退出时的清理
        atexit.register(self.release)

        return True

    def release(self):
        """释放锁（进程退出时自动调用）"""
        if self.fd is not None:
            try:
                fcntl.flock(self.fd, fcntl.LOCK_UN)
                os.close(self.fd)
            except (IOError, OSError):
                pass
            self.fd = None

            # 删除锁文件（可选，不删也没关系）
            try:
                os.remove(self.lock_file)
            except OSError:
                pass

    def __del__(self):
        """析构时确保释放"""
        if self.fd is not None:
            self.release()
