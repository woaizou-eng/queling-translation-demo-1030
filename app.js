(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const texts = [
    'Wanted rhythms. I say wanted rhythms because these rhythms are like I see them on a wanted poster, one of those western style.',
    'The man is sitting at a desk. He looks at the camera and speaks naturally.'
  ];
  const translations = {
    'wanted rhythms': '“通缉”般的节奏。',
    'wanted': '被通缉的；想要的（含义依上下文而定）。',
    'rhythms': '节奏。',
    'i say wanted rhythms': '我说的是“通缉”般的节奏。',
    'because these rhythms': '因为这些节奏。',
    'wanted poster': '通缉令。',
    'a wanted poster': '一张通缉令。',
    'western style': '西部风格。',
    'one of those western style': '那种西部风格的。',
    'i say wanted rhythms because these rhythms are like i see them on a wanted poster, one of those western style': '我说“通缉”般的节奏，是因为这些节奏让我想到那种西部风格通缉令上的感觉。',
    'wanted rhythms. i say wanted rhythms because these rhythms are like i see them on a wanted poster, one of those western style': '“通缉”般的节奏。我说“通缉”般的节奏，是因为这些节奏让我想到那种西部风格通缉令上的感觉。',
    'the man is sitting at a desk': '这位男子正坐在书桌前。',
    'he looks at the camera and speaks naturally': '他看着镜头，自然地说话。',
    'the man is sitting at a desk. he looks at the camera and speaks naturally': '这位男子正坐在书桌前。他看着镜头，自然地说话。',
    'the man': '这位男子。', 'a desk': '一张书桌。', 'camera': '镜头。', 'naturally': '自然地。', 'speaks naturally': '自然地说话。'
  };
  let task = 0, selected = 'Wanted rhythms.', drawerOpen = true, history = [], serial = 0, generation = 0;
  let speakingText = '', speechPhase = '', speechToken = 0, voiceTimer = null, videoPlaying = false, toastTimer = null;
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalized = text => text.trim().toLowerCase().replace(/[.!?。！？]+$/, '').replace(/\s+/g, ' ');
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5200); }
  function audioStatus(message, active = false) { $('audio-status').innerHTML = `${icon('sound')}<span>${escape(message)}</span>${speakingText ? '<button type="button" class="stop-audio" data-stop-speech="true">停止朗读</button>' : ''}`; $('audio-status').classList.toggle('active', active); }
  function setDrawer(open, focusResult = false) {
    drawerOpen = open; $('assistant-drawer').hidden = !open; $('workspace').classList.toggle('drawer-closed', !open);
    $('toggle-drawer').setAttribute('aria-expanded', String(open)); $('toggle-drawer').classList.toggle('primary', open);
    if (open && focusResult && matchMedia('(max-width:750px)').matches) $('assistant-drawer').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block: 'start'});
  }
  function renderSelection() {
    $('selection-toolbar').hidden = !selected;
    $('selection-status').textContent = selected ? `已选中 ${selected.length} 个字符 · 点击翻译后新增结果` : '划选英文台词，即可翻译或朗读';
    $('translate-selection').disabled = history.some(item => item.status === 'loading' && item.original === selected);
    const same = speakingText === selected && selected;
    $('speak-selection').querySelector('span').textContent = same ? (speechPhase === 'preparing' ? '取消' : '停止') : '朗读';
    $('speak-selection').classList.toggle('active', Boolean(same));
  }
  function resultMarkup(item, index) {
    let result;
    if (item.status === 'loading') result = '<div class="loading"><span class="spinner" aria-hidden="true"></span>正在翻译…</div>';
    else if (item.status === 'error') result = `<p class="result-error" role="alert">${escape(item.error)}</p><div class="result-actions"><button type="button" data-retry="${item.id}">${icon('refresh')}重试</button>${item.unmapped ? '<button type="button" data-whole="true">选用完整台词</button>' : ''}</div>`;
    else result = `<p class="result-translation">${escape(item.translation)}</p><div class="result-actions"><button type="button" data-copy="${item.id}">${icon('copy')}复制译文</button><button type="button" data-speak="${item.id}" class="${speakingText === item.original ? 'speaking' : ''}">${icon('sound')}<span>${speakingText === item.original ? (speechPhase === 'preparing' ? '取消' : '停止') : '朗读原文'}</span></button></div>`;
    const divider = index === 1 ? '<div class="history-divider">此前的翻译结果</div>' : '';
    return `${divider}<article class="result-card ${index === 0 ? 'latest' : ''}" data-result-id="${item.id}"><header class="result-card-header">${index === 0 ? '<span class="latest-label">最新结果</span>' : '<span>历史结果</span>'}<span>英文 → 中文</span><span class="result-number">#${String(item.id).padStart(2,'0')}</span></header><div class="result-card-body"><div class="result-label">英文原文<span>· ${item.original.length} 字符</span></div><p class="result-original" lang="en">${escape(item.original)}</p><div class="result-chinese"><div class="result-label">中文译文<span class="sample-tag">演示译文</span></div>${result}</div></div></article>`;
  }
  function renderHistory() {
    $('translation-empty').hidden = history.length > 0;
    $('history-count').hidden = history.length === 0;
    $('history-count').textContent = String(history.length);
    $('translation-list').innerHTML = history.map(resultMarkup).join('');
    renderSelection();
  }
  function renderSpeech() {
    renderSelection();
    document.querySelectorAll('[data-speak]').forEach(button => {
      const item = history.find(item => String(item.id) === button.dataset.speak);
      const active = item && item.original === speakingText;
      button.querySelector('span').textContent = active ? (speechPhase === 'preparing' ? '取消' : '停止') : '朗读原文';
      button.classList.toggle('speaking', Boolean(active));
    });
    const name = videoPlaying ? 'pause' : 'play';
    $('video-play').innerHTML = icon(name); $('video-center').innerHTML = icon(name);
    $('video-play').setAttribute('aria-label', videoPlaying ? '暂停视频播放状态演示' : '模拟视频播放');
    $('video-center').setAttribute('aria-label', videoPlaying ? '暂停视频播放状态演示' : '模拟视频播放');
  }
  function stopSpeech(message) {
    speechToken++; clearTimeout(voiceTimer); speakingText = ''; speechPhase = '';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (message) audioStatus(message);
    renderSpeech();
  }
  function speak(text) {
    if (!text || !text.trim()) return;
    if (speakingText === text) { stopSpeech('英文朗读已停止。'); return; }
    stopSpeech();
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { audioStatus('当前设备不支持英文朗读，未播放音频。'); toast('当前设备不支持英文朗读，请尝试支持语音的浏览器。'); return; }
    if (!/[A-Za-z]/.test(text)) { toast('请选择英文原文后朗读。'); return; }
    if (text.length > 1000) { toast('一次最多朗读 1,000 个字符，请缩小选区。'); return; }
    videoPlaying = false; speakingText = text; speechPhase = 'preparing'; const token = ++speechToken;
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices(); const voice = voices.find(v => /^en[-_]US$/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)); if (voice) utterance.voice = voice;
    audioStatus('正在准备英文朗读… 视频播放状态已暂停。', true);
    utterance.onstart = () => { if (token !== speechToken) return; clearTimeout(voiceTimer); speechPhase = 'speaking'; audioStatus('正在朗读英文原文 · 视频已暂停', true); renderSpeech(); };
    utterance.onend = () => { if (token !== speechToken) return; clearTimeout(voiceTimer); speakingText = ''; speechPhase = ''; audioStatus('朗读结束。视频保持暂停，可手动继续。'); renderSpeech(); };
    utterance.onerror = event => { if (token !== speechToken) return; stopSpeech('英文朗读不可用，未播放音频。'); if (!['interrupted','canceled'].includes(event.error)) toast('设备未能播放英文语音，请检查浏览器语音支持后重试。'); };
    voiceTimer = setTimeout(() => { if (token === speechToken && speechPhase === 'preparing') { stopSpeech('英文朗读启动超时，未播放音频。'); toast('当前设备未能启动语音，请在支持英文语音的浏览器重试。'); } }, 7000);
    try { window.speechSynthesis.speak(utterance); } catch { stopSpeech('英文朗读不可用，未播放音频。'); toast('当前环境未能启动语音。'); }
    renderSpeech();
  }
  function translate(text, retryItem = null) {
    if (!text?.trim()) { toast('请先划选英文台词。'); return; }
    if (!/[A-Za-z]/.test(text)) { toast('请选择英文原文；当前支持英文译中文。'); return; }
    if (text.length > 1000) { toast('一次最多翻译 1,000 个字符，请缩小选区。'); return; }
    if (history.some(item => item.status === 'loading' && item.original === text)) return;
    const item = retryItem || {id:++serial, original:text, translation:'', status:'loading', request:0};
    item.status = 'loading'; item.translation = ''; item.error = ''; item.unmapped = false; item.request++;
    if (!retryItem) history.unshift(item);
    const currentGeneration = generation, request = item.request, fail = $('scenario').value === 'fail'; $('scenario').value = 'success';
    setDrawer(true, true); renderHistory();
    setTimeout(() => {
      if (generation !== currentGeneration || request !== item.request || !history.includes(item)) return;
      if (fail) { item.status = 'error'; item.error = '翻译失败，请重试。已保留本次英文原文。'; }
      else if (!translations[normalized(text)]) { item.status = 'error'; item.unmapped = true; item.error = '此演示未预置该片段译文。可选完整台词，或 Wanted rhythms、wanted poster、western style 体验。'; }
      else { item.status = 'success'; item.translation = translations[normalized(text)]; }
      renderHistory();
    }, 900);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('已复制'); }
    catch {
      const area = document.createElement('textarea'); area.value = text; area.className = 'copy-fallback'; area.setAttribute('aria-label','待复制文字'); document.body.append(area); area.focus(); area.select();
      let copied = false; try { copied = document.execCommand('copy'); } catch {} area.remove();
      toast(copied ? '已复制' : '当前浏览器无法自动复制，请选中结果文字手动复制。');
    }
  }
  function chooseWhole() {
    const script = $('script'); script.textContent = texts[task]; selected = texts[task];
    const range = document.createRange(); range.selectNodeContents(script); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); renderSelection();
  }
  function captureSelection() {
    const sel = window.getSelection(); const script = $('script');
    if (!sel || sel.isCollapsed || !script.contains(sel.anchorNode) || !script.contains(sel.focusNode)) return;
    const value = sel.toString().trim(); if (!value) return; selected = value; script.querySelector('mark')?.classList.add('inactive-mark'); renderSelection();
  }
  function videoToggle() {
    if (!videoPlaying) { stopSpeech('播放视频时将停止英文朗读。'); videoPlaying = true; } else { videoPlaying = false; audioStatus('视频播放状态已暂停。'); }
    renderSpeech(); toast('这里仅演示播放与朗读的互斥状态；视频为静态画面。');
  }
  function clearTask(next = false) {
    generation++; stopSpeech(); history = []; serial = 0; selected = ''; videoPlaying = false;
    if (next) task = task ? 0 : 1;
    $('script').textContent = texts[task]; $('task-label').textContent = `演示任务 #${task ? '002' : '001'}`;
    document.querySelectorAll('input[name="score"]').forEach(input => input.checked = false); $('score-reason').value = '';
    window.getSelection()?.removeAllRanges(); audioStatus(next ? '已切换任务，旧朗读与翻译结果已清空。' : '英文朗读仅作参考，不以口音、语速差异直接扣分。'); renderHistory(); renderSpeech();
  }
  $('script').addEventListener('pointerup', () => setTimeout(captureSelection,0)); $('script').addEventListener('keyup', captureSelection);
  $('selection-toolbar').addEventListener('pointerdown', event => { if (event.target.closest('button')) event.preventDefault(); });
  $('translate-selection').addEventListener('click', () => translate(selected)); $('speak-selection').addEventListener('click', () => speak(selected)); $('copy-selection').addEventListener('click', () => copy(selected));
  $('select-all').addEventListener('click', chooseWhole);
  $('translation-list').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.whole) { chooseWhole(); translate(selected); return; }
    const id = button.dataset.retry || button.dataset.copy || button.dataset.speak; const item = history.find(item => String(item.id) === id); if (!item) return;
    if (button.dataset.retry) translate(item.original, item); else if (button.dataset.copy) copy(item.translation); else speak(item.original);
  });
  $('toggle-drawer').addEventListener('click', () => setDrawer(!drawerOpen)); $('close-drawer').addEventListener('click', () => setDrawer(false));
  $('selection-tip').addEventListener('click', () => toast('划选英文后，翻译会新增结果；朗读会播放所选英文。也可点击「选中整段」体验。'));
  document.querySelectorAll('[data-context]').forEach(button => button.addEventListener('click', () => { if (button.dataset.context === '世界知识') setDrawer(true,true); else toast('保留原有规则检索入口，此演示聚焦翻译与朗读。'); }));
  $('ai-toggle').addEventListener('change', () => toast(`AI 搜索${$('ai-toggle').checked ? '已开启' : '已关闭'}（演示状态），翻译始终可独立使用。`));
  $('video-play').addEventListener('click', videoToggle); $('video-center').addEventListener('click', videoToggle);
  $('audio-status').addEventListener('click', event => { if (event.target.closest('[data-stop-speech]')) stopSpeech('英文朗读已停止。'); });
  $('next-task').addEventListener('click', () => { clearTask(true); toast('已切换演示任务，旧选文、译文和声音均已清空。'); });
  $('reset-demo').addEventListener('click', () => { task = 0; clearTask(); selected = 'Wanted rhythms.'; $('script').innerHTML = '<mark>Wanted rhythms.</mark> I say wanted rhythms because these rhythms are like I see them on a wanted poster, one of those western style.'; $('scenario').value = 'success'; $('ai-toggle').checked = false; setDrawer(true); renderSelection(); toast('已重置演示。'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { selected = ''; window.getSelection()?.removeAllRanges(); $('script').textContent = texts[task]; renderSelection(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && speakingText) stopSpeech('页面进入后台，英文朗读已停止。'); });
  window.addEventListener('pagehide', () => stopSpeech());
  renderSelection(); renderHistory();
})();
