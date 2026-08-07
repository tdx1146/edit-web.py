/**
 * status-display.js — 系统守护进程状态指示灯
 * 显示玄鉴和调度器是否在线
 */
(function() {
    var POLL_INTERVAL = 15000;  // 15秒刷新
    
    function fetchAndRender() {
        fetch('/api/system-status')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.ok) return;
                var zj = d.data && d.data.zanjian;
                var sch = d.data && d.data.scheduler;
                
                var zjEl = document.getElementById('status-zanjian');
                if (zjEl) {
                    var zjOn = zj && zj.running;
                    zjEl.innerHTML = (zjOn ? '🛡️ <span style="color:#3fb950">在线</span>' : '🛡️ <span style="color:#f85149">离线</span>');
                    zjEl.title = zjOn ? '玄鉴守护进程 PID: ' + (zj.pid || '?') : '玄鉴守护进程未运行';
                }
                
                var schEl = document.getElementById('status-scheduler');
                if (schEl) {
                    var schOn = sch && sch.running;
                    schEl.innerHTML = (schOn ? '🧭 <span style="color:#3fb950">运行</span>' : '🧭 <span style="color:#f85149">停止</span>');
                    schEl.title = schOn ? '调度器 PID: ' + (sch.pid || '?') : '调度器未运行';
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
