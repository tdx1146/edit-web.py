var ttsRate = 1;
// TTS 状态机: idle → loading → playing → idle
// TTS: 最简版 - 先出声再说
var _ttsAudio = null;

function ttsReadBtn(btn) {
  if (!btn) return;
  var msg = btn.closest('.msg');
  var textEl = msg ? msg.querySelector('.text') : null;
  var text = textEl ? textEl.textContent : '';
  if (!text || !text.trim()) { toast('没有文本', true); return; }
  
  // 如果正在播放或加载中，停止并返回（不重新播放）
  if (_ttsAudio) {
    try { _ttsAudio.pause(); _ttsAudio.src = ''; _ttsAudio.load(); } catch(e) {}
    _ttsAudio = null;
    btn.textContent = '🔊';
    return;
  }

  
  toast('⏳ 生成中...', false);
  btn.textContent = '⏳';
  
  api.post('/api/tts', {text: text}).then(function(d) {
    if (!d.ok || !d.audio) { 
      toast('生成失败: ' + (d.error || '未知'), true); 
      btn.textContent = '🔊';
      return; 
    }
    try {
      var raw = atob(d.audio);
      var buf = new ArrayBuffer(raw.length);
      var view = new Uint8Array(buf);
      for (var i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
      var blob = new Blob([buf], {type: 'audio/mpeg'});
      var url = URL.createObjectURL(blob);
      var a = new Audio(url);
      _ttsAudio = a;
      a.playbackRate = parseFloat(document.getElementById('ttsSpeed').value || '1');
      btn.textContent = '⏹';
      toast('🔊 播放中...', false);
      a.play().then(function(){}).catch(function(e){ 
        toast('播放失败: ' + e.message, true); 
        btn.textContent = '🔊';
      });
      a.onended = function(){ 
        URL.revokeObjectURL(url); 
        btn.textContent = '🔊'; 
        _ttsAudio = null; 
      };
    } catch(e) {
      toast('处理失败', true);
      btn.textContent = '🔊';
    }
  }).catch(function(e) {
    toast('请求失败: ' + e.message, true);
    btn.textContent = '🔊';
  });
}

// TTS: 速度选择器绑定（DOM 就绪后执行）
document.addEventListener('DOMContentLoaded', function(){
  var sel = document.getElementById('ttsSpeed');
  if (sel) sel.addEventListener('change', function(){ ttsRate = parseFloat(this.value); });
});

// 渲染入口（操作 DOM）
