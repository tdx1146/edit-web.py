// modules.js — 精简启动器 (2026-06-10)
async function refresh() {
  try {
    var data = null;
    try {
      data = await api.sessionFresh();
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

    // 如果后端返回的轮数比本地少（乐观更新导致本地多了一条），跳过
    // 等后端写入后轮数 >= 本地时再更新
    if (newCount < store.pairs.length) {
      return;
    }

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


document.addEventListener('DOMContentLoaded', async function() {
  try {
    await refresh();
    document.getElementById("msgCount").textContent = "OK";
  } catch(e) {
    document.getElementById("msgCount").textContent = "ERR: " + e.message;
  }
});
