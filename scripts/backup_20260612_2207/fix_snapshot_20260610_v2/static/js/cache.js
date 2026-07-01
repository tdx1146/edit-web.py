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

