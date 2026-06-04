/**
 * 线稿旋律 → 数字简谱
 * 在画布上绘制旋律曲线，自动量化为简谱字符
 */
(function (global) {
  'use strict';

  var MIDI_LO = 48;
  var MIDI_HI = 84;
  var ROWS = MIDI_HI - MIDI_LO + 1;

  var JIANPU_BY_MIDI = {};

  function buildMidiMap() {
    var midi;
    for (midi = MIDI_LO; midi <= MIDI_HI; midi++) {
      JIANPU_BY_MIDI[midi] = global.jianpuKeyToMidi ? null : null;
      if (global.JianpuEngine && global.jianpuKeyToMidi) {
        /* reverse via engine map */
      }
    }
    var map = JianpuEngine.NOTE_MAP;
    var k;
    for (k in map) {
      midi = 72 - map[k];
      if (midi >= MIDI_LO && midi <= MIDI_HI) {
        JIANPU_BY_MIDI[midi] = k;
      }
    }
  }

  function midiToJianpu(midi) {
    if (JIANPU_BY_MIDI[midi]) return JIANPU_BY_MIDI[midi];
    var names = ['1', '#1', '2', '#2', '3', '4', '#4', '5', '#5', '6', '#6', '7'];
    var n = midi % 12;
    var octave = Math.floor(midi / 12) - 1;
    var base = names[n];
    if (octave <= 3) return '(' + base + ')';
    if (octave >= 5) return '[' + base + ']';
    return base;
  }

  function LineSketch(root, onConvert) {
    this.root = root;
    this.onConvert = onConvert;
    this.canvas = null;
    this.ctx = null;
    this.strokes = [];
    this.drawing = false;
    this.currentStroke = null;
  }

  LineSketch.prototype.init = function () {
    buildMidiMap();
    var self = this;
    this.root.innerHTML =
      '<div class="sketch-panel">' +
      '  <p class="sketch-hint">在下方网格上绘制旋律线（横向=时间，纵向=音高），松开后自动采样</p>' +
      '  <canvas class="sketch-canvas" id="sketchCanvas"></canvas>' +
      '  <div class="sketch-actions">' +
      '    <button type="button" class="btn btn-sm" id="sketchClear">清空线稿</button>' +
      '    <button type="button" class="btn btn-primary btn-sm" id="sketchConvert">转为数字简谱</button>' +
      '  </div>' +
      '</div>';

    this.canvas = this.root.querySelector('#sketchCanvas');
    this.ctx = this.canvas.getContext('2d');
    this._resize();
    this._drawGrid();

    window.addEventListener('resize', function () {
      self._resize();
      self._redraw();
    });

    this.canvas.addEventListener('mousedown', function (e) { self._down(e); });
    this.canvas.addEventListener('mousemove', function (e) { self._move(e); });
    window.addEventListener('mouseup', function () { self._up(); });

    this.root.querySelector('#sketchClear').addEventListener('click', function () {
      self.strokes = [];
      self._redraw();
    });
    this.root.querySelector('#sketchConvert').addEventListener('click', function () {
      self.convert();
    });
  };

  LineSketch.prototype._resize = function () {
    var wrap = this.canvas.parentElement;
    var w = wrap.clientWidth || 600;
    var h = 160;
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  };

  LineSketch.prototype._pos = function (e) {
    var r = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(this.w, e.clientX - r.left)),
      y: Math.max(0, Math.min(this.h, e.clientY - r.top))
    };
  };

  LineSketch.prototype._down = function (e) {
    this.drawing = true;
    var p = this._pos(e);
    this.currentStroke = [p];
    this.strokes.push(this.currentStroke);
  };

  LineSketch.prototype._move = function (e) {
    if (!this.drawing) return;
    var p = this._pos(e);
    var last = this.currentStroke[this.currentStroke.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
    this.currentStroke.push(p);
    this._redraw();
  };

  LineSketch.prototype._up = function () {
    this.drawing = false;
    this.currentStroke = null;
    this._redraw();
  };

  LineSketch.prototype._drawGrid = function () {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;
    var rowH = h / ROWS;
    var i;
    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (i = 0; i <= ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * rowH);
      ctx.lineTo(w, i * rowH);
      ctx.stroke();
    }
    for (i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo((w / 16) * i, 0);
      ctx.lineTo((w / 16) * i, h);
      ctx.stroke();
    }
  };

  LineSketch.prototype._redraw = function () {
    this._drawGrid();
    var ctx = this.ctx;
    var s;
    var i;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (s = 0; s < this.strokes.length; s++) {
      if (this.strokes[s].length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(this.strokes[s][0].x, this.strokes[s][0].y);
      for (i = 1; i < this.strokes[s].length; i++) {
        ctx.lineTo(this.strokes[s][i].x, this.strokes[s][i].y);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  };

  LineSketch.prototype.convert = function () {
    var points = [];
    var s;
    var i;
    for (s = 0; s < this.strokes.length; s++) {
      for (i = 0; i < this.strokes[s].length; i++) {
        points.push(this.strokes[s][i]);
      }
    }
    if (points.length < 2) {
      if (this.onConvert) this.onConvert('', '请先绘制旋律线');
      return;
    }
    points.sort(function (a, b) { return a.x - b.x; });

    var rowH = this.h / ROWS;
    var stepX = Math.max(12, this.w / 80);
    var out = [];
    var lastMidi = -999;
    var lastX = -9999;
    var px;
    var py;
    var midi;
    var jp;
    var gap;

    for (i = 0; i < points.length; i += 2) {
      px = points[i].x;
      py = points[i].y;
      if (px - lastX < stepX * 0.4 && i > 0) continue;
      midi = MIDI_HI - Math.round(py / rowH);
      midi = Math.max(MIDI_LO, Math.min(MIDI_HI, midi));
      gap = Math.round((px - lastX) / stepX);
      if (lastX > 0 && gap > 1) {
        var r;
        for (r = 0; r < gap - 1; r++) out.push('-');
      }
      if (midi !== lastMidi || px - lastX >= stepX) {
        jp = midiToJianpu(midi);
        out.push(jp);
        lastMidi = midi;
      }
      lastX = px;
    }

    var text = out.join('').replace(/-+/g, function (m) {
      return m.length > 1 ? m : '-';
    }).trim();
    if (this.onConvert) this.onConvert(text, '已转换，共 ' + out.length + ' 个音');
  };

  global.LineSketch = LineSketch;
})(window);
