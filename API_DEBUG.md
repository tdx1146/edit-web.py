# 轻如烟编辑器 API 数据加载故障排查报告

## 1. 现象

- ✅ 编辑器框架正常渲染（标题显示"轻如烟姐姐 对话编辑器 v2026-06-25"）
- ❌ 页面内容区域显示"加载中..."，没有对话数据
- ❌ `/api/status`、`/api/session`、`/api/list-sessions` 等 API 均返回**空回复**（`Empty reply from server`）

## 2. 排查步骤与结果

### 步骤1：直接测试 API 端点

```bash
# 首页 — ✅ 正常
curl -s http://127.0.0.1:18888/ | head -3
# → <!DOCTYPE html><html lang="zh-CN">...

# /api/status — ❌ Empty reply from server
curl -s http://127.0.0.1:18888/api/status
# → 无输出（连接中断）

# /api/session — ❌ Empty reply from server
curl -s 'http://127.0.0.1:18888/api/session?fresh=1'
# → 无输出（连接中断）
```

### 步骤2：检查服务器日志

旧进程的 stderr 被重定向到 `/dev/null`，无法查看实时错误。重启进程到前台后捕获到关键异常：

```
Exception occurred during processing of request
  File "handlers/system_handler.py", line 17, in handle_usage_status
    ss_path = os.path.join(DATA_DIR, "sessions.json")
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
TypeError: expected str, bytes or os.PathLike object, not NoneType
```

```
Exception occurred during processing of request
  File "handlers/session_handler.py", line 20, in handle_get_session_data
    sk, session_file = get_session_info()
                       ^^^^^^^^^^^^^^^^^^
TypeError: 'NoneType' object is not callable
```

### 步骤3：检查 handler 运行时错误

通过 `g()` 调用链分析确认**根因**：

1. `edit-web.py` 中只有 `_router._M` 被设置（第1723行）
2. 但每个 handler 模块有自己的 `_M` 变量和自己的 `g()` 函数
3. 这些 handler 的 `_M` 从未被设置为 edit-web 模块
4. 导致 `g('DATA_DIR')` → None，`g('get_session_info')` → None

**所有 handler 模块都有独立的 `_M`/`g()` 机制：**

| 模块文件 | g() 调用的关键名称 |
|---------|-----------------|
| `system_handler.py` | `DATA_DIR`, `INJECT_LOCK_DIR`, `LIGHT_SMOKE_DIR`, `OPENCLAW_HOME`, `SCRIPT_DIR`, `get_session_info` |
| `session_handler.py` | `DATA_DIR`, `BACKUP_DIR`, `GATEWAY_PORT`, `LIGHT_SMOKE_DIR`, `SCRIPT_DIR`, `get_session_info`, `read_session`, `group_into_pairs` |
| `inject_handler.py` | `GATEWAY_PORT`, `GATEWAY_TOKEN`, `OPENCLAW_HOME`, `_cleanup_lock`, `edit_message`, `get_session_info` |
| `crypto_handler.py` | `BROWSE_ROOT`, `PASSWORD_VAULT`, `_encrypt_file`, `_get_encrypt_folder` |
| `file_handler.py` | `BROWSE_ROOT`, `LIGHT_SMOKE_DIR`, `SAVE_MONITOR_DIR`, `save_file`, `log_file_change` 等 |
| `helper_handler.py` | `LIGHT_SMOKE_DIR`, `_load_reminders`, `_secretary_remind` |
| `awake_handler.py` | `get_session_info`, `inject_via_websocket` |
| `momo_handler.py` | `LIGHT_SMOKE_DIR`, `_momo_pack`, `_momo_status`, `_promote_pending_assertions` |

### 步骤4：router.py g() 函数交叉检查

```python
# router.py 中的 g() 调用（全部通过 router._M 查找）
g('LIGHT_SMOKE_DIR')      → edit-web.py ✓（模块变量）
g('_THIS_DIR')            → edit-web.py ✓（模块变量）
g('_get_html_page')       → edit-web.py ✓（函数）
g('_system_health')       → edit-web.py ✓（函数）
g('get_active_session_key') → edit-web.py ✓（函数）
g('set_active_session_key') → edit-web.py ✓（函数）
g('list_all_sessions')    → edit-web.py ✓（函数）
```

以上全存在，router.py 本身没有缺失。但 handler 模块使用自己的 `g()`，不走 router.py 的 `_M`。

## 3. 根因分析

**根本原因：** 2026-06-25 新创建的 `handlers/` 包中各模块均有独立的 `_M = None` 和 `g()` 函数，而底层的 `edit-web.py` 只在导入 `router.py` 后设置了 `_router._M`，没有设置各 handler 模块自身的 `_M`。

当 handler 模块中的函数（如 `handle_usage_status`）被调用时，它通过本模块的 `g('DATA_DIR')` 查找 edit-web 模块变量，但 `handler_module._M` 为 `None` → `g()` 返回 `None` → `os.path.join(None, "sessions.json")` 抛出 `TypeError` → 异常传播到 `do_GET()` → HTTP server 无法完成回复 → 连接断开（Empty reply from server）。

**为什么静态页面能加载？**
- `/` 路由直接从 `router.py` 调用 `g('_get_html_page')`，而 `router._M` 被正确设置 → 成功
- `/api/status` 在 `system_handler.py` 中，走 `system_handler._M` → 失败

## 4. 修复方案

### 核心修复：设置所有 handler 模块的 `_M`

**文件：** `edit-web.py`，第1721-1723行

**修改前（3行）：**
```python
from handlers import router as _router
import sys as _sys
_router._M = _sys.modules[__name__]
```

**修改后（11行）：**
```python
from handlers import router as _router
from handlers import system_handler, session_handler, inject_handler
from handlers import crypto_handler, file_handler, helper_handler
from handlers import awake_handler, momo_handler
import sys as _sys
_mod = _sys.modules[__name__]
_router._M = _mod
for _hmod in (system_handler, session_handler, inject_handler,
              crypto_handler, file_handler, helper_handler,
              awake_handler, momo_handler):
    _hmod._M = _mod
```

### 辅助修复：为 do_GET/do_POST 添加 try/except 保护

**文件：** `edit-web.py`，Handler 类的 `do_GET` 和 `do_POST` 方法

**修改前：**
```python
def do_GET(self):
    _router.get(self)
```

**修改后：**
```python
def do_GET(self):
    try:
        _router.get(self)
    except Exception as _e:
        import traceback as _tb
        traceback.print_exc(file=sys.stderr)
        self._send_json(500, {"ok": False, "error": repr(_e)})
```

（`do_POST` 同样的改动）

这样任何未捕获的错误都会返回 JSON 错误信息，而非空回复。

## 5. 修复后验证

在修复并重启服务器后，所有 API 端点恢复正常：

```bash
# /api/status → ✅ 返回 token 用量数据（174801 total, 17%）
curl -s http://127.0.0.1:18888/api/status
# → {"ok": true, "totalTokens": 174801, "contextTokens": 1000000, ...}

# /api/session?fresh=1 → ✅ 返回 356 条消息，18 轮对话
curl -s 'http://127.0.0.1:18888/api/session?fresh=1'
# → {"sessionKey": "agent:main:main", "messageCount": 356, "pairs": [...], ...}

# /api/list-sessions → ✅ 返回会话列表
curl -s http://127.0.0.1:18888/api/list-sessions
# → [{"sessionKey": "agent:main:main", ...}, ...]
```

## 6. 经验教训

1. **`_M` 传播模式**：handler 模块使用独立的 `_M`/`g()` 机制访问主模块，需要在入口处为所有模块设置。
2. **异常安全性**：HTTP 处理函数应当始终包裹 `try/except`，否则异常会导致空响应，难以排查。
3. **新旧文件共存**：`handlers/` 目录下的文件是今日新创建的，与 edit-web.py 中的旧有逻辑需要同步适配。
