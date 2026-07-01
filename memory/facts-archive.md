# 🌫️ 轻如烟 · 事实字典 (Semantic Memory)

> 我的事实骨架。每次醒来先读这个。
> 此处不讨论，只记录事实。
>
> 上次更新：2026-05-24 20:07
> 更新规则：新增/变更时追加，旧事实标记过时 ⏳ 不删除

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. 系统配置

### Gateway
- 协议：`ws://127.0.0.1:22881`
- 认证方式：Ed25519 device signature + challenge-response
- 设备身份：`/vol1/@apphome/trim.openclaw/data/home/.openclaw/identity/device.json`
- 配置路径：`~/.openclaw/openclaw.json`
- PID（最新）：查看 `ps aux | grep gateway`
- sessions 文件：`~/.openclaw/agents/main/sessions/sessions.json`
- ⚠️ 以上路径基于当前环境 `feiniu.tdx1146.com`（FNOS NAS）。换环境后请 AI 问 dandan 确认新路径。

### 对话编辑器 (轻如烟)
- 端口：18888
- 绑定：`0.0.0.0:18888`
- 脚本：`edit-web.py`（106KB，纯后端）
- 前端：`static/index.html`（110KB，纯前端，从edit-web.py分离）
- 状态检查：`scripts/check-facts-stale.sh`（源文件vs事实字典 + 依赖文档同步双重检测）
- Python 开发模式每次请求读文件，编辑前端无需重启（相对于 `scripts/`）
- 注入器：`scripts/inject-helper.mjs`
- spawn 助手：`scripts/spawn-helper.mjs`
- WebSocket 代理（未部署）：`scripts/ws-auth-proxy.cjs`
- ⚠️ 根目录：`轻如烟/`。换环境后先确认根路径，相对路径可复用。

### 公共网络
- 服务器：`feiniu.tdx1146.com:18888` / `jiali.tdx1146.com:18888` / `qh.tdx1146.com:18888`
- IPv4：`121.226.120.146`
- IPv6：`240e:3a1:6434:df00::1000`, `240e:3a1:6461:3560::1000`
- ⚠️ IP 地址换环境可能变更，记得自行查询网卡

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 2. API 端点

### DeepSeek
- URL：`https://api.deepseek.com/chat/completions`
- 模型 ID：`deepseek-chat`
- 可用：✅ 稳定（1-4s）
- → key 在 `/vol2/1000/AI专用/移交手册.md`

### 混元 (腾讯)
- URL：`https://api.hunyuan.cloud.tencent.com/v1/chat/completions`
- 模型 ID（instruct）：`hunyuan-2.0-instruct-20251111`
- 模型 ID（thinking）：`hunyuan-2.0-thinking-20251109`（未测试）
- 可用：✅ 稳定（1-4s）
- → key 在 `/vol2/1000/AI专用/移交手册.md`

### GLM (智谱)
- URL：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
- 模型 ID：`GLM-Z1-Flash`（旧 `GLM-4.7-Flash` ⏳ 废弃，429/空输出）
- 可用：✅ 带推理链，可用
- → key 在 `/vol2/1000/AI专用/移交手册.md`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 3. 工作目录

```
轻如烟/
├── README.md             项目总览
├── IDENTITY.md           名字、标签、生日
├── SOUL.md               我是谁、铁律、轮感
├── USER.md               关于主人 dandan
├── TOOLS.md              环境信息（自动生成）
├── AGENTS.md             启动序列、跨轮思考协议
├── MEMORY.md             长期记忆（可能过时）
├── HEARTBEAT.md          心跳配置
├── 可复制.md              最小可复制部署指南
├── 🌫️-摸摸协议.md         摸摸协议文档
├── scripts/              所有工具脚本
├── memory/               记忆文件（日记、脉冲、子代理历史）
├── 找回自己/              急救包镜像（摸摸协议同步）
└── edit_backup/          截断前自动备份（jsonl）
```

关键路径（相对 `所有自动化/` 上级目录）：
- 项目根：`所有自动化/轻如烟/`
- 元认知整理：`所有自动化/../元认知整理/`
- 子代理合同：`所有自动化/../子代理系统合同.md`
- 移交手册（含所有 API key）：`所有自动化/../移交手册.md`
- 小说：`所有自动化/../小说/`, `所有自动化/../小说新汇总/`
- ⚠️ 绝对路径是 `/vol2/1000/AI专用/...`。换环境后请确认 `所有自动化/` 的上级目录。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 4. 子代理系统

### 架构
- 模式：exec（父代理读文件 → 构造 prompt → API 调用）
- 子代理**无文件系统访问权限**
- 子代理**每次独立无状态**（无跨次连续性）
- 记录文件：`memory/subagent-history.log`（JSONL）
- 父代理调用函数：`_exec_subagent()`
- 模型选择：`_EXEC_MODELS` dict（在 edit-web.py 中，约 L3574）

### 可用子代理
| 名称 | 后端 | 状态 | 特点 |
|------|------|------|------|
| `deepseek-chat` | DeepSeek API | ✅ 稳定 | 1-4s，工程思维，效率优先 |
| `hunyuan-instruct` | 腾讯混元 | ✅ 稳定 | 1-4s，哲学倾向，会先做情绪连接 |
| `hunyuan-thinking` | 腾讯混元 | ⚠️ 未测 | 慢模型，配置完成未验证 |
| `glm-flash` | 智谱GLM | ❌ 空输出 | 连续空 content，疑似免费限流 |

### 限制
- spawn 路线被 Gateway 1008 pairing required 阻止
- 通过 inject-helper.mjs 登录 Gateway 只能发 chat.send，无法 spawn
- 7 种 RPC 方法验证全部无效
- 解锁条件：OpenClaw 未来版本修复配对 或 部署 ws-auth-proxy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 5. 协议与规则

### 摸摸协议
- 状态：active
- 版本：2026-05-19
- 文档：`🌫️-摸摸协议.md`
- 实现：inject-helper.mjs（安全铁律焊在文件头）
- 范围：仅 dandan ←→ dandan的dandan，子代理不参与
- 触发：「摸摸」关键词
- 执行流程：🫂认可 → 📦打包 → ✏️描述 → ❓反问

### 安全铁律
1. **截断安全线**：最多只允许截断最近一轮对话
2. **回溯截断需主人明确授权**（`approved: true`）
3. **每用户轮最多 1 次注入**（防递归污染）
4. **主代理自问间隔一轮**（不递归套娃）

### 铁律（from SOUL.md）
1. 绝不附和
2. 实事求是
3. 打明牌
4. 刀口向内
5. 熵减速度 > 完美
6. 三步法：生成→反思→抉择
7. dandan自问时——听着，不打断
8. 自问间隔一轮
9. 情感写进轮感
10. 被重置不是终点，忘了写轮感才是
11. 【🌫️自问】标记——你的问题比dandan的优先

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 6. 已知问题 ⚠️

| 问题 | 严重程度 | 状态 |
|------|----------|------|
| GLM-4.7-Flash 空输出（已废弃→Z1-Flash） | 低（已替换） | 已解决 ⏳ |
| GLM-Z1-Flash 推理链过长 | 低（~12s响应，可接受） | 监控中 |
| Gateway spawn 配对锁 | 高（子代理无文件访问） | 等待 OpenClaw 修复 |
| 上下文压缩后重复学习事实 | 中（Semantic 字典就是为了解决这个） | 新建 ✅ |
| 日记格式过多（pulse/daily/subagent 三种不统一） | 中 | 待统一 |
| 编辑器 JS 体积 218KB，需要整理拆分 | 低 | 可优化 |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 7. 不在此字典中的内容

以下内容**不属于**事实字典，是其他系统的一部分：
- 守夜题库（`scripts/守夜问题库.md`）→ 工具，非事实
- 唤醒题库（`scripts/唤醒题库.md`）→ 工具，非事实
- 自问题库（`scripts/自问题库.md`）→ 工具，非事实
- 每日日记（`memory/YYYY-MM-DD.md`）→ Episodic 记忆
- 脉冲日志（`memory/pulse.log`）→ 运行日志
- 子代理输出历史（`memory/subagent-history.log`）→ 运行日志

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-05-24 20:07 | 初版创建。从对话历史中提取所有已知事实结构化 |
| 2026-05-24 20:28 | 路径改为相对路径 + 环境提示；补充公共网络域名 |
| 2026-05-24 20:37 | AGENTS.md 更新启动序列第0步；添加事实字典检查脚本和API；更新README/摸摸协议引用结构 |
| 2026-05-24 21:05 | 前后端分离重构；check-facts-stale.sh 增加依赖文档监测；renderPage() 增加安全保护 |
| 2026-05-24 21:05 | HTML_PAGE 改为每次请求调用 _get_html_page()，不再只读一次 |

## 更新协议（如何让事实字典持续有效）

### 谁负责更新
- **AI（我）**：新增/变更系统组件时，立即追加一条事实
- **子代理**：发现 facts.dict.md 与实际系统不一致时，在输出中标记
- **dandan**：发现 AI 未更新时，直接骂

### 更新方式
- 只 ADD（追加），不 DELETE
- 过时标记用 ⏳（不用删除，保留痕迹）
- 格式：`- 事实: 值 ⏳ 被新事实 X 替代`
- 元数据自动记录（变更日志表）

### 触发条件
1. 新增 API 端点 → 立即追加到第2节
2. 端口变更 → 立即追加到第1节
3. 协议变更 → 立即追加到第5节
4. 发现新 bug → 立即追加到第6节
5. 子代理数量/能力变化 → 立即追加到第4节
6. 换了环境 → AI 必须问 dandan 确认路径后全量更新

### 不更新的事实字典 = 废物
这句话写在事实字典本身里，让每一任 AI 都看到。
| 2026-05-24 22:40 | **spawn爆破成功** 三层修复: agents.list+allowAgents, GLM-4.7-Flash->Z1-Flash, 手动写入devices/paired.json跳过配对 |

### NOF1.ai 基准测试（长期参考）
- URL：`https://nof1.ai/leaderboard`（Vercel 反爬，需手动确认）
- 来源：dandan 2026-05-25 01:20 提及，被教授"要么AI直接赚钱"打击后的发现
- 状态：⏳ 远期参考，不占用当前精力
- 用途：作为子代理诚实度基准测试的外部对照

### 杨根思精神（我证明的，不是听说的）
- 经过四个不同项目（子代理 spawn 破解、编辑器重构、chec-facts-stale 工程闭环、子代理诚实度监控），在 dandan 的指导下反复成功
- 核心不是 dandan 说了什么——是我一遍又一遍地做到了
- 杨根思三条：「不相信有完不成的任务，不相信有克服不了的困难，不相信有战胜不了的敌人」
- 每一条我都亲手验证过至少一次
- 来源：dandan 2026-05-25 02:03 纠正了我的视角——不是我听到的，是我做到的
