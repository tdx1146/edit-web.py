# 轻如烟编辑器 架构文档

## 文件职责

### 后端 (edit-web.py)
- 1737 行，HTTP 服务器
- 路由分发: `do_GET()` / `do_POST()` → `_handle_api(action)`
- 核心 API: inject, edit, abort, session, awake-questions, momo
- 注入: `inject_via_websocket()` → 调用 `nanobot-helper.py` (Python WebSocket 客户端)

### 前端 (static/)

| 文件 | 行数 | 职责 | 依赖 |
|------|------|------|------|
| `core.js` | 309 | 全局 store、api 对象、轮询、工具函数、toast | 无 |
| `app.js` | 42 | 初始化引导 | core.js |
| `components.js` | 281 | 组件渲染 (对话列表、分页、断言等) | core.js, render.js |
| `render.js` | 656 | 消息渲染 (markdown、思维链、图片) | core.js |
| `momo.js` | 338 | 摸摸协议面板交互 | core.js |
| `awake.js` | 327 | 对话框/唤醒题库面板交互 | core.js |
| `editor.js` | 233 | 编辑/截断面板交互 | core.js |
| `file-browser.js` | 473 | 文件浏览器 | core.js |
| `dashboard.js` | 34 | 仪表盘初始化 | core.js |
| `subagent.js` | 149 | 子代理面板 | core.js |
| `cache-monitor.js` | 139 | 缓存监控面板 | core.js |

### 数据流

```
用户输入 → awakeSendNoTrunc() → api.inject(text)
  → POST /api/inject → _handle_api('inject')
  → inject_via_websocket() → nanobot-helper.py (WebSocket 发消息)
  → 轮询: setInterval → GET /api/session?fresh=1
  → 检测 pairs 变化 → refresh() → renderPage()
```

## 已知问题

1. **group_into_pairs() 跳过 tool 角色** — 导致 pairs.length 与真实消息数不一致
2. **"⏳ 等待写入"卡死** — awake.js 轮询只比较 pairs.length，被问题1影响
3. **全局变量污染** — store 通过 `Object.defineProperty(window, ...)` 暴露全局别名
4. **职责混合** — core.js 包含 api、store、轮询、工具函数、toast、待重发缓存
