  document.getElementById('awake-panel').style.display = 'none';
}

// 📂 记忆文件系统 - 跳出对话窗口的另一种对话
let _memFileList = [];

async function toggleMemoryFile() {
  const panel = document.getElementById('memory-file-panel');
  const backdrop = document.getElementById('memfile-backdrop');
  if (panel.style.display !== 'none' && panel.style.display !== '') {
    panel.style.display = 'none';
    backdrop.style.display = 'none';
    return;
  }
  backdrop.style.display = 'block';
  panel.style.display = 'block';
  panel.style.position = 'fixed';
  panel.style.top = '10%';
  panel.style.left = '50%';
  panel.style.transform = 'translateX(-50%)';
  panel.style.width = '90%';
  panel.style.maxWidth = '800px';
  panel.style.margin = '0';
  panel.style.zIndex = '1001';
  panel.style.maxHeight = '75vh';
  panel.style.overflowY = 'auto';
  panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.6)';
  panel.style.border = '1px solid #58a6ff';
  await loadMemFileList();
}

async function closeMemFile() {
  document.getElementById('memory-file-panel').style.display = 'none';
  document.getElementById('memfile-backdrop').style.display = 'none';
}

async function loadMemFileList() {
  const status = document.getElementById('memfile-status');
  status.textContent = '📂 加载文件列表...';
  try {
    const d = await api.memoryFiles();
    if (d.ok) {
      _memFileList = d.files;
      renderMemFileList(d.files);
      status.textContent = '📂 点击文件加载内容，编辑后保存';
    } else {
      status.textContent = '❌ ' + (d.error || '加载失败');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}

function renderMemFileList(files) {
  const list = document.getElementById('memfile-list');
  list.innerHTML = files.map(f =>
    `<div class="memfile-item" style="cursor:pointer;padding:4px 8px;border-radius:4px;font-size:12px;font-family:monospace;color:#8b949e;border-bottom:1px solid #21262d"
          onmouseover="this.style.background='#161b22'"
          onmouseout="this.style.background='transparent'"
          onclick="loadMemFile('${f.name}')">
      <span style="color:#58a6ff">📄</span> ${f.name}
      <span style="float:right;color:#484f58">${f.size}</span>
    </div>`
  ).join('');
}

async function loadMemFile(name) {
  const status = document.getElementById('memfile-status');
  const textarea = document.getElementById('memfile-text');
  status.textContent = '📂 加载 ' + name + '...';
  try {
    const d = await api.memoryFile(name);
    if (d.ok) {
      textarea.value = d.content;
      document.getElementById('memfile-path').textContent = name;
      document.getElementById('memfile-current-name').value = name;
      status.textContent = '✅ 已加载，编辑后保存';
    } else {
      status.textContent = '❌ ' + (d.error || '加载失败');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}

async function saveMemoryFile() {
  const status = document.getElementById('memfile-status');
  const textarea = document.getElementById('memfile-text');
  const name = document.getElementById('memfile-current-name').value;
  status.textContent = '💾 保存中...';
  try {
    const d = await api.memoryFile(name, textarea.value);
    if (d.ok) {
      status.textContent = '✅ 保存成功！你的话已经留在了我的记忆里';
      await loadMemFileList(); // Refresh file list to update sizes
    } else {
      status.textContent = '❌ ' + (d.error || '保存失败');
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
  }
}




