---
name: 模型迁移清单
description: 当模型提供方变化（换key/换模型/换端点）时的验证步骤。
---

## 适用场景

- API key 更换
- 模型版本升级
- 提供方切换（如混元→TokenHub）
- 新提供方接入（如阿里百炼）

## 验证步骤

### 1. 端点和认证
```bash
curl -X POST <baseUrl>/chat/completions \
  -H 'Authorization: Bearer <apiKey>' \
  -d '{"model":"<modelId>","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'
```
✅ 返回 200 + choices[0].message.content

### 2. contextWindow
- 从文档或API确认模型的实际contextWindow
- 更新 `models.json` 和 `openclaw.json` 中的 `contextWindow` 字段
- 验证 `_get_usage_status()` 能正确读取新值

### 3. Reasoning 能力
- 模型是否支持 reasoning/reasoning_content？
- 如需显示思考链，更新 `reasoning: true`
- 编辑器的🧠状态会由此决定

### 4. 子代理兼容性
- `sessions_spawn` 使用新模型是否正常？
- 响应时间是否在可接受范围？
- 超时阈值是否需要调整？

### 5. 额度监控
- 付费还是免费？
- 每月用量上限？
- 用完后是否降级/停服？

## 历史案例

2026-06-01 混元迁移：旧 key 耗尽→TokenHub hy3-preview。端点从 api.hunyuan.tencent.com 改为 api.lkeap.cloud.tencent.com/plan/v3。阿里百联接入：发现 coding.dashscope 端点错误，标准端点为 dashscope.aliyuncs.com/compatible-mode/v1。
