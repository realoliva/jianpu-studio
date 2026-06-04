/**
 * 数字简谱播放引擎（Web Audio API）
 * 供 Web / Electron 共用，资源路径相对于页面根目录。
 */
(function (global) {
  'use strict';

  var FREQUENCY_RATIO = 1.059463;
  var DEFAULT_DURATION = 220;
  var AUDIO_URL = 'media/piano.wav';

  var NOTE_MAP = {
    '((1))': 36, '((#1))': 35, '((2))': 34, '((#2))': 33, '((3))': 32, '((4))': 31,
    '((#4))': 30, '((5))': 29, '((#5))': 28, '((6))': 27, '((#6))': 26, '((7))': 25,
    '(1)': 24, '(#1)': 23, '(2)': 22, '(#2)': 21, '(3)': 20, '(4)': 19,
    '(#4)': 18, '(5)': 17, '(#5)': 16, '(6)': 15, '(#6)': 14, '(7)': 13,
    '1': 12, '#1': 11, '2': 10, '#2': 9, '3': 8, '4': 7,
    '#4': 6, '5': 5, '#5': 4, '6': 3, '#6': 2, '7': 1,
    '[1]': 0, '[#1]': -1, '[2]': -2, '[#2]': -3, '[3]': -4, '[4]': -5,
    '[#4]': -6, '[5]': -7, '[#5]': -8, '[6]': -9, '[#6]': -10, '[7]': -11,
    '[[1]]': -12, '[[#1]]': -13, '[[2]]': -14, '[[#2]]': -15, '[[3]]': -16, '[[4]]': -17,
    '[[#4]]': -18, '[[5]]': -19, '[[#5]]': -20, '[[6]]': -21, '[[#6]]': -22, '[[7]]': -23
  };

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function parseScore(text) {
    var tokens = [];
    var i = 0;
    var ch;

    while (i < text.length) {
      ch = text[i];
      if (ch === ' ' || ch === '-' || ch === '\n' || ch === '\r' || ch === '\t') {
        tokens.push({ type: 'rest' });
        i += 1;
        continue;
      }
      if (ch === '(' || ch === '[') {
        if (text[i + 1] === '(' || text[i + 1] === '[') {
          if (text[i + 2] === '#') {
            tokens.push({ type: 'note', key: text.substr(i, 6) });
            i += 6;
          } else {
            tokens.push({ type: 'note', key: text.substr(i, 5) });
            i += 5;
          }
        } else if (text[i + 1] === '#') {
          tokens.push({ type: 'note', key: text.substr(i, 4) });
          i += 4;
        } else {
          tokens.push({ type: 'note', key: text.substr(i, 3) });
          i += 3;
        }
        continue;
      }
      if (ch === '#') {
        tokens.push({ type: 'note', key: text.substr(i, 2) });
        i += 2;
        continue;
      }
      if (NOTE_MAP[ch] !== undefined) {
        tokens.push({ type: 'note', key: ch });
        i += 1;
        continue;
      }
      i += 1;
    }
    return tokens;
  }

  function frequencyRatioForSteps(steps) {
    var ratio = 1;
    var n;
    if (steps > 0) {
      for (n = 0; n < steps; n++) ratio /= FREQUENCY_RATIO;
    } else {
      for (n = 0; n > steps; n--) ratio *= FREQUENCY_RATIO;
    }
    return ratio;
  }

  function frequencyRatioForKey(key) {
    var steps = NOTE_MAP[key];
    if (steps === undefined) return 1;
    return frequencyRatioForSteps(steps);
  }

  function frequencyRatioForMidi(midi) {
    return frequencyRatioForSteps(72 - midi);
  }

  function JianpuEngine() {
    this._ctx = null;
    this._buffer = null;
    this._gain = null;
    this._loadPromise = null;
    this._playing = false;
    this._abort = false;
    this._sources = [];
  }

  JianpuEngine.prototype._getContext = function () {
    if (!this._ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      this._ctx = new Ctx();
      this._gain = this._ctx.createGain();
      this._gain.connect(this._ctx.destination);
    }
    return this._ctx;
  };

  JianpuEngine.prototype.ensureReady = function () {
    var self = this;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = new Promise(function (resolve, reject) {
      var ctx = self._getContext();
      var xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.open('GET', AUDIO_URL, true);
      xhr.onload = function () {
        if (xhr.status >= 400) {
          reject(new Error('无法加载钢琴采样：' + AUDIO_URL));
          return;
        }
        ctx.decodeAudioData(
          xhr.response,
          function (buf) {
            self._buffer = buf;
            resolve();
          },
          function () {
            reject(new Error('音频解码失败'));
          }
        );
      };
      xhr.onerror = function () {
        reject(new Error('无法加载钢琴采样，请通过本地服务或 Electron 打开应用'));
      };
      xhr.send();
    });

    return this._loadPromise;
  };

  JianpuEngine.prototype.setVolume = function (value) {
    if (this._gain) {
      this._gain.gain.value = Math.max(0, Math.min(1, value));
    }
  };

  JianpuEngine.prototype.stop = function () {
    this._abort = true;
    this._playing = false;
    var src;
    for (var i = 0; i < this._sources.length; i++) {
      src = this._sources[i];
      try {
        src.stop(0);
      } catch (e) { /* already stopped */ }
    }
    this._sources = [];
  };

  JianpuEngine.prototype.isPlaying = function () {
    return this._playing;
  };

  JianpuEngine.prototype._startSource = function (playbackRate) {
    var ctx = this._getContext();
    var source = ctx.createBufferSource();
    source.buffer = this._buffer;
    source.playbackRate.value = playbackRate;
    source.connect(this._gain);
    source.start(0);
    this._sources.push(source);
    var self = this;
    source.onended = function () {
      var idx = self._sources.indexOf(source);
      if (idx >= 0) self._sources.splice(idx, 1);
    };
  };

  JianpuEngine.prototype.playNote = function (key) {
    this._startSource(frequencyRatioForKey(key));
  };

  /** 按 MIDI 音高播放（全键盘音域） */
  JianpuEngine.prototype.playMidi = function (midi) {
    if (midi < 0 || midi > 127) return;
    this._startSource(frequencyRatioForMidi(midi));
  };

  /**
   * @param {string} text
   * @param {{ duration?: number, volume?: number, onProgress?: function }} options
   */
  JianpuEngine.prototype.play = async function (text, options) {
    options = options || {};
    var duration = options.duration != null ? options.duration : DEFAULT_DURATION;
    var onProgress = options.onProgress;

    if (this._playing) this.stop();
    await this.ensureReady();

    if (options.volume != null) this.setVolume(options.volume);

    var tokens = parseScore(text);
    if (tokens.length === 0) return { tokenCount: 0 };

    this._abort = false;
    this._playing = true;
    var ctx = this._getContext();
    if (ctx.state === 'suspended') await ctx.resume();

    var i;
    var token;
    for (i = 0; i < tokens.length; i++) {
      if (this._abort) break;
      token = tokens[i];
      if (onProgress) onProgress(i + 1, tokens.length, token);
      if (token.type === 'rest') {
        await sleep(duration);
      } else if (NOTE_MAP[token.key] !== undefined) {
        this.playNote(token.key);
        if (options.onNote) options.onNote(token.key, token, i, tokens.length);
        await sleep(duration);
      }
    }

    this._playing = false;
    return { tokenCount: tokens.length, aborted: this._abort };
  };

  JianpuEngine.parse = parseScore;
  JianpuEngine.NOTE_MAP = NOTE_MAP;

  global.JianpuEngine = JianpuEngine;

  /** @deprecated 兼容旧调用 */
  global.jianpu = function (text, duration) {
    var engine = global.__jianpuEngine || (global.__jianpuEngine = new JianpuEngine());
    return engine.play(text, { duration: duration });
  };
})(typeof window !== 'undefined' ? window : global);
