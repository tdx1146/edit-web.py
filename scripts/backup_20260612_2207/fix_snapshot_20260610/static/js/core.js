
// ── 状态层 ──────────────────────────────────────────────────────────────────
const store = {
  msgCache: [], pairs: [], currentPage: 0, totalPages: 0,
};
// 全局别名
['msgCache','pairs','currentPage','totalPages']
  .forEach(k => Object.defineProperty(window, k, { get: () => store[k], set: v => store[k] = v }));

// Helper: 安全和并批量更新 store
function storeSet(updates) { Object.assign(store, updates); }

// 自动轮询追踪器
let _lastAsstLen = 0;
let _lastRefreshCount = 0;

// ── API 层 ──────────────────────────────────────────────────────────────────
const api = {
  _t: () => '?t=' + Date.now(),
  async get(path) {
    const r = await fetch(path + (path.includes('?') ? '&' : '?') + 't=' + Date.now());
    if (!r.ok) throw new Error('API ' + r.status + ': ' + path);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: body !== undefined ? JSON.stringify(body) : '{}'
    });
    if (!r.ok) throw new Error('API ' + r.status + ': ' + path);
    return r.json();
  },
  // ── 各端点 ──
  session:       () => api.get('/api/session'),
  sessionRpc:    () => api.get('/api/session-rpc'),
  status:        () => api.get('/api/status'),
  cacheStats:    () => api.get('/api/cache-stats'),
  backups:       () => api.get('/api/backups'),
  backupStale:   () => api.get('/api/backup-stale'),
  digestSkill:   () => api.get('/api/digestion-skill'),
  thinkingStatus:() => api.get('/api/thinking-status'),
  weaponryToggle:() => api.get('/api/weaponry-toggle'),
  memoryFiles:   () => api.get('/api/memory-files'),
  memoryFile:    (n) => api.get('/api/memory-file?name=' + encodeURIComponent(n)),
  secretaryLog:  () => api.get('/api/secretary-log'),
  subagentHist:  () => api.get('/api/subagent-history'),
  subagentsList:  () => api.get('/api/subagents'),
  reminders:     () => api.get('/api/reminders'),
  edit:          (i, t, a) => api.post('/api/edit', {index: i, text: t, approved: !!a}),
  inject:        (m) => api.post('/api/inject', {message: m}),
  injectFeeling: (t) => api.post('/api/momo', {sub_action: 'inject_feeling', feeling: t}),
  clearLock:     () => api.post('/api/clear-inject-lock'),
  abort:         () => api.post('/api/abort'),
  momo:          (sub, extra) => api.post('/api/momo', Object.assign({sub_action: sub}, extra || {})),
  trimSession:   () => api.post('/api/trim-session'),
  thinkingToggle:(e) => api.post('/api/thinking-toggle', {enable: !!e}),
  pet:           () => api.post('/api/pet-me'),
  restartHttp:   () => api.post('/api/restart-http'),
  awakeList:     () => api.get('/api/awake-questions/list'),
  awakeSave:     (c) => api.post('/api/awake-questions/save', {content: c}),
  remindersAdd:  (t, a, h) => api.post('/api/reminders', {action:'add', text:t, assignee:a, trigger_hint:h}),
  remindersDone: (id) => api.post('/api/reminders', {action:'done', id}),
  remindersClearDone: () => api.post('/api/reminders', {action:'clear_done'}),
  spawnSubagent: (t, m) => api.post('/api/spawn-subagent', {task: t, model: m}),
  execSubagent:  (t, m) => api.post('/api/exec-subagent', {task: t, model: m}),
  authSubagent:  () => api.post('/api/auth-subagent'),
  systemHealth:  () => api.get('/api/system-health'),
  // 文件工具
  tbRead:        (p, pw) => api.get('/api/tb-read-file?path=' + encodeURIComponent(p) + '&pw=' + encodeURIComponent(pw||'')),
  tbSave:        (p, c) => api.post('/api/tb-save-file', {path: p, content: c}),
  tbCreate:      (f, n, d) => api.post('/api/tb-create-file', {folder: f, name: n, is_dir: !!d}),
  tbDelete:      (p) => api.post('/api/tb-delete-file', {path: p}),
  tbRename:      (o, n, f) => api.post('/api/tb-rename-file', {old_path: o, new_name: n, new_folder: f || ''}),
  // 文件浏览
  listFiles:     (p) => api.get('/api/list-files?path=' + encodeURIComponent(p||'')),
  browseDirs:    () => api.get('/api/browse-dirs'),
};

// ── 🐢 串行加载状态指示器（避免单线程Python服务器并发阻塞） ─────
(async () => {
  try {
    const d = await api.status();
    if (!d.ok) return;
    const pct = d.percent || 0;
    const fill = document.getElementById('ctx-bar-fill');
    fill.style.width = Math.min(pct, 100) + '%';
    fill.style.background = pct > 90 ? '#f85149' : pct > 75 ? '#d29922' : '#58a6ff';
    document.getElementById('ctx-display').innerHTML =
      '📚 上下文: <b>' + fmtNum(d.totalTokens) + '</b>/' + fmtNum(d.contextTokens) +
      ' (' + pct + '%)' +
      ' · ' + fmtNum(d.inputTokens) + ' in / ' + fmtNum(d.outputTokens) + ' out';
    document.getElementById('cache-display').textContent = '🗄️ 缓存: ' + fmtNum(d.cacheRead);
    document.getElementById('comp-display').textContent = '🧹 压缩: ' + d.compactionCount + '次';
    document.getElementById('trim-count').textContent = d.trimCount || 0;
    // 更新上轮缓存命中率
    updateLastRoundCache();
  } catch(e) {
    // ignore
  }
  // 每10秒定时器集中刷新状态指示器（包在 rAF 里防抖动）
  requestAnimationFrame(function() {
    checkBackupStale();
    checkSystemHealth().then(() => new Promise(r => setTimeout(r, 100))).then(() => checkSecretary()).then(() => checkReminders()).then(() => checkDigestion()).then(() => checkThinking()).then(() => checkWeaponry());
  });
})();
async function updateLastRoundCache() {
  try {
    const d = await api.cacheStats();
    if (!d.ok) return;
    // 用 previousRound（上一轮完整回复）代替当前轮
    const prev = d.previousRound;
    if (!prev) {
      document.getElementById('cache-summary').textContent = '暂无上轮数据';
      return;
    }
    const pct = prev.cachePct;
    let clr = '#58a6ff';
    if (pct < 50) clr = '#f85149';
    else if (pct < 90) clr = '#d29922';
    document.getElementById('cache-summary').innerHTML =
      '<span style="color:' + clr + '">' + pct + '%</span>' +
      ' · input ' + prev.input + ' · cache ' + prev.cacheRead +
      ' · <span style="color:#8b949e">¥' + prev.cost + '</span>';
  } catch(e) {}
}
function fmtNum(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'k';
  return String(n);
}

// ── 消息发送缓存（防丢失 / 可重发 / 可编辑）──
function _renderSentCache() {
  const caches = JSON.parse(localStorage.getItem('sentCache') || '[]');
  const recent = caches.slice(-20);
  let el = document.getElementById('sent-cache-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sent-cache-panel';
    el.style.cssText = 'margin-top:6px;font-size:11px;max-height:120px;overflow-y:auto;background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:4px 6px;display:none';
    const after = document.getElementById('awake-status')?.parentNode;
    if (after) after.appendChild(el);
  }
  const unsent = recent.filter(c => !c.sent);
  if (unsent.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = '<div style="color:#f0883e;margin-bottom:2px">📋 待重发 (' + unsent.length + ')</div>' +
    unsent.slice(-5).reverse().map(function(c) {
      var txt = c.text.length > 40 ? c.text.slice(0,40) + '…' : c.text;
      return '<div style="display:flex;gap:4px;margin:2px 0;align-items:center">' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9d1d9">' + escapeHtml(txt) + '</span>' +
        '<button onclick="sentRetry(' + caches.indexOf(c) + ')" style="padding:1px 6px;font-size:10px;background:#238636;color:#fff;border:none;border-radius:3px;cursor:pointer">重发</button>' +
        '<button onclick="sentEdit(' + caches.indexOf(c) + ')" style="padding:1px 6px;font-size:10px;background:#1f6feb;color:#fff;border:none;border-radius:3px;cursor:pointer">编辑</button>' +
        '</div>';
    }).join('');
}
function sentRetry(idx) {
  var caches = JSON.parse(localStorage.getItem('sentCache') || '[]');
  var entry = caches[idx];
  if (!entry) return;
  document.getElementById('awake-editor').value = entry.text;
  entry.sent = true;
  localStorage.setItem('sentCache', JSON.stringify(caches));
  _renderSentCache();
  awakeSendNoTrunc();
}
function sentEdit(idx) {
  var caches = JSON.parse(localStorage.getItem('sentCache') || '[]');
  var entry = caches[idx];
  if (!entry) return;
  document.getElementById('awake-editor').value = entry.text;
  document.getElementById('awake-editor').focus();
  caches.splice(idx, 1);
  localStorage.setItem('sentCache', JSON.stringify(caches));
  _renderSentCache();
}


// toast moved to inline



function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function renderMarkdown(html) {
  // html 已 escape，安全处理 markdown 语法
  // 1. 代码块（必须最先处理，避免内部被误转）
  html = html.replace(/~~~([\s\S]*?)~~~/g, '<pre><code>$1</code></pre>');
  html = html.replace(/\`\`\`([\s\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
  // 2. 表格：行首|开头且连续多行
  html = html.replace(/(^|\n)(\|[^\n]+\|(?:\n\|[^\n]+\|)+)/gm, function(m, before, tableBlock) {
    var rows = tableBlock.trim().split('\n');
    var isHeader = true;
    var thead = '', tbody = '';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var cols = row.split('|').filter(function(c){ return c.trim() !== ''; });
      // 跳过分隔行（|---|---|）
      if (cols.length > 0 && /^[\s:-]+$/.test(cols.join(''))) continue;
      if (isHeader) {
        thead += '<tr>' + cols.map(function(c){ return '<th>' + c.trim() + '</th>'; }).join('') + '</tr>';
        isHeader = false;
      } else {
        tbody += '<tr>' + cols.map(function(c){ return '<td>' + c.trim() + '</td>'; }).join('') + '</tr>';
      }
    }
    var tbl = '<table>';
    if (thead) tbl += '<thead>' + thead + '</thead>';
    if (tbody) tbl += '<tbody>' + tbody + '</tbody>';
    tbl += '</table>';
    return before + tbl;
  });
  // 3. 行内代码
  html = html.replace(/\`([^`]+)\`/g, '<code>$1</code>');
  // 4. 粗体 + 斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // 5. 行内链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#58a6ff">$1</a>');
  return html;
}

let cachePanelOpen = false;
function toggleCachePanel() {
  cachePanelOpen = !cachePanelOpen;
  document.getElementById('cache-detail').style.display = cachePanelOpen ? 'block' : 'none';
  document.getElementById('cache-toggle').textContent = cachePanelOpen ? '▼' : '▶';
  if (cachePanelOpen) loadCacheStats();
}