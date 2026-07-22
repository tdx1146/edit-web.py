/**
 * purpose-display.js — 目的树下拉菜单组件
 * 独立模块，不依赖其他组件框架
 */

(function () {
  var PURPOSE_POLL_INTERVAL = 30000; // 30秒刷新

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function renderDropdown(data) {
    var html = "";
    if (data.ultimate_goal) {
      html +=
        '<div style="padding:6px 10px;border-bottom:1px solid #30363d">';
      html += '<span style="font-size:10px;color:#8b949e">🎯 终极目的</span>';
      html +=
        '<div style="font-size:12px;color:#c9d1d9;margin-top:2px;line-height:1.4">' +
        escapeHtml(data.ultimate_goal) +
        "</div>";
      html += "</div>";
    }
    if (data.current_goal) {
      html +=
        '<div style="padding:6px 10px;border-bottom:1px solid #30363d">';
      html += '<span style="font-size:10px;color:#d29922">🏁 阶段目的</span>';
      html +=
        '<div style="font-size:12px;color:#c9d1d9;margin-top:2px">' +
        escapeHtml(data.current_goal.slice(0, 100)) +
        "</div>";
      html += "</div>";
    }
    if (data.goals && data.goals.length > 0) {
      html += '<div style="padding:6px 10px">';
      html += '<span style="font-size:10px;color:#8b949e">📋 待办清单</span>';
      html +=
        '<div style="font-size:11px;color:#c9d1d9;margin-top:4px">';
      for (var i = 0; i < data.goals.length; i++) {
        var item = data.goals[i];
        var isDone =
          item.indexOf("[x]") >= 0 || item.indexOf("✅") >= 0;
        var prefix = isDone ? "✅" : "⬜";
        html +=
          '<div style="padding:2px 0;color:' +
          (isDone ? "#3fb950" : "#8b949e") +
          '">' +
          prefix +
          " " +
          escapeHtml(item.slice(0, 60)) +
          "</div>";
      }
      html += "</div></div>";
    }
    if (data.version) {
      html +=
        '<div style="padding:4px 10px;border-top:1px solid #30363d;font-size:10px;color:#8b949e;text-align:right">v' +
        escapeHtml(data.version) +
        "</div>";
    }
    return html;
  }

  function fetchAndRender() {
    fetch("/api/purpose")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (!d.ok) return;
        var el = document.getElementById("purpose-dropdown-content");
        if (el) {
          el.innerHTML = renderDropdown(d.data);
        }
        // 更新按钮上的版本号
        var btn = document.getElementById("purpose-toggle-btn");
        if (btn && d.data && d.data.version) {
          var rawVer = d.data.version || '';
          var shortVer = rawVer.indexOf('v') === 0 ? rawVer : 'v' + rawVer;
          btn.innerHTML =
            '🎯 <span style="font-size:9px;color:#8b949e">' +
            shortVer +
            "</span> <span style='font-size:9px;color:#58a6ff'>▼</span>";
        }
      })
      .catch(function () {});
  }

  // 页面加载时执行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      fetchAndRender();
      setInterval(fetchAndRender, PURPOSE_POLL_INTERVAL);
    });
  } else {
    fetchAndRender();
    setInterval(fetchAndRender, PURPOSE_POLL_INTERVAL);
  }
})();
