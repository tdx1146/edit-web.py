// facts.js — 从 modules.js 拆分
function loadFactsLightbox() {
  document.getElementById('facts-overlay').style.display = 'block';
  const body = document.getElementById('facts-body');
  document.getElementById('facts-meta').textContent = '加载中...';
  body.textContent = '加载中...';
  api.momo('read_facts').then(d => {
    if (d.ok && d.content) {
      body.innerHTML = renderMarkdown(d.content);
      document.getElementById('facts-meta').textContent = d.content.split('\\n').length + '行 | ' + d.size + 'B';
    } else {
      body.innerHTML = '❌ 读取失败: ' + (d.error || '未知错误');
    }
  }).catch(e => {
    body.innerHTML = '❌ 网络错误: ' + e.message;
  });
}


function closeFactsOverlay(event) {
  if (!event || event.target === document.getElementById('facts-overlay') || !event.target) {
    document.getElementById('facts-overlay').style.display = 'none';
  }
}