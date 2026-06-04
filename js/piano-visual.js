/**
 * 全宽 88 键钢琴 + Canvas 魔法光效迸发
 */
(function (global) {
  'use strict';

  var GLOW_PALETTE = [
    '#ff3d8a', '#b84dff', '#5b7fff', '#00e5ff',
    '#00ffcc', '#9fff5b', '#ffe14d', '#ff8c42',
    '#ff4757', '#a78bfa', '#ff6bcb', '#5efce8'
  ];

  var MIDI_MIN = 21;
  var MIDI_MAX = 108;

  function isBlackKey(midi) {
    var n = midi % 12;
    return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
  }

  function midiToJianpuKey(midi) {
    var steps = 72 - midi;
    var map = JianpuEngine.NOTE_MAP;
    var k;
    for (k in map) {
      if (map[k] === steps) return k;
    }
    return null;
  }

  function jianpuKeyToMidi(key) {
    var steps = JianpuEngine.NOTE_MAP[key];
    if (steps === undefined) return null;
    return 72 - steps;
  }

  function noteLabel(midi) {
    var names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function whiteIndexBefore(midi) {
    var count = 0;
    var m;
    for (m = MIDI_MIN; m < midi; m++) {
      if (!isBlackKey(m)) count++;
    }
    var n = midi % 12;
    if (n === 1 || n === 6) return count + 0.12;
    if (n === 3 || n === 10) return count + 0.88;
    return count + 0.62;
  }

  function PianoVisual(rootEl) {
    this.root = rootEl;
    this.keysEl = null;
    this.particlesEl = null;
    this.fxCanvas = null;
    this.fxCtx = null;
    this.bursts = [];
    this.keyMap = {};
    this.whiteCount = 0;
    this.colorIndex = 0;
    this._activeTimers = [];
    this._raf = 0;
  }

  PianoVisual.prototype.init = function () {
    if (!this.root) return;
    this.root.innerHTML =
      '<div class="piano-dock">' +
      '  <div class="piano-stage">' +
      '    <canvas class="piano-fx-canvas" id="pianoFxCanvas"></canvas>' +
      '    <div class="piano-glow-bg" aria-hidden="true"></div>' +
      '    <div class="piano-particles" id="pianoParticles"></div>' +
      '    <div class="piano-keys-fit">' +
      '      <div class="piano-keys" id="pianoKeys"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    this.keysEl = this.root.querySelector('#pianoKeys');
    this.particlesEl = this.root.querySelector('#pianoParticles');
    this.pianoStage = this.root.querySelector('.piano-stage');
    this.fxCanvas = this.root.querySelector('#pianoFxCanvas');
    this.fxCtx = this.fxCanvas.getContext('2d');

    this._buildKeys();
    this._resizeCanvas();
    var self = this;
    window.addEventListener('resize', function () {
      self._resizeCanvas();
    });
    this._startFxLoop();
  };

  PianoVisual.prototype._resizeCanvas = function () {
    if (!this.fxCanvas || !this.pianoStage) return;
    var rect = this.pianoStage.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    this.fxCanvas.width = Math.floor(rect.width * dpr);
    this.fxCanvas.height = Math.floor(rect.height * dpr);
    this.fxCanvas.style.width = rect.width + 'px';
    this.fxCanvas.style.height = rect.height + 'px';
    this.fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  PianoVisual.prototype._startFxLoop = function () {
    var self = this;
    function tick() {
      self._drawBursts();
      self._raf = requestAnimationFrame(tick);
    }
    tick();
  };

  PianoVisual.prototype._drawBursts = function () {
    var ctx = this.fxCtx;
    var rect = this.pianoStage.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (!ctx || w <= 0) return;

    ctx.clearRect(0, 0, w, h);
    var i;
    var b;
    var alive = [];

    for (i = 0; i < this.bursts.length; i++) {
      b = this.bursts[i];
      b.t += 0.022;
      if (b.t >= 1) continue;
      alive.push(b);

      var alpha = 1 - b.t;
      var r = b.r0 + (b.r1 - b.r0) * b.t;
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, hexA(b.color, alpha * 0.95));
      g.addColorStop(0.35, hexA(b.color, alpha * 0.4));
      g.addColorStop(1, hexA(b.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (b.beams) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexA(b.color, alpha * 0.7);
        ctx.lineWidth = 2 + (1 - b.t) * 3;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 18;
        var a;
        for (a = 0; a < b.beams.length; a++) {
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + Math.cos(b.beams[a]) * r * 1.1, b.y + Math.sin(b.beams[a]) * r * 0.5);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    this.bursts = alive;
  };

  function hexA(hex, a) {
    var n = Math.round(Math.max(0, Math.min(1, a)) * 255);
    var h = n.toString(16);
    if (h.length < 2) h = '0' + h;
    return hex + h;
  }

  PianoVisual.prototype._addBurst = function (x, y, color, isBlack) {
    var beams = [];
    var i;
    var n = isBlack ? 6 : 12;
    for (i = 0; i < n; i++) {
      beams.push((Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.4);
    }
    this.bursts.push({
      x: x,
      y: y,
      color: color,
      t: 0,
      r0: isBlack ? 8 : 14,
      r1: isBlack ? 55 : 95,
      beams: beams
    });
  };

  PianoVisual.prototype._buildKeys = function () {
    var whiteKeys = [];
    var midi;
    var keyEl;
    var self = this;

    for (midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
      if (!isBlackKey(midi)) whiteKeys.push(midi);
    }

    this.whiteCount = whiteKeys.length;
    this.keysEl.style.setProperty('--wc', String(this.whiteCount));

    whiteKeys.forEach(function (m) {
      keyEl = self._createKey(m, false);
      self.keysEl.appendChild(keyEl);
    });

    for (midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
      if (isBlackKey(midi)) {
        var wi = whiteIndexBefore(midi);
        keyEl = self._createKey(midi, true);
        keyEl.style.setProperty('--wi', String(wi));
        self.keysEl.appendChild(keyEl);
      }
    }
  };

  PianoVisual.prototype._createKey = function (midi, black) {
    var self = this;
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'piano-key' + (black ? ' piano-key--black' : ' piano-key--white');
    el.dataset.midi = String(midi);
    el.setAttribute('aria-label', noteLabel(midi));

    var jianpu = midiToJianpuKey(midi);
    if (jianpu) el.dataset.jianpu = jianpu;

    el.addEventListener('mousedown', function (e) {
      e.preventDefault();
      self._onKeyClick(midi, jianpu);
    });

    this.keyMap[midi] = el;
    return el;
  };

  PianoVisual.prototype._nextColor = function () {
    var c = GLOW_PALETTE[this.colorIndex % GLOW_PALETTE.length];
    this.colorIndex += 1;
    return c;
  };

  PianoVisual.prototype._onKeyClick = function (midi, jianpuKey) {
    var eng = global.__jianpuEngine;
    if (eng) {
      eng.ensureReady().then(function () {
        if (jianpuKey) eng.playNote(jianpuKey);
        else eng.playMidi(midi);
      });
    }
    this.pressMidi(midi, 280);
  };

  PianoVisual.prototype.press = function (jianpuKey, durationMs) {
    var midi = jianpuKeyToMidi(jianpuKey);
    if (midi != null) this.pressMidi(midi, durationMs);
  };

  PianoVisual.prototype.pressMidi = function (midi, durationMs) {
    var el = this.keyMap[midi];
    if (!el) return;

    var color = this._nextColor();
    var hold = Math.max(120, (durationMs || 220) * 0.85);
    var isBlack = el.classList.contains('piano-key--black');

    el.style.setProperty('--key-glow', color);
    el.classList.add('is-active');

    var rect = el.getBoundingClientRect();
    var stageRect = this.pianoStage.getBoundingClientRect();
    var cx = rect.left + rect.width / 2 - stageRect.left;
    var cy = rect.top + rect.height * 0.35 - stageRect.top;
    this._addBurst(cx, cy, color, isBlack);
    this._spawnParticles(el, color, isBlack);
    this._spawnMagicSparks(cx, cy, color);
    this._ripple(el, color);

    var timer = setTimeout(function () {
      el.classList.remove('is-active');
    }, hold);
    this._activeTimers.push(timer);
  };

  PianoVisual.prototype._ripple = function (keyEl, color) {
    var ripple = document.createElement('span');
    ripple.className = 'piano-ripple';
    ripple.style.setProperty('--ripple-color', color);
    keyEl.appendChild(ripple);
    ripple.addEventListener('animationend', function () {
      ripple.remove();
    });
  };

  PianoVisual.prototype._spawnMagicSparks = function (cx, cy, color) {
    var i;
    var s;
    for (i = 0; i < 6; i++) {
      s = document.createElement('span');
      s.className = 'piano-spark';
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--spark-color', color);
      s.style.setProperty('--spark-angle', (Math.random() * 360) + 'deg');
      s.style.setProperty('--spark-dist', (30 + Math.random() * 50) + 'px');
      this.particlesEl.appendChild(s);
      s.addEventListener('animationend', function () {
        s.remove();
      });
    }
  };

  PianoVisual.prototype._spawnParticles = function (keyEl, color, isBlack) {
    var rect = keyEl.getBoundingClientRect();
    var stageRect = this.particlesEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2 - stageRect.left;
    var cy = rect.top - stageRect.top;
    var count = isBlack ? 14 : 22;
    var i;
    var p;
    var angle;
    var dist;
    var dx;
    var dy;

    for (i = 0; i < count; i++) {
      p = document.createElement('span');
      p.className = 'piano-particle';
      angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      dist = 35 + Math.random() * 65;
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist - (isBlack ? 25 : 40);
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.setProperty('--p-color', color);
      p.style.setProperty('--p-x', dx + 'px');
      p.style.setProperty('--p-y', dy + 'px');
      p.style.animationDuration = (0.45 + Math.random() * 0.35) + 's';
      this.particlesEl.appendChild(p);
      p.addEventListener('animationend', function () {
        p.remove();
      });
    }
  };

  PianoVisual.prototype.reset = function () {
    var midi;
    this._activeTimers.forEach(clearTimeout);
    this._activeTimers = [];
    this.bursts = [];
    for (midi in this.keyMap) {
      this.keyMap[midi].classList.remove('is-active');
      this.keyMap[midi].querySelectorAll('.piano-ripple').forEach(function (r) {
        r.remove();
      });
    }
    if (this.particlesEl) this.particlesEl.innerHTML = '';
    if (this.pianoStage) this.pianoStage.classList.remove('is-performance');
  };

  PianoVisual.prototype.setPerformance = function (on) {
    if (this.pianoStage) this.pianoStage.classList.toggle('is-performance', !!on);
  };

  global.PianoVisual = PianoVisual;
  global.jianpuKeyToMidi = jianpuKeyToMidi;
})(window);
