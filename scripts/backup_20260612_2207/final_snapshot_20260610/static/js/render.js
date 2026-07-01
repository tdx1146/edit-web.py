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
function renderPage() {
  const el = document.getElementById('messages');
  const pc = document.getElementById('msgCount');
  pc.textContent = renderCountText(store);
  el.innerHTML = renderMessagesHtml(store);
  renderPagination();
}

// ── 子代理面板 ────────────────────────────────────────────────────────────
let subagentPanelOpen = false;
