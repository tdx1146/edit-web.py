function enableMobileResize(ta) {
  if (!ta || ta.dataset.mobileResize) return;
  ta.dataset.mobileResize = '1';
  var startY, startH;
  ta.addEventListener('touchstart', function(e) {
    // 只有触摸底部时才触发
    var rect = ta.getBoundingClientRect();
    var touchY = e.touches[0].clientY;
    if (touchY < rect.bottom - 30) return;
    startY = touchY;
    startH = ta.offsetHeight;
  }, {passive: true});
  ta.addEventListener('touchmove', function(e) {
    if (!startY) return;
    var dy = e.touches[0].clientY - startY;
    var newH = Math.max(60, startH + dy);
    ta.style.height = newH + 'px';
  }, {passive: true});
  ta.addEventListener('touchend', function() { startY = null; }, {passive: true});
}

// 自动给所有textarea启用触摸缩放
document.addEventListener('DOMContentLoaded', function() {
  // 使 textarea 可从右上+右下拖拽变长
  function setupResize(el) {
    el.style.resize = "vertical";

    // 在手柄所属的 textarea 外面包一层紧身容器
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;width:100%";
    // 把 textarea 的 margin 转移到容器上
    const m = el.style.marginBottom;
    if (m) { wrap.style.marginBottom = m; el.style.marginBottom = "0"; }
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    // 右上角手柄——贴在 textarea 本体右上角
    const grip = document.createElement("div");
    grip.style.cssText = "position:absolute;top:0;right:0;width:24px;height:16px;cursor:nw-resize;z-index:10;background:linear-gradient(225deg,transparent 40%,#666 60%,#888 100%);border-radius:0 6px 0 0;opacity:0.4";
    grip.title = "上拖变大，下拖变小";
    grip.onmouseenter = function() { this.style.opacity = "0.8"; };
    grip.onmouseleave = function() { this.style.opacity = "0.4"; };
    grip.onmousedown = function(e) {
      e.preventDefault(); e.stopPropagation();
      const startY = e.clientY, startH = el.offsetHeight;
      function mm(ev) {
        const delta = startY - ev.clientY;
        el.style.height = Math.max(50, startH + delta) + "px";
      }
      function mu() { document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); }
      document.addEventListener("mousemove", mm);
      document.addEventListener("mouseup", mu);
    };
    // 移动端 touch 支持
    grip.ontouchstart = function(e) {
      var touch = e.touches[0];
      var startY = touch.clientY, startH = el.offsetHeight;
      function tm(ev) {
        ev.preventDefault();
        var t = ev.touches[0];
        var delta = startY - t.clientY;
        el.style.height = Math.max(50, startH + delta) + "px";
      }
      function tu() { document.removeEventListener("touchmove", tm); document.removeEventListener("touchend", tu); }
      document.addEventListener("touchmove", tm, {passive: false});
      document.addEventListener("touchend", tu);
    };
    wrap.appendChild(grip);
  }
    document.querySelectorAll("textarea").forEach(setupResize);
  });
// 动态创建的textarea也启用
var origCreateTextarea = document.createElement;
document.createElement = function(tag) {
  var el = origCreateTextarea.call(document, tag);
  if (tag === 'textarea' || tag === 'TEXTAREA') {
    setTimeout(function() { enableMobileResize(el); }, 100);
  }
  return el;
};

// 思考模式检测
