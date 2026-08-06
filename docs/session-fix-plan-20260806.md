# 轻如烟编辑器「强制新开 session」Bug 整治方案（可评审 / 可执行 / diff 级）

- 日期：2026-08-06
- 状态：**方案稿，待 dandan 评审拍板，未实施**
- 涉及代码：`/vol2/1000/AI专用/所有自动化/轻如烟/scripts/`（git 仓库，当前 HEAD `2606d9c`）
- 涉及运行环境：OpenClaw gateway（port 10554，WS RPC），会话目录 `/vol1/@apphome/trim.openclaw/data/home/.openclaw/agents/main/sessions`

---

## 0. 背景结论摘要

编辑器（HTTP :18888）的会话解析层存在一处过期假设：把 `agent:main:main` 当作「scope=global 下会被网关规范化的别名」排除掉，导致自动挑选会话永远失败、主会话在列表里被显示成 `orphan:` 假 key；一旦用户点击该假 key，发送时网关会把不存在的 `orphan:...` sessionKey 当成新会话创建（实测生成 `agent:main:orphan:*` 幽灵会话），表现为「每次发送都像新开一个会话、无上下文」。叠加 8/5 网关 SIGUSR1 重启中断运行 → 8/6 10:02 编辑器消息落入损坏 transcript → 网关 role-ordering 校验失败触发 `resetReplyRunSession`，把 66 条真实对话归档为 `.jsonl.reset.<ts>`，UI 显示空。**本方案：修会话解析层（A）+ 备份保险（B）+ 归档只读恢复（C）+ 触发面治理（D），全部改动限于编辑器，不动网关、不动 UI 大结构。**

---

## 1. 根因（证据链，均于 2026-08-06 实测复核）

### 1.1 会话解析缺陷（直接根因）
- `edit-web.py:390` `_is_excluded_session_key()`：`if k == 'agent:main:main' or k.endswith(':main'): return True`。注释理由是「scope=global 下被网关 canonicalizeMainSessionAlias() 规范化为 global 容器」。
- **该前提已失效**：`openclaw.json` 全文 grep `session|scope|global` 零命中（无任何 session 配置，网关按默认 scope 运行）；且实测 `sessions.json` 中 `agent:main:main` 是**真实注册的 webchat 会话**：
  ```json
  "agent:main:main": { "origin": {"provider":"webchat","surface":"webchat","label":"轻如烟编辑器"}, "sessionFile": ".../d452b23e-7c91-4d18-a783-ac46f4b38a24.jsonl" }
  ```
- `edit-web.py:407` `_pick_best_session()`：排除 `agent:main:main` 后，其余候选（subagent 等）`origin` 全部为 `None` → `is_webchat` 全 False → 自动挑选**永远失败**，退回最大文件/孤儿启发式。
- `edit-web.py:306` `list_all_sessions()`：排除键直接 `continue` **不登记 `seen_files`** → 主会话文件（及所有 subagent/cron 会话文件）被孤儿扫描重复列出成 `orphan:<uuid>.jsonl` 假 key。**实时复现**（本方案编写时直接 curl 验证）：
  ```
  GET /api/session  →  sessionKey = orphan:d452b23e-7c91-4d18-a783-ac46f4b38a24.jsonl
  GET /api/list-sessions 前 6 条全是 orphan:（含真实主会话 d452b23e、我的 subagent b26e99d0、cron 遗留文件）
  ```
- 前端 `components.js:94` `shortKey()` 把 orphan 显示成 `old:xxxx` → dandan 看到的「主对话」是一堆 `old:` 孤儿条目。

### 1.2 网关重置机制（诱因）
- `gateway.log:1005-1006`：`2026-08-05T16:23:35` SIGUSR1 重启（glue-memory-injector 插件更新），当时 `67aaa3c0` 主会话正在跑（16:23:15 stream-ready 后 20s 被掐断）→ transcript 残留未闭合尾部。
- `gateway.log:1739-1741`：`2026-08-06T10:02:13.722` 编辑器 webchat 连接 → `10:02:15.681` 连接被断（code 1006）→ 10:02:15.759 网关触发 resetReplyRunSession：
  - 归档：`67aaa3c0-...jsonl.reset.2026-08-06T02-02-15.759Z`（882 行，**66 条 user + 401 assistant + 346 toolResult**，2.0MB，最后一条消息 8/5 16:20:15）
  - 建新：`d452b23e-...jsonl`（ctime 10:03:02）成为新主会话文件；`gateway.log:1742` 10:02:50 新 run 已在 `d452b23e` 上启动。
- 同机制 8/5 12:32 也发生过一次：`95c0820e-...jsonl.reset.2026-08-05T04-32-31.085Z`（904 行，2.1MB）。
- **8/6 10:28 幽灵会话实锤**：`sessions.json` 出现 `"agent:main:orphan:d452b23e-....jsonl" → sessionFile=fab59e9b-....jsonl`（3.1KB，ctime 10:28:20）——这正是编辑器把假 key `orphan:d452b23e-...jsonl` 发给网关后，网关新建的会话。编辑器读的是真主会话文件（内容对），发送却进了幽灵会话（无上下文）→「强制新开 session」的用户体感。

### 1.3 结论
三处代码缺陷（排除 agent:main:main / origin 依赖 / seen_files 不登记）叠加网关重置机制，构成完整故障链。修复必须落在编辑器侧。

---

## 2. 方案 A：会话解析层修复（核心，外科手术式）

> 原则：只改 `edit-web.py` 的 4 个函数 + `inject-helper.mjs` 1 处守卫 + `components.js` 标签级小改。不动 UI 大结构、不动注入锁、不动截断编辑逻辑。

### A1. `_is_excluded_session_key()` — 取消对 agent:main:main 的排除
**位置**：`edit-web.py:390-405`

**Before**：
```python
    if k == 'agent:main:main' or k.endswith(':main'):
        return True
```
**After**：
```python
    if k == 'agent:main:main':
        return False          # ★ 2026-08-06：openclaw.json 无 scope=global，
                              #   它是真实 webchat 主会话（sessions.json 实测），不再排除
    if k.endswith(':main'):
        return True           # 其他 agent 的 *:main 别名仍排除
```
同时更新函数 docstring（删除「scope=global 下被规范化为 global 容器」的失效说法）。

### A2. `list_all_sessions()` — 排除键文件登记 seen_files + 主会话置顶标记
**位置**：`edit-web.py:306-387`，store 循环 L328-334 与孤儿扫描 L352-377。

**Before**（L328-334 内联排除）：
```python
        for k, v in store.items():
            if (':cron:' in k or ':subagent:' in k or ':test-' in k or ':dreaming-' in k or ':elevated-' in k
                    or k == 'global' or k.startswith('global:')
                    or k == 'unknown' or k.startswith('unknown:')
                    or k == 'agent:main:main' or k.endswith(':main')):
                continue
            sf = v.get("sessionFile", "")
            if not sf or not os.path.exists(sf):
                continue
            seen_files.add(os.path.basename(sf))
```
**After**（复用 A1 的判定，并登记被排除容器的文件，杜绝孤儿重复列出）：
```python
        for k, v in store.items():
            if _is_excluded_session_key(k):
                # ★ 修复孤儿重复发现：被排除容器的文件也登记 seen_files，
                #   避免孤儿扫描把 subagent/cron 文件重复列成 orphan: 条目
                sf0 = v.get("sessionFile", "")
                if sf0:
                    seen_files.add(os.path.basename(sf0))
                continue
            sf = v.get("sessionFile", "")
            if not sf or not os.path.exists(sf):
                continue
            seen_files.add(os.path.basename(sf))
```
并在 `sessions.append({...})` 中加一个字段（约 L344）：
```python
                "isMain": (k == 'agent:main:main'),
```
排序改为主会话置顶（L385）：
```python
    sessions.sort(key=lambda s: (not s.get("isMain", False), s.get("updatedAt", 0) or 0), reverse=True)
```
> 说明：排序 key 首项 `not isMain` 配合 `reverse=True` → `isMain=True` 排最前；次项 updatedAt 降序不变。

### A3. `_pick_best_session()` — 确定性优先级：主会话 → webchat → 任意
**位置**：`edit-web.py:407-434`

**After**（整体替换函数体）：
```python
def _pick_best_session(store):
    """从 sessions.json 挑选最佳真实用户对话会话：
    1. 排除 global/unknown/其他 *:main/cron/subagent 等系统容器（agent:main:main 不再排除）
    2. 优先级：agent:main:main（当前主对话）→ origin.provider==webchat → 任意非排除会话
    3. 同优先级取 updatedAt 最新者
    返回 (key, sessionFile)；无可选会话时返回 (None, None)。
    """
    candidates = []
    for k, v in store.items():
        if _is_excluded_session_key(k):
            continue
        sf = v.get("sessionFile")
        if not sf or not os.path.exists(sf):
            continue
        origin = v.get("origin") or {}
        provider = origin.get("provider", "") if isinstance(origin, dict) else ""
        candidates.append({
            "key": k,
            "sf": sf,
            "updated": v.get("updatedAt", 0) or 0,
            "is_main": (k == 'agent:main:main'),
            "is_webchat": provider == "webchat" or ":dashboard:" in k,
        })
    if not candidates:
        return None, None
    for c in candidates:
        if c["is_main"]:
            return c["key"], c["sf"]        # ★ 主对话永远优先，不依赖 origin 元数据
    pool = [c for c in candidates if c["is_webchat"]] or candidates
    best = max(pool, key=lambda c: c["updated"])
    return best["key"], best["sf"]
```

### A4. `get_session_info()` — orphan 假 key 自愈反查 + 兜底确定性回落
**位置**：`edit-web.py:436-499`

关键变化（函数体重构，替换 L450-497 的挑选逻辑）：
1. **显式选中有效会话**：`target_key` 在 store 中且非排除 → 直接用（不变）。
2. **★ orphan 假 key 自愈**：`target_key` 以 `orphan:` 开头时，按文件名反查 store 中 `sessionFile` 同 basename 的真实 key → 返回**真实 key**（历史误点击的脏状态自动修正，如 `orphan:d452b23e-...` → `agent:main:main`）；反查不到（真·未注册归档文件）→ 返回 `(None, file)` 供只读回看，**发送层会拒绝**。
3. **自动挑选**：`_pick_best_session(store)`（A3 后必含主会话）。
4. **终极兜底**：最大 `.jsonl` 按 basename 反查 store 真实 key；查不到返回 `(None, biggest)`（宁可不发，不发明文假 key）。

伪代码（插入 L450 处，替换原「优先/孤儿/终极 fallback」三段）：
```python
    # 0) 显式选中的有效会话（注册于 store 且非系统容器）→ 直接用
    if target_key and not _is_excluded_session_key(target_key):
        entry = store.get(target_key)
        if entry:
            sf = entry.get("sessionFile")
            if sf and os.path.exists(sf):
                return target_key, sf

    # 0.5) ★ 显式选中 orphan: 假 key → 按文件名反查真实注册会话（自愈）
    if target_key and target_key.startswith("orphan:"):
        fname = target_key[len("orphan:"):]
        for k, v in store.items():
            sf = v.get("sessionFile") or ""
            if os.path.basename(sf) == fname:
                return k, sf
        fp = os.path.join(DATA_DIR, fname)
        if os.path.exists(fp):
            return None, fp          # 真·未注册文件：只读回看（发送层拒绝）

    # 1) 自动挑选（主会话优先）
    picked = _pick_best_session(store)
    if picked[0]:
        return picked

    # 2) 终极兜底：最大 .jsonl 反查真实 key；查不到返回 (None, file)（宁缺毋滥）
    ...（保留原逻辑，不变）
```

### A5. `inject_via_websocket()` — 发送硬护栏（假 key 一律回落主对话）
**位置**：`edit-web.py:191`，函数体最前（写注入锁之前）插入：

```python
    # ── 🔒 2026-08-06 发送护栏：orphan:/None 假 key 绝不发给网关 ──
    # 网关收到不存在的 sessionKey 会新建幽灵会话（实测 agent:main:orphan:*），
    # 这是「每次发送都像新开会话」的直接原因。兜底确定性回落 agent:main:main。
    if not session_key or str(session_key).startswith('orphan:'):
        try:
            with open(os.path.join(DATA_DIR, "sessions.json")) as f:
                _store = json.load(f)
            _sf = (_store.get('agent:main:main') or {}).get('sessionFile', '')
            if _sf and os.path.exists(_sf):
                session_key = 'agent:main:main'
        except Exception:
            pass
    if not session_key or str(session_key).startswith('orphan:'):
        raise Exception("安全限制：无法确定发送目标会话（主会话文件缺失）。请检查 sessions 目录。")
```
> 该护栏同时覆盖 `handle_inject` / `momo inject_feeling` / `_send_pulse` 等所有走 `inject_via_websocket` 的路径（单点收口）。

### A6. `inject-helper.mjs` — 传输层兜底守卫（双保险）
**位置**：`inject-helper.mjs:26-30`（`if (!sessionKey)` 检查之后）插入：

```js
// 🔒 2026-08-06：拒绝假 sessionKey，防止网关创建幽灵会话
if (sessionKey.startsWith('orphan:') || sessionKey.startsWith('agent:main:orphan:')) {
  process.stderr.write('Error: refusing to send to fake session key: ' + sessionKey + '\n');
  process.exit(1);
}
```

### A7. 前端 `components.js` — 标签级小改（不动结构）
**位置**：`components.js:17-99`（sessionSelector 组件）

1. `shortKey()` L42：`if (key === 'agent:main:main') return '当前会话';` → `return '📌 当前主对话';`
2. render 循环 L45-55：给 `isMain` 条目加标签：
   ```js
   html += '<span class="cl-sess-name" style="color:' + (isCurr ? '#58a6ff' : '#c9d1d9') + '">'
         + (s.isMain ? '📌 ' : '') + shortKey(sk) + '</span>';
   ```
3. 点击 orphan 条目时提示只读（L88 点击分支内）：
   ```js
   if (k.indexOf('orphan:') === 0) toast('存档/孤儿会话：只读回看，发送将自动回落主对话');
   ```
4. 可选优化（避免高亮错位）：switchSession 成功后用后端返回的真实 key 覆盖 `ctx._current`：
   ```js
   ctx._current = (d && d.sessionKey) || k;
   ```

### A 项风险与回滚
| 风险 | 影响 | 缓解/回滚 |
|---|---|---|
| agent:main:main 出现在列表后，若网关某天真的配置了 scope=global，消息会被规范化到 global | 低（当前无配置；即便发生，症状是消息进 global，可通过 `openclaw.json` 加 `session.scope: session` 反制） | 若出现，回滚 A1 单行即可 |
| 自愈反查把多个 orphan 文件映射到同一真实 key | 无实质影响（只是显示归位） | — |
| 发送护栏把「想发到存档会话」的请求改发主会话 | 符合设计预期（存档只读） | 如需改回，回滚 A5 两段 |
| **整体回滚**：`git checkout -- edit-web.py inject-helper.mjs static/js/components.js` + 重启编辑器（`bash start-clean.sh`） | — | 全程 < 1 分钟 |

---

## 3. 方案 B：会话备份保险 cron（防重置丢历史）

### B1. 新增脚本 `scripts/session-backup.py`（stdlib only，约 50 行）
```python
#!/usr/bin/env python3
# session-backup.py — 定期备份 OpenClaw sessions 目录（含 .reset. 归档）到备份区
# 部署（与 pulse-cron.sh 同风格，crontab 添加）：
#   30 2 * * * python3 /vol2/1000/AI专用/所有自动化/轻如烟/scripts/session-backup.py > /dev/null 2>&1
import os, glob, shutil, datetime, json, time, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
cfg = {}
try:
    cfg = json.load(open(os.path.join(SCRIPT_DIR, 'editor-config.json')))
except Exception:
    pass
DATA_DIR = cfg.get('DATA_DIR') or '/vol1/@apphome/trim.openclaw/data/home/.openclaw/agents/main/sessions'
BACKUP_ROOT = os.path.join(cfg.get('ALL_AUTO_DIR') or '/vol2/1000/AI专用/所有自动化', 'backups', 'sessions-archive')
KEEP_DAYS = 14

stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
dst = os.path.join(BACKUP_ROOT, stamp)
os.makedirs(dst, exist_ok=True)

count = 0
for fp in glob.glob(os.path.join(DATA_DIR, '*.jsonl*')) + [os.path.join(DATA_DIR, 'sessions.json')]:
    b = os.path.basename(fp)
    if b.endswith('.trajectory.jsonl') or '.trajectory-path' in b or not os.path.isfile(fp):
        continue
    if not (b.endswith('.jsonl') or '.jsonl.' in b or b == 'sessions.json'):
        continue        # 只备份会话文件与 sessions.json（跳过 .usage-cost-cache.json 等）
    try:
        shutil.copy2(fp, os.path.join(dst, b)); count += 1
    except Exception as e:
        print(f'skip {b}: {e}', file=sys.stderr)

cutoff = time.time() - KEEP_DAYS * 86400
for d in sorted(os.listdir(BACKUP_ROOT)):
    p = os.path.join(BACKUP_ROOT, d)
    if os.path.isdir(p):
        try:
            if os.path.getmtime(p) < cutoff:
                shutil.rmtree(p, ignore_errors=True)
        except Exception:
            pass
print(f'session backup ok: {count} files -> {dst}')
```
> 说明：`*.jsonl*` 通配天然覆盖 `*.jsonl.reset.<ts>`、`*.jsonl.deleted.<ts>`、`*.jsonl.trim-backup.<ts>`；`sessions.json` 一并备份（含 key→file 映射，供恢复时反查）。

### B2. 部署
```bash
(crontab -l 2>/dev/null; echo "30 2 * * * python3 /vol2/1000/AI专用/所有自动化/轻如烟/scripts/session-backup.py > /dev/null 2>&1") | crontab -
# 实施时立即手动跑一次，先给当前状态（含 2 个 .reset. 归档）留底：
python3 /vol2/1000/AI专用/所有自动化/轻如烟/scripts/session-backup.py
```

### B 项风险与回滚
- 风险：极低（只读拷贝）；备份目录增长可控（14 天滚动，单次 ~20MB）。
- 回滚：`crontab -e` 删行 + 删除脚本；备份目录删除即完全撤销。

---

## 4. 方案 C：旧对话恢复（.reset. 归档）

### C1（推荐，默认执行）：归档只读展示
**位置**：`edit-web.py:352-377` 孤儿扫描段，追加对归档文件的扫描：

```python
    # 发现归档文件（.reset. / .deleted. / .trim-backup.）→ 只读存档条目
    try:
        for pat in ("*.jsonl.reset.*", "*.jsonl.deleted.*"):
            for fp in glob.glob(os.path.join(DATA_DIR, pat)):
                basename = os.path.basename(fp)
                if basename in seen_files:
                    continue
                try:
                    fsize = os.path.getsize(fp)
                    mtime = os.path.getmtime(fp)
                    sessions.append({
                        "sessionKey": f"orphan:{basename}",
                        "sessionFile": fp,
                        "updatedAt": int(mtime * 1000),
                        "createdAt": int(os.path.getctime(fp) * 1000),
                        "totalTokens": 0,
                        "messageCount": fsize // 200,
                        "orphan": True,
                        "archived": True,       # ★ 前端可据此打「存档」标
                    })
                except Exception:
                    continue
    except Exception:
        pass
```
效果：8/6 的 67aaa3c0 归档（66 条真实对话）与 8/5 的 95c0820e 归档在会话下拉列表以 `存档:` 条目出现，点击后 `get_session_info` 返回 `(None, file)` → `read_session` 正常读取（已核实 read_session 直接读文件、无快照复制，对归档安全）→ **可完整回看、复制旧对话**。

**配套只读保护**（防止对归档文件执行截断/裁剪）：在 `handlers/inject_handler.py:32 handle_edit` 与 `handlers/session_handler.py:89 handle_trim_session` 内，`get_session_info()` 后加：
```python
        if not sk:
            handler._send_json(200, {"ok": False, "error": "存档会话为只读，禁止编辑/裁剪。如需操作请先人工合并。"})
            return
```

**C1 风险**：极低（只读）；列表多几个存档条目。回滚：删除追加段。

### C2（默认不执行，需 dandan 拍板）：归档合并回主会话
- **可行性**：文件层面可行（JSONL 拼接 + parentId 断链修复 + 角色序列校验），但**网关内存态与文件不同步**，外部改文件有被网关下一次写覆盖或再次触发 role-ordering 校验失败的风险——**正是 reset 的诱因**，操作不当会二次归档。
- **建议执行条件（若 dandan 决定做）**：一次性脚本 `merge-reset-session.py <reset_file> [--target agent:main:main]`，流程：① 备份 live 与归档两份（pre-merge 快照）；② 确认网关空闲（主会话无 processing/queued，`gateway.log` 无新 run）；③ 解析归档，剔除 `session/model_change/thinking_level_change/custom` 头，重写 parentId 断链（映射旧 id→新 id 或置 null）；④ 追加到 live 文件（或按时间序重排），用 A 项新增的 `_session_tail_health()` 校验角色序列；⑤ 提示重启网关（`openclaw gateway restart`）使内存态重载。
- **明确建议**：**C1 已满足「找回旧对话」诉求**（可读、可复制、可手动摘录要点回贴给主会话）。C2 仅当 dandan 要求「让 AI 直接续上旧上下文工作」时才做，且必须人工确认。

---

## 5. 方案 D：触发面治理（防重启中断 → 重置的二次防护）

### D1. 发送前 transcript 尾部健康检查（关键：把「消息落入损坏会话→触发重置」挡在发送前）
**位置**：`edit-web.py` 新增函数 + `inject_via_websocket()` 内调用（A5 护栏之后）。

```python
def _session_tail_health(session_file):
    """发送前检查会话尾部完整性，防中断残留触发网关 role-ordering 重置。
    返回 (ok, reason)。规则保守：只报确定异常，不误伤正常形态。
    1. 会话文件存在 .lock 且 2 分钟内被写过 → 网关正在写入，跳过检查
    2. 尾部最近 30 条 message 角色序列合法：
       toolResult 前必须是 assistant；不允许 assistant→assistant 相邻；
       toolResult 后不允许直接跟 user
    3. 文件末尾为未闭合 toolResult → 中断残留，判定异常
    """
    try:
        lock = session_file + '.lock'
        if os.path.exists(lock) and time.time() - os.path.getmtime(lock) < 120:
            return True, ''            # 活跃写入中，跳过
        roles = []
        with open(session_file, 'r', encoding='utf-8') as f:
            for line in f:
                s = line.strip()
                if not s:
                    continue
                try:
                    d = json.loads(s)
                except Exception:
                    continue
                if d.get('type') != 'message':
                    continue
                r = (d.get('message') or {}).get('role')
                if r in ('user', 'assistant', 'toolResult'):
                    roles.append(r)
        if not roles:
            return True, ''
        tail = roles[-30:]
        for i in range(1, len(tail)):
            prev, cur = tail[i-1], tail[i]
            if cur == 'toolResult' and prev != 'assistant':
                return False, f'会话尾部角色序列异常：toolResult 前不是 assistant（倒数第 {len(tail)-i} 条）'
            if prev == 'assistant' and cur == 'assistant':
                return False, f'会话尾部角色序列异常：连续两个 assistant（倒数第 {len(tail)-i} 条）'
            if cur == 'user' and prev == 'toolResult':
                return False, f'会话尾部角色序列异常：toolResult 后直接跟 user（倒数第 {len(tail)-i} 条）'
        if tail[-1] == 'toolResult':
            return False, '会话尾部为未闭合 toolResult：上次运行疑似被中断，发送会触发网关重置'
        return True, ''
    except Exception:
        return True, ''                # 检查不可用放行，不阻塞正常使用
```
在发送路径（`handlers/inject_handler.py:15 handle_inject` 与 `edit-web.py:1635 _send_pulse`，二者均已有 `sk, session_file = get_session_info()` 的结果）中调用：
```python
    ok, reason = _session_tail_health(session_file)
    if not ok:
        raise Exception(f"安全限制：{reason}。建议在会话列表「存档」中回读旧对话，或人工修复会话尾部后再发送。")
```
> 实现建议：健康检查放在 `handle_inject`（`inject_handler.py:15`）与 `_send_pulse`（`edit-web.py:1635`）两处，均已有 `sk, session_file = get_session_info()` 的结果；`session_file` 为空或异常时跳过检查。
> 行为：异常时**拒绝发送**并给出明确错误（同注入锁的体验）；不提供默认放行。若 dandan 确需强发，可临时加 `force=1` 参数（仅 owner 可用），但默认策略为拒绝。
> 若 8/6 10:02 有此检查，67aaa3c0 的损坏尾部会被拦截 → 重置不会发生 → 66 条对话不丢。

### D2. 重置检测提示（重启后可见）
**位置**：`edit-web.py:1176 _system_health()` 增加字段 + `components.js` sessionSelector render 显示横幅（约 5 行 JS）。

```python
def _system_health():
    ...  # 现有逻辑不变
    # ★ 2026-08-06：检测近期会话重置归档，提示用户
    try:
        import glob as _glob
        resets = sorted(
            _glob.glob(os.path.join(DATA_DIR, '*.jsonl.reset.*')),
            key=os.path.getmtime, reverse=True)
        recent = [os.path.basename(r) for r in resets
                  if time.time() - os.path.getmtime(r) < 7 * 86400]
        if recent:
            result["resetNotice"] = (f"⚠️ 检测到 {len(recent)} 个会话重置归档"
                                     f"（最近: {recent[0][:48]}…）。旧对话可在会话列表「存档」中回看。")
    except Exception:
        pass
    return result
```
前端 `components.js` sessionSelector render（`el.innerHTML = html` 之前）追加：
```js
    var _h = window._batchData && window._batchData.systemHealth;
    if (_h && _h.resetNotice) {
      html = '<div style="color:#f0883e;font-size:11px;padding:2px 0;border-bottom:1px solid #30363d">'
           + _h.resetNotice + '</div>' + html;
    }
```
（`window._batchData` 已由 dashboard.js 的 20s 批量轮询填充，无需新管道。）

### D 项风险与回滚
| 风险 | 影响 | 缓解/回滚 |
|---|---|---|
| D1 误判正常会话（如活跃写入时锁文件 mtime 判断失败）→ 拒绝发送 | 低（120s 锁窗口 + 只报确定性异常；误判时错误信息明确，可人工判断） | 临时注释调用点即可放行 |
| D1 检查读取大文件（10MB trajectory 不读，只读 session 文件尾部） | 低（读最后 30 条角色，逐行扫描 2MB 约几十 ms） | — |
| D2 横幅骚扰 | 极低（仅重置后 7 天内显示，且仅在存在 .reset. 时） | 删前端 5 行即可 |

---

## 6. 实施顺序与验收标准

### 实施顺序（每步可独立回滚）
1. **预检与留底**：手动跑 B 备份脚本（当前 2 个 .reset. 归档 + 全部会话先留底）；`git status` 确认工作区干净。
2. **A1→A3（解析层三函数）**：编辑 `edit-web.py`，`python3 -m py_compile edit-web.py` 语法自检。
3. **A4（get_session_info 自愈）**：同上。
4. **A5（inject_via_websocket 护栏）+ D1（_session_tail_health + 两处调用）**。
5. **A6（inject-helper.mjs 守卫）**：`bun --check inject-helper.mjs` 语法自检（或 node --check）。
6. **A7 + D2（前端）**：改 `components.js`。
7. **C1（归档只读展示 + 只读保护）**：改 `edit-web.py` + 两个 handler。
8. **B（session-backup.py + crontab）**。
9. **重启编辑器**：`bash start-clean.sh`（不影响网关）。
10. **git commit**：`git add -A && git commit -m "fix: 会话解析层修复——主会话不再被排除/孤儿自愈/发送护栏/归档只读+备份"`。

### 验收标准（逐条，全部通过才算完成）
1. **「不再强制新开」核心验收**：编辑器内连续发送 10 次消息，每次 `GET /api/session` 返回的 `sessionKey` 恒为 `agent:main:main`（且 `sessionFile` 不变）；`sessions.json` 不再新增 `agent:main:orphan:*` 条目。
2. **会话列表正确性**：`GET /api/list-sessions` 第一条为 `agent:main:main`（`isMain:true`），**不再出现** `orphan:d452b23e-...` 这类主会话假孤儿；subagent/cron 文件不再被列为 orphan。
3. **发送护栏**：手动 `POST /api/switch-session?key=orphan:xxx.jsonl` 后再发送，消息实际进入 `agent:main:main`（可在 gateway.log 或会话内看到新消息），且 `sessions.json` 无新增幽灵会话。
4. **归档回看**：会话下拉列表出现 `存档:` 条目（67aaa3c0 / 95c0820e），点击可读 66 条旧对话；对存档条目执行编辑/裁剪被拒绝。
5. **备份**：`backups/sessions-archive/<ts>/` 存在当日快照，含 `*.jsonl` 与 `sessions.json`；`crontab -l` 有 02:30 条目。
6. **健康检查**：手工在测试副本上构造「尾部 toolResult 未闭合」的假会话文件并指向之，发送被拒绝且错误信息明确；正常会话发送不受影响。
7. **回归**：注入锁（同轮二次注入拒绝）、截断编辑（最近 N 轮 + 50% 保险线）、子代理 spawn、守夜 pulse、momo 摸摸 全部走一遍，行为与改造前一致。

---

## 7. 禁止做的改动（红线）

1. **不得修改网关代码/配置**（node_modules 内 agent-runner 的 resetReplyRunSession、openclaw.json 均不动）——本方案全部改动都在编辑器侧。
2. **不得破坏注入锁**：`inject_via_websocket` 的锁写入/清理顺序不变（A5/D1 插入点均在锁逻辑之前）。
3. **不得放宽截断编辑安全线**：`edit_message`（`edit-web.py:696`）的 MAX_EDIT_DEPTH / 50% 保险线 / parentId 修复逻辑一律不动；只新增「存档会话只读」拒绝。
4. **不得改子代理 spawn 路径**：`_spawn_subagent_process`（`edit-web.py:1797`）不变（其依赖的 `get_session_info` 修复后自然受益）。
5. **不得自动合并归档**：C2 只能人工执行，任何自动 merge 逻辑都不进代码。
6. **不得删除/移动 .reset. 归档文件**：即使 UI 不显示也保留原件（本方案只增只读条目）。
7. **不得改 sessions.json**：任何修复都不直接改写 sessions.json（网关独占），只做读取与解析。
8. **不得改前端大结构**：components.js 只允许标签/提示级改动（A7、D2 共约 10 行），不动渲染框架、不动轮询。

---

## 8. 遗留风险（评审时需知晓）

1. **网关侧重置机制仍在**：本方案把「损坏会话上发送」挡在编辑器侧，但其他入口（webchat 直连、cron、hooks）若向损坏会话发消息仍可能触发 resetReplyRunSession。根治需网关侧自检（超出本方案范围，建议作为后续单独议题）。
2. **D1 健康规则基于本环境 transcript 形态归纳**：若网关升级改变 role 序列约定（如引入新的 message type），规则可能误判；已设计为「检查异常时放行」兜底。
3. **agent:main:main 的 origin 元数据可能再次缺失**：A3 已不依赖 origin（主会话硬优先），故不受影响。
4. **多 agent 环境**：`*:main`（非 main agent）仍被排除，若未来启用多 agent 主对话需重新评估。
5. **备份频率**：每日 02:30 一次；若 dandan 希望更密（如每 6h），改 crontab 表达式即可。

---

## 9. 待 dandan 拍板的关键决策点

**最关键的拍板点：C2「归档合并回主会话」做不做。**
- 默认建议：**只做 C1（只读存档回看）**，不合并。合并有二次触发重置的风险，且 C1 已能找回全部 66 条旧对话（可读、可复制、可摘录回贴）。
- 若 dandan 要求「让 AI 直接续上旧上下文工作」，则批准 C2 的**人工**合并流程（含 pre-merge 备份 + 网关空闲确认 + 角色校验 + 网关重启），并明确授权该一次性操作。
- 次要拍板点：D1 健康检查发现异常时**默认拒绝发送**（推荐）还是仅警告；以及备份频率 02:30 每日是否足够。
