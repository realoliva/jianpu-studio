/**
 * 电脑键盘弹奏 — 数字键 + 字母键映射
 */
(function (global) {
  'use strict';

  /**
   * event.code → 简谱键名
   * 数字 1-7：中音 do~si
   * Q-U：高八度  Q W E R T Y U
   * Z-M：低八度  Z X C V B N M
   * A-J：中音（与数字相同，方便双手）
   * Shift+数字：升半音 #1~#7
   */
  var BINDINGS = {
    Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
    Digit5: '5', Digit6: '6', Digit7: '7',
    KeyA: '1', KeyS: '2', KeyD: '3', KeyF: '4',
    KeyG: '5', KeyH: '6', KeyJ: '7',
    KeyQ: '[1]', KeyW: '[2]', KeyE: '[3]', KeyR: '[4]',
    KeyT: '[5]', KeyY: '[6]', KeyU: '[7]',
    KeyZ: '(1)', KeyX: '(2)', KeyC: '(3)', KeyV: '(4)',
    KeyB: '(5)', KeyN: '(6)', KeyM: '(7)'
  };

  var SHIFT_BINDINGS = {
    Digit1: '#1', Digit2: '#2', Digit3: '#3', Digit4: '#4',
    Digit5: '#5', Digit6: '#6', Digit7: '#7',
    KeyQ: '[#1]', KeyW: '[#2]', KeyE: '[#3]', KeyR: '[#4]',
    KeyT: '[#5]', KeyY: '[#6]', KeyU: '[#7]'
  };

  function resolveBinding(e) {
    if (e.shiftKey && SHIFT_BINDINGS[e.code]) return SHIFT_BINDINGS[e.code];
    return BINDINGS[e.code] || null;
  }

  function isTypingTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function KeyboardPlay(options) {
    this.engine = options.engine;
    this.piano = options.piano;
    this.getDuration = options.getDuration;
    this.isEnabled = options.defaultEnabled !== false;
    this.onStatus = options.onStatus || function () {};
    this._bound = false;
  }

  KeyboardPlay.prototype.setEnabled = function (on) {
    this.isEnabled = !!on;
  };

  KeyboardPlay.prototype.isActive = function () {
    return this.isEnabled;
  };

  KeyboardPlay.prototype._shouldCapture = function (e) {
    if (!this.isEnabled) return false;
    if (e.repeat) return false;
    if (e.ctrlKey || e.metaKey) return false;
    if (isTypingTarget(document.activeElement) && !e.altKey) return false; /* Alt：输入框内也可弹 */
    return !!resolveBinding(e);
  };

  KeyboardPlay.prototype._playKey = function (jianpuKey) {
    var self = this;
    var eng = this.engine;
    var dur = this.getDuration ? this.getDuration() : 220;
    var pv = this.piano;
    if (!eng) return;
    eng.ensureReady().then(function () {
      eng.playNote(jianpuKey);
      if (pv) pv.press(jianpuKey, dur);
    });
  };

  KeyboardPlay.prototype.bind = function () {
    if (this._bound) return;
    var self = this;
    this._onKeyDown = function (e) {
      if (!self._shouldCapture(e)) return;
      var key = resolveBinding(e);
      if (!key) return;
      e.preventDefault();
      self._playKey(key);
      self.onStatus('弹奏：' + key);
    };
    document.addEventListener('keydown', this._onKeyDown);
    this._bound = true;
  };

  KeyboardPlay.prototype.unbind = function () {
    if (!this._bound) return;
    document.removeEventListener('keydown', this._onKeyDown);
    this._bound = false;
  };

  KeyboardPlay.BINDINGS = BINDINGS;
  KeyboardPlay.SHIFT_BINDINGS = SHIFT_BINDINGS;

  global.KeyboardPlay = KeyboardPlay;
})(window);
