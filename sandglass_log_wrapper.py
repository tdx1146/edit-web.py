#!/usr/bin/env python3
"""NexSandglass 落沙封装——给 edit-web.py 调用。

路径原则（2026-08-12 复现保障）：不硬编码本机绝对路径。
  - 优先读环境变量 LIGHT_HOME（Agent OS/env.local 已定义）；
  - 缺省按本文件位置相对推导（wrapper 位于 <LIGHT_HOME>/scripts/）。
两种方式在本机等价，新机器无需改代码。
"""
import sys, os

# <LIGHT_HOME>/scripts/sandglass_log_wrapper.py → LIGHT_HOME = 上上级目录
_LIGHT_HOME = os.environ.get('LIGHT_HOME') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_LIGHT_HOME, 'sandglass_source'))
os.environ.setdefault('NEXSANDBASE_HOME', os.path.join(_LIGHT_HOME, 'sandglass'))

from sandglass_log import log_message
from sandglass_paths import _SANDGLASS, _SHADOW_DB
from sandglass_vault import rebuild_index

def log(content, role='user'):
    """落沙一条"""
    log_message(content, role)
    # 同步影子沙索引
    rebuild_index()
    print(f"✅ 沙漏写入: {content[:50]}...")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python3 sandglass_log_wrapper.py <内容> [role]")
        sys.exit(1)
    content = sys.argv[1]
    role = sys.argv[2] if len(sys.argv) > 2 else 'user'
    log(content, role)
