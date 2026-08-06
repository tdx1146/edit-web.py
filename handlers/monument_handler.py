"""
monument_handler.py — 丰碑库数据接口
返回丰碑库的条目列表和统计。
"""
import os
import re

MONUMENT_INDEX = "/vol2/1000/AI专用/Agent OS/monument/INDEX.md"

def get_monument_data():
    """读取 INDEX.md 返回丰碑列表和统计"""
    data = {
        "total": 0,
        "entries": [],
        "lineage": ""
    }
    try:
        if not os.path.exists(MONUMENT_INDEX):
            data["error"] = "INDEX.md not found"
            return data
        
        with open(MONUMENT_INDEX, encoding="utf-8") as f:
            content = f.read()
        
        # 提取谱系
        lineage_match = re.search(r'## 传承谱系\n\n(.+?)(?:\n\n##|\Z)', content, re.DOTALL)
        if lineage_match:
            data["lineage"] = lineage_match.group(1).strip()
        
        # 提取丰碑条目（表格行）
        # 匹配 | xxx | date | entity | trigger | status |
        rows = re.findall(r'\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|', content)
        for row in rows:
            version = row[0].strip()
            # 跳过表头行
            if version in ("版本", "---", ""):
                continue
            entry = {
                "version": version,
                "time": row[1].strip(),
                "entity": row[2].strip(),
                "trigger": row[3].strip(),
                "status": row[4].strip()
            }
            data["entries"].append(entry)
        
        data["total"] = len(data["entries"])
        data["entries"] = data["entries"][:10]
        
    except Exception as e:
        data["error"] = str(e)
    
    return data
