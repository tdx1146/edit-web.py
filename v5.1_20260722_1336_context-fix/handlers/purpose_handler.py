"""
purpose_handler.py — 目的树数据接口
返回 Agent OS 的终极目的和当前阶段目的。
"""

import os
import re

PURPOSE_PATH = "/vol1/@team/qh团队/QH/AI专用/Agent OS/kernel/PURPOSE.md"
VERSION_PATH = "/vol1/@team/qh团队/QH/AI专用/Agent OS/kernel/VERSION"


def get_purpose_data():
    """读取 PURPOSE.md 并解析为结构化数据"""
    data = {
        "version": "unknown",
        "ultimate_goal": "",
        "current_goal": "",
        "goals": [],
        "boundaries": "",
    }

    # 读取版本号
    try:
        if os.path.exists(VERSION_PATH):
            with open(VERSION_PATH, encoding="utf-8") as f:
                data["version"] = f.read().strip()
    except Exception:
        pass

    # 读取 PURPOSE.md
    try:
        if not os.path.exists(PURPOSE_PATH):
            data["error"] = "PURPOSE.md not found"
            return data

        with open(PURPOSE_PATH, encoding="utf-8") as f:
            content = f.read()

        # 提取 Ultimate Goal
        ug_match = re.search(
            r"## 终极目的（不变层）\n\n(.+?)(?:\n\n|\Z)", content, re.DOTALL
        )
        if ug_match:
            data["ultimate_goal"] = ug_match.group(1).strip()

        # 提取 Current Goal (阶段目的)
        cg_match = re.search(
            r"## 阶段目的（可变层）\n\n(.+?)(?:\n\n##|\Z)", content, re.DOTALL
        )
        if cg_match:
            text = cg_match.group(1).strip()
            data["current_goal"] = text
            # 提取子目标列表（仅匹配行首的数字序号，避免 v1.0 误匹配）
            items = []
            for line in text.split('\n'):
                line = line.strip()
                m = re.match(r'^\d+\.\s+(.+)', line)
                if m:
                    items.append(m.group(1).strip())
            data["goals"] = items

        # 提取边界条件
        bc_match = re.search(
            r"## 边界条件（何时修改目的）\n\n(.+?)(?:\Z)", content, re.DOTALL
        )
        if bc_match:
            data["boundaries"] = bc_match.group(1).strip()

    except Exception as e:
        data["error"] = str(e)

    return data
