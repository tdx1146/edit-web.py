---
name: 逐层追问法
description: 当问题反复出现时，停止在当前层修修补补，逐层向上查根因。检查顺序：配置→注入→模型→系统。
metadata:
  openclaw:
    emoji: "🔍"
    events: []
    requires:
      bins: []
---

# 🔍 逐层追问法

> 同一类错误出现两次 → 问题不在当前层，在上层。

## 五层检查（由下往上）

| 层 | 检查什么 | 怎么查 |
|----|---------|--------|
| L1 代码层 | 文件是否写对了？语法有错吗？ | 肉眼检查 |
| L2 配置层 | openclaw.json 的设置是否正确？ | 看 model.reasoning、hooks、plugins |
| L3 注入层 | AGENTS.md 等引导文件是否真的被注入了？ | /context list |
| L4 模型层 | 思考模式开了吗？模型能力是否被限制了？ | /status → thinking 级别 |
| L5 系统层 | cron/hooks/plugins 是否在运行？ | 查 cron/jobs.json、hooks 目录 |

## 使用场景

- dandan 说「你不执行」→ 先查 L4 思考模式，再查 L3 注入
- 自动化没生效 → 先查 L5 cron/hooks，再查 L2 配置
- 功能不对 → 先查 L1 代码，不行就 L2 配置
