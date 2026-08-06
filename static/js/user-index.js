// ─────────────────────────────────────────────────────────────────────────────
// user-index.js — 截断索引换算模块（前端专用，不依赖后端改动）
// ─────────────────────────────────────────────────────────────────────────────
//
// 🎯 解决的问题（2026-08 截断bug）：
//   · 后端 edit_message() 在"完整文件"上数用户消息：target = 全部用户消息中的
//     第 N 条（0 基，最旧=0，最新 = total_users-1）。
//   · 但 /api/session 为了性能只返回"最后 50 轮"（read_session max_rounds=50）。
//     前端拿到的 pair.userIndex 是"窗口内"序号（窗口最旧=0，最新=窗口长-1），
//     且 sessions.json 主会话可能远大于 50 轮（如 1872 用户消息）。
//   · 若直接把窗口内 userIndex 传给后端，新版会指向窗口最旧处 → 误截断几乎全部
//     对话（后端 50% 保险线会拦截，但操作会失败/指向错误目标）。
//
// ✅ 修复思路（高内聚）：把"窗口内序号"换算成"全局序号"：
//      globalIndex = windowUserIndex + offset
//  其中 offset = 全文用户消息数 − 窗口用户消息数（= 被窗口跳过的头部用户消息数）。
//   · 当窗口不满 50 轮时，窗口=全文，offset=0（无需额外请求）。
//   · 当窗口恰好 50 轮时（窗口已饱和），需取一次全文用户数求 offset。
//
//  这些逻辑全部收敛在此模块，其他前端文件只调用 computeGlobalUserIndex()。
// ─────────────────────────────────────────────────────────────────────────────
(function(){
  'use strict';

  // 与后端 edit-web.py read_session() 的默认窗口一致（不得修改）
  var WINDOW_ROUNDS = 50;

  // 全文用户消息数缓存 { sessionFile: { count, ts } }
  // 会话文件不常变，做 TTL 缓存避免重复拉 5~6MB 大文件。
  var _fullCountCache = {};
  var _FETCH_TTL_MS = 60 * 1000; // 60 秒

  // 正在进行的全文统计请求（去重并发）
  var _pendingFetch = null;

  /**
   * 获取当前会话文件的绝对路径（优先从 store 里的 info，回退拉一次 /api/session）
   * @returns {Promise<string|null>}
   */
  function getSessionFilePath() {
    var info = window.store && window.store.sessionInfo;
    if (info && info.sessionFile) return Promise.resolve(info.sessionFile);
    return window.api.session().then(function(d) {
      if (d && d.info && d.info.sessionFile) return d.info.sessionFile;
      return null;
    }).catch(function() { return null; });
  }

  /**
   * 通过 /api/tb-read-file 读取会话 JSONL 并统计其中 user 消息的条数（全文）。
   * @returns {Promise<number|null>} 解析失败返回 null
   */
  function fetchFullUserCount() {
    var path = null;
    return getSessionFilePath().then(function(fp) {
      path = fp;
      if (!fp) return Promise.resolve(null);
      return window.api.get('/api/tb-read-file?path=' + encodeURIComponent(fp));
    }).then(function(d) {
      if (!d || !d.ok || typeof d.content !== 'string') return Promise.resolve(null);
      // 行级统计：包含 "role":"user" 的行即计为一个用户消息
      var count = 0;
      var idx = 0;
      var content = d.content;
      while (idx < content.length) {
        var nl = content.indexOf('\n', idx);
        var line = nl === -1 ? content.slice(idx) : content.slice(idx, nl);
        if (line.indexOf('"role":"user"') !== -1) count++;
        if (nl === -1) break;
        idx = nl + 1;
      }
      return count;
    }).catch(function() { return null; });
  }

  /**
   * 获取全文用户消息数（带 TTL 缓存）。
   * @returns {Promise<number|null>}
   */
  function getFullUserCount() {
    return getSessionFilePath().then(function(fp) {
      if (!fp) return Promise.resolve(null);
      var cached = _fullCountCache[fp];
      if (cached && (Date.now() - cached.ts) < _FETCH_TTL_MS) {
        return cached.count;
      }
      // 并发去重
      if (!_pendingFetch) {
        _pendingFetch = fetchFullUserCount().then(function(count) {
          _pendingFetch = null;
          if (count !== null && count !== undefined) {
            _fullCountCache[fp] = { count: count, ts: Date.now() };
          }
          return count;
        }).catch(function() {
          _pendingFetch = null;
          return null;
        });
      }
      return _pendingFetch;
    });
  }

  /**
   * 核心换算：把窗口内/页内的 userIndex 换算成后端要的"全局用户消息序号"。
   * @param {number} windowUserIndex  当前 pair 的 userIndex（窗口内，0 基）
   * @param {number} windowUserCount  当前 store.pairs 的长度（窗口用户消息条数）
   * @returns {Promise<number>} 换算后的全局索引；拿不到 offset 时保守返回原值
   *                             （此时由后端 50% 保险线兜底，绝无数据丢失风险）
   */
  function computeGlobalUserIndex(windowUserIndex, windowUserCount) {
    windowUserIndex = Number(windowUserIndex) || 0;
    windowUserCount = Number(windowUserCount) || 0;

    // 参数非法：原样返回（后端安全线兜底）
    if (windowUserCount <= 0) return Promise.resolve(windowUserIndex);

    // 窗口未饱和 → 窗口即全文 → offset = 0，无需额外请求
    if (windowUserCount < WINDOW_ROUNDS) {
      return Promise.resolve(debugGlobalIndex('小会话(offset=0)', windowUserIndex, windowUserIndex));
    }

    // 窗口饱和（==50）→ 需要全文用户数求 offset
    return getFullUserCount().then(function(fullCount) {
      var out;
      if (fullCount === null || fullCount === undefined || fullCount <= windowUserCount) {
        // 拿不到/异常 → 保守回退为窗口内原值（后端保险线续兜底）
        out = windowUserIndex;
      } else {
        var offset = fullCount - windowUserCount;
        out = windowUserIndex + offset;
      }
      return debugGlobalIndex('窗口=' + windowUserCount + ' 全文=' + (fullCount === null ? '?' : fullCount),
                              windowUserIndex, out);
    });
  }

  /**
   * 便捷版：直接对当前选中的 pair 换算全局索引。
   * @param {object} pair  store.pairs 中的某一轮
   * @returns {Promise<number>}
   */
  function computeGlobalUserIndexForPair(pair) {
    var winCount = (window.store && window.store.pairs && window.store.pairs.length) || 0;
    var idx = (pair && pair.user && typeof pair.user.userIndex === 'number') ? pair.user.userIndex : 0;
    return computeGlobalUserIndex(idx, winCount);
  }

  // 🔍 调试观察：换算前后打印，便于验证命中正确轮次（仅当索引变化时输出）
  function debugGlobalIndex(label, winIndex, globalIndex) {
    try {
      if (window.console && console.debug) {
        console.debug('[user-index] ' + label + ' windowIndex=' + winIndex + ' → globalIndex=' + globalIndex);
      }
    } catch (e) {}
    return globalIndex;
  }

  // ── 导出到全局（Load 顺序：core.js → user-index.js → editor.js / awake.js）──
  window.userIndexCtl = {
    computeGlobalUserIndex: computeGlobalUserIndex,
    computeGlobalUserIndexForPair: computeGlobalUserIndexForPair,
    getFullUserCount: getFullUserCount,
    getSessionFilePath: getSessionFilePath,
    debugGlobalIndex: debugGlobalIndex,
    WINDOW_ROUNDS: WINDOW_ROUNDS,
    // 测试钩子：允许注入假全文计数 / 清缓存
    _setFullCount: function(fp, count) {
      if (fp) _fullCountCache[fp] = { count: count, ts: Date.now() };
      else { _fullCountCache = {}; }
    },
    _clearCache: function() { _fullCountCache = {}; _pendingFetch = null; }
  };
})();
