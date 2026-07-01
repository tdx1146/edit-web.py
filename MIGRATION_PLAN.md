# 轻如烟 Editor 真正分离方案

> 制定日期：2026-06-25  
> 基于：审计报告 (AUDIT_REPORT.md) + 前端审计 (FRONTEND_AUDIT.md) + 版本对比 (VERSION_COMPARISON.md)  
> 目标：将 edit-web.py 剩余的 80+ Handler 类方法真正迁移到 handlers/*.py

---

## 1. 当前架构总览

### 已分离的部分 ✅

| 层 | 模块 | 内容 | 状态 |
|----|------|------|------|
| **路由层** | `handlers/router.py` (150行) | 52+ 条路由分发 (do_GET/do_POST → handler 方法) | **已完成** |
| **工具层** | `utils/momo.py` (222行) | momo_pack, momo_status, momo_index_report, start_momo_auto_save | **已导入使用** |
| **工具层** | `utils/secretary.py` (87行) | 秘书分析/提醒/加载/保存 | **已导入使用** |
| **工具层** | `utils/tb_handler.py` (216行) | 文件浏览/CRUD | **已导入使用** |
| **工具层** | `utils/crypto.py` (55行) | 加解密工具 | **存在但未从 utils 导入** |
| **工具层** | `utils/inject.py` (36行) | WS注入 | **存在但未从 utils 导入** |
| **工具层** | `utils/session.py` (138行) | 会话文件读/写/截断 | **存在但未从 utils 导入** |

### 未分离的部分 ❌

**核心问题：Handler 类的 80+ 方法全部内联在 edit-web.py 中。**

```
edit-web.py (3925行)
├── 模块配置+常量 (约130行)
├── 配置发现系统 (约140行)      ← 可以抽到 utils/config.py
├── 23个模块级函数 (约1900行)   ← 双轨过渡中
│   ├── inject_via_websocket()  ← 双轨: utils/inject.py 也有
│   ├── edit_message()         ← 双轨: utils/session.py 也有
│   ├── _momo_pack/status/report ← 双轨: 已从 utils/momo.py 导入
│   ├── 加密系统               ← 双轨: utils/crypto.py 也有
│   └── ...其他
├── Handler 类 (约1600行)
│   ├── HTTP基础设施 (do_GET/do_POST/_send_json/_serve_static_file)  ≈ 50行
│   ├── 60+ _handle_xxx 方法   ≈ 1300行  ← 核心迁移目标
│   └── 辅助方法               ≈ 250行
└── 入口+服务器类 (约150行)
```

### 空壳 Handler 的问题

7个 handler 文件中有5个**完全为空**（只有 docstring 注释），2个 (momo_handler.py, session_handler.py) 有部分代码但**依赖不存在的 `edit_web_merged` 模块**，无法导入使用。

| 文件 | 状态 | 说明 |
|------|------|------|
| `inject_handler.py` | 🗑️ 空壳 (4行) | 只有注释，无函数体 |
| `crypto_handler.py` | 🗑️ 空壳 (4行) | 只有注释，无函数体 |
| `file_handler.py` | 🗑️ 空壳 (4行) | 只有注释，无函数体 |
| `helper_handler.py` | 🗑️ 空壳 (4行) | 只有注释，无函数体 |
| `system_handler.py` | 🗑️ 空壳 (4行) | 只有注释，无函数体 |
| `momo_handler.py` | ⚠️ 半成品 (14行) | 有 handle_momo 函数但依赖 `edit_web_merged` |
| `session_handler.py` | ⚠️ 半成品 (35行) | 有 7 个函数但依赖 `edit_web_merged` |

---

## 2. 真正分离方案 — 三层架构

```
┌────────────────────────────────────────────────────────────────────┐
│                      Gate 层 — 路由分发                           │
│                                                                     │
│  handlers/router.py (✅ 已就绪，不改动)                             │
│  ├── get(handler)     — 35+ GET 路由                               │
│  ├── post(handler)    — 20+ POST 路由                              │
│  └── 保持 g() 魔术引用模式不变                                      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ 需要改动的部分：router.py 将 handler
                                 │ 方法调用改为调用 handlers/*.py 函数
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Business 层 — 业务处理                            │
│                                                                     │
│  handlers/*_handler.py (将填充如下文件)                             │
│  ├── inject_handler.py   — 注入/编辑/重启/中止/子代理               │
│  ├── session_handler.py  — 会话CRUD/截断/获取/备份                  │
│  ├── crypto_handler.py   — 加解密操作                               │
│  ├── file_handler.py     — 文件浏览/CRUD                            │
│  ├── momo_handler.py     — 摸摸打包/状态/搜索/索引/武器库           │
│  ├── system_handler.py   — 系统状态/缓存/健康/守夜                  │
│  ├── helper_handler.py   — 辅助/工具函数（杂项）                    │
│  └── awake_handler.py    — 守夜题库/发送/脉冲                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ 调用 utils/*.py
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Service 层 — 工具函数                             │
│                                                                     │
│  utils/ (✅ 已分离，不改动结构)                                     │
│  ├── momo.py    — 摸摸打包/状态/索引/存档                          │
│  ├── session.py — 会话读/写/截断                                   │
│  ├── inject.py  — WS注入（内存锁）                                 │
│  ├── crypto.py  — 加解密工具                                       │
│  ├── secretary.py — 秘书提醒/文件变更                              │
│  └── tb_handler.py — 文件系统操作                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Handler 方法迁移路线图（核心部分）

### 3.1 路由分发关系图

当前 router.py 中的每一行路由指向 Handler 方法：

```
router.py (get/post)                           edit-web.py Handler
─────────────────────                           ──────────────────

GET 路由:
/api/status                          → _get_usage_status()
/api/cache-stats                     → _get_cache_stats()
/api/list-sessions                   → g('list_all_sessions')  [模块级]
/api/system-health                   → g('_system_health')     [模块级]
/api/switch-session                  → _get_session_data()
/api/session                         → _get_session_data()
/api/session-rpc                     → _handle_session_rpc()
/api/digestion-status                → g('_digestion_status')  [模块级]
/api/digestion-skill                 → g('_digestion_skill_status') [模块级]
/api/digestion-history               → g('_digestion_history') [模块级]
/api/backlog                         → g('_backlog_status')   [模块级]
/api/backup-stale                    → g('_backup_stale_status')[模块级]
/api/thinking-status                 → g('_thinking_status')  [模块级]
/api/weaponry-toggle-status          → g('_weaponry_toggle_status')[模块级]
/api/plugin-health                   → g('_plugin_health')    [模块级]
/api/last-injection                  → g('_last_injection')   [模块级]
/api/last-processing                 → g('_last_processing')  [模块级]
/api/subagent-history                → g('_get_subagent_history')[模块级]
/api/memory-files                    → _handle_memory_file_list()
/api/memory-file (GET)               → _handle_memory_file_get()
/api/quickcheck                      → _handle_quickcheck()
/api/secretary-log                   → _handle_secretary_log()
/api/facts-stale                     → _handle_facts_stale_check()
/api/reminders                       → _handle_reminders()
/api/backups                         → _list_backups()
/api/subagents                       → _list_subagents()
/api/tb-files*                       → _handle_tb_files()
/api/tb-read-file*                   → _handle_tb_read_file()
/api/tb-save-file*                   → _handle_tb_save_file()
/api/tb-create-file*                 → _handle_tb_create_file()
/api/tb-rename-file*                 → _handle_tb_rename_file()
/api/tb-delete-file*                 → _handle_tb_delete_file()
/api/list-files*                     → _handle_list_files()
/api/browse-dirs*                    → _handle_browse_dirs()
/api/encrypt*                        → _handle_encrypt()
/api/awake-questions/list            → _handle_awake_list()
(根路径) /                           → g('_get_html_page')    [模块级]
/paper-annotated.html                → _serve_static_file()
/static/*                            → _serve_static_file()

POST 路由:
/api/abort                           → _handle_abort()
/api/restart-http                    → _handle_restart_http()
/api/pet-me                          → _handle_pet_me()
/api/trim-session                    → _handle_trim_session()
/api/thinking-toggle                 → _handle_thinking_toggle()
/api/weaponry-toggle                 → _handle_weaponry_toggle()
/api/inject                          → _handle_api('inject')
/api/edit                            → _handle_api('edit')
/api/clear-inject-lock               → _handle_api('clear_lock')
/api/pulse                           → _handle_api('pulse')
/api/momo                            → _handle_api('momo')
/api/spawn-subagent                  → _handle_spawn_subagent()
/api/auth-subagent                   → _handle_auth_subagent()
/api/exec-subagent                   → _handle_exec_subagent()
/api/reminders (POST)                → _handle_reminders()
/api/memory-file (POST)              → _handle_memory_file_save()
/api/tts                             → _handle_tts()
/api/awake-questions/save            → _handle_awake_save()
/api/awake-questions/list (POST)     → _handle_awake_list()
```

### 3.2 方法迁移清单（完整 80+ 方法）

以下列表覆盖 Handler 类中所有需要迁移的方法。

#### 🎯 迁移目标 #1: `handlers/inject_handler.py` — 注入/编辑/子代理

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_handle_api('inject')` | 2608 | inject_handler.py | 🔴 高 | 从 _handle_api 大分发器中拆出 inject 分支 |
| 1 | `_handle_api('edit')` | 2608 | inject_handler.py | 🔴 高 | 从 _handle_api 大分发器中拆出 edit 分支 |
| 1 | `_handle_api('clear_lock')` | 2608 | inject_handler.py | 🟢 低 | 从 _handle_api 中拆出 |
| 2 | `_handle_api('pulse')` | 2608 | inject_handler.py | 🟢 低 | 从 _handle_api 中拆出 |
| 2 | `_handle_spawn_subagent()` | 2446 | inject_handler.py | 🟡 中 | 子代理生成 |
| 2 | `_handle_auth_subagent()` | 2458 | inject_handler.py | 🟡 中 | 子代理授权 |
| 2 | `_handle_exec_subagent()` | 2496 | inject_handler.py | 🟡 中 | 子代理执行 |
| 2 | `_handle_abort()` | 2794 | inject_handler.py | 🟢 低 | 中止 |
| 3 | `_handle_restart_http()` | 2810 | inject_handler.py | 🟡 中 | HTTP 重启（含 SIGKILL 逻辑） |

#### 🎯 迁移目标 #2: `handlers/session_handler.py` — 会话管理

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_get_session_data()` | 2290 | session_handler.py | 🟡 中 | 获取会话数据（核心方法，多处调用） |
| 1 | `_handle_delete_session()` | 2255 | session_handler.py | 🟢 低 | 删除会话 |
| 1 | `_handle_trim_session()` | 2968 | session_handler.py | 🔴 高 | 截断会话（安全铁律+双重验证） |
| 1 | `_handle_session_rpc()` | 3107 | session_handler.py | 🟡 中 | GateWay RPC 会话读取 |
| 2 | `_list_backups()` | 2508 | session_handler.py | 🟢 低 | 列出备份 |
| 2 | `_restore_backup()` | 2537 | session_handler.py | 🟢 低 | 恢复备份 |
| 2 | `_update_last_user_msg()` | 2567 | session_handler.py | 🟢 低 | 更新最后用户消息时间 |
| 2 | `_cleanup_inject_lock()` | 2575 | session_handler.py | 🟢 低 | 清理注入锁 |

#### 🎯 迁移目标 #3: `handlers/crypto_handler.py` — 加解密

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_handle_encrypt()` | 3631 | crypto_handler.py | 🟡 中 | 加密入口（同时处理 GET 和 POST） |
| 1 | `_handle_decrypt()` | 3698 | crypto_handler.py | 🟡 中 | 解密入口 |
| 1 | `_handle_encrypt_status()` | 3599 | crypto_handler.py | 🟢 低 | 加密状态 |
| 2 | `_handle_encrypt_save_file()` | 3498 | crypto_handler.py | 🟢 低 | 加密保存文件 |
| 2 | `_handle_pass_password()` | 3536 | crypto_handler.py | 🟢 低 | 传密码 |
| 2 | `_handle_encrypt_folders()` | 3562 | crypto_handler.py | 🟢 低 | 加密文件夹 |
| 2 | `_try_decrypt_file()` | 3420 | crypto_handler.py | 🟢 低 | 尝试解密文件（辅助方法） |

#### 🎯 迁移目标 #4: `handlers/file_handler.py` — 文件操作

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_handle_tb_files()` | 3286 | file_handler.py | 🟢 低 | 文件列表 |
| 1 | `_handle_tb_read_file()` | 3387 | file_handler.py | 🟡 中 | 读文件（含 .docx 解密） |
| 1 | `_handle_tb_save_file()` | 3305 | file_handler.py | 🟢 低 | 保存文件 |
| 1 | `_handle_tb_create_file()` | 3331 | file_handler.py | 🟢 低 | 创建文件 |
| 1 | `_handle_tb_delete_file()` | 3351 | file_handler.py | 🟢 低 | 删除文件 |
| 1 | `_handle_tb_rename_file()` | 3369 | file_handler.py | 🟢 低 | 重命名文件 |
| 2 | `_handle_list_files()` | 3255 | file_handler.py | 🟢 低 | 文件列表（另一种） |
| 2 | `_handle_browse_dirs()` | 3444 | file_handler.py | 🟢 低 | 浏览目录 |

#### 🎯 迁移目标 #5: `handlers/system_handler.py` — 系统状态

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_get_usage_status()` | 2323 | system_handler.py | 🟢 低 | 使用状态 (for /api/status) |
| 1 | `_get_cache_stats()` | 2374 | system_handler.py | 🟢 低 | 缓存统计 (for /api/cache-stats) |
| 1 | `_handle_quickcheck()` | 2579 | system_handler.py | 🟢 低 | 快速检查 |
| 2 | `_list_subagents()` | 2386 | system_handler.py | 🟢 低 | 子代理列表 |
| 2 | `_handle_thinking_toggle()` | 2919 | system_handler.py | 🟡 中 | 思考模式切换 |
| 2 | `_handle_weaponry_toggle()` | 2822 | system_handler.py | 🟡 中 | 武器库切换 |

#### 🎯 迁移目标 #6: `handlers/momo_handler.py` — 摸摸协议

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_handle_api('momo')` | 2608 | momo_handler.py | 🔴 高 | 从 _handle_api 大分发器中拆出 momo 分支（含 pack/inject_feeling/status/list_backups/restore_backup/search_backups/read_facts/index_report/trigger_digest/promote_assertions/thinking_on/thinking_off 共12个子分发） |
| 2 | `_handle_pet_me()` | 2844 | momo_handler.py | 🟢 低 | 摸摸 |
| 2 | `_handle_read_facts()` | 3137 | momo_handler.py | 🟢 低 | 读事实 |

#### 🎯 迁移目标 #7: `handlers/helper_handler.py` — 辅助功能

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_handle_memory_file_get()` | 3076 | helper_handler.py | 🟢 低 | 获取记忆文件 |
| 1 | `_handle_memory_file_list()` | 3456 | helper_handler.py | 🟢 低 | 记忆文件列表 |
| 1 | `_handle_memory_file_save()` | 3475 | helper_handler.py | 🟢 低 | 保存记忆文件 |
| 2 | `_handle_secretary_log()` | 3244 | helper_handler.py | 🟢 低 | 秘书日志 |
| 2 | `_handle_facts_stale_check()` | 3150 | helper_handler.py | 🟡 中 | 事实过期检查 |
| 2 | `_handle_reminders()` | 3208 | helper_handler.py | 🟢 低 | 提醒 |

#### 🎯 迁移目标 #8: `handlers/awake_handler.py` — 守夜面板（新建文件）

| 阶段 | 方法名 | 当前行 | 目标文件 | 复杂度 | 说明 |
|------|--------|--------|----------|--------|------|
| 1 | `_handle_awake_list()` | 2736 | awake_handler.py | 🟢 低 | 守夜问题列表 |
| 1 | `_handle_awake_save()` | 2758 | awake_handler.py | 🟢 低 | 保存守夜问题 |
| 1 | `_handle_awake_send()` | 2775 | awake_handler.py | 🟡 中 | 守夜发送消息（含截断+注入） |
| 1 | `_handle_awake_questions()` | 2713 | awake_handler.py | 🟢 低 | 守夜题库 GET/POST |
| 2 | `_handle_tts()` | 2891 | awake_handler.py | 🟢 低 | TTS |

#### 🎯 不迁移（留在 Handler 类中的基础设施）

以下方法是 HTTP 服务器基础设施，**不迁移**：

| 方法名 | 保留理由 |
|--------|----------|
| `do_GET()` | HTTP 入口，只调用 `_router.get(self)` |
| `do_POST()` | HTTP 入口，处理 /api/ping + 调用 `_router.post(self)` |
| `_send_json()` | 统一 JSON 响应（含 gzip 压缩），handler 函数需要调用 |
| `_serve_static_file()` | 静态文件服务，router.py 中的 /static/ 和 / 路由需要 |
| `_get_query_param()` | 查询参数提取，所有路由都可能需要 |
| `_get_param()` | 参数获取，所有 handler 都可能需要 |
| `log_message()` | 静默日志（已 override） |

#### 模块级函数（非 Handler 类方法）的分离状态

这些是 edit-web.py 模块级别的函数，当前分散管理：

| 函数 | 当前状态 | 建议 |
|------|----------|------|
| `find_openclaw_home()` ~ `_resolve_int()` | 配置发现系统 (140行) | 抽到 `utils/config.py` |
| `inject_via_websocket()` | ✅ utils/inject.py 已双轨 | 清理旧副本用 utils 版本 |
| `edit_message()` | ✅ utils/session.py 已双轨 | 清理旧副本用 utils 版本 |
| `_momo_pack()` | ✅ 已从 utils/momo.py 导入 | 删除旧副本 |
| `_momo_status()` | ✅ 已从 utils/momo.py 导入 | 删除旧副本 |
| `_momo_index_report()` | ✅ 已从 utils/momo.py 导入 | 删除旧副本 |
| `_momo_auto_save_loop()` | ✅ 已从 utils/momo.py 导入 | 删除旧副本 |
| 秘书系统 | ✅ 已从 utils/secretary.py 导入 | 删除旧副本 |
| 文件系统 | ✅ 已从 utils/tb_handler.py 导入 | 删除旧副本 |
| 加密系统 | 双轨，但未导入 utils 版本 | 清理为统一使用 utils/crypto.py |
| 守夜题库 | 只有 edit-web.py 中有 | 保持或抽到 utils |
| 子代理进程 | 只有 edit-web.py 中有 | 保持或抽到 utils |

---

## 4. 迁移步骤与风险控制

### 4.1 每个方法的迁移流程

```
┌──────────────────────────────────────────────────────────────────────┐
│  迁移流程（每个方法遵循 5 步）：                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  步骤 1: 在对应 handler 文件中创建独立函数                           │
│  ──────────────────────────────────────────────────────────           │
│  # handlers/xxx_handler.py                                           │
│  def handle_xxx(handler, ...):                                       │
│      """原 Handler._handle_xxx 的迁移版本"""                          │
│      # 复制原方法体，将 self 引用改为 handler 参数                   │
│      # handler._send_json(200, result) → 保留不变                    │
│      # handler._get_session_data() → 保留不变                       │
│      # 模块级函数通过 from edit_web import func 导入                  │
│                                                                       │
│  步骤 2: 在 router.py 中指向新函数                                    │
│  ──────────────────────────────────────────────────────────           │
│  # handlers/router.py                                                │
│  from handlers.xxx_handler import handle_xxx                          │
│  # 路由 if cp == '/api/xxx': return handle_xxx(handler)              │
│                                                                       │
│  步骤 3: 验证旧路由同时工作                                           │
│  ──────────────────────────────────────────────────────────           │
│  在 router.py 中双轨运行 24h:                                         │
│  if cp == '/api/xxx':                                                │
│      result = handle_xxx(handler)  # 新函数                          │
│      # 旧路由保持注释                                                 │
│      return result                                                    │
│                                                                       │
│  步骤 4: 删除 Handler 类中的原方法                                    │
│  ──────────────────────────────────────────────────────────           │
│  移除 edit-web.py 中 Handler._handle_xxx 方法定义                     │
│                                                                       │
│  步骤 5: 最终验证                                                     │
│  ──────────────────────────────────────────────────────────           │
│  - 启动服务器，访问对应路由                                           │
│  - 确认前端对应功能正常工作                                           │
│  - 清理 router.py 中的 import（如已全局导入）                         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 具体迁移示例

以 `_handle_encrypt()` 为例展示迁移细节：

```python
# === 迁移前：edit-web.py Handler 类 ===
def _handle_encrypt(self):
    """加密入口（GET:查询, POST:执行）"""
    if self.command == 'GET':
        # ... GET 逻辑
        return self._send_json(200, result)
    # POST
    length = int(self.headers.get('Content-Length', 0))
    body = self.rfile.read(length)
    data = json.loads(body)
    # ... POST 逻辑
    return self._send_json(200, result)

# === 迁移后：handlers/crypto_handler.py ===
from edit_web import _xor_crypt, _xor_decrypt, _is_hex_encrypted  # 或其他导入方式

def handle_encrypt(handler):
    """加密入口（GET:查询, POST:执行）"""
    if handler.command == 'GET':
        # ... GET 逻辑（self 改为 handler）
        return handler._send_json(200, result)
    length = int(handler.headers.get('Content-Length', 0))
    body = handler.rfile.read(length)
    data = json.loads(body)
    # ... POST 逻辑
    return handler._send_json(200, result)

# === router.py 变更 ===
# 改前:
# if cp.startswith('/api/encrypt'): return handler._handle_encrypt()
# 改后:
from handlers.crypto_handler import handle_encrypt
# ...
if cp.startswith('/api/encrypt'): return handle_encrypt(handler)
```

### 4.3 导入模式选择

有三种模式来让 handler 文件访问 edit-web.py 中的模块级函数：

| 模式 | 方式 | 优缺点 |
|------|------|--------|
| **A: 直接 import** | `from edit_web import inject_via_websocket, ...` | ✅ 最直接<br>⚠️ 需要文件是合法的 Python 模块名（`edit-web.py` 不能 import，需要 `edit_web.py` 软链或 rename） |
| **B: sys.modules 访问** | `import sys; _M = sys.modules['__main__']` | ✅ 不改文件名<br>⚠️ router.py 当前就用这模式（g()函数）<br>⚠️ handler 文件被 import 时 `__main__` 可能还未设置 |
| **C: 函数参数注入** | handler 构造时注入引用 | ✅ 最干净解耦<br>⚠️ 需要修改 Handler 初始化<br>⚠️ 改动较大 |

**推荐：采用模式 A（重命名 edit-web.py → edit_web.py）**。

因为：
- `edit-web.py` 的 `-` 不是有效的 Python 模块名，当前能运行是因为 `python3 edit-web.py` 直接执行（`__name__ == '__main__'`）
- 要 import 它，必须从 `edit_web` 导入
- 一种做法：创建 `edit_web.py` 作为硬链接或软链到 `edit-web.py`
- 或者直接在启动脚本中用 `import edit_web` 然后 `sys.modules['edit_web']` 注册

**过渡期建议**：在 handler 文件中使用模式 B（sys.modules['__main__']），因为 router.py 的 g() 已经这么做了，保持一致。

```python
# handlers/xxx_handler.py
import sys
_M = sys.modules.get('__main__')
def g(name): return getattr(_M, name, None) if _M else None

def handle_xxx(handler):
    func = g('some_module_level_func')
    if func:
        result = func(...)
    # 也可以直接引用 handler 方法
    data = handler._get_session_data()
```

### 4.4 阶段划分 — 按批次迁移

```
阶段 1 (基础迁移 — 低复杂度，快速见效)
├── 约 25 个低/中复杂度的独立方法
├── 目标：快速填满 5 个空壳 handler
├── 风险：低 — 每个方法独立，不影响其他
├── 期望：1-2 小时完成
│
├── batch-1a: 注入组 (inject_handler.py)
│   ├── handle_inject()           ─ _handle_api('inject') 拆出
│   ├── handle_edit()             ─ _handle_api('edit') 拆出
│   ├── handle_clear_lock()       ─ _handle_api('clear_lock')
│   └── handle_abort()            ─ _handle_abort()
│
├── batch-1b: 会话组 (session_handler.py)  
│   ├── handle_delete_session()   ─ _handle_delete_session()
│   ├── handle_session_rpc()      ─ _handle_session_rpc()
│   ├── handle_get_session_data() ─ _get_session_data()
│   └── handle_list_backups()     ─ _list_backups()
│
├── batch-1c: 加密组 (crypto_handler.py)
│   ├── handle_encrypt()          ─ _handle_encrypt()
│   ├── handle_decrypt()          ─ _handle_decrypt()
│   └── handle_encrypt_status()   ─ _handle_encrypt_status()
│
├── batch-1d: 文件组 (file_handler.py)
│   ├── handle_tb_files()         ─ _handle_tb_files()
│   ├── handle_tb_read_file()     ─ _handle_tb_read_file()
│   ├── handle_tb_save_file()     ─ _handle_tb_save_file()
│   ├── handle_tb_create_file()   ─ _handle_tb_create_file()
│   ├── handle_tb_delete_file()   ─ _handle_tb_delete_file()
│   └── handle_tb_rename_file()   ─ _handle_tb_rename_file()
│
├── batch-1e: 系统组 (system_handler.py)
│   ├── handle_usage_status()     ─ _get_usage_status()
│   └── handle_cache_stats()      ─ _get_cache_stats()
│
├── batch-1f: 记忆组 (helper_handler.py)
│   ├── handle_memory_file_get()  ─ _handle_memory_file_get()
│   ├── handle_memory_file_list() ─ _handle_memory_file_list()
│   └── handle_memory_file_save() ─ _handle_memory_file_save()
│
└── batch-1g: 守夜组 (awake_handler.py)
    ├── handle_awake_list()       ─ _handle_awake_list()
    ├── handle_awake_save()       ─ _handle_awake_save()
    ├── handle_awake_send()       ─ _handle_awake_send()
    └── handle_awake_questions()  ─ _handle_awake_questions()

阶段 2 (中复杂度 — _handle_api 大分发器拆解)
├── 🎯 最核心的任务：将 _handle_api(self, action) 拆分为独立 handler
├── 当前 _handle_api 是单体大分发器，处理 5 个 action 和 12 个 momo sub_action
├── 迁移策略：
│   ├── 在 inject_handler.py 中创建 handle_inject_api(handler, data)
│   ├── 在 session_handler.py 中创建 handle_edit_api(handler, data)
│   ├── 在 momo_handler.py 中创建 handle_momo_api(handler, data)
│   └── 拆分后 router.py 不再调用 handler._handle_api('xxx')
│       → 改为直接调用对应的 handler 函数
├── 风险：中 — _handle_api 是核心分发入口，需要仔细拆
└── 期望：2-3 小时完成

阶段 3 (高复杂度 — 复杂方法的迁移)
├── batch-3a: 截断与安全校验
│   ├── handle_trim_session()     ─ _handle_trim_session() 含安全铁律
│   └── move to session_handler.py
│
├── batch-3b: 守夜发送
│   ├── handle_awake_send()       ─ 含截断+注入流程
│   └── move to awake_handler.py
│
├── batch-3c: 子代理系统
│   ├── handle_spawn_subagent()   ─ _handle_spawn_subagent()
│   ├── handle_auth_subagent()    ─ _handle_auth_subagent()
│   └── handle_exec_subagent()    ─ _handle_exec_subagent()
│
├── batch-3d: 杂项
│   ├── handle_restart_http()     ─ 包含 SIGKILL 逻辑
│   ├── handle_thinking_toggle()  ─ 思考模式切换
│   ├── handle_weaponry_toggle()  ─ 武器库切换
│   ├── handle_pet_me()           ─ 摸摸
│   ├── handle_secretary_log()    ─ 秘书日志
│   ├── handle_facts_stale_check()─ 事实过期
│   ├── handle_reminders()        ─ 提醒
│   ├── handle_list_files()       ─ 列表文件
│   └── handle_browse_dirs()      ─ 浏览目录
│
└── 风险：高 — 需要理解复杂业务逻辑
    期望：2-3 小时完成

阶段 4 (清理 — 消除双轨过渡代码)
├── 删除 edit-web.py 中的旧函数副本：
│   ├── _momo_pack()              → utils/momo.py 已用
│   ├── _momo_status()            → utils/momo.py 已用
│   ├── _momo_index_report()      → utils/momo.py 已用
│   ├── _momo_auto_save_loop()    → utils/momo.py 已用
│   ├── _secretary_analyze_save() → utils/secretary.py 已用
│   ├── _load_reminders() → utils/secretary.py 已用
│   ├── _save_reminders() → utils/secretary.py 已用
│   ├── _add_reminder() → utils/secretary.py 已用
│   ├── _secretary_remind() → utils/secretary.py 已用
│   ├── _is_hex_encrypted()       → utils/crypto.py（待确认）
│   ├── _xor_crypt()              → utils/crypto.py
│   ├── _xor_decrypt()            → utils/crypto.py
│   ├── _encrypt_file()           → utils/crypto.py
│   ├── _decrypt_file_text()      → utils/crypto.py
│   ├── inject_via_websocket()    → utils/inject.py
│   ├── _cleanup_lock()           → utils/inject.py
│   ├── list_all_sessions()       → utils/session.py
│   ├── get_session_info()        → utils/session.py
│   ├── read_session()            → utils/session.py
│   ├── group_into_pairs()        → utils/session.py
│   └── edit_message()            → utils/session.py
│
└── 验证：所有 import 路径改为 from utils.xxx import ...
```

### 4.5 测试策略

| 类型 | 方法 | 预期 |
|------|------|------|
| **单元测试** | 每个 handler 函数可独立测试 | 输入→输出的正确性 |
| **API 集成测试** | curl 调用每个路由 | 返回格式与迁移前一致 |
| **前端功能测试** | 打开浏览器，点击每个功能按钮 | 前端交互正常 |
| **压力测试** | 快速连续注入+编辑 | 锁机制正常，无竞态 |
| **回滚测试** | 确认回滚步骤可执行 | 回滚后功能正常 |

建议的测试脚本：

```bash
#! /bin/bash
# test_api.sh — 快速验证各 API 是否正常

BASE="http://localhost:18888"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
PASS=0
FAIL=0

check() {
    local desc="$1"
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$2" ${@:3})
    if [ "$status" == "200" ]; then
        echo -e "${GREEN}✅${NC} $desc"
        ((PASS++))
    else
        echo -e "${RED}❌${NC} $desc (HTTP $status)"
        ((FAIL++))
    fi
}

GET() { check "$1" "$BASE$2"; }
POST() { check "$1" "$BASE$2" -X POST -H "Content-Type: application/json" -d "${3:-{}}"; }

# 基本状态
GET "状态" "/api/status"
GET "缓存统计" "/api/cache-stats"
GET "会话列表" "/api/list-sessions"
GET "系统健康" "/api/system-health"
GET "消化状态" "/api/digestion-status"

# 文件操作
GET "TB文件列表" "/api/tb-files?path=/"
GET "浏览目录" "/api/browse-dirs?path=/"

# 加密
GET "加密状态" "/api/encrypt"

# POST
POST "中止" "/api/abort"
POST "摸摸" "/api/momo" '{"sub_action":"status"}'

echo ""
echo "结果: $PASS 通过, $FAIL 失败"
[ $FAIL -eq 0 ] && echo "✅ 全部通过" || echo "❌ 有 $FAIL 个失败"
```

### 4.6 回滚方案

```
回滚步骤（针对每个迁移的 handler）:

1. 双轨运行期间（步骤 3）：
   └─ 简单回滚：将 router.py 中的新路由调用注释掉，取消旧路由的注释
   └─ 立即生效：重启 HTTP 服务器即可

2. 单轨运行后（步骤 4 已删除原方法）：
   └─ git checkout / 备份恢复 edit-web.py 中的原方法
   └─ router.py 恢复旧路径
   └─ 重启 HTTP 服务器

3. 灾难回滚（全部迁移失败）：
   └─ 创建一个回滚脚本 _rollback.sh
   └─ 内容：将 handlers/ 目录重命名为 handlers.migrated/
   └─ 恢复 edit-web.py 备份（方法全部回到 Handler 类）
   └─ router.py 恢复为 handler._handle_xxx() 模式
   └─ 重启服务

4. 快速回滚工具（推荐提前准备）：
   └─ 在 scripts/ 目录创建 rollback.py
   └─ 功能：备份当前文件 → 恢复上一个备份 → 重启 server
```

---

## 5. 不做的事（防止方案膨胀）

以下内容**不在本次分离方案的范围内**，即使它们也有改进价值：

| 事项 | 原因 |
|------|------|
| ❌ **不改动前端 JS** | 前端 12 个 JS 文件 (2972行) 的分离是独立工作，不在此方案内 |
| ❌ **不改动 router.py 的工作方式** | 保持 `g()` 魔术引用模式。当前 g() 模式让 router 引用模块级函数和 handler 方法，迁移完成后仍可正常工作 |
| ❌ **不改动 utils/ 的结构** | utils/ 6 个模块已经分离，结构保持。不合并、不拆分 |
| ❌ **不改动注入模型** | inject-helper.mjs + subprocess.Popen 的模式不变 |
| ❌ **不改动配置发现系统** | 配置代码仍在 edit-web.py 顶层，但不属于 handler 迁移范围 |
| ❌ **不改动数据存储格式** | JSONL 文件格式、备份策略不变 |
| ❌ **不修复 P0 问题** | 虽然审计发现 6 个 P0 级缺陷，但那是后续修复工作，不是分离方案的一部分 |
| ❌ **不重构 do_POST 中的 /api/ping** | 虽然应走路由层，但分离方案不包含此变更 |
| ❌ **不添加 CORS/OPTIONS** | 分离方案聚焦业务层，不涉及 HTTP 基础设施 |
| ❌ **不添加 Git 版本管理** | 建议启动，但不强制绑定 |

---

## 6. 成功标准

迁移完成后的衡量标准：

| 指标 | 当前 | 目标 |
|------|------|------|
| edit-web.py 行数 | 3925 | **< 800**（只剩下 HTTP 基础设施 + 配置 + 入口） |
| Handler 类方法数 | 80+ | **< 10**（只保留 do_GET/do_POST/_send_json/_serve_static_file/_get_query_param/_get_param/log_message） |
| handler 空壳数 | 7 个空壳/半成品 | **0**（全部填实实际函数） |
| 双轨代码 | 10+ 处重复 | **0**（全部统一到 utils/） |
| 业务逻辑在 edit-web.py 中的比例 | ~60% | **< 5%** |
| 迁移后的路由调用 | `handler._handle_xxx()` | `handle_xxx(handler)` 从 handlers/*.py 调用 |

---

## 附录 A：迁移后文件结构预期

```
scripts/
├── edit-web.py                     ← 瘦身版 (≈800行): HTTP + 配置 + 入口
├── edit_web.py → edit-web.py       ← 软链/硬链接，用于 import
├── handlers/
│   ├── __init__.py
│   ├── router.py                   ← 不变 (150行)
│   ├── inject_handler.py           ← 填充 (≈150行)
│   ├── session_handler.py          ← 填充 (≈250行)
│   ├── crypto_handler.py           ← 填充 (≈200行)
│   ├── file_handler.py             ← 填充 (≈200行)
│   ├── system_handler.py           ← 填充 (≈150行)
│   ├── momo_handler.py             ← 修复+填充 (≈150行)
│   ├── awake_handler.py            ← 新建 (≈100行)
│   └── helper_handler.py           ← 填充 (≈100行)
├── utils/
│   ├── __init__.py
│   ├── momo.py                     ← 不变 (222行)
│   ├── secretary.py                ← 不变 (87行)
│   ├── tb_handler.py               ← 不变 (216行)
│   ├── crypto.py                   ← 不变 (55行)
│   ├── inject.py                   ← 不变 (36行)
│   └── session.py                  ← 不变 (138行)
└── static/                         ← 前端不变
```

## 附录 B：快速启动迁移脚本

```bash
#! /bin/bash
# 准备迁移环境
cd /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts/

# 1. 备份当前版本
cp edit-web.py edit-web.py.bak.$(date +%Y%m%d_%H%M%S)

# 2. 创建软链用于模块 import
ln -sf edit-web.py edit_web.py

# 3. 创建新 handler 文件
touch handlers/awake_handler.py
```

---

> **核心原则**: 保持小步迭代，每次只迁移一个 handler 文件（约 5-10 个方法），双轨验证后再继续。不要在一天内迁移所有方法。
