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

