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
      const d = await api.sessionFresh();
      if (d && d.pairs && d.pairs.length > 0) {
        const newCount = d.pairs.length;
        const latestAssistants = (d.pairs[0] && d.pairs[0].assistants) ? d.pairs[0].assistants.length : 0;
        // 后端轮数少于本地（乐观更新导致）→ 跳过
        if (newCount < store.pairs.length) return;
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
          const d = await api.sessionFresh();
          if (d && d.pairs && d.pairs.length > 0) {
            const newText = d.pairs[0]?.assistants?.[0]?.text || '';
            const oldText = optimisticPair.assistants?.[0]?.text || '';
            const newAsstLen = d.pairs[0]?.assistants?.length || 0;

            if (d.pairs.length > store.pairs.length) {
              // 后端有新轮次（可能用户发了多条）→ 整组替换
              store.msgCache = d.messages || [];
              store.pairs = d.pairs || [];
              store.currentPage = 0;
              store.totalPages = store.pairs.length;
              renderPage();
              status.textContent = '✅ 已发送';
              clearInterval(waitTimer);
            } else if (newAsstLen > 0 && newText !== oldText) {
              // AI 回复了 → 原地更新 assistant，不替换整个数组（防闪烁）
              store.pairs[0] = {
                ...store.pairs[0],
                user: d.pairs[0].user,       // 用真实 user 数据
                assistants: d.pairs[0].assistants,  // 真实 assistant 数据
              };
              if (d.messages) store.msgCache = d.messages;
              renderPage();
              status.textContent = '💬 回复中...';
              // 不 clearInterval，继续轮询获取更多文字
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
