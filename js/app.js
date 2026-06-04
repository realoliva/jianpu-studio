(function () {
  'use strict';

  var STORAGE_KEY = 'jianpu-studio-v1';
  var LIBRARY_KEY = 'jianpu-studio-library-v1';
  var engine = new JianpuEngine();
  window.__jianpuEngine = engine;
  var piano = null;
  var keyboardPlay = null;

  var dom = {
    scoreList: document.getElementById('scoreList'),
    scoreSearch: document.getElementById('scoreSearch'),
    btnLibExport: document.getElementById('btnLibExport'),
    btnLibImport: document.getElementById('btnLibImport'),
    btnAddToLib: document.getElementById('btnAddToLib'),
    libraryImport: document.getElementById('libraryImport'),
    editor: document.getElementById('scoreEditor'),
    titleInput: document.getElementById('scoreTitle'),
    btnPlay: document.getElementById('btnPlay'),
    btnStop: document.getElementById('btnStop'),
    btnClear: document.getElementById('btnClear'),
    btnSave: document.getElementById('btnSave'),
    btnExport: document.getElementById('btnExport'),
    btnImport: document.getElementById('btnImport'),
    tempo: document.getElementById('tempo'),
    tempoVal: document.getElementById('tempoVal'),
    volume: document.getElementById('volume'),
    volumeVal: document.getElementById('volumeVal'),
    statNotes: document.getElementById('statNotes'),
    statRests: document.getElementById('statRests'),
    progressFill: document.getElementById('progressFill'),
    statusText: document.getElementById('statusText'),
    statusHint: document.getElementById('statusHint'),
    fileImport: document.getElementById('fileImport'),
    symbolBar: document.getElementById('symbolBar'),
    btnKeyboardPlay: document.getElementById('btnKeyboardPlay')
  };

  var SYMBOLS = [
    '1', '2', '3', '4', '5', '6', '7',
    '#1', '#2', '#4', '#5', '#6',
    '(1)', '(5)', '(6)', '(7)',
    '[1]', '[2]', '[3]',
    '-', ' ', '\n'
  ];

  function normalizeScoreText(text) {
    return text.replace(/[ \t]+/g, ' ').replace(/\r\n/g, '\n').trim();
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSettings() {
    var data = {
      title: dom.titleInput.value,
      text: dom.editor.value,
      tempo: Number(dom.tempo.value),
      volume: Number(dom.volume.value)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setStatus('已自动保存到本机');
  }

  function applySettings(data) {
    if (!data) return;
    if (data.title) dom.titleInput.value = data.title;
    if (data.text != null) dom.editor.value = data.text;
    if (data.tempo != null) {
      dom.tempo.value = data.tempo;
      dom.tempoVal.textContent = data.tempo + ' ms';
    }
    if (data.volume != null) {
      dom.volume.value = Math.round(data.volume * 100);
      dom.volumeVal.textContent = dom.volume.value + '%';
      engine.setVolume(data.volume);
    }
    updateStats();
  }

  var statusFooter = document.getElementById('appStatus');

  function setStatus(msg, playing) {
    dom.statusText.innerHTML = '<span class="status-dot"></span>' + msg;
    dom.statusText.classList.toggle('status-playing', !!playing);
    if (statusFooter) statusFooter.classList.toggle('is-playing', !!playing);
  }

  function getDuration() {
    return Number(dom.tempo.value) || 220;
  }

  function getVolume() {
    return Number(dom.volume.value) / 100;
  }

  function updateStats() {
    var tokens = JianpuEngine.parse(dom.editor.value);
    var notes = 0;
    var rests = 0;
    tokens.forEach(function (t) {
      if (t.type === 'note') notes += 1;
      else rests += 1;
    });
    dom.statNotes.textContent = '音符 ' + notes;
    dom.statRests.textContent = '休止 ' + rests;
  }

  function setProgress(current, total) {
    var pct = total ? Math.round((current / total) * 100) : 0;
    dom.progressFill.style.width = pct + '%';
  }

  function setUiPlaying(playing) {
    dom.btnPlay.disabled = playing;
    dom.btnStop.disabled = !playing;
    dom.editor.readOnly = playing;
  }

  function loadCustomLibrary() {
    try {
      var raw = localStorage.getItem(LIBRARY_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data.categories) ? data.categories : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomLibrary(categories) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({
      format: 'jianpu-library',
      version: 1,
      categories: categories
    }));
  }

  function getAllScoreGroups() {
    var custom = loadCustomLibrary();
    var builtIn = window.JIANPU_SCORES || [];
    return custom.concat(builtIn);
  }

  function appendScoreItem(frag, item) {
    var li = document.createElement('li');
    li.className = 'score-item';
    li.textContent = item.title;
    li.dataset.title = item.title;
    li.dataset.text = normalizeScoreText(item.text);
    li.addEventListener('click', function () {
      selectScore(li);
      dom.titleInput.value = item.title;
      dom.editor.value = item.text;
      updateStats();
      saveSettings();
      setStatus('已载入：' + item.title);
    });
    frag.appendChild(li);
  }

  function buildScoreList() {
    dom.scoreList.innerHTML = '';
    var frag = document.createDocumentFragment();
    var groups = getAllScoreGroups();

    groups.forEach(function (group) {
      if (!group.items || !group.items.length) return;
      var cat = document.createElement('li');
      cat.className = 'score-category';
      cat.textContent = group.category;
      cat.dataset.category = '1';
      frag.appendChild(cat);
      group.items.forEach(function (item) {
        appendScoreItem(frag, item);
      });
    });

    dom.scoreList.appendChild(frag);
    filterScores(dom.scoreSearch ? dom.scoreSearch.value : '');
  }

  function addCurrentToLibrary() {
    var title = (dom.titleInput.value || '').trim() || '未命名';
    var text = dom.editor.value;
    if (!text.trim()) {
      setStatus('当前简谱为空，无法收录');
      return;
    }
    var custom = loadCustomLibrary();
    var mine = custom.find(function (g) { return g.category === '我的曲目'; });
    if (!mine) {
      mine = { category: '我的曲目', items: [] };
      custom.unshift(mine);
    }
    var exists = mine.items.some(function (it) { return it.title === title; });
    if (exists && !confirm('曲库中已有「' + title + '」，是否覆盖？')) return;
    mine.items = mine.items.filter(function (it) { return it.title !== title; });
    mine.items.unshift({ title: title, text: text });
    saveCustomLibrary(custom);
    buildScoreList();
    setStatus('已收录到曲库：' + title);
  }

  function exportLibrary() {
    var payload = {
      format: 'jianpu-library',
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: getAllScoreGroups().map(function (g) {
        return {
          category: g.category,
          items: g.items.map(function (it) {
            return { title: it.title, text: it.text };
          })
        };
      })
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '简谱曲库-' + new Date().toISOString().slice(0, 10) + '.jianpu-library.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('已导出曲库（含示例与自定义曲目）');
  }

  function importLibraryFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var incoming = [];
        if (Array.isArray(data.categories)) {
          incoming = data.categories;
        } else if (Array.isArray(data)) {
          incoming = data;
        } else {
          throw new Error('格式不正确');
        }
        var mode = confirm(
          '导入 ' + incoming.length + ' 个分类。\n\n确定 = 合并到现有曲库\n取消 = 仅替换「我的曲目」等自定义分类（保留内置示例）'
        );
        if (mode) {
          var merged = loadCustomLibrary().concat(incoming);
          saveCustomLibrary(merged);
        } else {
          saveCustomLibrary(incoming);
        }
        buildScoreList();
        setStatus('曲库导入成功');
      } catch (e) {
        setStatus('曲库导入失败：' + (e.message || '文件格式错误'));
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function selectScore(activeLi) {
    dom.scoreList.querySelectorAll('.score-item').forEach(function (el) {
      el.classList.toggle('active', el === activeLi);
    });
  }

  function filterScores(query) {
    var q = query.trim().toLowerCase();
    dom.scoreList.querySelectorAll('.score-item').forEach(function (li) {
      var match = !q || li.textContent.toLowerCase().indexOf(q) >= 0;
      li.classList.toggle('hidden', !match);
    });
    dom.scoreList.querySelectorAll('.score-category').forEach(function (cat) {
      var next = cat.nextElementSibling;
      var anyVisible = false;
      while (next && !next.dataset.category) {
        if (!next.classList.contains('hidden')) anyVisible = true;
        next = next.nextElementSibling;
      }
      cat.classList.toggle('hidden', q.length > 0 && !anyVisible);
    });
  }

  function insertAtCursor(text) {
    var el = dom.editor;
    var start = el.selectionStart;
    var end = el.selectionEnd;
    var val = el.value;
    el.value = val.slice(0, start) + text + val.slice(end);
    var pos = start + text.length;
    el.selectionStart = el.selectionEnd = pos;
    el.focus();
    updateStats();
  }

  function buildSymbolBar() {
    SYMBOLS.forEach(function (sym) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sym-btn';
      btn.title = '插入 ' + (sym === '\n' ? '换行' : sym === ' ' ? '空格' : sym);
      btn.textContent = sym === '\n' ? '↵' : sym === ' ' ? '␣' : sym;
      btn.addEventListener('click', function () {
        insertAtCursor(sym);
      });
      dom.symbolBar.appendChild(btn);
    });
  }

  async function playScore() {
    var text = dom.editor.value;
    if (!text.trim()) {
      setStatus('请先输入简谱内容');
      return;
    }

    try {
      await engine.ensureReady();
    } catch (e) {
      setStatus(e.message || '音频初始化失败');
      return;
    }

    setUiPlaying(true);
    setStatus('正在播放…', true);
    setProgress(0, 1);
    if (piano) piano.setPerformance(true);

    try {
      await engine.play(text, {
        duration: getDuration(),
        volume: getVolume(),
        onProgress: function (cur, total) {
          setProgress(cur, total);
        },
        onNote: function (key) {
          if (piano) piano.press(key, getDuration());
        }
      });
      setStatus('播放完成');
    } catch (e) {
      setStatus('播放出错：' + (e.message || e));
    } finally {
      setUiPlaying(false);
      setProgress(0, 1);
      if (piano) {
        piano.setPerformance(false);
        piano.reset();
      }
    }
  }

  function stopScore() {
    engine.stop();
    setUiPlaying(false);
    setProgress(0, 1);
    if (piano) {
      piano.setPerformance(false);
      piano.reset();
    }
    setStatus('已停止');
  }

  function exportScore() {
    var payload = {
      title: dom.titleInput.value || '未命名',
      text: dom.editor.value,
      format: 'jianpu-studio',
      version: 1,
      exportedAt: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (payload.title || '简谱') + '.jianpu.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('已导出 JSON');
  }

  function importScoreFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data.text != null) dom.editor.value = data.text;
        if (data.title) dom.titleInput.value = data.title;
        updateStats();
        saveSettings();
        setStatus('已导入：' + (data.title || file.name));
      } catch (e) {
        dom.editor.value = reader.result;
        updateStats();
        setStatus('已导入纯文本');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function bindEvents() {
    dom.btnPlay.addEventListener('click', playScore);
    dom.btnStop.addEventListener('click', stopScore);
    dom.btnClear.addEventListener('click', function () {
      if (!confirm('确定清空当前简谱？')) return;
      dom.editor.value = '';
      dom.titleInput.value = '未命名简谱';
      updateStats();
      saveSettings();
      setStatus('已清空');
    });
    dom.btnSave.addEventListener('click', function () {
      saveSettings();
    });
    dom.btnExport.addEventListener('click', exportScore);
    dom.btnImport.addEventListener('click', function () {
      dom.fileImport.click();
    });
    dom.fileImport.addEventListener('change', function () {
      var f = dom.fileImport.files[0];
      if (f) importScoreFile(f);
      dom.fileImport.value = '';
    });

    if (dom.btnLibExport) dom.btnLibExport.addEventListener('click', exportLibrary);
    if (dom.btnLibImport) dom.btnLibImport.addEventListener('click', function () {
      dom.libraryImport.click();
    });
    if (dom.libraryImport) {
      dom.libraryImport.addEventListener('change', function () {
        var f = dom.libraryImport.files[0];
        if (f) importLibraryFile(f);
        dom.libraryImport.value = '';
      });
    }
    if (dom.btnAddToLib) dom.btnAddToLib.addEventListener('click', addCurrentToLibrary);

    dom.tempo.addEventListener('input', function () {
      dom.tempoVal.textContent = dom.tempo.value + ' ms';
    });
    dom.tempo.addEventListener('change', saveSettings);

    dom.volume.addEventListener('input', function () {
      dom.volumeVal.textContent = dom.volume.value + '%';
      engine.setVolume(getVolume());
    });
    dom.volume.addEventListener('change', saveSettings);

    dom.editor.addEventListener('input', function () {
      updateStats();
      clearTimeout(dom.editor._saveTimer);
      dom.editor._saveTimer = setTimeout(saveSettings, 600);
    });

    dom.titleInput.addEventListener('change', saveSettings);
    dom.scoreSearch.addEventListener('input', function () {
      filterScores(dom.scoreSearch.value);
    });

    if (dom.btnKeyboardPlay) {
      dom.btnKeyboardPlay.addEventListener('click', function () {
        var on = !keyboardPlay.isActive();
        keyboardPlay.setEnabled(on);
        dom.btnKeyboardPlay.classList.toggle('active', on);
        setStatus(on ? '键盘弹奏已开启 — 见右侧说明' : '键盘弹奏已关闭');
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.target.matches('input, textarea') && e.key === ' ') {
        if (e.ctrlKey || e.metaKey) return;
      }
      if (e.code === 'Space' && !e.target.matches('textarea, input')) {
        e.preventDefault();
        if (engine.isPlaying()) stopScore();
        else playScore();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!engine.isPlaying()) playScore();
      }
      if (e.key === 'Escape' && engine.isPlaying()) {
        e.preventDefault();
        stopScore();
      }
    });
  }

  function initPiano() {
    var board = document.getElementById('pianoBoard');
    if (!board || typeof PianoVisual === 'undefined') return;
    piano = new PianoVisual(board);
    piano.init();
  }

  function initKeyboardPlay() {
    if (typeof KeyboardPlay === 'undefined') return;
    keyboardPlay = new KeyboardPlay({
      engine: engine,
      piano: piano,
      getDuration: getDuration,
      defaultEnabled: true,
      onStatus: function (msg) {
        dom.statusHint.textContent = msg;
      }
    });
    keyboardPlay.bind();
  }

  function initTabs() {
    var tabs = document.querySelectorAll('.editor-tab');
    var panes = {
      score: document.getElementById('paneScore'),
      sketch: document.getElementById('paneSketch')
    };
    var symbolBar = document.getElementById('symbolBar');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.dataset.tab;
        tabs.forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        Object.keys(panes).forEach(function (k) {
          if (panes[k]) panes[k].classList.toggle('is-active', k === name);
        });
        if (symbolBar) symbolBar.style.display = name === 'score' ? '' : 'none';
      });
    });
  }

  function initLineSketch() {
    var root = document.getElementById('lineSketchRoot');
    if (!root || typeof LineSketch === 'undefined') return;
    var sketch = new LineSketch(root, function (text, msg) {
      if (text) {
        dom.editor.value = text;
        updateStats();
        saveSettings();
        document.querySelector('.editor-tab[data-tab="score"]').click();
      }
      setStatus(msg || (text ? '线稿已转为数字简谱' : ''));
    });
    sketch.init();
  }

  function init() {
    buildSymbolBar();
    buildScoreList();
    initTabs();
    initLineSketch();
    initPiano();
    initKeyboardPlay();
    bindEvents();
    applySettings(loadSettings());

    engine.ensureReady().then(function () {
      setStatus('就绪 — 选择曲目或输入简谱后点击播放');
    }).catch(function (e) {
      setStatus(e.message || '请使用 start.bat 启动本地服务');
    });

    dom.statusHint.textContent = '键盘弹奏见右侧说明 · 空格播放/停止';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
