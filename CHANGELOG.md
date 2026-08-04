# 轻如烟编辑器·CHANGELOG

## v5.3 (2026-08-04) — 会话路由修复：编辑器消息不再跑偏到 global

**根因**：`get_session_info()` 默认/兜底使用 `agent:main:main` 会话键；OpenClaw 配置 `session.scope="global"` 下，网关 `canonicalizeMainSessionAlias()` 将 `main` 别名规范化为 `global` 容器 → 编辑器注入的消息全部落入 global（d794e50f），与真实主对话 `agent:main:dashboard:<uuid>`（da928bb2）分离。

### 变更内容
- `edit-web.py get_session_info()`：无显式选择时不再用 `agent:main:main`；新增 `_is_excluded_session_key()`（排除 global/unknown/agent:*:main/cron/subagent）与 `_pick_best_session()`（优先 origin.provider=webchat 即 :dashboard: 会话，取 updatedAt 最新）；删除"终极 fallback 硬标 agent:main:main"
- `list_all_sessions()`：过滤 global / unknown / agent:main:main 键，避免手动切到系统容器
- `_thinking_status()`：用解析后的真实会话读 thinkingLevel（不再硬编码 agent:main:main）
- `handlers/system_handler.py handle_thinking_toggle()`：同上改用真实会话
- `handlers/router.py`：`/api/switch-session` 与 `/api/session?key=` 拒绝切换到系统容器会话
- `handlers/inject_handler.py handle_inject()`：支持前端显式传 sessionKey（所见即所发，双保险）
- 前端 `static/js/components.js`：会话选择器 `_current` 初始值取自 `/api/session`（不再硬编码 agent:main:main）
- 前端 `static/js/core.js`：`/api/inject` 请求携带当前 sessionKey

### 验证
- `python3 -m py_compile` 全部通过；`node --check` JS 通过
- 测试脚本 25 项断言全过：真实 sessions.json 上 `get_session_info()` 返回 `agent:main:dashboard:5e7ae73c-e16e-442f-b3fc-9473231bca71`（da928bb2），不再是 agent:main:main/global；global/subagent/cron/别名键均不被选中

---

## v5.2 (2026-08-03) — 消息丢失根因修复 + 结构性补全（权威版本）

**修复 inject-helper fire-and-forget 消息丢失 + 补全缺失依赖**

### 变更内容
- 修复 inject-helper.mjs `chat.send` fire-and-forget：发送后等待 gateway RPC `res` 确认，3s 超时（覆盖 gateway 事件循环阻塞峰值 2.9s），失败时非 0 退出码，edit-web.py 可捕获重试
- 保留 idempotencyKey（重试不重复投递）与 deliver:true
- 新增 `utils/process_lock.py`（PID 文件锁，纯标准库）：新版 edit-web.py 的 `from utils.process_lock import ProcessLock` 依赖此前在 GitHub 上不存在，部署即崩
- 补全 GitHub main 根目录结构：`utils/` 完整包、`handlers/` 完整模块、`static/` 前端资源、`inject-helper.mjs`、`cache_monitor.py`（此前缺失，无法独立部署）
- 本版本为 GitHub 权威版本，覆盖此前残缺版本

### 验证
- `node --check` inject-helper 通过；模拟 gateway 测试：正常 ack / 3s 超时 / 错误 res 三态均符合预期
- `py_compile` 全部文件通过；模拟启动（测试端口）确认配置发现 + 进程锁 + HTTP 服务 + 自动存档均正常

---

## v4.2 (2026-06-27)

**修复 deliver:true 缺失 + fire-and-forget 恢复**

### 变更内容
- 修复 inject_handler 中 `deliver` 参数未正确传递的问题
- 恢复 fire-and-forget 模式，确保消息立即投递
- 优化前端超时重试逻辑

---

## v4.1 (2026-06-26)

**Inject Fix：subprocess.run + 前端超时重试 + 清除守护冲突**

### 变更内容
- 使用 `subprocess.run()` 替代旧版子进程调用
- 添加前端请求超时自动重试机制（最多3次）
- 清理残留的守护进程冲突
- 优化 handlers 执行顺序和异常处理

---

## v4 (2026-06-25)

**架构重构：真正分离 handlers/utils 双轨清理**

### 变更内容
- 完成 handlers 与 utils 的真正分离
- 统一配置管理（config.json）
- 实现 cache_stats 监控模块
- 完善 error handling 和日志记录

## v5.1 (2026-07-22)

**Context 动态查询 + checkReminders 修复 + 恢复原始 control-ui**

### 变更内容
- 修复 handle_usage_status() 中 contextTokens 硬编码 1.0M 的问题
- 补全 render.js 中 checkReminders() 函数定义
- 恢复 OpenClaw control-ui 到原始版本（bun reinstall openclaw@2026.5.4）

### 踩坑记录
1. 上下文1.0M: 三个bug叠加——①只查deepseek-v4-flash一个模型 ②Config大小写不匹配 ③字段名contextWindow不存在
2. 搞混两套编辑器: OpenClaw control-ui(16878) ≠ 轻如烟编辑器(18888)，前者是终极备份不应修改
3. 版本管理纪律: 修改前确认正确的目标系统，修改后立即归档到编辑器所有版本/
