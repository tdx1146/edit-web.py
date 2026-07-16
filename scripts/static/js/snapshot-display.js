/**
 * snapshot-display.js — 版本快照监控（下拉菜单）
 */
(function() {
    var POLL_INTERVAL = 30000;
    function escapeHtml(str) {
        if (!str) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
    function renderDropdown(data) {
        var html = '';
        html += '<div style="padding:6px 10px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between">';
        html += '<span style="font-size:10px;color:#8b949e">📸 版本快照</span>';
        html += '<span style="font-size:10px;color:#8b949e">' + escapeHtml(data.version || '?') + ' · 共' + (data.total || 0) + '个</span>';
        html += '</div>';
        if (data.list && data.list.length > 0) {
            for (var i = 0; i < data.list.length; i++) {
                var s = data.list[i];
                var icon = '📦';
                if (s.trigger === 'git_commit') icon = '🔧';
                else if (s.trigger === 'scheduler_creation') icon = '🧭';
                else if (s.trigger === 'test_direct' || s.trigger === 'test' || s.trigger === 'audit_test') icon = '🧪';
                else if (s.trigger === 'manual') icon = '👤';
                html += '<div style="padding:5px 10px;border-bottom:1px solid #21262d;font-size:11px">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center">';
                html += '<span>' + icon + ' <b>' + escapeHtml(s.version) + '</b></span>';
                html += '<span style="color:#8b949e;font-size:10px">' + escapeHtml(s.time) + '</span>';
                html += '</div>';
                html += '<div style="color:#58a6ff;font-size:10px;margin-top:1px">' + escapeHtml(s.trigger) + '</div>';
                html += '</div>';
            }
        }
        return html;
    }
    function fetchAndRender() {
        fetch('/api/snapshot')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.ok) return;
                var btn = document.getElementById('snapshot-summary');
                if (btn && d.data) {
                    var rawVer = (d.data.version || '?');
                    var shortVer = rawVer.indexOf('v') === 0 ? rawVer : 'v' + rawVer;
                    btn.textContent = (d.data.total || 0) + ' · ' + shortVer;
                }
                var el = document.getElementById('snapshot-dropdown-content');
                if (el) el.innerHTML = renderDropdown(d.data);
            })
            .catch(function() {});
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { fetchAndRender(); setInterval(fetchAndRender, POLL_INTERVAL); });
    } else {
        fetchAndRender(); setInterval(fetchAndRender, POLL_INTERVAL);
    }
})();
