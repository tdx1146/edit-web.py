#!/usr/bin/env python3
"""
会话文件读写
"""
import json, os, time, shutil

def discover_session_dir(openclaw_home):
    agents_dir = os.path.join(openclaw_home, "agents")
    if not os.path.exists(agents_dir):
        return None
    for entry in os.listdir(agents_dir):
        sessions_path = os.path.join(agents_dir, entry, "sessions")
        if os.path.isdir(sessions_path):
            return sessions_path
    return None

def get_session_info(data_dir):
    sessions_file = os.path.join(data_dir, "sessions.json")
    if not os.path.exists(sessions_file):
        return {"ok": False, "error": "no sessions.json"}
    with open(sessions_file) as f:
        store = json.load(f)
    main = store.get("agent:main:main")
    if main:
        return {"ok": True, "sessionKey": "agent:main:main", "sessionFile": main}
    for k, v in store.items():
        if v:
            return {"ok": True, "sessionKey": k, "sessionFile": v}
    return {"ok": False, "error": "no active session"}

def read_session(session_file, max_messages=200):
    messages = []
    if not os.path.exists(session_file):
        return messages
    with open(session_file, "r") as f:
        total_lines = sum(1 for _ in f)
        need_tail = total_lines > max_messages * 2
        tail_n = max_messages * 3 if need_tail else 0
    with open(session_file, "r") as f:
        if need_tail:
            pos = 0
            lines = []
            f.seek(0, 2)
            file_size = f.tell()
            chunk = 4096
            pos = file_size
            while pos > 0 and len(lines) < tail_n:
                read_size = min(chunk, pos)
                pos -= read_size
                f.seek(pos)
                buf = f.read(read_size)
                parts = buf.split("\n")
                if pos > 0:
                    buf = parts[0]
                    lines = parts[1:] + lines
                else:
                    lines = parts + lines
            lines = [l for l in lines if l][-tail_n:]
        else:
            lines = [l for l in f if l.strip()]
    for line in lines:
        try:
            entry = json.loads(line)
        except:
            continue
        msg = entry.get("message", {})
        if msg.get("role") and msg.get("content"):
            msg["_raw_entry"] = entry
            messages.append(msg)
    return messages

def group_into_pairs(messages):
    pairs = []
    current_user = None
    current_assistants = []
    for msg in messages:
        role = msg.get("role")
        if role == "user":
            if current_user:
                pairs.append({"user": current_user, "assistants": current_assistants})
                current_assistants = []
            current_user = msg
        elif role == "assistant":
            current_assistants.append(msg)
    if current_user:
        pairs.append({"user": current_user, "assistants": current_assistants})
    return pairs

def edit_message(session_file, user_index, new_text, backup_dir):
    backup_path = None
    try:
        os.makedirs(backup_dir, exist_ok=True)
        stamp = time.strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(backup_dir, f"pre-edit.{stamp}.jsonl")
        shutil.copy2(session_file, backup_path)
    except:
        pass
    with open(session_file, "r") as f:
        lines = f.readlines()
    target_idx = -1
    for i, line in enumerate(lines):
        try:
            entry = json.loads(line)
        except:
            continue
        msg = entry.get("message", {})
        if msg.get("role") == "user":
            target_idx += 1
            if target_idx == user_index:
                entry["message"]["content"] = new_text
                lines[i] = json.dumps(entry, ensure_ascii=False) + "\n"
                with open(session_file, "w") as f:
                    f.writelines(lines)
                return {"ok": True, "message": "已修改", "backup": backup_path}
    return {"ok": False, "error": "未找到目标消息", "backup": backup_path}
