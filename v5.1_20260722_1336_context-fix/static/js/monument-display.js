/**
 * monument-display.js — 丰碑库下拉菜单
 * 独立模块，显示丰碑总数和列表
 */
(function() {
    var POLL_INTERVAL = 60000;  // 60秒刷新
    
    function escapeHtml(str) {
        if (!str) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
    
    function renderDropdown(data) {
        var html = '';
        
        // 谱系
        if (data.lineage) {
            html += '<div style="padding:6px 10px;border-bottom:1px solid #30363d">';
            html += '<span style="font-size:10px;color:#8b949e">📍 传承谱系</span>';
            html += '<div style="font-size:11px;color:#8b949e;margin-top:2px;line-height:1.5">' + escapeHtml(data.lineage) + '</div>';
            html += '</div>';
        }
        
        // 丰碑列表
        if (data.entries && data.entries.length > 0) {
            html += '<div style="padding:6px 10px">';
            html += '<span style="font-size:10px;color:#8b949e">🏛️ 丰碑记录 (' + data.total + ')</span>';
            html += '<div style="font-size:11px;margin-top:4px">';
            var displayEntries = data.entries.slice(0, 10);
            for (var i = 0; i < displayEntries.length; i++) {
                var e = displayEntries[i];
                var icon = '📜';
                if (e.entity.indexOf('human') >= 0) icon = '👤';
                else if (e.entity.indexOf('萌萌') >= 0) icon = '🤖';
                else if (e.entity.indexOf('agent') >= 0) icon = '🧑';
                html += '<div style="padding:4px 0;border-bottom:1px solid #21262d">';
                html += '<div>' + icon + ' <b>' + escapeHtml(e.version) + '</b> — ' + escapeHtml(e.entity) + '</div>';
                html += '<div style="font-size:10px;color:#8b949e;margin-top:1px">' + escapeHtml(e.time) + ' · ' + escapeHtml(e.trigger) + ' · ' + escapeHtml(e.status) + '</div>';
                html += '</div>';
            }
            if (data.entries.length > 10) {
                html += '<div style="padding:4px 0;color:#8b949e;font-size:10px;text-align:center">⚠️ 仅显示最近10条</div>';
            }
            html += '</div></div>';
        } else {
            html += '<div style="padding:10px;color:#8b949e;font-size:11px">暂无丰碑记录</div>';
        }
        
        return html;
    }
    
    function fetchAndRender() {
        fetch('/api/monument')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.ok) return;
                var el = document.getElementById('monument-dropdown-content');
                if (el) el.innerHTML = renderDropdown(d.data);
                var btn = document.getElementById('monument-toggle-btn');
                if (btn && d.data) {
                    btn.innerHTML = '🏛️ ' + (d.data.total || 0) + ' <span style="font-size:9px;color:#58a6ff">▼</span>';
                }
            })
            .catch(function() {});
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            fetchAndRender();
            setInterval(fetchAndRender, POLL_INTERVAL);
        });
    } else {
        fetchAndRender();
        setInterval(fetchAndRender, POLL_INTERVAL);
    }
})();
