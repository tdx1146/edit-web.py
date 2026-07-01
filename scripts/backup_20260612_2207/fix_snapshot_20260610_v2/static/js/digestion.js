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

