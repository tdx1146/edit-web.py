async function loadAllIndicators() {
  await new Promise(r => setTimeout(r, 150));
  checkBackupStale();
  await new Promise(r => setTimeout(r, 150));
  checkSystemHealth();
  await new Promise(r => setTimeout(r, 150));
  checkSecretary();
  await new Promise(r => setTimeout(r, 150));
  checkReminders();
  await new Promise(r => setTimeout(r, 150));
  checkDigestion();
  await new Promise(r => setTimeout(r, 150));
  checkThinking();
  await new Promise(r => setTimeout(r, 150));
  checkWeaponry();
}
loadAllIndicators();

function checkBackupStale() {
  api.backupStale()
    .then(d => {
      const el = document.getElementById('backup-stale');
      if (!d.ok || d.stale === undefined) { el.textContent = '💾 ?'; return; }
      if (d.stale) {
        el.textContent = '💾 ⚠️';
        el.style.color = '#da3633';
        el.title = '备份过时：' + d.stale_files.join(', ') + ' | 最后打包: ' + d.last_pack;
      } else {
        el.textContent = '💾 ✅ ' + d.last_pack;
        el.style.color = '#3fb950';
        el.title = '备份最新 | ' + d.file_count + ' 个核心文件已同步';
      }
    })
    .catch(() => { document.getElementById('backup-stale').textContent = '💾 ?'; });
}

function checkSystemHealth() {
  return api.systemHealth().then(d => {
      const el = document.getElementById('sys-health');
      const val = el.querySelector('span') || el;
      const hooksOk = d.hooks && d.hooks.enabled;
      const cronOk = d.cron && d.cron.enabled && d.cron.last_ok === 'ok';
      const ctxOk = d.context && d.context.ok;
      const allOk = hooksOk && cronOk && ctxOk;
      if (allOk) {
        val.textContent = '✅';
        val.style.color = '#3fb950';
        let t = '系统自动化正常：';
        t += '\nhooks: session-memory=' + (d.hooks.details['session-memory'] ? '✅' : '❌') + ' command-logger=' + (d.hooks.details['command-logger'] ? '✅' : '❌');
        t += '\ncron: 武器库' + (cronOk ? ' ✅' : ' ❌');
        t += '\ncontext: ' + d.context.actual/1000 + 'K' + (ctxOk ? ' ✅' : ' ❌');
        el.title = t;
      } else {
        val.textContent = '⚠️';
        val.style.color = '#da3633';
        let t = '系统异常：';
        if (!hooksOk) t += '\nhooks: ' + JSON.stringify(d.hooks.details);
        if (!cronOk) t += '\ncron: enabled=' + d.cron.enabled + ' last=' + d.cron.last_ok;
        if (!ctxOk) t += '\ncontext: ' + d.context.actual + ' (期望 ' + d.context.expected + ')';
        el.title = t;
      }
    })
    .catch(() => { var el=document.getElementById('sys-health'); var v=el.querySelector('span')||el; v.textContent='?'; v.style.color='#f85149'; });
}

function checkSecretary() {
  api.secretaryLog().then(d => {
      const el = document.getElementById('secretary-count');
      if (d.ok) {
        el.textContent = d.total;
        el.style.color = d.total > 0 ? '#58a6ff' : '#8b949e';
        document.getElementById('secretary-indicator').title = '小秘书观察了 ' + d.total + ' 次文件变更\n最近: ' + (d.recent && d.recent.length ? d.recent[d.recent.length-1] : '无');
      }
    })
    .catch(() => {});
}

function checkReminders() {
  api.reminders().then(d => {
      const btn = document.querySelector('button[onclick="openReminderDialog()"]');
      if (d.ok && d.count > 0) {
        btn.textContent = '📋 ' + d.count;
        btn.style.borderColor = '#f0c040';
        btn.style.color = '#f0c040';
        btn.title = d.count + ' 条待办提醒';
      } else {
        btn.textContent = '📋';
        btn.style.borderColor = '#30363d';
        btn.style.color = '#8b949e';
        btn.title = '提醒系统';
      }
    })
    .catch(() => {});
}

// 手机端通用textarea触摸拖拽缩放
