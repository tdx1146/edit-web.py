function setupPagination() {
  // 只执行一次：创建分页栏HTML结构
  const initHtml = totalPages > 0
    ? '<button class="btn" data-page="0">«</button>' +
      '<button class="btn" data-page="prev">‹</button>' +
      ' 第 <input id="pageInput" type="number" min="1" max="' + totalPages + '" value="1" style="width:48px"> 页 / <span id="pageTotal">' + totalPages + '</span>' +
      '<button class="btn" data-page="next">›</button>' +
      '<button class="btn" data-page="last">»</button>' +
      '<button class="btn" id="jumpBtn">跳转</button>' +
      '<button class="btn" onclick="refresh()" title="刷新会话内容" style="margin-left:8px;font-size:11px">🔄</button>'
    : '';
  document.getElementById('paginationBottom').innerHTML = initHtml;

  // 事件代理：统一处理两个分页栏的点击
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.pagination .btn[data-page]');
    if (!btn) return;
    const page = btn.dataset.page;
    if (page === 'prev') goToPage(currentPage - 1);
    else if (page === 'next') goToPage(currentPage + 1);
    else if (page === 'last') goToPage(totalPages - 1);
    else goToPage(parseInt(page));
  });
  document.getElementById('jumpBtn')?.addEventListener('click', jumpPage);
  // 更新初始状态
  updatePaginationState();
}

function updatePaginationState() {
  // 更新按钮禁用状态和页码显示
  const pageNum = currentPage + 1;
  document.querySelectorAll('#paginationBottom .btn[data-page]').forEach(function(btn) {
    const page = btn.dataset.page;
    let disabled = false;
    if (page === '0' || page === 'prev') disabled = currentPage <= 0;
    else if (page === 'next' || page === 'last') disabled = currentPage >= totalPages - 1;
    btn.disabled = disabled;
  });
  const pageInput = document.getElementById('pageInput');
  if (pageInput) {
    pageInput.value = pageNum;
    pageInput.max = totalPages;
  }
  const pageTotal = document.getElementById('pageTotal');
  if (pageTotal) pageTotal.textContent = totalPages;
}

function renderPagination() {
  // 向后兼容：初次调用时setup，后续只更新状态
  if (!document.getElementById('pageTotal')) {
    setupPagination();
  } else {
    updatePaginationState();
  }
}

function goToPage(p) {
  if (p < 0 || p >= totalPages) return;
  // 记录翻页栏当前位置，render后补偿，防止跳动
  const pb = document.getElementById('paginationBottom');
  const beforeRect = pb ? pb.getBoundingClientRect() : null;
  store.currentPage = p;
  renderPage();
  // 补偿：翻页栏应该停留在视口中原来相同的位置
  if (beforeRect) {
    requestAnimationFrame(function() {
      const pb2 = document.getElementById('paginationBottom');
      if (!pb2) return;
      const afterRect = pb2.getBoundingClientRect();
      const dy = afterRect.top - beforeRect.top;
      if (Math.abs(dy) > 2) window.scrollBy(0, dy);
    });
  }
}

function jumpPage() {
  const inp = document.getElementById('pageInput');
  const p = parseInt(inp.value, 10);
  if (p >= 1 && p <= totalPages) goToPage(p - 1);
}




var tbRootPath = '';
var tbCurrentPath = '';
var tbCurrentName = '';
var tbCurrentBrowsePath = ''; // 当前浏览的目录（记忆用）
var tbMovePath = ''; // 待移动的路径

// ===== 树弹出 =====
