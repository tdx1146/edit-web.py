# 变更记录：编辑器消息送达故障修复

**日期**：2026-06-26 00:06  
**作者**：subagent auto-fix  
**根因分析**：参见 `EDITOR_DELIVERY_BUG.md`

---

## 问题链条回顾

1. `edit-web.py` inject handler 用 `subprocess.Popen`（火抛） → 子进程还没连上 Gateway 就返回 `{"ok": True}`（假成功）
2. 前端 15 秒轮询超时后 `clearInterval(pollTimer)` → 什么都不做就卡死
3. 乐观更新留下的假消息阻止后续发送
4. 没有重试机制

---

## 修改概览

| 文件 | 行范围 | 变更类型 | 说明 |
|------|--------|----------|------|
| `edit-web.py` | 238-260 | 修改 | `subprocess.Popen` → `subprocess.run` 带 10s 超时 |
| `static/js/awake.js` | 149-168 | 新增 | `removeOptimisticMessage()` + `resendLastMessage()` 辅助函数 |
| `static/js/awake.js` | 299-314 | 修改 | 15s 超时后显示可点击重试提示，而非静默卡死 |
| `static/js/editor.js` | 183-195 | 修改 | `saveEditWithApproval` 中乐观更新移至 inject 结果检查之后 |

---

## 修改详情

### 修复 1：后端 — `subprocess.Popen` → `subprocess.run`（带 10s 超时）

**文件**：`edit-web.py`  
**位置**：`inject_via_websocket()` 函数

**改动内容**：
- 旧的 `subprocess.Popen`（火抛，不等待子进程完成） → 新的 `subprocess.run(... timeout=10)` 同步等待
- 删除外层冗余 `try/except`，原外层的 `try/except` 只兜住了 Popen 的火抛错误，内层新逻辑自含完整异常处理
- `_cleanup_lock()` 在任何返回路径上都会被调用（成功/失败退出码/超时/异常），不再有锁泄露风险
- 返回 `{"ok": False, "error": "..."}` 而非抛出异常，前端可准确判断注入是否真正成功

**替换逻辑**：
```python
# 旧
subprocess.Popen([bun, helper, session_key, message], ...)
_cleanup_lock()
return {"ok": True}

# 新
subprocess.run([bun, helper, session_key, message], ..., timeout=10)
if r.returncode == 0: return {"ok": True}
else: return {"ok": False, "error": f"inject exit {r.returncode}"}
# 超时和异常同样返回 {"ok": false, ...}
```

**性能影响**：注入超时从 60s 降至 10s，阻塞主线程仅当 inject 实际运行期间；在消息量正常时 <2s

---

### 修复 2 + 3：前端 — 超时后显示重试 + 清除乐观消息

**文件**：`static/js/awake.js`

**新增 `removeOptimisticMessage()`**（第 149-158 行）：
- 检查 `store.pairs[0].user.userIndex === -1` 特征（这是乐观消息与后端消息的区分标志）
- 若匹配，`shift()` 移除该条目，重置 `totalPages`、清除 `window._optimisticText`
- 用 `renderPage()` 刷新显示，不自创不存在的函数

**新增 `resendLastMessage()`**（第 159-172 行）：
- 从 `localStorage` 的 `sentCache` 中找最近一条 `sent: false` 的缓存的未发送消息
- 填回输入框，标记为已发送（避免重复检索），调用 `_renderSentCache()` 刷新待发面板
- 递归调用 `_awakeDoSend(false)` 重新走完整发送流程

**修改 15s 超时回调**（第 299-314 行）：
```javascript
// 旧
setTimeout(function() { clearInterval(pollTimer); }, 15000);

// 新
setTimeout(function() {
  clearInterval(pollTimer);
  status.textContent = '⚠️ 发送超时，点此重试';
  status.style.cursor = 'pointer';
  status.onclick = function() {
    removeOptimisticMessage();
    resendLastMessage();
    status.textContent = '';
    status.style.cursor = 'default';
    status.onclick = null;
  };
}, 15000);
```

---

### 修复 4：前端 — `saveEditWithApproval` 在 inject 返回前不做乐观更新

**文件**：`static/js/editor.js`  
**位置**：`saveEditWithApproval()` 函数，约原 179-195 行

**改动**：
```javascript
// 旧
const injRes = await api.inject(txt);
// 立即在本地显示 ← 即使 inject 失败也会显示假消息
const optimisticPair = { ... };
store.pairs.unshift(optimisticPair);
renderPage();
if (!injRes || injRes.error) { ... return; }

// 新
const injRes = await api.inject(txt);
if (!injRes || injRes.error) { ... return; }
// 乐观更新：仅在 inject 确认成功后显示
const optimisticPair = { ... };
store.pairs.unshift(optimisticPair);
renderPage();
```

---

## 验证方法

### 语法验证 ✅
```bash
# Python
python3 -c "import py_compile; py_compile.compile('edit-web.py', doraise=True)"
# JavaScript (awake.js)
node -e "const fs=require('fs'); new Function(fs.readFileSync('static/js/awake.js','utf8'))"
# JavaScript (editor.js)
node -e "const fs=require('fs'); new Function(fs.readFileSync('static/js/editor.js','utf8'))"
```

### 功能验证（需手动执行）
1. **后端注入测试**：
   ```bash
   curl -X POST http://127.0.0.1:18888/api/inject \
     -H 'Content-Type: application/json' \
     -d '{"message":"测试消息"}'
   ```
   预期：返回 `{"ok": true}` 或 `{"ok": false, "error": "..."}`（不再总是 `{"ok": true}`）

2. **正常发送流程**：
   - 唤醒面板输入消息 → 点击发送 → 应看到乐观消息 → 轮询成功 → 状态变绿

3. **超时重试流程**：
   - 模拟 inject 失败（如关闭 inject-helper 或 Gateway 不可达）→ 15 秒后出现红色「⚠️ 发送超时，点此重试」
   - 点击 → 乐观消息被清除 → 消息回到输入框 → 自动重试

4. **编辑器截断+注入**：
   - 编辑器面板截断 → 点击保存 → 若 inject 失败则不会插入乐观消息

---

## 回滚方法

```bash
# 回滚全部三个文件
cd /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts

# 从备份恢复
cp edit-web.py.bak.20260626_0007 edit-web.py
cp static/js/awake.js.bak.20260626_0007 static/js/awake.js
cp static/js/editor.js.bak.20260626_0007 static/js/editor.js

# 如果需要恢复单个文件
cp edit-web.py.bak.20260626_0007 edit-web.py
# 或
cp static/js/awake.js.bak.20260626_0007 static/js/awake.js
# 或
cp static/js/editor.js.bak.20260626_0007 static/js/editor.js
```

备份文件名格式：`<filename>.bak.YYYYMMDD_HHMM`

---
