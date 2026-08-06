"""
event_bus_handler.py — 事件总线桥接层
职责：读取 operation_log.jsonl 中的 【事件】 记录，桥接到编辑器事件队列。
"""

import json
import os
import threading
import time

# 操作日志路径
_OPLOG_PATH = "/vol2/1000/AI专用/Agent OS/iso-sand/data/operation_log.jsonl"
_SEEK_PATH = "/vol2/1000/AI专用/Agent OS/iso-sand/data/event_bus.seek"
_POLL_INTERVAL = 5  # 5秒扫描一次
_EVENT_PREFIX = "【事件】"

# 持有 edit-web.py 的 push_event 引用
_push_event_callback = None


def set_push_event_callback(cb):
    """设置 push_event 回调（由 edit-web.py 启动时注入）"""
    global _push_event_callback
    _push_event_callback = cb


def _read_seek():
    """读取已读取的字节偏移"""
    try:
        if os.path.exists(_SEEK_PATH):
            with open(_SEEK_PATH) as f:
                return int(f.read().strip())
    except Exception:
        pass
    return 0


def _write_seek(pos):
    """持久化读取位置"""
    try:
        os.makedirs(os.path.dirname(_SEEK_PATH), exist_ok=True)
        with open(_SEEK_PATH, "w") as f:
            f.write(str(pos) + "\n")
    except Exception:
        pass


def _poll_loop():
    """后台轮询线程：扫描操作日志新行，提取事件推送到前端"""
    while True:
        try:
            if not os.path.exists(_OPLOG_PATH):
                time.sleep(_POLL_INTERVAL)
                continue

            old_pos = _read_seek()
            current_size = os.path.getsize(_OPLOG_PATH)

            if current_size < old_pos:
                # 文件被轮转或重置，重新开始
                old_pos = 0

            if current_size > old_pos:
                with open(_OPLOG_PATH, "r", encoding="utf-8") as f:
                    f.seek(old_pos)
                    for line in f:
                        line = line.strip()
                        if _EVENT_PREFIX in line:
                            _dispatch_event(line)
                _write_seek(current_size)
        except Exception as e:
            pass  # 静默容错

        time.sleep(_POLL_INTERVAL)


def _dispatch_event(line):
    """解析事件行并推送到前端"""
    if not _push_event_callback:
        return

    # 【事件】格式：evt-xxx | type | producer | summary | timestamp
    try:
        # 提取事件部分（去掉前缀）
        event_part = line.split(_EVENT_PREFIX, 1)[1].strip()
        parts = [p.strip() for p in event_part.split("|")]

        if len(parts) >= 4:
            event_id = parts[0]
            event_type = parts[1]
            producer = parts[2]
            summary = parts[3]

            # 根据事件类型选择通知类型
            notify_type = "info"
            if event_type in ("anomaly", "error", "failure"):
                notify_type = "anomaly"
            elif event_type in ("warning", "warn"):
                notify_type = "warning"
            elif event_type in ("milestone", "success", "snapshot", "release"):
                notify_type = "milestone"

            _push_event_callback(notify_type, f"[{producer}] {summary}")
    except Exception:
        pass


def start_polling():
    """启动后台轮询线程（在独立线程中运行）"""
    thread = threading.Thread(target=_poll_loop, daemon=True, name="event-bus-poll")
    thread.start()
    return thread
