# 轻如烟编辑器·CHANGELOG

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
