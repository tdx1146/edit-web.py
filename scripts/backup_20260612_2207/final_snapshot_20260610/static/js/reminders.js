function openReminderDialog() {
  // 加载现有提醒
  api.reminders().then(d => {
      let html = '<div id="reminder-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;font-size:13px">';
      html += '<div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
      html += '<strong style="color:#f0c040;font-size:15px">📋 提醒</strong>';
      html += '<span onclick="closeReminderDialog()" style="cursor:pointer;color:#8b949e;font-size:18px">✕</span>';
      html += '</div>';
      html += '<div style="margin-bottom:12px;display:flex;gap:6px">';
      html += '<input id="reminder-text" style="flex:1;background:#161b22;border:1px solid #30363d;border-radius:4px;padding:6px 8px;color:#c9d1d9;font-size:12px" placeholder="记下要做的事...">';
      html += '<select id="reminder-assignee" style="background:#161b22;border:1px solid #30363d;border-radius:4px;padding:6px;color:#c9d1d9;font-size:12px">';
      html += '<option value="">自己</option><option value="DeepSeek">DeepSeek</option><option value="混元">混元</option>';
      html += '</select>';
      html += '<button onclick="addReminder()" style="background:#238636;border:1px solid #2ea043;border-radius:4px;padding:6px 10px;color:white;cursor:pointer;font-size:12px">添加</button>';
      html += '</div>';
      html += '<div id="reminder-list">';
      if (d.ok && d.reminders && d.reminders.length > 0) {
        d.reminders.forEach(r => {
          const a = r.assignee ? ' [' + r.assignee + ']' : '';
          html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #21262d">';
          html += '<button onclick="doneReminder(' + r.id + ')" style="background:transparent;border:1px solid #30363d;border-radius:3px;padding:2px 6px;color:#8b949e;cursor:pointer;font-size:10px">✓</button>';
          html += '<span style="flex:1;color:#c9d1d9">' + r.text + '</span>';
          html += '<span style="color:#8b949e;font-size:10px">' + a + '</span>';
          html += '<span style="color:#484f58;font-size:10px">' + (r.created || '') + '</span>';
          html += '</div>';
        });
      } else {
        html += '<div style="color:#484f58;text-align:center;padding:20px">暂无待办提醒</div>';
      }
      html += '</div>';
      if (d.ok && d.count > 0) {
        html += '<div style="margin-top:10px;text-align:right"><button onclick="clearDoneReminders()" style="background:transparent;border:1px solid #30363d;border-radius:4px;padding:4px 8px;color:#8b949e;cursor:pointer;font-size:10px">清理已完成</button></div>';
      }
      html += '</div></div>';
      const existing = document.getElementById('reminder-overlay');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', html);
    });
}

function closeReminderDialog() {
  const el = document.getElementById('reminder-overlay');
  if (el) el.remove();
  checkReminders();
}

function addReminder() {
  const text = document.getElementById('reminder-text').value.trim();
  if (!text) return;
  const assignee = document.getElementById('reminder-assignee').value;
  api.remindersAdd(text, assignee).then(d => {
    if (d.ok) {
      // Show brief toast
      const toast = document.createElement('div');
      toast.textContent = '✅ 已添加';
      toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#238636;color:white;padding:8px 16px;border-radius:6px;font-size:13px;z-index:10000;transition:opacity 0.5s';
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 1500);
    }
    document.getElementById('reminder-text').value = '';
    openReminderDialog();
  });
}

function doneReminder(id) {
  api.remindersDone(id).then(() => openReminderDialog());
}

function clearDoneReminders() {
  api.remindersClearDone().then(() => openReminderDialog());
}

