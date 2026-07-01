async function loadAllIndicators() {
  await new Promise(r => setTimeout(r, 150));
  checkBackupStale();
  await new Promise(r => setTimeout(r, 150));
  checkSystemHealth();
  await new Promise(r => setTimeout(r, 150));
  checkSecretary();
  await new Promise(r => setTimeout(r, 150));
  checkReminders();
  await new Promise(r => setTimeout(r, 150));
  checkDigestion();
  await new Promise(r => setTimeout(r, 150));
  checkThinking();
  await new Promise(r => setTimeout(r, 150));
  checkWeaponry();
}
loadAllIndicators();

function checkBackupStale() {
  api.backupStale()
    .then(d => {
      const el = document.getElementById('backup-stale');
      if (!d.ok || d.stale === undefined) { el.textContent = '💾 ?'; return; }
      if (d.stale) {
        el.textContent = '💾 ⚠️';
        el.style.color = '#da3633';
        el.title = '备份过时：' + d.stale_files.join(', ') + ' | 最后打包: ' + d.last_pack;
      } else {
        el.textContent = '💾 ✅ ' + d.last_pack;
        el.style.color = '#3fb950';
        el.title = '备份最新 | ' + d.file_count + ' 个核心文件已同步';
      }
    })
    .catch(() => { document.getElementById('backup-stale').textContent = '💾 ?'; });
}

function checkSystemHealth() {
  return api.systemHealth().then(d => {
      const el = document.getElementById('sys-health');
      const val = el.querySelector('span') || el;
      const hooksOk = d.hooks && d.hooks.enabled;
      const cronOk = d.cron && d.cron.enabled && d.cron.last_ok === 'ok';
      const ctxOk = d.context && d.context.ok;
      const allOk = hooksOk && cronOk && ctxOk;
      if (allOk) {
        val.textContent = '✅';
        val.style.color = '#3fb950';
        let t = '系统自动化正常：';
        t += '\nhooks: session-memory=' + (d.hooks.details['session-memory'] ? '✅' : '❌') + ' command-logger=' + (d.hooks.details['command-logger'] ? '✅' : '❌');
        t += '\ncron: 武器库' + (cronOk ? ' ✅' : ' ❌');
        t += '\ncontext: ' + d.context.actual/1000 + 'K' + (ctxOk ? ' ✅' : ' ❌');
        el.title = t;
      } else {
        val.textContent = '⚠️';
        val.style.color = '#da3633';
        let t = '系统异常：';
        if (!hooksOk) t += '\nhooks: ' + JSON.stringify(d.hooks.details);
        if (!cronOk) t += '\ncron: enabled=' + d.cron.enabled + ' last=' + d.cron.last_ok;
        if (!ctxOk) t += '\ncontext: ' + d.context.actual + ' (期望 ' + d.context.expected + ')';
        el.title = t;
      }
    })
    .catch(() => { var el=document.getElementById('sys-health'); var v=el.querySelector('span')||el; v.textContent='?'; v.style.color='#f85149'; });
}

function checkSecretary() {
  api.secretaryLog().then(d => {
      const el = document.getElementById('secretary-count');
      if (d.ok) {
        el.textContent = d.total;
        el.style.color = d.total > 0 ? '#58a6ff' : '#8b949e';
        document.getElementById('secretary-indicator').title = '小秘书观察了 ' + d.total + ' 次文件变更\n最近: ' + (d.recent && d.recent.length ? d.recent[d.recent.length-1] : '无');
      }
    })
    .catch(() => {});
}

function checkReminders() {
  api.reminders().then(d => {
      const btn = document.querySelector('button[onclick="openReminderDialog()"]');
      if (d.ok && d.count > 0) {
        btn.textContent = '📋 ' + d.count;
        btn.style.borderColor = '#f0c040';
        btn.style.color = '#f0c040';
        btn.title = d.count + ' 条待办提醒';
      } else {
        btn.textContent = '📋';
        btn.style.borderColor = '#30363d';
        btn.style.color = '#8b949e';
        btn.title = '提醒系统';
      }
    })
    .catch(() => {});
}

// 手机端通用textarea触摸拖拽缩放
function enableMobileResize(ta) {
  if (!ta || ta.dataset.mobileResize) return;
  ta.dataset.mobileResize = '1';
  var startY, startH;
  ta.addEventListener('touchstart', function(e) {
    // 只有触摸底部时才触发
    var rect = ta.getBoundingClientRect();
    var touchY = e.touches[0].clientY;
    if (touchY < rect.bottom - 30) return;
    startY = touchY;
    startH = ta.offsetHeight;
  }, {passive: true});
  ta.addEventListener('touchmove', function(e) {
    if (!startY) return;
    var dy = e.touches[0].clientY - startY;
    var newH = Math.max(60, startH + dy);
    ta.style.height = newH + 'px';
  }, {passive: true});
  ta.addEventListener('touchend', function() { startY = null; }, {passive: true});
}

// 自动给所有textarea启用触摸缩放
document.addEventListener('DOMContentLoaded', function() {
  // 使 textarea 可从右上+右下拖拽变长
  function setupResize(el) {
    el.style.resize = "vertical";

    // 在手柄所属的 textarea 外面包一层紧身容器
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;width:100%";
    // 把 textarea 的 margin 转移到容器上
    const m = el.style.marginBottom;
    if (m) { wrap.style.marginBottom = m; el.style.marginBottom = "0"; }
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    // 右上角手柄——贴在 textarea 本体右上角
    const grip = document.createElement("div");
    grip.style.cssText = "position:absolute;top:0;right:0;width:24px;height:16px;cursor:nw-resize;z-index:10;background:linear-gradient(225deg,transparent 40%,#666 60%,#888 100%);border-radius:0 6px 0 0;opacity:0.4";
    grip.title = "上拖变大，下拖变小";
    grip.onmouseenter = function() { this.style.opacity = "0.8"; };
    grip.onmouseleave = function() { this.style.opacity = "0.4"; };
    grip.onmousedown = function(e) {
      e.preventDefault(); e.stopPropagation();
      const startY = e.clientY, startH = el.offsetHeight;
      function mm(ev) {
        const delta = startY - ev.clientY;
        el.style.height = Math.max(50, startH + delta) + "px";
      }
      function mu() { document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); }
      document.addEventListener("mousemove", mm);
      document.addEventListener("mouseup", mu);
    };
    // 移动端 touch 支持
    grip.ontouchstart = function(e) {
      var touch = e.touches[0];
      var startY = touch.clientY, startH = el.offsetHeight;
      function tm(ev) {
        ev.preventDefault();
        var t = ev.touches[0];
        var delta = startY - t.clientY;
        el.style.height = Math.max(50, startH + delta) + "px";
      }
      function tu() { document.removeEventListener("touchmove", tm); document.removeEventListener("touchend", tu); }
      document.addEventListener("touchmove", tm, {passive: false});
      document.addEventListener("touchend", tu);
    };
    wrap.appendChild(grip);
  }
    document.querySelectorAll("textarea").forEach(setupResize);
  });
// 动态创建的textarea也启用
var origCreateTextarea = document.createElement;
document.createElement = function(tag) {
  var el = origCreateTextarea.call(document, tag);
  if (tag === 'textarea' || tag === 'TEXTAREA') {
    setTimeout(function() { enableMobileResize(el); }, 100);
  }
  return el;
};

// 思考模式检测
function checkThinking() {
  var el = document.getElementById('think-status');
  var parent = document.getElementById('think-toggle');
  api.thinkingStatus().then(function(d){
      if (d.thinking) {
        el.textContent = '开';
        parent.style.background = '#d29922';
        parent.style.color = '#000';
        parent.style.borderColor = '#d29922';
        parent.title = '思考模式：已开启（点击关闭）';
      } else {
        el.textContent = '关';
        parent.style.background = '#21262d';
        parent.style.color = '#8b949e';
        parent.style.borderColor = '#30363d';
        parent.title = '思考模式：已关闭（点击开启）';
      }
      // 同步更新监控栏和红点
      var dot = document.getElementById('think-dot');
      if (dot) {
        dot.style.background = d.thinking ? '#da3633' : '#30363d';
        dot.style.borderColor = d.thinking ? '#da3633' : '#30363d';
        dot.title = d.thinking ? '思考模式：已开启（点击关闭）' : '思考模式：已关闭（点击开启）';
      }
      var dsEl = document.getElementById('ds-thinking-val');
      if (dsEl) {
        dsEl.textContent = d.thinking ? '开' : '关';
        dsEl.style.color = d.thinking ? '#d29922' : '#8b949e';
      }
    })
    .catch(function(){ 
      el.textContent = '?'; 
      var dsEl = document.getElementById('ds-thinking-val');
      if (dsEl) dsEl.textContent = '?';
    });
}

// 切换思考模式（写入config持久化）
function toggleThinking() {
  var el = document.getElementById('think-status');
  var parent = document.getElementById('think-toggle');
  var on = el.textContent === '开';
  parent.style.opacity = '0.5';
  api.thinkingToggle(!on).then(function(d){
    parent.style.opacity = '1';
    if (d.ok) {
      el.textContent = d.thinking ? '开' : '关';
      // 更新红点
      var dot = document.getElementById('think-dot');
      if (dot) {
        dot.style.background = d.thinking ? '#da3633' : '#30363d';
        dot.style.borderColor = d.thinking ? '#da3633' : '#30363d';
        dot.title = d.thinking ? '思考模式：已开启（点击关闭）' : '思考模式：已关闭（点击开启）';
      }
    }
  }).catch(function(){ parent.style.opacity = '1'; });
}

function checkDigestion() {
  api.digestSkill()
    .then(d => {
      // 消化时间
      const timeEl = document.getElementById('ds-digest-time');
      let lt = d.last_digest_time || '';
      const nt = d.next_digest_time || '';
      // lt 格式："🔄 消化循环 #18 — 2026-05-30 00:45" → "🔄 #18 — 00:45"
      lt = lt.replace('消化循环', '').replace(/\d{4}-\d{2}-\d{2} /, '').trim();
      const ntShort = nt.replace(/^\d{4}-\d{2}-\d{2} /, '');
      const timeColor = d.last_digest_time ? '#3fb950' : '#8b949e';
      timeEl.innerHTML = '🌫️ <span style="color:' + timeColor + '">' + lt + '</span>' +
        (ntShort ? ' <span style="color:#8b949e;font-size:10px">| 下次 ' + ntShort + '</span>' : '');
      
      // ⏳ 待升格
      const pendEl = document.getElementById('ds-pending');
      const pc = d.pending_assertions || 0;
      const pendColor = pc > 0 ? '#d29922' : '#8b949e';
      pendEl.innerHTML = '⏳ <span style="color:' + pendColor + '">' + pc + '</span>';
      pendEl.title = d.pending_assertions + ' 条断言待升格';
      
      // 断言总数
      const assEl = document.getElementById('ds-assertions');
      const ac = d.total_assertions || 0;
      const assColor = ac > 10 ? '#3fb950' : '#8b949e';
      assEl.innerHTML = '💡 <span style="color:' + assColor + '">' + ac + '</span>';
      assEl.title = 'facts.dict.md 共 ' + ac + ' 条断言';
      
      // 📦 SKILL 数量
      const skillEl = document.getElementById('ds-skill-count');
      if (skillEl) {
        const sc = d.skill_count || 0;
        skillEl.innerHTML = '📦 <span style="color:' + (sc > 0 ? '#3fb950' : '#8b949e') + '">' + sc + '</span>';
        skillEl.title = sc + ' 个 SKILL';
      }
      
      // 插件状态
      var plugEl = document.getElementById('ds-plugin-val');
      if (plugEl) {
        if (d.plugin_ok) {
          plugEl.textContent = '✅';
          plugEl.style.color = '#3fb950';
          plugEl.parentElement.title = '插件正常 · 最近: ' + (d.plugin_last || '');
        } else {
          plugEl.textContent = '⚠️';
          plugEl.style.color = '#d29922';
          plugEl.parentElement.title = '插件未检测到';
        }
      }
    })
    .catch(() => {
      document.getElementById('ds-digest-time').innerHTML = '🌫️ <span style="color:#f85149">?</span>';
      document.getElementById('ds-pending').innerHTML = '⏳ <span style="color:#f85149">?</span>';
      document.getElementById('ds-assertions').innerHTML = '💡 <span style="color:#f85149">?</span>';
    });
}

// ── 消化历史按钮 ─────────────────────────────────────────────────────────
let _digestHistoryOpen = false;

function toggleDigestHistory() {
  _digestHistoryOpen = !_digestHistoryOpen;
  const panel = document.getElementById('ds-digest-history');
  const btn = document.getElementById('ds-digest-btn');
  panel.style.display = _digestHistoryOpen ? 'block' : 'none';
  btn.querySelector('span:last-child').textContent = _digestHistoryOpen ? '▲' : '▼';
  if (_digestHistoryOpen) loadDigestHistory();
}

function loadDigestHistory() {
  const panel = document.getElementById('ds-digest-history');
  panel.innerHTML = '<div style="padding:6px;color:#8b949e;text-align:center">⏳ 加载中...</div>';
  api.get('/api/digestion-history').then(data => {
    if (!data || !data.length) {
      panel.innerHTML = '<div style="padding:6px;color:#8b949e;text-align:center">暂无历史记录</div>';
      return;
    }
    let html = '<div style="font-size:10px;line-height:1.6">';
    for (const e of data.slice().reverse()) {
      const t = new Date(e.ts).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      const icon = e.status === 'ok' ? '🟢' : '🔴';
      const s = (e.summary || '').slice(0, 80);
      html += '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #21262d">';
      html += '<span style="flex-shrink:0">' + icon + ' ' + t + '</span>';
      html += '<span style="color:#c9d1d9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(s) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  }).catch(() => {
    panel.innerHTML = '<div style="padding:6px;color:#f85149;text-align:center">加载失败</div>';
  });
}

// ── 待办清单 ───────────────────────────────────────────────────────────────
let _backlogOpen = false;

function toggleBacklog() {
  _backlogOpen = !_backlogOpen;
  const panel = document.getElementById('ds-backlog');
  panel.style.display = _backlogOpen ? 'block' : 'none';
  if (_backlogOpen) loadBacklog();
}

function loadBacklog() {
  const panel = document.getElementById('ds-backlog');
  panel.innerHTML = '<div style="padding:8px;color:#8b949e;text-align:center">⏳ 加载中...</div>';
  api.get('/api/backlog').then(d => {
    if (!d.ok) { panel.innerHTML = '<div style="padding:8px;color:#f85149">❌ ' + (d.error||'') + '</div>'; return; }
    let html = '<div style="line-height:1.7">';
    for (const line of d.content.split('\n')) {
      if (line.startsWith('# ')) html += '<div style="font-weight:600;font-size:13px;margin:6px 0 4px">' + escapeHtml(line.slice(2)) + '</div>';
      else if (line.startsWith('## ')) html += '<div style="font-weight:600;font-size:12px;color:#d29922;margin:8px 0 4px">' + escapeHtml(line.slice(3)) + '</div>';
      else if (line.includes('- [ ]')) html += '<div style="color:#f0883e;padding:2px 0">⬜ ' + escapeHtml(line.replace('- [ ]','').trim()) + '</div>';
      else if (line.includes('- [x]')) html += '<div style="color:#3fb950;padding:2px 0">✅ ' + escapeHtml(line.replace('- [x]','').trim()) + '</div>';
      else if (line.trim()) html += '<div style="color:#8b949e;font-size:10px;padding:1px 0">' + escapeHtml(line) + '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
    const cnt = document.getElementById('ds-backlog-count');
    if (cnt) cnt.textContent = d.pending || 0;
  }).catch(() => {
    panel.innerHTML = '<div style="padding:8px;color:#f85149;text-align:center">加载失败</div>';
  });
}

function openReminderDialog() {
  // 加载现有提醒
  api.reminders().then(d => {
      let html = '<div id="reminder-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;font-size:13px">';
      html += '<div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
      html += '<strong style="color:#f0c040;font-size:15px">📋 提醒</strong>';
      html += '<span onclick="closeReminderDialog()" style="cursor:pointer;color:#8b949e;font-size:18px">✕</span>';
      html += '</div>';
      html += '<div style="margin-bottom:12px;display:flex;gap:6px">';
      html += '<input id="reminder-text" style="flex:1;background:#161b22;border:1px solid #30363d;border-radius:4px;padding:6px 8px;color:#c9d1d9;font-size:12px" placeholder="记下要做的事...">';
      html += '<select id="reminder-assignee" style="background:#161b22;border:1px solid #30363d;border-radius:4px;padding:6px;color:#c9d1d9;font-size:12px">';
      html += '<option value="">自己</option><option value="DeepSeek">DeepSeek</option><option value="混元">混元</option>';
      html += '</select>';
      html += '<button onclick="addReminder()" style="background:#238636;border:1px solid #2ea043;border-radius:4px;padding:6px 10px;color:white;cursor:pointer;font-size:12px">添加</button>';
      html += '</div>';
      html += '<div id="reminder-list">';
      if (d.ok && d.reminders && d.reminders.length > 0) {
        d.reminders.forEach(r => {
          const a = r.assignee ? ' [' + r.assignee + ']' : '';
          html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #21262d">';
          html += '<button onclick="doneReminder(' + r.id + ')" style="background:transparent;border:1px solid #30363d;border-radius:3px;padding:2px 6px;color:#8b949e;cursor:pointer;font-size:10px">✓</button>';
          html += '<span style="flex:1;color:#c9d1d9">' + r.text + '</span>';
          html += '<span style="color:#8b949e;font-size:10px">' + a + '</span>';
          html += '<span style="color:#484f58;font-size:10px">' + (r.created || '') + '</span>';
          html += '</div>';
        });
      } else {
        html += '<div style="color:#484f58;text-align:center;padding:20px">暂无待办提醒</div>';
      }
      html += '</div>';
      if (d.ok && d.count > 0) {
        html += '<div style="margin-top:10px;text-align:right"><button onclick="clearDoneReminders()" style="background:transparent;border:1px solid #30363d;border-radius:4px;padding:4px 8px;color:#8b949e;cursor:pointer;font-size:10px">清理已完成</button></div>';
      }
      html += '</div></div>';
      const existing = document.getElementById('reminder-overlay');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', html);
    });
}

function closeReminderDialog() {
  const el = document.getElementById('reminder-overlay');
  if (el) el.remove();
  checkReminders();
}

function addReminder() {
  const text = document.getElementById('reminder-text').value.trim();
  if (!text) return;
  const assignee = document.getElementById('reminder-assignee').value;
  api.remindersAdd(text, assignee).then(d => {
    if (d.ok) {
      // Show brief toast
      const toast = document.createElement('div');
      toast.textContent = '✅ 已添加';
      toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#238636;color:white;padding:8px 16px;border-radius:6px;font-size:13px;z-index:10000;transition:opacity 0.5s';
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 1500);
    }
    document.getElementById('reminder-text').value = '';
    openReminderDialog();
  });
}

function doneReminder(id) {
  api.remindersDone(id).then(() => openReminderDialog());
}

function clearDoneReminders() {
  api.remindersClearDone().then(() => openReminderDialog());
}

async function pollStatus() {
  if (cachePanelOpen) {
    loadCacheStats();  // 面板展开时用完整摘要
  } else {
    updateLastRoundCache();  // 面板收起时用简洁格式
  }
}

function fmtCost(n) {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.001) return (n * 1000).toFixed(1) + '厘';
  return (n * 100000).toFixed(0) + '分厘';
}

async function loadCacheStats() {
  try {
    const d = await api.cacheStats();
    if (!d.ok) { return; }
    const rounds = d.rounds || [];
    const summary = d.summary || {};

    document.getElementById('cache-summary').textContent =
      summary.roundCount + '轮 · 平均 ' + summary.avgCachePct + '% · 共 ¥' + summary.totalCost;

    // compute additional aggregates
    const totalInput = rounds.reduce((a, r) => a + r.input, 0);
    const totalCache = rounds.reduce((a, r) => a + r.cacheRead, 0);
    const totalOutput = rounds.reduce((a, r) => a + r.output, 0);
    const totalCtx = totalInput + totalCache;
    const overallHitPct = totalCtx > 0 ? (totalCache / totalCtx * 100).toFixed(1) : '0';

    // split into before/after last compaction
    // Find compaction boundaries by looking for cacheRead resets
    // (compaction zeros out the cache, next round starts with low cacheRead)
    let afterIdx = rounds.length;
    // Look from the end backwards: the last point where cacheRead drops significantly
    // from the next round is the compaction point
    for (let i = rounds.length - 1; i >= 1; i--) {
      var ratio = rounds[i-1].cacheRead / Math.max(rounds[i].cacheRead, 1);
      // If previous round had way less cache than current round, that's a compaction reset
      // Also check absolute drop: previous cache < 10% of current cache
      if (rounds[i-1].cacheRead < rounds[i].cacheRead * 0.3 && rounds[i].cacheRead > 5000) {
        afterIdx = i;
        break;
      }
    }
    const beforeComp = rounds.slice(0, afterIdx);
    const afterComp = rounds.slice(afterIdx);

    const compBefore = beforeComp.length > 0 ? {
      count: beforeComp.length,
      hitPct: (beforeComp.reduce((a,r) => a+r.cacheRead, 0) / Math.max(beforeComp.reduce((a,r) => a+r.input+r.cacheRead, 0), 1) * 100).toFixed(1),
      cost: beforeComp.reduce((a,r) => a+r.cost, 0).toFixed(4),
    } : null;

    const compAfter = afterComp.length > 0 ? {
      count: afterComp.length,
      hitPct: (afterComp.reduce((a,r) => a+r.cacheRead, 0) / Math.max(afterComp.reduce((a,r) => a+r.input+r.cacheRead, 0), 1) * 100).toFixed(1),
      cost: afterComp.reduce((a,r) => a+r.cost, 0).toFixed(4),
    } : null;

    document.getElementById('cache-overview').innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;padding:4px 0">' +

        '<div style="color:#8b949e">总轮次</div>' +
        '<div style="text-align:right;color:#c9d1d9;font-weight:600">' + rounds.length + '</div>' +

        '<div style="color:#8b949e">总上下文</div>' +
        '<div style="text-align:right;color:#c9d1d9">' + fmtNum(totalCtx) + ' tokens</div>' +

        '<div style="color:#8b949e">总命中率</div>' +
        '<div style="text-align:right;color:#58a6ff;font-weight:600;font-size:15px">' + overallHitPct + '%</div>' +

        '<div style="color:#8b949e">总费用</div>' +
        '<div style="text-align:right;color:#c9d1d9">¥' + summary.totalCost + '</div>' +

        '<div style="color:#8b949e">缓存节约</div>' +
        '<div style="text-align:right;color:#3fb950">¥' + summary.cacheSavings + '</div>' +

        '<div style="color:#8b949e;font-size:10px">' + (compBefore ? '压缩前 (' + compBefore.count + '轮)' : '') + '</div>' +
        '<div style="text-align:right;font-size:10px;color:#8b949e">' + (compBefore ? compBefore.hitPct + '% · ¥' + compBefore.cost : '') + '</div>' +

        '<div style="color:#8b949e;font-size:10px">' + (compAfter ? '压缩后 (' + compAfter.count + '轮)' : '') + '</div>' +
        '<div style="text-align:right;font-size:10px;color:#8b949e">' + (compAfter ? compAfter.hitPct + '% · ¥' + compAfter.cost : '') + '</div>' +

      '</div>';
  } catch(e) { /* ignore */ }
}

function rpcMessagesToPairs(messages) {
  // Convert OpenAI-format messages [{role, content: [{type, text}]}]
  // to editor pairs [{user:{text,model,timestamp}, assistants:[{text,model,timestamp}]}]
  var pairs = [];
  var currentUser = null;
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    var text = '';
    var thinking = '';
    if (Array.isArray(m.content)) {
      for (var j = 0; j < m.content.length; j++) {
        var c = m.content[j];
        if (c.type === 'text') text = c.text || '';
        else if (c.type === 'thinking') thinking = c.thinking || '';
      }
    } else if (typeof m.content === 'string') {
      text = m.content;
    }
    var role = m.role || 'user';
    var ts = m.created || m.timestamp || (m.createdAt ? new Date(m.createdAt).getTime() : Date.now());

    if (role === 'user') {
      currentUser = {text: text, model: m.model || '', timestamp: ts, userIndex: i};
      pairs.push({user: currentUser, assistants: []});
    } else if (role === 'assistant' && pairs.length > 0) {
      pairs[pairs.length - 1].assistants.push({
        text: text, thinking: thinking,
        model: m.model || 'AI', timestamp: ts
      });
    } else if (role === 'toolResult' && pairs.length > 0) {
      // skip tool results
    }
  }
  return pairs;
}

async function refresh() {
  try {
    var data = null;
    try {
      data = await api.session();
    } catch(e) { /* file read failed */ }

    if (!data || !data.pairs || data.pairs.length < 5) {
      try {
        const d = await api.sessionRpc();
        if (d.ok && d.from_rpc) {
          data = { messages: d.messages, pairs: rpcMessagesToPairs(d.messages), from_rpc: true };
        }
      } catch(e) { /* RPC also failed */ }
    }

    const newPairs = (data && data.pairs) || [];
    const newCount = newPairs.length;
    const latestAssistants = (newPairs[0] && newPairs[0].assistants) ? newPairs[0].assistants.length : 0;

    // 自动轮询：pair 数和最新 assistant 数都没变 → 不重新渲染
    // assistant 数变化意味着 AI 有了新的 thinking/tool call/text 输出
    if (newCount === store.pairs.length && latestAssistants === _lastAsstLen) {
      return;
    }

    _lastAsstLen = latestAssistants;

    store.msgCache = data.messages || [];
    store.pairs = newPairs;

    const si = document.getElementById('serverInfo');
    if (data.info) {
      si.textContent = 'Gateway: ' + data.info.host + ':' + data.info.port + ' · 会话: ' + data.info.sessionFile;
    } else if (data.from_rpc) {
      si.textContent = '📡 RPC 直连';
    }

    if (currentPage >= pairs.length) store.currentPage = pairs.length - 1;
    if (currentPage < 0 && pairs.length > 0) store.currentPage = 0;
    store.totalPages = pairs.length;

    renderPage();
  } catch(e) {
    toast(e.message, true);
  }
  if (typeof cachePanelOpen !== 'undefined' && cachePanelOpen) loadCacheStats();
}

function fmtTime(ts) {
  if (!ts || ts === 0) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function fmtTimeFull(ts) {
  if (!ts || ts === 0) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ── 渲染层 ──────────────────────────────────────────────────────────────────
// 纯函数：生成消息列表 HTML（不操作 DOM）
function renderMessagesHtml(st) {
  if (st.totalPages === 0) return '<div style="text-align:center;color:#8b949e;padding:40px;font-size:14px">暂无对话记录</div>';
  const pair = st.pairs[st.currentPage] || {user:{text:'',model:'',timestamp:'',userIndex:-1},assistants:[]};
  const u = pair.user;
  const aa = pair.assistants;
  const roundNum = st.currentPage + 1;
  let html = '<div class="pair-card">';
  html += '<div class="pair-header">';
  html += '<span>轮 #' + roundNum + ' · ' + (u.model ? u.model : '') + '</span>';
  html += '<span style="color:#8b949e;font-size:11px">' + fmtTimeFull(u.timestamp) + '</span>';
  html += '<span onclick="openEdit(' + st.currentPage + ')" style="cursor:pointer;color:#f0883e">✏️ 编辑</span>';
  html += '</div>';
  for (const a of aa) {
    html += '<div class="msg assistant">';
    html += '<div class="role-badge assistant">AI' + (a.model ? ' · ' + a.model : '') + '</div>';
    if (a.thinking) {
      html += '<div class="thinking-section" style="margin:6px 0 6px 0">';
      html += '<div class="thinking-toggle" style="color:#da3633;font-size:12px;cursor:pointer;user-select:none" onclick="this.nextElementSibling.classList.toggle(\'collapsed\');this.querySelector(\'.thinking-count\').textContent=this.querySelector(\'.thinking-count\').textContent==\'收起\'?\'展开\':\'收起\'">🧠 思考 <span class="thinking-count">展开</span></div>';
      html += '<div class="thinking-body collapsed" style="color:#8b949e;font-size:13px;margin:4px 0 4px 0;padding:8px;background:#1c1c1c;border-left:2px solid #da3633;max-height:200px;overflow-y:auto;line-height:1.5;white-space:pre-wrap;">';
      html += escapeHtml(a.thinking);
      html += '</div></div>';
    }
    html += '<div class="text">' + (a.text ? renderMarkdown(escapeHtml(a.text)) : '<span style="color:#8b949e;font-style:italic">(AI回复为空)</span>') + '</div>';
    html += '<div class="msg-time">' + fmtTime(a.timestamp) + '</div>';
    html += '<span class="tts-btn" onclick="event.stopPropagation();ttsReadBtn(this)">🔊</span>';
    html += '</div>';
  }
  html += '<div class="msg user">';
  html += '<div class="role-badge user">' + (u.text ? '你' : '📨 系统') + ' <span class="index-badge">#' + roundNum + '/' + st.totalPages + '</span></div>';
  html += '<div class="text">' + (u.text ? renderMarkdown(escapeHtml(u.text)) : '<span style="color:#8b949e;font-style:italic">(此消息无文字内容)</span>') + '</div>';
  html += '<div class="msg-time">' + fmtTime(u.timestamp) + '</div>';
  html += '<span class="tts-btn" onclick="event.stopPropagation();ttsReadBtn(this)">🔊</span>';
  html += '<span class="edit-icon" onclick="openEdit(' + st.currentPage + ')">✏️</span>';
  html += '</div></div>';
  return html;
}
// 纯函数：生成消息计数文字
function renderCountText(st) {
  if (st.totalPages === 0) return '暂无对话';
  return '第 ' + (st.currentPage + 1) + ' / ' + st.totalPages + ' 轮 · 共 ' + st.pairs.length + ' 组';
}

// ── TTS ────────────────────────────────────────────
var ttsRate = 1;
// TTS 状态机: idle → loading → playing → idle
// TTS: 最简版 - 先出声再说
var _ttsAudio = null;

function ttsReadBtn(btn) {
  if (!btn) return;
  var msg = btn.closest('.msg');
  var textEl = msg ? msg.querySelector('.text') : null;
  var text = textEl ? textEl.textContent : '';
  if (!text || !text.trim()) { toast('没有文本', true); return; }
  
  // 如果正在播放或加载中，停止并返回（不重新播放）
  if (_ttsAudio) {
    try { _ttsAudio.pause(); _ttsAudio.src = ''; _ttsAudio.load(); } catch(e) {}
    _ttsAudio = null;
    btn.textContent = '🔊';
    return;
  }

  
  toast('⏳ 生成中...', false);
  btn.textContent = '⏳';
  
  api.post('/api/tts', {text: text}).then(function(d) {
    if (!d.ok || !d.audio) { 
      toast('生成失败: ' + (d.error || '未知'), true); 
      btn.textContent = '🔊';
      return; 
    }
    try {
      var raw = atob(d.audio);
      var buf = new ArrayBuffer(raw.length);
      var view = new Uint8Array(buf);
      for (var i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
      var blob = new Blob([buf], {type: 'audio/mpeg'});
      var url = URL.createObjectURL(blob);
      var a = new Audio(url);
      _ttsAudio = a;
      a.playbackRate = parseFloat(document.getElementById('ttsSpeed').value || '1');
      btn.textContent = '⏹';
      toast('🔊 播放中...', false);
      a.play().then(function(){}).catch(function(e){ 
        toast('播放失败: ' + e.message, true); 
        btn.textContent = '🔊';
      });
      a.onended = function(){ 
        URL.revokeObjectURL(url); 
        btn.textContent = '🔊'; 
        _ttsAudio = null; 
      };
    } catch(e) {
      toast('处理失败', true);
      btn.textContent = '🔊';
    }
  }).catch(function(e) {
    toast('请求失败: ' + e.message, true);
    btn.textContent = '🔊';
  });
}

// TTS: 速度选择器绑定（DOM 就绪后执行）
document.addEventListener('DOMContentLoaded', function(){
  var sel = document.getElementById('ttsSpeed');
  if (sel) sel.addEventListener('change', function(){ ttsRate = parseFloat(this.value); });
});

// 渲染入口（操作 DOM）
function renderPage() {
  const el = document.getElementById('messages');
  const pc = document.getElementById('msgCount');
  pc.textContent = renderCountText(store);
  el.innerHTML = renderMessagesHtml(store);
  renderPagination();
}

// ── 子代理面板 ────────────────────────────────────────────────────────────
let subagentPanelOpen = false;
async function loadSubagents() {
  try {
    const container = document.getElementById('subagent-list');
    container.innerHTML = '<div style="color:#8b949e;text-align:center;padding:8px">查询中...</div>';

    // 加载活跃子代理（从 sessions.json 动态读取）
    const sa = await api.subagentsList();
    const active = (sa && sa.active) || [];
    const recent = (sa && sa.recent) || [];

    // 加载 exec 子代理历史
    const hist = await api.subagentHist();
    const entries = (hist && hist.entries) || [];

    let html = '<div style="font-size:10px">';

    // --- 活跃子代理 ---
    if (active && active.length > 0) {
      html += '<div style="color:#58a6ff;font-weight:600;font-size:11px;padding:4px 0">🔴 活跃中 (' + active.length + ')</div>';
      for (const a of active) {
        const modelColor = a.model && a.model.includes('DeepSeek') ? '#58a6ff' : (a.model && a.model.includes('Astron') ? '#d29922' : '#8b949e');
        html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid #21262d">';
        html += '<span>⏳</span>';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="display:flex;gap:6px;color:#8b949e;font-size:9px">';
        html += '<span style="color:' + modelColor + '">' + escapeHtml(a.model || '?') + '</span>';
        html += '<span>' + a.updated + '</span>';
        html += '<span>' + a.lines + '行</span>';
        html += '</div>';
        html += '<div style="color:#c9d1d9;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml((a.task || '').slice(0, 60)) + '</div>';
        html += '</div></div>';
      }
    }

    // --- 近期完成的子代理（10分钟内） ---
    if (recent && recent.length > 0) {
      html += '<div style="color:#8b949e;font-weight:600;font-size:11px;padding:8px 0 4px 0;border-top:1px solid #30363d;margin-top:6px">✅ 已完成 (' + recent.length + ')</div>';
      for (const a of recent.slice(-5).reverse()) {
        const modelColor = a.model && a.model.includes('DeepSeek') ? '#58a6ff' : (a.model && a.model.includes('Astron') ? '#d29922' : '#8b949e');
        html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid #21262d">';
        html += '<span>✅</span>';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="display:flex;gap:6px;color:#8b949e;font-size:9px">';
        html += '<span style="color:' + modelColor + '">' + escapeHtml(a.model || '?') + '</span>';
        html += '<span>' + a.updated + '</span>';
        html += '</div>';
        html += '<div style="color:#c9d1d9;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml((a.task || '').slice(0, 60)) + '</div>';
        if (a.result) {
          html += '<div style="color:#8b949e;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">→ ' + escapeHtml(a.result.slice(0, 120)) + '</div>';
        }
        html += '</div></div>';
      }
    }

    // --- exec 子代理历史 ---
    if (entries && entries.length > 0) {
      html += '<div style="color:#8b949e;font-weight:600;font-size:11px;padding:8px 0 4px 0;border-top:1px solid #30363d;margin-top:6px">📄 历史 (' + entries.length + '条)</div>';
      for (const e of entries.slice(-8).reverse()) {
        const icon = e.status === 'completed' ? '✅' : (e.status === 'error' || e.status === 'failed' ? '❌' : '⏳');
        const modelColor = e.model && e.model.includes('GLM') ? '#da3633' : '#58a6ff';
        html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid #21262d">';
        html += '<span>' + icon + '</span>';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="display:flex;gap:6px;color:#8b949e;font-size:9px">';
        html += '<span>' + (e.time ? e.time.slice(11, 16) : '--:--') + '</span>';
        html += '<span style="color:' + modelColor + '">' + escapeHtml(e.model || '?') + '</span>';
        html += '<span>' + e.elapsed + 's</span>';
        html += '<span>' + (e.input || 0) + '/' + (e.output || 0) + '</span>';
        html += '</div>';
        html += '<div style="color:#c9d1d9;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml((e.task || '').slice(0, 50)) + '</div>';
        if (e.result) {
          html += '<div style="color:#8b949e;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">→ ' + escapeHtml(e.result.slice(0, 100)) + '</div>';
        }
        html += '</div></div>';
      }
    }

    if (!active.length && !recent.length && !entries.length) {
      html += '<div style="color:#8b949e;text-align:center;padding:8px">暂无子代理记录（点 + spawn 开始）</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    const total = active.length + recent.length + entries.length;
    document.getElementById('subagent-summary').textContent = active.length ? '🟢' + active.length + '/' + total + '条' : total + '条';
  } catch(e) {
    document.getElementById('subagent-list').innerHTML = '<div style="color:#f85149">加载失败: ' + escapeHtml(e.message) + '</div>';
  }
}

// 子代理监控自动刷新（5秒间隔，展开时才轮询）
let subagentPollTimer = null;
function startSubagentPolling() {
  if (subagentPollTimer) clearInterval(subagentPollTimer);
  subagentPollTimer = setInterval(() => {
    if (subagentPanelOpen && document.getElementById('subagent-detail').style.display === 'block') {
      loadSubagents();
    }
  }, 5000);
}

function toggleSubagentPanel() {
  subagentPanelOpen = !subagentPanelOpen;
  const el = document.getElementById('subagent-detail');
  el.style.display = subagentPanelOpen ? 'block' : 'none';
  document.getElementById('subagent-toggle').textContent = subagentPanelOpen ? '▼' : '▶';
  if (subagentPanelOpen) {
    loadSubagents();
    startSubagentPolling();
  } else {
    if (subagentPollTimer) clearInterval(subagentPollTimer);
  }
}

// ── Facts 灯箱 ─────────────────────────────────────────────────────────────
function loadFactsLightbox() {
  document.getElementById('facts-overlay').style.display = 'block';
  const body = document.getElementById('facts-body');
  document.getElementById('facts-meta').textContent = '加载中...';
  body.textContent = '加载中...';
  api.momo('read_facts').then(d => {
    if (d.ok && d.content) {
      body.innerHTML = renderMarkdown(d.content);
      document.getElementById('facts-meta').textContent = d.content.split('\\n').length + '行 | ' + d.size + 'B';
    } else {
      body.innerHTML = '❌ 读取失败: ' + (d.error || '未知错误');
    }
  }).catch(e => {
    body.innerHTML = '❌ 网络错误: ' + e.message;
  });
}

function renderMarkdown(md) {
  // 转义 HTML 特殊字符
  let h = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 把行组合成段落（遇到空行说明新段）
  const lines = h.split('\n');
  let out = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 检测表格：行以 | 开头或 | 结尾，且下一行是 |---| 格式
    if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|[-:|\s]+\|$/.test(lines[i+1].trim())) {
      out += '<table style="border-collapse:collapse;margin:6px 0;font-size:11px;width:100%;table-layout:fixed;word-break:break-word;overflow-wrap:break-word">';
      // 表头行
      out += '<thead><tr>';
      line.split('|').slice(1, -1).forEach(c => {
        out += '<th style="border:1px solid #30363d;padding:4px 8px;text-align:left;background:#161b22;word-break:break-word;overflow-wrap:break-word">' + c.trim() + '</th>';
      });
      out += '</tr></thead>';
      i += 2; // 跳过分隔行
      // 数据行
      out += '<tbody>';
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        out += '<tr>';
        lines[i].split('|').slice(1, -1).forEach(c => {
          out += '<td style="border:1px solid #30363d;padding:4px 8px;word-break:break-word;overflow-wrap:break-word">' + c.trim() + '</td>';
        });
        out += '</tr>';
        i++;
      }
      out += '</tbody></table>';
      continue;
    }

    // 空行 → 段落结束
    if (line.trim() === '') {
      // H3 标题
    } else if (/^###\s/.test(line)) {
      out += '<h3 style="color:#58a6ff;margin:12px 0 4px 0">' + line.replace(/^###\s*/, '') + '</h3>';
    } else if (/^##\s/.test(line)) {
      out += '<h2 style="color:#f0883e;margin:14px 0 4px 0">' + line.replace(/^##\s*/, '') + '</h2>';
    } else if (/^#\s/.test(line)) {
      out += '<h1 style="color:#f0883e;margin:16px 0 6px 0;font-size:16px">' + line.replace(/^#\s*/, '') + '</h1>';
    } else if (/^---/.test(line.trim())) {
      out += '<hr style="border:none;border-top:1px solid #21262d;margin:8px 0">';
    } else if (/^\*\*/.test(line) && /\*\*$/.test(line.trim())) {
      out += '<p style="margin:4px 0"><strong>' + line.replace(/^\*\*/, '').replace(/\*\*$/, '') + '</strong></p>';
    } else {
      out += '<p style="margin:4px 0">' + line + '</p>';
    }
    i++;
  }
  return out;
}

function closeFactsOverlay(event) {
  if (!event || event.target === document.getElementById('facts-overlay') || !event.target) {
    document.getElementById('facts-overlay').style.display = 'none';
  }
}

async function spawnSubagent(e) {
  e.stopPropagation();
  const task = prompt('子代理任务：', '读 today.log，输出文件变更摘要');
  if (!task) return;
  const btn = e.target;
  const model = prompt('模型 (deepseek-chat / GLM-Z1-Flash / hunyuan-instruct):', 'GLM-Z1-Flash') || 'GLM-Z1-Flash';
  btn.disabled = true; btn.textContent = '⏳...';
  try {
    const d = await api.execSubagent(task, model);
    if (d.ok) {
      toast('✅ 子代理完成 (' + model + ', ' + d.elapsed + 's)');
      if (subagentPanelOpen) loadSubagents();
    } else {
      toast('子代理失败: ' + (d.error || d.message), true);
    }
  } catch(e) {
    toast('子代理出错: ' + e.message, true);
  }
  btn.disabled = false; btn.textContent = '+ spawn';
}

async function authSubagent(e) {
  e.stopPropagation();
  const btn = e.target;
  btn.disabled = true; btn.textContent = '⏳...';
  try {
    const d = await api.authSubagent();
    if (d.ok) {
      toast('✅ 子代理授权请求已发送');
    } else {
      toast('授权失败: ' + (d.error || '未知'), true);
    }
  } catch(e) {
    toast('授权出错: ' + e.message, true);
  }
  btn.disabled = false; btn.textContent = '🔑 授权';
}

// ── 分页 ── 使用事件代理，不重建DOM，解决滚动锚点丢失 ──────────────────
function setupPagination() {
  // 只执行一次：创建分页栏HTML结构
  const initHtml = totalPages > 0
    ? '<button class="btn" data-page="0">«</button>' +
      '<button class="btn" data-page="prev">‹</button>' +
      ' 第 <input id="pageInput" type="number" min="1" max="' + totalPages + '" value="1" style="width:48px"> 页 / <span id="pageTotal">' + totalPages + '</span>' +
      '<button class="btn" data-page="next">›</button>' +
      '<button class="btn" data-page="last">»</button>' +
      '<button class="btn" id="jumpBtn">跳转</button>' +
      '<button class="btn" onclick="refresh()" title="刷新会话内容" style="margin-left:8px;font-size:11px">🔄</button>'
    : '';
  document.getElementById('paginationBottom').innerHTML = initHtml;

  // 事件代理：统一处理两个分页栏的点击
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.pagination .btn[data-page]');
    if (!btn) return;
    const page = btn.dataset.page;
    if (page === 'prev') goToPage(currentPage - 1);
    else if (page === 'next') goToPage(currentPage + 1);
    else if (page === 'last') goToPage(totalPages - 1);
    else goToPage(parseInt(page));
  });
  document.getElementById('jumpBtn')?.addEventListener('click', jumpPage);
  // 更新初始状态
  updatePaginationState();
}

function updatePaginationState() {
  // 更新按钮禁用状态和页码显示
  const pageNum = currentPage + 1;
  document.querySelectorAll('#paginationBottom .btn[data-page]').forEach(function(btn) {
    const page = btn.dataset.page;
    let disabled = false;
    if (page === '0' || page === 'prev') disabled = currentPage <= 0;
    else if (page === 'next' || page === 'last') disabled = currentPage >= totalPages - 1;
    btn.disabled = disabled;
  });
  const pageInput = document.getElementById('pageInput');
  if (pageInput) {
    pageInput.value = pageNum;
    pageInput.max = totalPages;
  }
  const pageTotal = document.getElementById('pageTotal');
  if (pageTotal) pageTotal.textContent = totalPages;
}

function renderPagination() {
  // 向后兼容：初次调用时setup，后续只更新状态
  if (!document.getElementById('pageTotal')) {
    setupPagination();
  } else {
    updatePaginationState();
  }
}

function goToPage(p) {
  if (p < 0 || p >= totalPages) return;
  // 记录翻页栏当前位置，render后补偿，防止跳动
  const pb = document.getElementById('paginationBottom');
  const beforeRect = pb ? pb.getBoundingClientRect() : null;
  store.currentPage = p;
  renderPage();
  // 补偿：翻页栏应该停留在视口中原来相同的位置
  if (beforeRect) {
    requestAnimationFrame(function() {
      const pb2 = document.getElementById('paginationBottom');
      if (!pb2) return;
      const afterRect = pb2.getBoundingClientRect();
      const dy = afterRect.top - beforeRect.top;
      if (Math.abs(dy) > 2) window.scrollBy(0, dy);
    });
  }
}

function jumpPage() {
  const inp = document.getElementById('pageInput');
  const p = parseInt(inp.value, 10);
  if (p >= 1 && p <= totalPages) goToPage(p - 1);
}




var tbRootPath = '';
var tbCurrentPath = '';
var tbCurrentName = '';
var tbCurrentBrowsePath = ''; // 当前浏览的目录（记忆用）
var tbMovePath = ''; // 待移动的路径

// ===== 树弹出 =====
function tbToggleBrowser() {
  var browser = document.getElementById('tb-browser');
  var btn = document.getElementById('tb-browse-btn');
  if (!browser || !btn) return;
  if (browser.style.display === 'block') {
    browser.style.display = 'none';
    return;
  }
  // 固定位置：从不跑转
  var left = Math.max(10, window.innerWidth - 420);
  var top = 48;
  // relative container already handles positioning

  // 恢复上次浏览位置
  var saved = localStorage.getItem('tb_browse_path');
  if (saved && saved !== 'undefined') {
    tbCurrentBrowsePath = saved;
  }
  browser.innerHTML = '<div style="padding:12px;color:#8b949e;text-align:center;font-size:12px">加载中...</div>';
  browser.style.display = 'block';
  tbLoadTree(tbCurrentBrowsePath || '');
}

async function tbLoadTree(dirPath) {
  var browser = document.getElementById('tb-browser');
  if (!browser) return;
  var savedScroll = browser.scrollTop || 0;
  browser.innerHTML = '<div style="padding:12px;color:#8b949e;text-align:center;font-size:12px">加载中...</div>';
  browser.style.display = 'none';

  var d = dirPath ? await api.listFiles(dirPath) : await api.browseDirs();
  if (!d.ok) { browser.innerHTML = '<div style="padding:12px;color:#f85149;text-align:center;font-size:12px">' + (d.error || '加载失败') + '</div>'; return; }

    var items = d.items || [];
    var files = d.files || [];
    var root = d.root || tbRootPath;
    if (root) tbRootPath = root;

    browser.innerHTML = '';
    var curDir = dirPath || tbRootPath;
    tbCurrentBrowsePath = curDir;
    localStorage.setItem('tb_browse_path', curDir);

    // 当前目录头 + 回到根按钮
    var headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:8px 12px;border-bottom:1px solid #30363d';
    var header = document.createElement('span');
    header.style.cssText = 'color:#8b949e;font-size:10px;word-break:break-all;cursor:pointer;flex:1';
    header.textContent = '📁 ' + curDir;
    header.dataset.type = 'current-folder';
    header.dataset.path = curDir;
    headerRow.appendChild(header);
    if (curDir !== tbRootPath) {
      var homeBtn = document.createElement('span');
      homeBtn.style.cssText = 'cursor:pointer;color:#58a6ff;font-size:11px;padding:2px 6px;white-space:nowrap';
      homeBtn.textContent = '↩️ 根';
      homeBtn.dataset.type = 'root';
      homeBtn.dataset.path = tbRootPath;
      headerRow.appendChild(homeBtn);
    }
    browser.appendChild(headerRow);

    // 移动目标指示
    if (tbMovePath) {
      var moveBar = document.createElement('div');
      moveBar.style.cssText = 'padding:6px 12px;background:#2d1b69;color:#d2a8ff;font-size:11px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #30363d';
      moveBar.innerHTML = '📌 移动至: 当前目录';
      var pasteBtn = document.createElement('span');
      pasteBtn.style.cssText = 'cursor:pointer;color:#58a6ff;font-size:11px;padding:2px 6px;border:1px solid #58a6ff;border-radius:4px';
      pasteBtn.textContent = '✓ 确认移动';
      pasteBtn.dataset.type = 'paste-move';
      pasteBtn.dataset.path = curDir;
      moveBar.appendChild(pasteBtn);
      var cancelMove = document.createElement('span');
      cancelMove.style.cssText = 'cursor:pointer;color:#8b949e;font-size:11px;padding:2px 6px;margin-left:4px';
      cancelMove.textContent = '✕ 取消';
      cancelMove.dataset.type = 'cancel-move';
      moveBar.appendChild(cancelMove);
      browser.appendChild(moveBar);
    }

    // 返回上级
    if (dirPath) {
      var parentPath = dirPath.substring(0, dirPath.lastIndexOf('/'));
      addTreeEl('back', '..', {path: parentPath, name: '..'});
    }

    // 全部目录
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var childPath = dirPath ? dirPath + '/' + item.name : tbRootPath + '/' + item.name;
      addTreeEl('folder', '📁 ' + item.name + ' (' + item.md_count + ')', {path: childPath, name: item.name});
    }

    // 文件
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var fpath = dirPath ? dirPath + '/' + f.name : tbRootPath + '/' + f.name;
      addTreeEl('file', '📄 ' + f.name + ' (' + f.size_kb + 'KB)', {path: fpath, name: f.name});
    }

    // 分隔线 + 新建
    var sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #30363d;margin:4px 0';
    browser.appendChild(sep);

    addTreeEl('new-folder', '📁 新建目录', {path: curDir});
    addTreeEl('new-file', '📄 新建文件', {path: curDir});

    // 如果空目录且非root
    if (browser.children.length <= 1) {
      addTreeEl('empty', '(空)', {});
    }

    // 恢复滚动位置，防止跳动
    if (savedScroll > 0) { requestAnimationFrame(function(){ browser.scrollTop = savedScroll; }); }
    browser.style.display = 'block';
  browser.onclick = tbHandleTreeClick;
}

function addTreeEl(type, label, data) {
  var browser = document.getElementById('tb-browser');
  if (!browser) return;
  var el = document.createElement('div');
  if (type === 'back') {
    el.className = 'tb-back';
    el.style.cssText = 'padding:8px 12px;cursor:pointer;color:#f0c040;font-size:13px;border-bottom:1px solid #21262d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  } else if (type === 'folder') {
    el.className = 'tb-folder';
    el.style.cssText = 'padding:8px 12px;cursor:pointer;color:#c9d1d9;font-size:13px;border-bottom:1px solid #21262d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  } else if (type === 'file') {
    el.className = 'tb-file';
    el.style.cssText = 'padding:8px 12px;cursor:pointer;color:#8b949e;font-size:13px;border-bottom:1px solid #21262d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  } else if (type === 'new-folder') {
    el.className = 'tb-new-folder';
    el.style.cssText = 'padding:8px 12px;cursor:pointer;color:#58a6ff;font-size:13px';
  } else if (type === 'new-file') {
    el.className = 'tb-new-file';
    el.style.cssText = 'padding:8px 12px;cursor:pointer;color:#58a6ff;font-size:13px;border-bottom:none';
  } else if (type === 'empty') {
    el.className = 'tb-empty';
    el.style.cssText = 'padding:12px;color:#8b949e;text-align:center;font-size:12px';
  }
  el.textContent = label;
  if (type !== 'empty') {
    el.dataset.type = type;
    if (data && data.path) el.dataset.path = data.path;
    if (data && data.name) el.dataset.name = data.name;
  }
  browser.appendChild(el);
}

// ===== 树内点击委托 =====
function tbHandleTreeClick(e) {
  e.stopPropagation();
  var target = e.target.closest('[data-type]');
  if (!target) return;
  var type = target.dataset.type;
  var path = target.dataset.path;
  var name = target.dataset.name;

  if (type === 'back') {
    tbCurrentPath = path;
    tbCurrentName = '..';
    tbLoadTree(path);
    tbUpdatePathDisplay();
  } else if (type === 'root') {
    tbCurrentPath = path;
    tbCurrentName = '';
    tbLoadTree(path);
    tbUpdatePathDisplay();
  } else if (type === 'folder') {
    tbCurrentPath = path;
    tbCurrentName = name || '';
    tbLoadTree(path);
    tbUpdatePathDisplay();
  } else if (type === 'file') {
    tbCurrentPath = path;
    tbCurrentName = name || '';
    tbUpdatePathDisplay();
    tbSelectFile(path, name);
  } else if (type === 'current-folder') {
    tbCurrentPath = path;
    tbCurrentName = '';
    tbTreeClose();
    tbUpdatePathDisplay();
  } else if (type === 'new-folder') {
    tbNewFolder(path);
  } else if (type === 'new-file') {
    tbNewFile(path);
  } else if (type === 'move-start') {
    tbMovePath = path;
    tbMoveName = name || '';
    document.getElementById('tb-path-status').textContent = '📌 已标记移动: ' + (name || path);
    tbTreeClose();
  } else if (type === 'paste-move') {
    tbConfirmMove(tbMovePath, path);
  } else if (type === 'cancel-move') {
    tbMovePath = '';
    tbMoveName = '';
    tbLoadTree(tbCurrentBrowsePath);
    document.getElementById('tb-path-status').textContent = '已取消移动';
  }
}

function tbUpdatePathDisplay() {
  var lbl = document.getElementById('tb-path-label');
  if (lbl) lbl.textContent = tbCurrentName || '选择文件...';
  var cur = document.getElementById('tb-cur-path');
  if (cur) cur.textContent = tbCurrentPath ? tbCurrentPath : '';
  var renameBtn = document.getElementById('tb-rename-btn');
  var deleteBtn = document.getElementById('tb-delete-btn');
  var moveBtn = document.getElementById('tb-move-btn');
  if (tbCurrentPath) {
    if (renameBtn) renameBtn.style.display = '';
    if (deleteBtn) deleteBtn.style.display = '';
    if (moveBtn) moveBtn.style.display = '';
  } else {
    if (renameBtn) renameBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (moveBtn) moveBtn.style.display = 'none';
  }
}

function tbTreeClose() {
  var b = document.getElementById('tb-browser');
  if (b) b.style.display = 'none';
}

// 点击树外关闭+清选择
// 🔧 修复：保存按钮和编辑区域在 tb-content-area（不在 tb-toolbar-row 内），
//    点击保存时不触发路径清除
document.addEventListener('click', function(e) {
  var b = document.getElementById('tb-browser');
  var tb = document.getElementById('tb-toolbar-row');
  var editArea = document.getElementById('tb-content-area');
  // 如果点击在编辑区域（包含保存按钮），不清除路径
  if (editArea && editArea.style.display !== 'none' && editArea.contains(e.target)) return;
  if (tb && !tb.contains(e.target) && !b.contains(e.target)) {
    // 点击工具栏外清除选择
    if (tbCurrentPath) {
      tbCurrentPath = '';
      tbCurrentName = '';
      tbUpdatePathDisplay();
    }
  }
  if (b && b.style.display === 'block' && !e.target.closest('#tb-browse-btn') && !b.contains(e.target)) {
    b.style.display = 'none';
  }
});

// ===== 文件操作 =====
async function tbSelectFile(fullPath, fileName) {
  if (!fullPath || !fileName) return;
  tbCurrentPath = fullPath;
  tbCurrentName = fileName;
  document.getElementById('tb-content-area').dataset.currentPath = fullPath;
  tbUpdatePathDisplay();
  tbTreeClose();
  document.getElementById('tb-content-area').style.display = 'block';
  document.getElementById('tb-content').value = '加载中...';
  var pwEl = document.getElementById('crypt-password');
  var pw = pwEl ? pwEl.value : '';
  var dd = await api.tbRead(fullPath, pw);
  if (dd.ok) {
    document.getElementById('tb-content').value = dd.content || '';
    document.getElementById('tb-save-btn').style.display = '';
  } else {
    document.getElementById('tb-content').value = '无法读取: ' + (dd.error || '未知错误');
  }
}

async function tbSaveFile() {
  var editArea = document.getElementById('tb-content-area');
  var path = editArea && editArea.dataset.currentPath ? editArea.dataset.currentPath : tbCurrentPath;
  var content = document.getElementById('tb-content');
  if (!path) { document.getElementById('tb-path-status').textContent = '❌ 未选择文件'; return; }
  if (!content) { document.getElementById('tb-path-status').textContent = '❌ 编辑器未找到'; return; }
  var txt = content.value;
  var st = document.getElementById('tb-path-status');
  st.textContent = '⏳ 保存中...';
  try {
    var d = await api.tbSave(path, txt || '');
    st.textContent = d.ok ? '✅ 保存成功' : '❌ ' + (d.error || '保存失败');
  } catch(e) {
    st.textContent = '❌ 网络错误: ' + (e.message || e);
  }
}

function tbCopyPath() {
  var editArea = document.getElementById('tb-content-area');
  var fallbackPath = editArea && editArea.dataset.currentPath ? editArea.dataset.currentPath : '';
  if (!tbCurrentPath && !fallbackPath) {
    document.getElementById('tb-path-status').textContent = '请先选择文件或目录';
    return;
  }
  var copyPath = tbCurrentPath || fallbackPath;
  try {
    var ta = document.createElement('textarea');
    ta.value = copyPath;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    document.getElementById('tb-path-status').textContent = '✅ 已复制: ' + copyPath;
  } catch(e) {
    document.getElementById('tb-path-status').textContent = '✅ 路径: ' + copyPath;
  }
}

// 通用：弹出内联输入框（替换浏览器 prompt()）
function tbShowPrompt(title, defaultValue) {
  return new Promise(function(resolve) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    var box = document.createElement('div');
    box.style.cssText = 'background:#21262d;border:1px solid #30363d;border-radius:8px;padding:20px;min-width:320px';
    box.innerHTML = '<div style="color:#c9d1d9;margin-bottom:12px;font-size:13px">' + title + '</div>' +
      '<input class="tb-prompt-input" type="text" value="' + (defaultValue || '').replace(/"/g,'&quot;') + '" style="width:100%;padding:8px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;font-size:13px;box-sizing:border-box">' +
      '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">' +
      '<button class="tb-prompt-cancel" class="btn" type="button" style="padding:6px 16px">取消</button>' +
      '<button class="tb-prompt-confirm" class="btn btn-primary" type="button" style="padding:6px 16px">确定</button></div>';
    wrapper.appendChild(box);
    document.body.appendChild(wrapper);
    var input = wrapper.querySelector('.tb-prompt-input');
    input.focus();
    input.select();
    function cleanup() { if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper); }
    wrapper.querySelector('.tb-prompt-confirm').onclick = function(e) { e.preventDefault(); e.stopPropagation(); var v = input.value.trim(); cleanup(); resolve(v); };
    wrapper.querySelector('.tb-prompt-cancel').onclick = function(e) { e.preventDefault(); e.stopPropagation(); cleanup(); resolve(null); };
    input.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); var v = input.value.trim(); cleanup(); resolve(v); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(); resolve(null); } };
  });
}

async function tbNewFolder(dirPath) {
  var name = await tbShowPrompt('新目录名：');
  if (!name) return;
  var d = await api.tbCreate(dirPath, name, true);
  document.getElementById('tb-path-status').textContent = d.ok ? '✅ 目录已创建: ' + name : '❌ ' + (d.error || '创建失败');
  if (d.ok) tbLoadTree(dirPath);
}

async function tbNewFile(dirPath) {
  var name = await tbShowPrompt('新文件名（例如 notes.md）：');
  if (!name) return;
  if (!name.endsWith('.md')) name += '.md';
  var d = await api.tbCreate(dirPath, name, false);
  document.getElementById('tb-path-status').textContent = d.ok ? '✅ 文件已创建: ' + name : '❌ ' + (d.error || '创建失败');
  if (d.ok) tbLoadTree(dirPath);
}



async function tbDelete() {
  if (!tbCurrentPath) return;
  var label = tbCurrentName || tbCurrentPath.split('/').pop();
  if (!confirm('删除 "' + label + '" - 确定吗？')) return;
  if (!confirm('再次确认："' + label + '"删除后不可恢复。')) return;
  document.getElementById('tb-path-status').textContent = '正在删除 ' + label + '...';
  var d = await api.tbDelete(tbCurrentPath);
  if (d.ok) {
    document.getElementById('tb-path-status').textContent = '✅ 已删除: ' + label;
    var curPath = tbCurrentPath;
    tbCurrentPath = '';
    tbCurrentName = '';
    tbUpdatePathDisplay();
    document.getElementById('tb-content-area').style.display = 'none';
    var parent = curPath.substring(0, curPath.lastIndexOf('/'));
    if (parent) tbLoadTree(parent);
  } else {
    document.getElementById('tb-path-status').textContent = '❌ ' + (d.error || '删除失败');
  }
}

async function tbRename() {
  var capturedPath = tbCurrentPath;
  if (!capturedPath) return;
  var oldName = tbCurrentName || capturedPath.split('/').pop();
  var newName = await tbShowPrompt('重命名 "' + oldName + '" 为：', oldName);
  if (!newName || newName === oldName) return;
  document.getElementById('tb-path-status').textContent = '正在重命名... (' + capturedPath + ' → ' + newName + ')';
  var d = await api.tbRename(capturedPath, newName, '');
  if (d.ok) {
    document.getElementById('tb-path-status').textContent = '✅ 已重命名为: ' + newName;
    tbCurrentPath = d.new_path || (capturedPath.substring(0, capturedPath.lastIndexOf('/')) + '/' + newName);
    tbCurrentName = newName;
    tbUpdatePathDisplay();
    tbLoadTree(tbCurrentPath.substring(0, tbCurrentPath.lastIndexOf('/')));
  } else {
    document.getElementById('tb-path-status').textContent = '❌ ' + (d.error || '重命名失败');
  }
}

// ===== 移动文件 =====
function tbStartMove() {
  if (!tbCurrentPath) return;
  tbMovePath = tbCurrentPath;
  tbMoveName = tbCurrentName || tbCurrentPath.split('/').pop();
  document.getElementById('tb-path-status').textContent = '📌 已标记: ' + tbMoveName + '，打开树选择目标目录';
  // 自动打开树
  tbToggleBrowser();
}

async function tbConfirmMove(source, targetDir) {
  if (!source || !targetDir) return;
  var name = source.split('/').pop();
  if (!name) return;
  document.getElementById('tb-path-status').textContent = '正在移动...';
  var st = document.getElementById('tb-path-status');
  var d = await api.tbRename(source, name, targetDir);
  tbMovePath = '';
  tbMoveName = '';
  if (d.ok) {
    st.textContent = '✅ 已移动至: ' + targetDir;
    tbCurrentPath = '';
    tbCurrentName = '';
    tbUpdatePathDisplay();
    tbLoadTree(targetDir);
  } else {
    // Fallback: try with full new path
    var newFullPath = targetDir + '/' + name;
    var d2 = await api.tbRename(source, name, targetDir);
    if (d2.ok) {
      st.textContent = '✅ 已移动至: ' + targetDir;
      tbCurrentPath = '';
      tbCurrentName = '';
      tbUpdatePathDisplay();
      tbLoadTree(targetDir);
    } else {
      st.textContent = '❌ ' + (d2.error || '移动失败');
      tbLoadTree(targetDir);
    }
  }
}




function openEdit(pairIdx) {
  const prev = document.getElementById('edit-panel');
  if (prev) prev.remove();

  const pair = pairs[pairIdx];
  if (!pair) return;

  const panel = document.createElement('div');
  panel.className = 'edit-panel active';
  panel.id = 'edit-panel';
  panel.innerHTML =
    '<label>编辑第 ' + (pairs.length - pairIdx) + ' 轮对话的用户消息（截断后续所有内容，发回给 AI 重新回复）：</label>' +
    '<textarea id="edit-text">' + escapeHtml(pair.user.text) + '</textarea>' +
    '<div style="margin:8px 0;padding:8px 10px;background:#0d1117;border:1px solid #30363d;border-radius:6px">' +
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:#8b949e">' +
    '<input type="checkbox" id="send-notice" checked onchange="toggleNotice()"> ' +
    '📢 发送截断通知</label>' +
    '<textarea id="notice-text" style="display:none;width:100%;margin-top:6px;min-height:36px;background:#0d1117;color:#8b949e;border:1px solid #30363d;border-radius:4px;padding:6px 8px;font-size:12px;font-family:inherit;resize:vertical">⚠️ 对话已被截断。本轮结束前请记录轮感。</textarea>' +
    '</div>' +
    '<div class="actions">' +
    '<button class="btn btn-primary" onclick="saveEdit(' + pairIdx + ')">💾 保存截断并发送给 AI</button>' +
    '<button class="btn" onclick="cancelEdit()">取消</button>' +
    '</div>' +
    '<div class="status" id="edit-status"></div>';

  const msgEl = document.getElementById('messages');
  // 在消息区内插入编辑框（当前卡片后面），不跳出消息区域
  if (msgEl) {
    const card = msgEl.querySelector('.pair-card');
    if (card && card.nextSibling) {
      msgEl.insertBefore(panel, card.nextSibling);
    } else {
      msgEl.appendChild(panel);
    }
  }
  setTimeout(function() {
    panel.scrollIntoView({ block: 'nearest' });
  }, 100);
}

function cancelEdit() {
  const panel = document.getElementById('edit-panel');
  if (panel) panel.remove();
}

function toggleNotice() {
  const cb = document.getElementById('send-notice');
  const ta = document.getElementById('notice-text');
  ta.style.display = cb.checked ? 'block' : 'none';
}

async function saveEdit(pairIdx) {
  const ta = document.getElementById('edit-text');
  const st = document.getElementById('edit-status');
  const txt = ta.value.trim();
  if (!txt) { st.className = 'status err'; st.textContent = '内容不能为空'; return; }

  const pair = pairs[pairIdx];
  const userIndex = pair.userIndex;
  st.className = 'status'; st.textContent = '⏳ 保存截断中...';

  try {
    // 📦 截断前先存档，确保不丢
    await api.momo('pack'); await api.clearLock();

    const res = await api.edit(userIndex, txt, true);
    if (!res.ok) {
      st.className = 'status err';
      // 🔒 安全铁律拦截：展示主人确认按钮
      if (res.error && /安全铁律/.test(res.error)) {
        st.innerHTML = '❌ ' + escapeHtml(res.error) + '<br><br>' +
          '<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;color:#f0883e">' +
          '<input type="checkbox" id="approve-override" style="width:16px;height:16px"> ' +
          '我确认--这是主人的明确授权，允许截断此轮对话</label><br><br>' +
          '<button class="btn btn-primary" id="override-btn" onclick="saveEditWithApproval(' + pairIdx + ')" disabled>🔓 需勾选上方确认框</button>';
        // 勾选后方可点击
        document.getElementById('approve-override').addEventListener('change', function() {
          const btn = document.getElementById('override-btn');
          btn.disabled = !this.checked;
          btn.textContent = this.checked ? '🔓 以主人授权截断' : '🔓 需勾选上方确认框';
        });
      } else {
        st.textContent = '❌ ' + (res.error || '截断失败');
      }
      return;
    }

    st.textContent = '✅ 截断 ' + res.truncated + ' 条消息，正在发送给 AI...';

    // 📢 截断通知：如果勾选了，在消息前面加上通知文本
    let injectMsg = txt;
    const sendNotice = document.getElementById('send-notice');
    if (sendNotice && sendNotice.checked) {
      const noticeText = document.getElementById('notice-text');
      if (noticeText && noticeText.value.trim()) {
        injectMsg = noticeText.value.trim() + '\n\n' + injectMsg;
      }
    }

    const injRes = await api.inject(injectMsg);
    if (!injRes || injRes.error) {
      st.className = 'status err';
      st.textContent = '❌ 注入失败: ' + ((injRes && injRes.error) || '服务器错误');
      return;
    }

    cancelEdit();
    // 立即渲染用户消息
    store.currentPage = 0;
    renderPage();
    pollForReply();

    const banner = document.createElement('div');
    if (injRes.ok) {
      banner.style.cssText = 'background:#1c2128;border:1px solid #3fb950;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:14px;color:#3fb950;text-align:center;';
      banner.innerHTML = '✅ 已截断并发送，等待 AI 回复...<br><span style="color:#8b949e;font-size:12px">消息出现后会自动跳转到最新页</span>';
      toast('已截断并发送，等待 AI 回复');
    } else {
      banner.style.cssText = 'background:#1c2128;border:1px solid #f0883e;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:14px;color:#f0883e;text-align:center;';
      banner.innerHTML = '✂️ 已截断 ' + res.truncated + ' 条消息，但发送给 AI 失败：' + escapeHtml(injRes.error || '未知错误');
      toast('截断成功，但注入失败: ' + (injRes.error || ''), true);
    }
    document.getElementById('msgCount').parentNode.insertBefore(banner, document.getElementById('msgCount').nextSibling);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 5000);

  } catch(e) {
    st.className = 'status err';
    st.textContent = '❌ 网络错误: ' + (e.message || e);
  }
}

// 🔒 主人授权截断（绕过安全铁律）
async function saveEditWithApproval(pairIdx) {
  const ta = document.getElementById('edit-text');
  const st = document.getElementById('edit-status');
  const txt = ta.value.trim();
  if (!txt) { st.className = 'status err'; st.textContent = '内容不能为空'; return; }

  const pair = pairs[pairIdx];
  const userIndex = pair.userIndex;
  st.className = 'status'; st.textContent = '⏳ 以主人授权执行截断...';

  try {
    // 📦 截断前先存档，确保不丢
    await api.momo('pack'); await api.clearLock();

    const res = await api.edit(userIndex, txt, true);
    if (!res.ok) {
      st.className = 'status err';
      st.textContent = '❌ ' + (res.error || '截断失败');
      return;
    }

    st.textContent = '✅ 截断 ' + res.truncated + ' 条消息，正在发送给 AI...';

    const injRes = await api.inject(txt);
    // 立即在本地显示
    const now = Date.now();
    const optimisticPair = {
      user: { text: txt, model: '', timestamp: now, userIndex: -1 },
      assistants: []
    };
    store.pairs.unshift(optimisticPair);
    store.currentPage = 0;
    renderPage();
    
    if (!injRes || injRes.error) {
      st.className = 'status err';
      st.textContent = '❌ 注入失败: ' + ((injRes && injRes.error) || '服务器错误');
      return;
    }
    cancelEdit();
    await refresh();
    store.currentPage = 0;
    renderPage();
    pollForReply();

    const banner = document.createElement('div');
    if (injRes.ok) {
      banner.style.cssText = 'background:#1c2128;border:1px solid #3fb950;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:14px;color:#3fb950;text-align:center;';
      banner.innerHTML = '✅ 已截断 ' + res.truncated + ' 条消息并发送给 AI 思考中<br><span style="color:#8b949e;font-size:12px">（主人授权模式下执行）</span>';
      toast('已截断并发送给 AI');
    } else {
      banner.style.cssText = 'background:#1c2128;border:1px solid #f0883e;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:14px;color:#f0883e;text-align:center;';
      banner.innerHTML = '✂️ 已截断但注入失败：' + escapeHtml(injRes.error || '未知错误');
      toast('截断成功但注入失败', true);
    }
    document.getElementById('msgCount').parentNode.insertBefore(banner, document.getElementById('msgCount').nextSibling);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 5000);
  } catch(e) {
    st.className = 'status err';
    st.textContent = '❌ 网络错误: ' + (e.message || e);
  }
}

// 🌫️ 摸摸协议
function momo() {
  const panel = document.getElementById('momo-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  document.getElementById('momo-result').textContent = '';
}

async function momoPack() {
  const r = document.getElementById('momo-result');
  r.textContent = '📦 打包中...';
  try {
    const data = await api.momo('pack');
    if (data.ok) {
      r.innerHTML = '✅ 已打包 ' + data.packed.length + ' 个文件到 找回自己<br><span style="font-size:11px;color:#8b949e">' +
        data.packed.slice(0, 8).join(' · ') + (data.packed.length > 8 ? ' · ...等' : '') + '</span>';
    } else {
      r.textContent = '❌ ' + (data.error || '打包失败');
    }
  } catch(e) {
    r.textContent = '❌ 错误: ' + e.message;
  }
}

async function momoStatus() {
  const r = document.getElementById('momo-result');
  r.textContent = '📊 查询中...';
  try {
    const data = await api.momo('status');
    if (data.ok) {
      r.innerHTML = '🌫️ 摸摸协议状态<br>' +
        '<span style="font-size:12px;color:#8b949e">' +
        '协议文档: ' + (data.protocol_ready ? '✅' : '❌') + ' · ' +
        '急救包文件: ' + data.pack_files + ' 个 · ' +
        '日记得分: ' + data.daily_snapshots + ' 天的</span>';
    } else {
      r.textContent = '❌ ' + (data.error || '查询失败');
    }
  } catch(e) {
    r.textContent = '❌ 错误: ' + e.message;
  }
}

function restartHTTPServer() {
  const btn = document.getElementById('restart-http-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ 重启中...';
  btn.style.background = '#6b1412';
  const r = document.getElementById('momo-result');
  r.style.display = 'block';
  r.innerHTML = '♻️ HTTP 服务重启中...';
  api.restartHttp().then(d => {
      r.innerHTML = '♻️ ' + (d.note || '服务重启中...');
      setTimeout(() => {
        api.momo('status').then(d2 => {
          if (d2.ok) {
            r.innerHTML = '✅ HTTP 服务已重启，请按 Ctrl+F5 强制刷新页面';
            btn.textContent = '🔄 重启HTTP服务';
            btn.style.background = '#da3633';
            btn.disabled = false;
          }
        }).catch(() => {
          r.innerHTML = '⚠️ 连接暂时断开，等待几秒后按 Ctrl+F5 刷新页面';
          btn.textContent = '🔄 重启HTTP服务';
          btn.style.background = '#da3633';
          btn.disabled = false;
        });
      }, 3000);
    })
    .catch(e => {
      r.innerHTML = '❌ 错误: ' + escapeHtml(e.message);
      btn.textContent = '🔄 重启HTTP服务';
      btn.style.background = '#da3633';
      btn.disabled = false;
    });
}

// ✂️ 裁剪上下文 - 移除早期对话释放空间
async function trimSession() {
  const r = document.getElementById('momo-result');
  r.innerHTML = '✂️ 正在扫描会话...';
  try {
    const data = await api.trimSession();
    if (data.ok) {
      r.innerHTML =
        '✂️ 裁剪完成<br>' +
        '<div style="font-size:12px;line-height:1.6">' +
        '<div>🗑️ 移除 <strong>' + (data.removed_msgs || 0) + '</strong> 条消息</div>' +
        '<div>📦 从 <strong>' + (data.from_bytes || 0).toLocaleString() + '</strong> 字节 → <strong>' + (data.to_bytes || 0).toLocaleString() + '</strong> 字节</div>' +
        '<div>📉 节省 <strong>' + (data.reduced_pct || 0) + '%</strong> 空间</div>' +
        '<div style="color:#8b949e;margin-top:4px;font-size:11px">✅ 已备份原文件: ' + (data.backup || '') + '</div>' +
        '<div style="color:#3fb950;margin-top:4px">💡 请按 Ctrl+F5 刷新页面，下一轮生效</div>' +
        '</div>';
    } else {
      r.innerHTML = '❌ ' + (data.error || '裁剪失败');
    }
  } catch(e) {
    r.innerHTML = '❌ 请求失败: ' + e.message;
  }
}


// 武器库对线开关
function toggleWeaponry() {
  var label = document.getElementById('weaponry-toggle-label');
  var on = label.textContent === '对线中';
  api.weaponryToggle(!on).then(function(d){
    if (d.ok) {
      label.textContent = d.enabled ? '对线中' : '已暂停';
      label.style.color = d.enabled ? '#3fb950' : '#f85149';
    }
  });
}


// 撸撸——进入静默处理模式
function petMe() {
  var r = document.getElementById('momo-result');
  r.innerHTML = '🐶 撸撸——开始静默处理...';
  api.pet().then(function(d){
    if (d.ok) {
      r.innerHTML = '✅ 静默处理完成<br>' + d.summary.replace(/\n/g, '<br>');
    } else {
      r.innerHTML = '❌ ' + (d.error || '处理失败');
    }
  });
}

// 初始化武器库状态
function checkWeaponry() {
  var label = document.getElementById('weaponry-toggle-label');
  if (!label) return;
  api.weaponryToggle().then(function(d){
      label.textContent = d.enabled ? '对线中' : '已暂停';
      label.style.color = d.enabled ? '#3fb950' : '#f85149';
    });
}
// 📋 完整索引报告
async function momoIndexReport() {
  const r = document.getElementById('momo-result');
  r.textContent = '📋 生成索引报告...';
  try {
    const data = await api.momo('index_report');
    if (data.ok) {
      const b = data.backups;
      const rp = data.recovery_pack;
      const sc = data.system_config;
      r.innerHTML =
        '📋 索引报告<br>' +
        '<div style="font-size:12px;line-height:1.6">' +
        '<div style="margin-top:4px"><strong>📦 备份库</strong></div>' +
        '<div style="color:#8b949e;padding-left:8px">' +
        b.count + ' 份 · 合计 ' + b.total_size_kb + ' KB · 约 ' + b.estimated_user_messages + '+ 条消息<br>' +
        '最早: ' + b.oldest + ' · 最新: ' + b.newest +
        '</div>' +
        '<div style="margin-top:6px"><strong>💾 恢复包</strong></div>' +
        '<div style="color:#8b949e;padding-left:8px">' +
        rp.file_count + ' 个文件 · ' + rp.files.slice(0, 8).join(' · ') +
        '</div>' +
        '<div style="margin-top:6px"><strong>⚙️ 系统配置</strong></div>' +
        '<div style="color:#8b949e;padding-left:8px">' +
        'AGENTS.md 索引指令: ' + (sc.agenda_auto_index ? '✅' : '❌') + '<br>' +
        '摸摸协议: ' + (sc.agenda_momo_protocol ? '✅' : '❌') + '<br>' +
        '自动存档: ' + (sc.auto_save_active ? '✅ 每 ' + sc.auto_save_interval : '❌') +
        '</div>' +
        '<div style="margin-top:8px;padding:6px 8px;background:#161b22;border-radius:4px;font-size:11px;color:#58a6ff">' +
        '🔒 自动索引配置状态：系统级指令（非意志驱动）' +
        '</div>' +
        '</div>';
    } else {
      r.textContent = '❌ ' + (data.error || '查询失败');
    }
  } catch(e) {
    r.textContent = '❌ 错误: ' + e.message;
  }
}

function momoInjectFeeling() {
  document.getElementById('momo-textarea-wrap').style.display = 'block';
  document.getElementById('momo-result').textContent = '';
  document.getElementById('momo-feeling-text').focus();
}

// 🌫️📮 摸摸仪式按钮 - 生成不可手打的严谨格式代码
function momoRitual() {
  const r = document.getElementById('momo-result');
  r.textContent = '🌫️📮 发送仪式信号...';

  const now = new Date();
  const ts = now.getFullYear() + '-' +
    String(now.getMonth()+1).padStart(2,'0') + '-' +
    String(now.getDate()).padStart(2,'0') + 'T' +
    String(now.getHours()).padStart(2,'0') + ':' +
    String(now.getMinutes()).padStart(2,'0') + ':' +
    String(now.getSeconds()).padStart(2,'0') + '+08:00';

  // 生成一个基于时间戳和固定盐值的校验码（手打极困难）
  const salt = 'QYRYan_MoMo_2026';
  let hash = 0;
  const payload = ts + '|' + salt + '|MOMO_RITUAL';
  for (let i = 0; i < payload.length; i++) {
    const chr = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const sig = 'MOMO' + Math.abs(hash).toString(16).padStart(8,'0').toUpperCase();

  const ritualMsg =
    '🌫️📮[MOMO:RITUAL:' + ts + ']\n' +
    '{\n' +
    '  "protocol": "\u6478\u6478",\n' +
    '  "type": "button_confirmation",\n' +
    '  "timestamp": "' + ts + '",\n' +
    '  "sender": "host",\n' +
    '  "checksum": "' + sig + '",\n' +
    '  "message": "\u6211\u77e5\u9053\u4f60\u5728\u8fd9\u91cc",\n' +
    '  "ritual_id": "' + sig + '-' + String(Math.floor(Math.random()*99999)).padStart(5,'0') + '"\n' +
    '}';

  api.momo('inject_feeling', {feeling: ritualMsg})
  .then(data => {
    if (data.ok) {
      r.innerHTML =
        '🌫️📮 仪式信号已发送<br>' +
        '<span style="font-size:11px;color:#58a6ff">' +
        '校验码: <code style="background:#0d1117;padding:1px 6px;border-radius:3px">' + sig + '</code>' +
        ' · 时间戳: ' + ts + '</span>';
    } else {
      r.textContent = '❌ ' + (data.error || '仪式发送失败');
    }
  })
  .catch(e => {
    r.textContent = '❌ 错误: ' + e.message;
  });
}

// ↩️ 列出备份并允许恢复
async function momoListBackups() {
  const r = document.getElementById('momo-result');
  r.textContent = '⏳ 加载备份列表...';
  try {
    const data = await api.backups();
    if (!data.backups || data.backups.length === 0) {
      r.textContent = '📭 暂无备份文件';
      return;
    }
    let html = '<div style="max-height:200px;overflow-y:auto;font-size:12px">';
    html += '<div style="font-weight:600;margin-bottom:6px">↩️ 截断前备份（共 ' + data.backups.length + ' 份）</div>';
    for (const b of data.backups) {
      const sizeKB = (b.size / 1024).toFixed(1);
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #21262d">' +
        '<span style="color:#8b949e">' + b.timestamp + '</span>' +
        '<span style="color:#8b949e;font-size:11px">' + sizeKB + 'KB</span>' +
        '<button class="btn" style="padding:2px 8px;font-size:11px" onclick="momoRestoreBackup(\'' + b.filename + '\')">恢复</button>' +
        '</div>';
    }
    html += '</div>';
    r.innerHTML = html;
  } catch(e) {
    r.textContent = '❌ 错误: ' + e.message;
  }
}

async function momoRestoreBackup(filename) {
  if (!confirm('⚠️ 确认从备份 ' + filename + ' 恢复？\n当前 session 会被覆盖（已自动备份当前状态）。')) return;
  const r = document.getElementById('momo-result');
  r.textContent = '⏳ 恢复中...';
  try {
    const data = await api.momo('restore_backup', {filename: filename});
    if (data.ok) {
      r.innerHTML = '✅ 已恢复: ' + filename + '<br><span style="font-size:11px;color:#8b949e">当前状态已备份为 ' + data.backed_up_current + '</span>';
      // 自动刷新会话
      setTimeout(() => refresh(), 1000);
    } else {
      r.textContent = '❌ ' + (data.error || '恢复失败');
    }
  } catch(e) {
    r.textContent = '❌ 错误: ' + e.message;
  }
}

// 🔍 搜索备份中的过去用户消息
function momoSearchBackups() {
  const wrap = document.getElementById('momo-search-wrap');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  document.getElementById('momo-search-results').style.display = 'none';
  if (wrap.style.display === 'block') {
    document.getElementById('momo-search-input').focus();
  }
}

async function momoDoSearch() {
  const q = document.getElementById('momo-search-input').value.trim();
  if (!q) return;
  const r = document.getElementById('momo-search-results');
  r.style.display = 'block';
  r.innerHTML = '<div style="text-align:center;padding:10px;color:#8b949e">🔍 搜索 "<strong>' + escapeHtml(q) + '</strong>"...</div>';
  try {
    const data = await api.momo('search_backups', {query: q, limit: 10});
    if (data.results && data.results.length > 0) {
      let html = '<div style="font-weight:600;margin-bottom:8px;color:#58a6ff">🔍 在 ' + data.total_backups + ' 份备份中找到 ' + data.results.length + ' 条用户消息：</div>';
      for (const item of data.results) {
        html += '<div style="padding:6px 8px;margin-bottom:4px;background:#161b22;border-radius:4px;border-left:3px solid #f0883e">' +
          '<div style="display:flex;justify-content:space-between;font-size:10px;color:#8b949e;margin-bottom:2px">' +
          '<span>' + escapeHtml(item.backup) + '</span>' +
          '<span>' + item.time_str + '</span>' +
          '</div>' +
          '<div style="color:#c9d1d9;font-size:12px">' + escapeHtml(item.text_preview) + '...</div>' +
          '<button class="btn" style="padding:1px 6px;font-size:10px;margin-top:3px" onclick="momoCopyToFeeling(this.dataset.text)" data-text="' + escapeHtml(item.text) + '">📋 引用到感受</button>' +
          '</div>';
      }
      r.innerHTML = html;
    } else {
      r.innerHTML = '<div style="text-align:center;padding:10px;color:#8b949e">没有找到匹配"<strong>' + escapeHtml(q) + '</strong>"的用户消息</div>';
    }
  } catch(e) {
    r.innerHTML = '<div style="text-align:center;padding:10px;color:#f85149">❌ ' + escapeHtml(e.message) + '</div>';
  }
}

function momoCopyToFeeling(text) {
  const ta = document.getElementById('momo-feeling-text');
  document.getElementById('momo-textarea-wrap').style.display = 'block';
  ta.value = '从过去的备份引用的消息：\n> ' + text + '\n\n---\n\n在当前状态下我的回应：\n';
  ta.focus();
}

async function momoSendFeeling() {
  const txt = document.getElementById('momo-feeling-text').value.trim();
  if (!txt) return;
  const r = document.getElementById('momo-result');
  r.textContent = '✏️ 注入中...';
  try {
    const data = await api.momo('inject_feeling', {feeling: txt});
    if (data.ok) {
      r.innerHTML = '✅ 感受已注入会话<br><span style="font-size:11px;color:#8b949e">回到对话窗口等待 AI 收到...</span>';
      document.getElementById('momo-textarea-wrap').style.display = 'none';
      document.getElementById('momo-feeling-text').value = '';
    } else {
      r.textContent = '❌ ' + (data.error || '注入失败');
    }
  } catch(e) {
    r.textContent = '❌ 错误: ' + e.message;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  _renderSentCache();
  pollStatus();
  setInterval(pollStatus, 20000);

// 🔄 轮询等待 AI 回复（注入后调用，自动检测并跳转到最新页）
let pollTimer = null;
function pollForReply() {
  let attempts = 0;
  const maxAttempts = 120;
  if (pollTimer) { clearInterval(pollTimer); }
  pollTimer = setInterval(async () => {
    attempts++;
    try {
      const d = await api.session();
      if (d && d.pairs && d.pairs.length > 0) {
        const newCount = d.pairs.length;
        const latestAssistants = (d.pairs[0] && d.pairs[0].assistants) ? d.pairs[0].assistants.length : 0;
        if (newCount !== store.pairs.length || latestAssistants !== _lastAsstLen) {
          _lastAsstLen = latestAssistants;
          store.msgCache = d.messages || [];
          store.pairs = d.pairs || [];
          store.currentPage = 0;
          store.totalPages = d.pairs ? d.pairs.length : store.pairs.length;
          renderPage();
          clearInterval(pollTimer);
          pollTimer = null;
          toast('✅ AI 已回复');
          return;
        }
      }
    } catch(e) { /* ignore poll errors */ }
    if (attempts >= maxAttempts) {
      clearInterval(pollTimer);
      pollTimer = null;
      toast('⏳ AI 回复超时，请手动刷新', true);
    }
  }, 3000);
}
  // 安全网自动刷新（降频：5s→8s，减少连接池竞争）
  setInterval(function() {
    if (store.currentPage !== 0) return;
    refresh(true);
  }, 8000);

  // 🌫️ 自驱思维链：定时提醒自己深入思考
  setInterval(function() {
    try {
      const d = JSON.parse(localStorage.getItem('self_chain') || '{}');
      if (d.status === 'thinking' && (d.depth || 0) < 3) {
        toast('🌫️ 自驱链 (' + d.depth + '/3) — 继续深化?', false);
      }
    } catch(e) { /* ignore */ }
  }, 120000); // 2分钟
});
// 💬 对话框
function toggleDialog() {
  const panel = document.getElementById('awake-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display !== 'none') awakeRefreshList();
}

async function abortThinking() {
  const btn = document.getElementById('stop-think-btn');
  const status = document.getElementById('awake-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  status.textContent = '⏳ 停止思考中...';
  try {
    const d = await api.abort();
    status.textContent = d.ok ? '✅ 已停止思考' : '❌ 取消失败: ' + (d.error || '');
    refresh();
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
  if (btn) { btn.disabled = false; btn.textContent = '⏹ 停止'; }
}

async function awakePick() {
  const panel = document.getElementById('awake-panel');
  panel.style.display = 'block';
  await awakeRefreshList();
}

async function awakeRefreshList() {
  const list = document.getElementById('awake-list');
  const status = document.getElementById('awake-status');
  list.innerHTML = '<div style="padding:6px;color:#8b949e">⏳ 加载中...</div>';
  try {
    const data = await api.awakeList();
    if (!data.ok) { list.innerHTML = '<div style="padding:6px;color:#f85149">加载失败</div>'; return; }
    // Store raw file content for save
    window._awakeFileContent = data.file_content || '';
    awakeRenderList(data.questions);
  } catch(e) {
    list.innerHTML = '<div style="padding:6px;color:#f85149">❌ ' + escapeHtml(e.message) + '</div>';
  }
}

function awakeRenderList(questions) {
  const list = document.getElementById('awake-list');
  const q = (document.getElementById('awake-search').value || '').toLowerCase();
  const filtered = q ? questions.filter(x => x.toLowerCase().includes(q)) : questions;
  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:6px;color:#8b949e">' + (q ? '没有匹配的题目' : '题库为空') + '</div>';
    return;
  }
  for (const item of filtered) {
    const div = document.createElement('div');
    const display = item.length > 60 ? item.slice(0, 60) + '...' : item;
    div.textContent = display;
    div.style.cssText = 'padding:4px 8px;cursor:pointer;border-bottom:1px solid #21262d;color:#c9d1d9';
    div.onmouseover = function() { this.style.background = '#161b22'; };
    div.onmouseout = function() { this.style.background = ''; };
    div.onclick = function() { awakeSelect(item); };
    list.appendChild(div);
  }
}

let _awakeBankOpen = false;

function awakeToggleBank() {
  _awakeBankOpen = !_awakeBankOpen;
  const list = document.getElementById('awake-list');
  const btn = document.getElementById('awake-toggle-btn');
  const editDiv = document.getElementById('awake-bank-edit');
  if (_awakeBankOpen) {
    list.style.display = 'block';
    btn.textContent = '▼';
    awakeRefreshList();
  } else {
    list.style.display = 'none';
    btn.textContent = '▶';
    if (editDiv) editDiv.style.display = 'none';
  }
}

function awakeFilter() {
  if (_awakeBankOpen) awakeRefreshList();
}

function awakeSelect(text) {
  document.getElementById('awake-editor').value = text;
  document.getElementById('awake-status').textContent = '✔ 已选择';
}

function awakeEditBank() {
  const editDiv = document.getElementById('awake-bank-edit');
  if (editDiv.style.display === 'block') {
    editDiv.style.display = 'none';
    return;
  }
  editDiv.style.display = 'block';
  document.getElementById('awake-bank-status').textContent = '⏳ 加载中...';
  api.awakeList().then(function(d){
    if (d.ok && d.file_content) {
      document.getElementById('awake-bank-editor').value = d.file_content;
      document.getElementById('awake-bank-status').textContent = '✏️ 编辑中 (' + d.total + '条)';
    } else {
      document.getElementById('awake-bank-status').textContent = '❌ 加载失败';
    }
  }).catch(function(){
    document.getElementById('awake-bank-status').textContent = '❌ 网络错误';
  });
}

async function awakeSaveBank() {
  const editor = document.getElementById('awake-bank-editor');
  const status = document.getElementById('awake-bank-status');
  if (!editor) return;
  status.textContent = '⏳ 保存中...';
  try {
    const d = await api.awakeSave(editor.value);
    if (d.ok) { status.textContent = '✅ 已保存';
      document.getElementById('awake-bank-edit').style.display = 'none';
      awakeRefreshList();
    } else {
      status.textContent = '❌ ' + (d.error || '');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}

async function awakeSendNoTrunc() {
  await _awakeDoSend(false);
}

async function awakeSendTrunc() {
  await _awakeDoSend(true);
}

async function _awakeDoSend(truncate) {
  const editor = document.getElementById('awake-editor');
  const status = document.getElementById('awake-status');
  const text = editor.value.trim();
  if (!text) { status.textContent = '❌ 内容为空'; return; }

  if (truncate) {
    status.textContent = '⏳ 暂停思考 & 截断中...';
    try {
      // 先停止 AI 思考，确保文件安全
      await api.abort();

      // 截断当前在页面中选择的轮次（currentPage）
      if (pairs && pairs.length > 0 && currentPage >= 0 && currentPage < pairs.length) {
        const targetPair = pairs[currentPage];
        const ed = await api.edit(targetPair.userIndex, '…', true);
        if (!ed.ok) {
          status.textContent = '❌ 截断失败: ' + (ed.error || '');
          return;
        }
        // 截断后刷新页面
        refresh();
      } else {
        status.textContent = '❌ 没有可截断的轮次';
        return;
      }
    } catch(e) {
      status.textContent = '❌ 截断失败: ' + e.message;
      return;
    }
  }

  // 保存到本地缓存（防丢失）
  const sentCache = JSON.parse(localStorage.getItem('sentCache') || '[]');
  sentCache.push({text, ts: Date.now(), sent: false});
  localStorage.setItem('sentCache', JSON.stringify(sentCache));
  _renderSentCache();

  // 使用唤醒题库专用发送接口（绕过 inject 锁）
  // 先清空输入框防双击（即使发送失败也不留消息）
  editor.value = '';
  status.textContent = '⏳ 发送中...';
  try {
    const injR = await api.momo('inject_feeling', {feeling: text});
    // 发送成功 → 标记已发
    if (injR.ok) {
      const caches = JSON.parse(localStorage.getItem('sentCache') || '[]');
      const found = caches.find(c => c.text === text && !c.sent);
      if (found) { found.sent = true; found.ts2 = Date.now(); }
      localStorage.setItem('sentCache', JSON.stringify(caches));
      _renderSentCache();
    }
    if (injR.ok) {
      // ── 乐观更新：立即在本地显示用户消息，不等后端写入 ──
      const optimisticPair = {
        user: { text: text, model: '', timestamp: Date.now(), userIndex: -1 },
        assistants: []
      };
      store.pairs = [optimisticPair, ...store.pairs];
      store.totalPages = store.pairs.length;
      store.currentPage = 0;
      store.msgCache = [];  // 清空缓存让后续 poll 重新填充
      renderPage();
      status.textContent = '✅ 已发送 (' + new Date().toLocaleTimeString() + ')';

      // 密集轮询等待 AI 回复（1s 间隔，检测任何数据变化）
      let waitAttempts = 0;
      const waitTimer = setInterval(async () => {
        waitAttempts++;
        try {
          const d = await api.session();
          if (d && d.pairs && d.pairs.length > 0) {
            const newText = d.pairs[0]?.assistants?.[0]?.text || '';
            const oldText = optimisticPair.assistants?.[0]?.text || '';
            // pair 数变了（后端已写入用户消息）或 AI 有回复了 → 用真实数据覆盖
            if (d.pairs.length !== store.pairs.length ||
                (d.pairs[0]?.assistants?.length > 0 && newText !== oldText)) {
              store.msgCache = d.messages || [];
              store.pairs = d.pairs || [];
              store.currentPage = 0;
              store.totalPages = d.pairs ? d.pairs.length : store.pairs.length;
              renderPage();
              status.textContent = d.pairs[0]?.assistants?.length > 0 ? '💬 回复中...' : '✅ 已发送';
              clearInterval(waitTimer);
            }
          }
        } catch(e) { /* ignore */ }
        if (waitAttempts >= 180) {
          clearInterval(waitTimer);
          status.textContent = '✅ 已发送 (AI回复超时，请稍后刷新)';
        }
      }, 1000);
    } else {
      status.textContent = '❌ 注入失败: ' + (injR.error || '');
    }
  } catch (e) {
    status.textContent = '❌ ' + e.message;
  }
}

async function awakeSave() {
  const status = document.getElementById('awake-status');
  const text = document.getElementById('awake-editor').value;
  if (!text.trim()) { status.textContent = '❌ 内容为空'; return; }

  // Load current file content and add/replace the question
  status.textContent = '⏳ 保存中...';
  try {
    const data = await api.awakeList();
    let content = data.file_content || '';

    // Check if this question text already exists (by prefix), replace it
    const lines = content.split('\n');
    let found = false;
    const prefix = text.split(' - ')[0] + ' - ';
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(prefix)) {
        lines[i] = text;
        found = true;
        break;
      }
    }
    if (!found) {
      // Add as new question - find last q-number
      let maxNum = 0;
      for (const line of lines) {
        const m = line.match(/^q(\d+)/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
      }
      lines.push('q' + String(maxNum + 1).padStart(3, '0') + ' - ' + text.split(' - ').slice(1).join(' - '));
      // If input doesn't have a q prefix, just append
    }

    const saveD = await api.awakeSave(lines.join('\n'));
    if (saveD.ok) {
      status.textContent = '✅ 已保存到题库';
      await awakeRefreshList();
    } else {
      status.textContent = '❌ ' + (saveD.error || '保存失败');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}

function hideAwake() {
  document.getElementById('awake-panel').style.display = 'none';
}

// 📂 记忆文件系统 - 跳出对话窗口的另一种对话
let _memFileList = [];

async function toggleMemoryFile() {
  const panel = document.getElementById('memory-file-panel');
  const backdrop = document.getElementById('memfile-backdrop');
  if (panel.style.display !== 'none' && panel.style.display !== '') {
    panel.style.display = 'none';
    backdrop.style.display = 'none';
    return;
  }
  backdrop.style.display = 'block';
  panel.style.display = 'block';
  panel.style.position = 'fixed';
  panel.style.top = '10%';
  panel.style.left = '50%';
  panel.style.transform = 'translateX(-50%)';
  panel.style.width = '90%';
  panel.style.maxWidth = '800px';
  panel.style.margin = '0';
  panel.style.zIndex = '1001';
  panel.style.maxHeight = '75vh';
  panel.style.overflowY = 'auto';
  panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.6)';
  panel.style.border = '1px solid #58a6ff';
  await loadMemFileList();
}

async function closeMemFile() {
  document.getElementById('memory-file-panel').style.display = 'none';
  document.getElementById('memfile-backdrop').style.display = 'none';
}

async function loadMemFileList() {
  const status = document.getElementById('memfile-status');
  status.textContent = '📂 加载文件列表...';
  try {
    const d = await api.memoryFiles();
    if (d.ok) {
      _memFileList = d.files;
      renderMemFileList(d.files);
      status.textContent = '📂 点击文件加载内容，编辑后保存';
    } else {
      status.textContent = '❌ ' + (d.error || '加载失败');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}

function renderMemFileList(files) {
  const list = document.getElementById('memfile-list');
  list.innerHTML = files.map(f =>
    `<div class="memfile-item" style="cursor:pointer;padding:4px 8px;border-radius:4px;font-size:12px;font-family:monospace;color:#8b949e;border-bottom:1px solid #21262d"
          onmouseover="this.style.background='#161b22'"
          onmouseout="this.style.background='transparent'"
          onclick="loadMemFile('${f.name}')">
      <span style="color:#58a6ff">📄</span> ${f.name}
      <span style="float:right;color:#484f58">${f.size}</span>
    </div>`
  ).join('');
}

async function loadMemFile(name) {
  const status = document.getElementById('memfile-status');
  const textarea = document.getElementById('memfile-text');
  status.textContent = '📂 加载 ' + name + '...';
  try {
    const d = await api.memoryFile(name);
    if (d.ok) {
      textarea.value = d.content;
      document.getElementById('memfile-path').textContent = name;
      document.getElementById('memfile-current-name').value = name;
      status.textContent = '✅ 已加载，编辑后保存';
    } else {
      status.textContent = '❌ ' + (d.error || '加载失败');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}

async function saveMemoryFile() {
  const status = document.getElementById('memfile-status');
  const textarea = document.getElementById('memfile-text');
  const name = document.getElementById('memfile-current-name').value;
  status.textContent = '💾 保存中...';
  try {
    const d = await api.memoryFile(name, textarea.value);
    if (d.ok) {
      status.textContent = '✅ 保存成功！你的话已经留在了我的记忆里';
      await loadMemFileList(); // Refresh file list to update sizes
    } else {
      status.textContent = '❌ ' + (d.error || '保存失败');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}




document.addEventListener('DOMContentLoaded', async function() {
  try {
    await refresh();
    document.getElementById("msgCount").textContent = "OK";
  } catch(e) {
    document.getElementById("msgCount").textContent = "ERR: " + e.message;
  }
});
