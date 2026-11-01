'use strict';
// ===================== Rootwell — engine =====================
const W = 288, TS = 32, HT = TS / 2;
let H = 192, S = 3;
const cvs = document.getElementById('game'), ctx = cvs.getContext('2d');
const buf = document.createElement('canvas'), bx0 = buf.getContext('2d');
let bx = bx0;
const SAVE_KEY = 'rootwell_save_v1', SET_KEY = 'rootwell_settings_v1';
const FONT = 'Pixelify, "Trebuchet MS", sans-serif';
const COL = { text: '#3d2a2f', dim: '#9b8580', gold: '#d2601a', hp: '#3fa84a', fp: '#3a78d4', red: '#d23a3a', light: '#fff6e4', panel: '#fbf3e6', border: '#131b1b' };
const ELEM_TEXT = { gale: '#2a9a78', ember: '#d0601c', bloom: '#4a9a2a', hush: '#7a5ab0' };
const OUTLINE_COL = '#1c1428';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};
const settings = Object.assign({ music: true, sfx: true, text: 1 }, (() => { try { return JSON.parse(store.get(SET_KEY)) || {}; } catch (e) { return {}; } })());
function saveSettings() { store.set(SET_KEY, JSON.stringify(settings)); }
function font(px, bold) { ctx.font = (bold ? '600 ' : '400 ') + px + 'px ' + FONT; }

function resize() {
  const scr = document.getElementById('screen'), app = document.getElementById('app');
  const land = window.matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
  let aw, ah;
  if (!land) {
    const cs = getComputedStyle(app);
    aw = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
    ah = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 186;
  } else { scr.style.height = ''; const r = scr.getBoundingClientRect(); aw = r.width; ah = r.height; }
  if (!aw || !ah) return;
  H = Math.max(192, Math.min(360, Math.round((W * ah) / aw)));
  let cw = aw, ch = (cw * H) / W;
  if (ch > ah) { ch = ah; cw = (ch * W) / H; }
  if (!land) scr.style.height = Math.ceil(ch + 12) + 'px';
  cvs.style.width = cw + 'px'; cvs.style.height = ch + 'px';
  if (window.W3D) W3D.resize(cw, ch, W, H);
  const dpr = window.devicePixelRatio || 1;
  S = Math.max(1, Math.min(8, Math.ceil((cw * dpr) / W)));
  if (cvs.width !== W * S || cvs.height !== H * S) { cvs.width = W * S; cvs.height = H * S; }
  if (buf.height !== H) { buf.width = W; buf.height = H; }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

// ---------- utils ----------
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }

// ===================== AUDIO =====================
const Snd = { ac: null, mus: null, fx: null, song: null, songName: null, want: null, step: 0, next: 0, lastBlip: 0 };
function audioInit() {
  if (Snd.ac) { if (Snd.ac.state === 'suspended') Snd.ac.resume(); return; }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    Snd.ac = ac;
    const master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
    Snd.mus = ac.createGain(); Snd.mus.connect(master);
    Snd.fx = ac.createGain(); Snd.fx.connect(master);
    applyAudio();
    for (const n in musicRaw) decodeMusic(n);
    const w = Snd.want; Snd.songName = null; music(w);
  } catch (e) { Snd.ac = null; }
}
const MUSIC = ['title', 'village', 'field', 'cave', 'battle', 'boss', 'ending', 'victory', 'level', 'gameover'];
const MUSIC_ONCE = { victory: 1, level: 1, gameover: 1 };
const musicRaw = {}, musicBuf = {};
function preloadMusic() {
  for (const n of MUSIC) fetch(`assets/music/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => { if (buf) { musicRaw[n] = buf; decodeMusic(n); } }).catch(() => {});
}
function decodeMusic(n) {
  if (!Snd.ac || !musicRaw[n] || n in musicBuf) return;
  musicBuf[n] = null;
  const done = (b) => { musicBuf[n] = b; if (Snd.want === n && Snd.songName !== n) music(n); };
  try { const p = Snd.ac.decodeAudioData(musicRaw[n].slice(0), done, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
function applyAudio() { if (Snd.mus) Snd.mus.gain.value = settings.music ? 0.9 : 0; if (Snd.fx) Snd.fx.gain.value = settings.sfx ? 1 : 0; }
function noteFreq(n) {
  const m = n.match(/^([A-G])([#b]?)(-?\d)$/); if (!m) return 0;
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (+m[3] - 4) * 12) / 12);
}
function parseTrack(s) {
  const tk = s.trim().split(/\s+/), out = [];
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i]; if (t === '.' || t === '-') { out.push(null); continue; }
    let d = 1; while (tk[i + d] === '-') d++; out.push({ f: noteFreq(t), d });
  }
  return out;
}
function tone(f, t, dur, type = 'square', vol = 0.15, dest) {
  if (!Snd.ac || !f) return;
  const ac = Snd.ac, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.06, dur));
  o.connect(g); g.connect(dest || Snd.fx); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, vol = 0.2, hp = 800) {
  if (!Snd.ac) return;
  const ac = Snd.ac, len = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp; src.buffer = b; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(Snd.fx); src.start(t);
}
function schedule() {}
function music(name) {
  Snd.want = name;
  if (!Snd.ac || Snd.songName === name) return;
  const ac = Snd.ac, t = ac.currentTime;
  if (Snd.src) { const src = Snd.src, g = Snd.srcGain; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.5); try { src.stop(t + 0.6); } catch (e) {} Snd.src = null; }
  Snd.songName = null;
  if (!name || !musicBuf[name]) { if (name) decodeMusic(name); return; }
  Snd.songName = name;
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = musicBuf[name]; src.loop = !MUSIC_ONCE[name];
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(MUSIC_ONCE[name] ? 0.9 : 0.6, t + 0.4);
  src.connect(g); g.connect(Snd.mus); src.start(t);
  Snd.src = src; Snd.srcGain = g;
}
function sfx(n) {
  if (!Snd.ac) return;
  const t = Snd.ac.currentTime;
  switch (n) {
    case 'cursor': tone(1046, t, 0.035, 'square', 0.04); break;
    case 'confirm': tone(988, t, 0.05, 'square', 0.06); tone(1480, t + 0.05, 0.08, 'square', 0.06); break;
    case 'cancel': tone(700, t, 0.05, 'square', 0.05); tone(470, t + 0.05, 0.06, 'square', 0.05); break;
    case 'buzz': tone(120, t, 0.14, 'sawtooth', 0.07); break;
    case 'blip': if (t - Snd.lastBlip > 0.05) { Snd.lastBlip = t; tone(660 + Math.random() * 80, t, 0.03, 'triangle', 0.05); } break;
    case 'hit': noise(t, 0.12, 0.32, 700); tone(160, t, 0.09, 'square', 0.07); break;
    case 'crit': noise(t, 0.22, 0.4, 300); tone(90, t, 0.22, 'sawtooth', 0.1); break;
    case 'magic': for (let i = 0; i < 6; i++) tone(520 + i * 150, t + i * 0.035, 0.12, 'triangle', 0.08); break;
    case 'heal': [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.22, 'sine', 0.11)); break;
    case 'chest': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.075, 0.18, 'square', 0.06)); break;
    case 'level': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.2, 'square', 0.06)); break;
    case 'encounter': [330, 494, 330, 659].forEach((f, i) => tone(f, t + i * 0.06, 0.08, 'sawtooth', 0.07)); break;
    case 'door': noise(t, 0.07, 0.12, 2400); tone(220, t, 0.08, 'triangle', 0.1); break;
    case 'gust': noise(t, 0.4, 0.22, 1500); tone(300, t, 0.3, 'sine', 0.05); break;
    case 'thud': tone(70, t, 0.25, 'sine', 0.3); noise(t, 0.18, 0.2, 100); break;
    case 'fire': noise(t, 0.5, 0.25, 1200); break;
    case 'bloom': [880, 1175, 1397].forEach((f, i) => tone(f, t + i * 0.05, 0.12, 'sine', 0.08)); break;
    case 'down': tone(320, t, 0.3, 'sawtooth', 0.07); tone(160, t + 0.15, 0.4, 'sawtooth', 0.07); break;
    case 'trinket': [1047, 1319, 1568, 2093, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.15, 'sine', 0.09)); break;
    case 'burst': noise(t, 0.6, 0.3, 300); [262, 392, 523, 784, 1047].forEach((f, i) => tone(f, t + i * 0.05, 0.4, 'square', 0.06)); break;
  }
}
document.addEventListener('visibilitychange', () => { if (Snd.ac) { if (document.hidden) Snd.ac.suspend(); else Snd.ac.resume(); } });

// ===================== INPUT =====================
const held = { up: 0, down: 0, left: 0, right: 0, a: 0, b: 0, p: 0, m: 0 };
const inputQ = [], dirStack = [], rep = { k: null, t: 0 };
function press(k) {
  audioInit();
  if (held[k]) return;
  held[k] = 1; inputQ.push(k);
  if (DIRS[k]) { dirStack.push(k); rep.k = k; rep.t = -330; if (P.path.length) { P.path = []; P.after = null; P.marker = null; } }
}
function release(k) { held[k] = 0; const i = dirStack.indexOf(k); if (i >= 0) dirStack.splice(i, 1); if (rep.k === k) rep.k = null; }
function heldDir() { for (let i = dirStack.length - 1; i >= 0; i--) if (held[dirStack[i]]) return dirStack[i]; return null; }
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'a', Z: 'a', Enter: 'a', ' ': 'a', x: 'b', X: 'b', Escape: 'b', Backspace: 'b', Shift: 'b', c: 'p', C: 'p', q: 'p', Q: 'p', m: 'm', M: 'm', Tab: 'm' };
window.addEventListener('keydown', (e) => { const k = KEYMAP[e.key]; if (!k) return; e.preventDefault(); if (!e.repeat) press(k); });
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) release(k); });
window.addEventListener('blur', () => { for (const k in held) release(k); });

(function setupTouch() {
  // arrow pad: slide your thumb between the arrows to change direction (hold B to run)
  const dpad = document.getElementById('dpad');
  let dDir = null, dId = null;
  const setDir = (d) => { if (d === dDir) return; if (dDir) release(dDir); dDir = d; if (d) press(d); dpad.dataset.dir = d || ''; };
  const upd = (e) => {
    const r = dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.1) { setDir(null); return; }
    setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); try { dpad.setPointerCapture(e.pointerId); } catch (_) {} dId = e.pointerId; upd(e); });
  dpad.addEventListener('pointermove', (e) => { if (e.pointerId === dId) upd(e); });
  const end = (e) => { if (e.pointerId !== dId) return; dId = null; setDir(null); };
  dpad.addEventListener('pointerup', end); dpad.addEventListener('pointercancel', end); dpad.addEventListener('lostpointercapture', end);
  document.querySelectorAll('.btn').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('on'); press(k); });
    const up = () => { b.classList.remove('on'); release(k); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  cvs.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audioInit();
    const r = cvs.getBoundingClientRect();
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
})();
const btnA = document.querySelector('.btn[data-k="a"] small'), btnP = document.querySelector('.btn[data-k="p"]');
let lastALabel = '';
function setButtonHints(aLabel, powerReady) {
  if (aLabel !== lastALabel) { lastALabel = aLabel; btnA.textContent = aLabel; }
  btnP.classList.toggle('ready', !!powerReady);
}

// ===================== UI =====================
const UI = { dialog: null, menus: [], waiter: null, panel: null, fade: 1, fadeTo: 0, fadeRes: null, flash: 0, flashCol: '#fff', banner: null, toast: null, goldBox: false, goalT: 0 };
let hits = [], panelKey = null;
function tap(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return; } }
  if (UI.menus.length) return;
  if (UI.dialog || UI.waiter) { handleInput('a'); return; }
  if (game.scene === 'map' && !busy) tapMap(x, y);
}
function wrap(text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
// who: key in PEOPLE (shows a portrait), or omitted for narration.
// story text names the hero "Wren"; swap in the player's chosen name
function heroText(t) { return String(t).replace(/\bWren\b/g, () => HERO.name); }
function say(text, who, nameOverride, hold) {
  text = heroText(text);
  return new Promise((res) => {
    const p = who && PEOPLE[who];
    font(10);
    const lines = wrap(text, W - 30 - (p ? 54 : 0)), pages = [];
    for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    UI.dialog = { pages, p: 0, c: 0, name: nameOverride || (p ? p.name : null), look: p ? p.look : null, res, hold, done: false };
  });
}
function advanceDialog() {
  const d = UI.dialog, total = d.pages[d.p].join('').length;
  if (d.c < total) { d.c = total; return; }
  if (d.hold && d.p === d.pages.length - 1) return;
  d.p++; d.c = 0; sfx('cursor');
  if (d.p >= d.pages.length) { UI.dialog = null; d.res(); }
}
async function ask(text, who, opts = ['Yes', 'No']) {
  await say(text, who, null, true);
  const c = await choose(opts, { x: W - 66, bottom: H - 66, w: 60 });
  UI.dialog = null;
  return c;
}
function choose(items, o = {}) {
  return new Promise((res) => {
    items = items.map((it) => (typeof it === 'string' ? { label: it } : it));
    const m = { items, cursor: clamp(o.cursor || 0, 0, Math.max(0, items.length - 1)), cols: o.cols || 1, x: o.x, y: o.y, w: o.w, title: o.title,
      cancel: o.cancel !== false, res, max: o.max || 8, scroll: 0, onHover: o.onHover, extraHits: o.extraHits };
    font(9);
    const rows = Math.ceil(items.length / m.cols);
    m.vis = Math.min(rows, m.max);
    if (!m.w) {
      let mw = 0;
      for (const it of items) mw = Math.max(mw, ctx.measureText(it.label).width + (it.right ? ctx.measureText(it.right).width + 12 : 0) + (it.icon ? 14 : 0));
      if (m.title) { font(9, true); mw = Math.max(mw, ctx.measureText(m.title).width - 6); }
      m.w = (Math.ceil(mw) + 20) * m.cols + 8;
    }
    m.h = m.vis * 13 + 8 + (m.title ? 14 : 0);
    if (m.x == null) m.x = W - m.w - 4;
    if (m.y == null) m.y = 4;
    if (o.bottom != null) m.y = o.bottom - m.h;
    m.x = clamp(Math.round(m.x), 0, W - m.w); m.y = clamp(Math.round(m.y), 0, H - m.h);
    scrollMenu(m);
    UI.menus.push(m);
    if (m.onHover) m.onHover(m.cursor);
  });
}
function scrollMenu(m) { const r = Math.floor(m.cursor / m.cols); if (r < m.scroll) m.scroll = r; if (r >= m.scroll + m.vis) m.scroll = r - m.vis + 1; }
function closeMenu(m, v) { const i = UI.menus.indexOf(m); if (i >= 0) UI.menus.splice(i, 1); m.res(v); }
function selectMenu(m) { const it = m.items[m.cursor]; if (!it || it.disabled) { sfx('buzz'); return; } sfx('confirm'); closeMenu(m, m.cursor); }
function menuInput(m, k) {
  const n = m.items.length, c = m.cols, old = m.cursor;
  if (!n) { if (k === 'b' || k === 'a') closeMenu(m, -1); return; }
  if (k === 'up') { if (m.cursor - c >= 0) m.cursor -= c; else if (c === 1) m.cursor = n - 1; }
  else if (k === 'down') { if (m.cursor + c < n) m.cursor += c; else if (c === 1) m.cursor = 0; }
  else if (k === 'left') { if (c > 1 && m.cursor % c > 0) m.cursor--; }
  else if (k === 'right') { if (c > 1 && m.cursor % c < c - 1 && m.cursor + 1 < n) m.cursor++; }
  else if (k === 'a') { selectMenu(m); return; }
  else if (k === 'b') { if (m.cancel) { sfx('cancel'); closeMenu(m, -1); } return; }
  if (m.cursor !== old) { sfx('cursor'); scrollMenu(m); if (m.onHover) m.onHover(m.cursor); }
}
function waitKey() { return new Promise((res) => { UI.waiter = () => res(); }); }
function waitOrTap(ms) {
  return new Promise((res) => {
    let done = false; const w = () => fin();
    const fin = () => { if (done) return; done = true; if (UI.waiter === w) UI.waiter = null; res(); };
    UI.waiter = w; setTimeout(fin, ms);
  });
}
function fade(to) { return new Promise((res) => { UI.fadeTo = to; UI.fadeRes = res; }); }
function toast(t, ms = 1800) { UI.toast = { text: t, t: ms }; }

function handleInput(k) {
  if (UI.menus.length) { menuInput(UI.menus[UI.menus.length - 1], k); return; }
  if (panelKey) { const f = panelKey; panelKey = null; f(k); return; }
  if (UI.dialog) { if (k === 'a' || k === 'b') advanceDialog(); return; }
  if (UI.waiter) { if (k === 'a' || k === 'b') { const w = UI.waiter; UI.waiter = null; w(); } return; }
  if (game.scene === 'map' && !busy) {
    if (P.moving) { if (k === 'a' || k === 'p' || k === 'm') pendingAction = k; return; }
    doMapAction(k);
  }
}
let pendingAction = null, stickRun = false;
function doMapAction(k) {
  if (k === 'a') interact();
  else if (k === 'p') usePowerKey();
  else if (k === 'm') runScript(pauseMenu);
}

// ---------- ui drawing ----------
const SO = () => Math.max(1, Math.round(S * 0.55)) / S;
function box(x, y, w, h, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const R = (c, a, b, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(a, b, ww, hh); };
  R('rgba(20,10,5,0.28)', x + 2, y + h, w - 2, 2);
  R(COL.border, x + 2, y, w - 4, h); R(COL.border, x, y + 2, w, h - 4); R(COL.border, x + 1, y + 1, w - 2, h - 2);
  const rim = o.dark ? '#f06733' : '#ffad55', rimD = o.dark ? '#9b513c' : '#f06733';
  R(rim, x + 2, y + 1, w - 4, h - 2); R(rim, x + 1, y + 2, w - 2, h - 4);
  R(rimD, x + 1, y + h - 4, w - 2, 2); R(rimD, x + 2, y + h - 2, w - 4, 1);
  R('#9b513c', x + 3, y + 3, w - 6, h - 7);
  R(o.dark ? '#46402e' : o.bg || COL.panel, x + 4, y + 4, w - 8, h - 9);
  if (o.border && o.border !== COL.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
}
function text(s, x, y, col = COL.text, align = 'left') {
  s = String(s).replace(/f([ilt])/g, 'f\u200C$1');
  ctx.textAlign = align;
  if (isLight(col)) { const so = SO(); ctx.fillStyle = 'rgba(12,6,24,0.85)'; ctx.fillText(s, x + so, y + so); }
  ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
}
const lightCache = {};
function isLight(col) {
  if (col in lightCache) return lightCache[col];
  let r = 255, g = 255, b = 255;
  const m = col.match(/^#([0-9a-f]{6})/i), m2 = col.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) { const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; } else if (m2) { r = +m2[1]; g = +m2[2]; b = +m2[3]; }
  return (lightCache[col] = 0.299 * r + 0.587 * g + 0.114 * b > 150);
}
function bar(x, y, w, h, v, max, col, col2) {
  ctx.fillStyle = '#120c20'; ctx.fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
  const fw = Math.max(0, Math.min(1, v / Math.max(1, max))) * w;
  ctx.fillStyle = col; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = col2 || 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, fw, Math.max(0.5, h / 3));
}
function poly(pts, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
function img(c, x, y, sc = 1) { ctx.imageSmoothingEnabled = false; ctx.drawImage(c, Math.round(x), Math.round(y), c.width * sc, c.height * sc); }
function rc(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function drawMenu(m, top) {
  box(m.x, m.y, m.w, m.h);
  let y0 = m.y + 4;
  if (m.title) { font(9, true); text(m.title, m.x + 7, y0 + 9, COL.gold); y0 += 14; }
  font(9);
  const n = m.items.length, c = m.cols, cw = (m.w - 8) / c, rows = Math.ceil(n / c);
  for (let r = m.scroll; r < m.scroll + m.vis && r < rows; r++) {
    for (let col = 0; col < c; col++) {
      const i = r * c + col; if (i >= n) break;
      const it = m.items[i], ix = m.x + 4 + col * cw, iy = y0 + (r - m.scroll) * 13;
      if (i === m.cursor && top) {
        ctx.fillStyle = 'rgba(240,103,51,0.16)'; ctx.fillRect(ix, iy, cw, 13);
        const bob = Math.round(Math.sin(T / 130));
        poly([ix + 2 + bob, iy + 3, ix + 7 + bob, iy + 6.5, ix + 2 + bob, iy + 10], COL.gold);
      }
      let lx = ix + 10;
      if (it.icon) { img(it.icon, lx - 1, iy, 1); lx += 14; }
      text(it.label, lx, iy + 10, it.disabled ? COL.dim : it.color || COL.text);
      if (it.right) text(it.right, ix + cw - 3, iy + 10, it.disabled ? COL.dim : it.rightColor || '#7a6a70', 'right');
      if (top) hits.push({ x: ix, y: iy, w: cw, h: 13, fn: () => { if (UI.menus[UI.menus.length - 1] !== m) return; m.cursor = i; if (m.onHover) m.onHover(i); selectMenu(m); } });
    }
  }
  if (m.scroll > 0) poly([m.x + m.w / 2 - 3, m.y + 4, m.x + m.w / 2 + 3, m.y + 4, m.x + m.w / 2, m.y + 1], COL.gold);
  if (m.scroll + m.vis < rows) poly([m.x + m.w / 2 - 3, m.y + m.h - 4, m.x + m.w / 2 + 3, m.y + m.h - 4, m.x + m.w / 2, m.y + m.h - 1], COL.gold);
  if (top && m.extraHits) for (const eh of m.extraHits) hits.push({ ...eh, fn: () => { if (UI.menus[UI.menus.length - 1] !== m) return; m.cursor = eh.index; if (m.onHover) m.onHover(eh.index); selectMenu(m); } });
  if (top && m.cancel) {
    const x0 = m.x + m.w - 11, y0b = m.y - 3;
    hits.push({ x: x0 - 5, y: y0b - 6, w: 20, h: 18, fn: () => { if (UI.menus[UI.menus.length - 1] === m) { sfx('cancel'); closeMenu(m, -1); } } });
    box(x0 - 1, y0b - 1, 14, 14, { dark: true }); font(8, true); text('×', x0 + 6, y0b + 8.5, COL.light, 'center');
  }
}
function drawDialog() {
  const d = UI.dialog; if (!d) return;
  const y = H - 62, x = 4, w = W - 8;
  box(x, y, w, 58);
  let tx = x + 12;
  if (d.look) { img(ART.ui('faceframe'), x + 6, y + 5); img(ART.portrait(d.look), x + 11, y + 10); tx = x + 62; }
  if (d.name) { font(9, true); const nw = ctx.measureText(d.name).width + 18; box(x + 8, y - 13, nw, 17, { dark: true }); text(d.name, x + 17, y - 1, COL.light); }
  font(10);
  let left = d.c;
  d.pages[d.p].forEach((ln, i) => { const s = ln.slice(0, Math.max(0, left)); left -= ln.length; text(s, tx, y + 19 + i * 14); });
  const total = d.pages[d.p].join('').length;
  if (d.c >= total && !(d.hold && d.p === d.pages.length - 1)) { const b = Math.round(Math.sin(T / 140)); poly([W - 22, y + 44 + b, W - 14, y + 44 + b, W - 18, y + 49 + b], COL.gold); }
}
function drawUI() {
  if (UI.panel) UI.panel();
  for (let i = 0; i < UI.menus.length; i++) drawMenu(UI.menus[i], i === UI.menus.length - 1);
  const top = UI.menus[UI.menus.length - 1];
  if (top && top.items[top.cursor] && top.items[top.cursor].desc) {
    font(9); const lines = wrap(top.items[top.cursor].desc, game.scene === 'battle' ? W - 104 : W - 20).slice(0, 2);
    const by = top.y > 34 ? 4 : H - 10 - lines.length * 11;
    const dw = game.scene === 'battle' ? W - 92 : W - 8;
    box(4, by, dw, lines.length * 11 + 7); lines.forEach((l, i) => text(l, 10, by + 12 + i * 11));
  }
  if (UI.goldBox && state) {
    box(W - 76, 4, 72, 18); img(ART.icon('gold'), W - 72, 6);
    font(9, true); text(state.gold + '', W - 10, 17, COL.gold, 'right');
  }
  drawDialog();
  if (UI.toast) {
    ctx.globalAlpha = clamp(UI.toast.t / 250, 0, 1); font(9);
    const w = Math.min(W - 8, ctx.measureText(UI.toast.text).width + 16);
    box((W - w) / 2, 26, w, 19); text(UI.toast.text, W / 2, 38, COL.text, 'center'); ctx.globalAlpha = 1;
  }
}

// ===================== STATE =====================
let state = null, cur = null, B = null;
const game = { scene: 'boot' };
const P = { x: 0, y: 0, fx: 0, fy: 0, t: 1, moving: false, dir: 'down', anim: 0, path: [], hist: [], after: null, marker: null };
let busy = false, encSteps = 20, T = 0, VW = W, VH = H, ZM = 1;
const fx = [];

function newState() {
  state = { map: 'village', x: 14, y: 7, dir: 'down', party: [], gold: 30, items: { herb: 2 }, flags: {}, mods: {}, trinkets: {}, known: {}, harmony: 0, steps: 0, time: 0 };
}
function startParty(hero) {
  if (typeof hero === 'string') hero = { name: 'Wren', outfit: 0, cls: hero };
  state.hero = { name: hero.name, outfit: hero.outfit };
  state.classes = assignClasses(hero.cls); applyClasses(state.classes, state.hero);
  state.party = [makeMember('wren', 1)];
}
function makeMember(id, lv) { const m = { id, lv, xp: 0, hp: 1, fp: 1, weapon: null, armor: null }; const s = stats(m); m.hp = s.hp; m.fp = s.fp; return m; }
function trinketOf(m) { if (!state) return null; for (const k in state.trinkets) if (state.trinkets[k] === m.id) return TRINKETS[k]; return null; }
function stats(m) {
  const h = HEROES[m.id], o = {};
  for (const k of ['hp', 'fp', 'atk', 'def', 'agi']) o[k] = Math.floor(h.base[k] + h.grow[k] * (m.lv - 1));
  if (m.weapon) o.atk += ITEMS[m.weapon].atk;
  if (m.armor) o.def += ITEMS[m.armor].def;
  for (const slot of ['weapon', 'armor']) { const b = m[slot] && ITEMS[m[slot]].bonus; if (b) for (const k in b) o[k] += b[k]; }
  if (m.up) { o.atk += (m.up.w || 0) * 3; o.def += (m.up.a || 0) * 2; }
  const t = trinketOf(m); if (t && t.bonus) for (const k in t.bonus) o[k] += t.bonus[k];
  return o;
}
const xpNext = (lv) => Math.floor(10 * Math.pow(lv, 1.5));
const hname = (m) => HEROES[m.id].name;
function addItem(id, n = 1) { state.items[id] = (state.items[id] || 0) + n; }
function removeItem(id) { if (--state.items[id] <= 0) delete state.items[id]; }
function skillsOf(m) { return HEROES[m.id].skills.filter((a) => a[1] <= m.lv).map((a) => a[0]); }
function clampHero(m) { const s = stats(m); m.hp = Math.min(m.hp, s.hp); m.fp = Math.min(m.fp, s.fp); }
function saveGame() {
  if (!cur || !state) return false;
  state.map = cur.id; state.x = P.x; state.y = P.y; state.dir = P.dir;
  return store.set(SAVE_KEY, JSON.stringify(state));
}
function loadGame() {
  try {
    const s = JSON.parse(store.get(SAVE_KEY));
    if (s && s.party) {
      state = s; state.known = state.known || {}; state.trinkets = state.trinkets || {};
      // saves from before classes existed: give everyone the class closest to their old role
      if (!state.classes) state.classes = { wren: 'ranger', bram: 'warden', corin: 'rogue', tamsin: 'druid' };
      for (const m of state.party) state.flags[m.id + 'Joined'] = true;
      applyClasses(state.classes, state.hero || { name: 'Wren', outfit: 0 });
      for (const m of state.party) clampHero(m);
      return true;
    }
  } catch (e) {}
  return false;
}
function goalChanged() { UI.goalT = 6000; toast('New goal: ' + goalText(), 2600); }

// ===================== MAP =====================
const SAME = {
  '=': (c) => '=|DvX'.includes(c), '~': (c) => '~%o|'.includes(c), M: (c) => c === 'M' || c === 'v', '#': (c) => c === '#', '"': (c) => c === '"',
  Q: (c) => c === 'Q', R: (c) => c === 'R', H: (c) => c === 'H' || c === 'D', F: (c) => c === 'F', g: (c) => c === 'g',
};
SAME['%'] = SAME.o = SAME['|'] = SAME['~']; SAME.D = SAME.H;
const SOLID = new Set('T~#HRBOPCcJSFKYLrMQtuxwlzmqke '.split(''));

function loadMap(id) {
  const def = MAPS[id];
  const t = def.rows.map((r) => r.split(''));
  const mods = state.mods[id] || {};
  for (const k in mods) { const [x, y] = k.split(',').map(Number); t[y][x] = mods[k]; }
  cur = { id, def, w: t[0].length, h: t.length, t, npcs: [], moving: null, mask: [], roof: {}, chimneys: [], clouds: [] };
  for (let y = 0; y < cur.h; y++) cur.mask.push(new Array(cur.w).fill(0));
  for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) cur.mask[y][x] = maskAt(x, y);
  syncNpcs();
  fx.length = 0;
  if (window.W3D) { W3D.buildMap(cur, state); W3D.resetCamera(); }
  encSteps = def.encTall ? ri(4, 10) : ri(10, 20);
  music(def.music);
  if (def.outdoor) for (let i = 0; i < 3; i++) cur.clouds.push({ x: rand(0, cur.w * TS), y: rand(0, cur.h * TS), r: rand(60, 110) });
  if (!def.interior) UI.banner = { text: def.name, t: 2600 };
}
function maskAt(x, y) {
  const c = cur.t[y][x], f = SAME[c]; if (!f) return 255;
  const s = (xx, yy) => (xx < 0 || yy < 0 || xx >= cur.w || yy >= cur.h ? true : f(cur.t[yy][xx]));
  return (s(x, y - 1) ? 1 : 0) | (s(x + 1, y) ? 2 : 0) | (s(x, y + 1) ? 4 : 0) | (s(x - 1, y) ? 8 : 0) |
    (s(x + 1, y - 1) ? 16 : 0) | (s(x + 1, y + 1) ? 32 : 0) | (s(x - 1, y + 1) ? 64 : 0) | (s(x - 1, y - 1) ? 128 : 0);
}
function syncNpcs() {
  if (!cur) return;
  cur.npcs = cur.npcs.filter((n) => !n.cond || n.cond());
  for (const n of cur.def.npcs || []) {
    if (cur.npcs.some((m) => m.id === n.id)) continue;
    if (n.cond && !n.cond()) continue;
    cur.npcs.push({ ...n, fx: n.x, fy: n.y, t: 1, moving: false, dir: n.dir || 'down', home: { x: n.x, y: n.y }, wt: rand(800, 2500), anim: 0 });
  }
}
function tileAt(x, y) { if (x < 0 || y < 0 || x >= cur.w || y >= cur.h) return ' '; return cur.t[y][x]; }
function setTile(x, y, c) {
  cur.t[y][x] = c; (state.mods[cur.id] = state.mods[cur.id] || {})[x + ',' + y] = c;
  if (window.W3D) W3D.tileChanged(cur, state);
  for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && yy >= 0 && xx < cur.w && yy < cur.h) cur.mask[yy][xx] = maskAt(xx, yy);
}
function npcAt(x, y) { return cur.npcs.find((n) => (n.x === x && n.y === y) || (n.moving && n.fx === x && n.fy === y)); }
function pickupAt(x, y) { return (cur.def.trinkets || []).find((w) => w.x === x && w.y === y && !(w.id in state.trinkets)); }
function blocked(x, y, self) {
  const tc = tileAt(x, y);
  if (SOLID.has(tc) && !((tc === 'H' || tc === 'R') && W3D.openTiles && W3D.openTiles.has(x + ',' + y))) return true;
  if (W3D.closedTiles && W3D.closedTiles.has(x + ',' + y)) return true;
  if (cur.npcs.some((n) => n !== self && ((n.x === x && n.y === y) || (n.moving && n.fx === x && n.fy === y)))) return true;
  if (pickupAt(x, y)) return true;
  if (self && ((P.x === x && P.y === y) || (P.moving && P.fx === x && P.fy === y))) return true;
  return false;
}
function placePlayer(x, y, dir) {
  P.x = P.fx = x; P.y = P.fy = y; P.t = 1; P.moving = false; P.dir = dir || P.dir; P.path = []; P.after = null; P.marker = null; P.rot = null; P.diag = false;
  P.hist = [{ x, y }, { x, y }, { x, y }, { x, y }, { x, y }, { x, y }];
}
async function runScript(fn) {
  if (busy) return;
  busy = true; P.path = []; P.after = null; P.marker = null;
  try { await fn(); } catch (e) { console.error(e); }
  busy = false;
}
async function warp(to, x, y, dir) {
  sfx('door');
  await fade(1);
  loadMap(to); placePlayer(x, y, dir);
  saveGame();
  await fade(0);
  if (cur.def.onEnter) await cur.def.onEnter();
}

function updateMap(dt) {
  for (const n of cur.npcs) {
    if (n.moving) { n.t += dt / 320; n.anim += dt; if (n.t >= 1) { n.t = 1; n.moving = false; } continue; }
    if (!n.wander || busy || UI.dialog || UI.menus.length) continue;
    n.wt -= dt; if (n.wt > 0) continue;
    n.wt = rand(1400, 3600);
    const d = pick(Object.keys(DIRS)); n.dir = d;
    const nx = n.x + DIRS[d][0], ny = n.y + DIRS[d][1];
    if (Math.abs(nx - n.home.x) > 2 || Math.abs(ny - n.home.y) > 2 || blocked(nx, ny, n)) continue;
    n.fx = n.x; n.fy = n.y; n.x = nx; n.y = ny; n.t = 0; n.moving = true;
  }
  if (P.moving) {
    P.t += dt / ((held.b || stickRun ? 110 : 190) * (P.diag ? 1.41 : 1)); P.anim += dt;
    if (P.t < 1) return;
    P.t = 1; P.moving = false;
    onStep();
    if (busy) return;
    if (pendingAction) { const k = pendingAction; pendingAction = null; doMapAction(k); return; }
  }
  if (busy || UI.dialog || UI.menus.length || UI.panel || game.scene !== 'map') return;
  let d = heldDir();
  if (!d && P.path.length) {
    d = P.path[0];
    if (blocked(P.x + DIRS[d][0], P.y + DIRS[d][1])) { P.path = []; P.after = null; P.marker = null; d = null; }
    else P.path.shift();
  } else if (!d && P.after) {
    const a = P.after; P.after = null; P.marker = null;
    if (a.face) P.dir = a.face;
    interact();
    return;
  }
  if (!d) { P.anim = 0; return; }
  P.dir = d; P.rot = null;
  const nx = P.x + DIRS[d][0], ny = P.y + DIRS[d][1];
  if (!blocked(nx, ny)) {
    P.fx = P.x; P.fy = P.y; P.x = nx; P.y = ny; P.t = 0; P.moving = true; P.diag = false;
    P.hist.unshift({ x: nx, y: ny }); if (P.hist.length > 6) P.hist.pop();
  }
}
function onStep() {
  state.steps++;
  if (!P.path.length && !P.after) P.marker = null;
  if (state.steps % 4 === 0) for (const m of state.party) if (m.hp > 0) m.fp = Math.min(stats(m).fp, m.fp + 1);
  const w = (cur.def.warps || []).find((w) => w.x === P.x && w.y === P.y);
  if (w) { runScript(() => warp(w.to, w.tx, w.ty, w.dir)); return; }
  if (cur.def.onStep) { const s = cur.def.onStep(P.x, P.y); if (s) { runScript(s); return; } }
  if (cur.def.enc) {
    const tc = tileAt(P.x, P.y);
    const ok = cur.def.encTall ? tc === '"' : !['X', '%', 'o'].includes(tc);
    if (ok && --encSteps <= 0) { encSteps = cur.def.encTall ? ri(5, 12) : ri(14, 24); runScript(randomBattle); }
  }
}
async function randomBattle() { await fight(pick(ENCOUNTERS[cur.def.enc]), { bg: cur.def.bg }); }

// ---------- camera, tap-to-move ----------
function camera() {
  const px = (P.fx + (P.x - P.fx) * P.t) * TS, py = (P.fy + (P.y - P.fy) * P.t) * TS;
  const mw = cur.w * TS, mh = cur.h * TS;
  const cx = mw <= VW ? (mw - VW) / 2 : clamp(px + HT - VW / 2, 0, mw - VW);
  const cy = mh <= VH ? (mh - VH) / 2 : clamp(py + HT - VH / 2, 0, mh - VH);
  return { cx: Math.round(cx), cy: Math.round(cy), px, py };
}
function findPath(tx, ty, adjacentOk) {
  const key = (x, y) => x + ',' + y, prev = new Map([[key(P.x, P.y), null]]), q = [[P.x, P.y]];
  let end = null, n = 0;
  while (q.length && n++ < 3000) {
    const [x, y] = q.shift();
    if ((x === tx && y === ty && !adjacentOk) || (adjacentOk && Math.abs(x - tx) + Math.abs(y - ty) === 1)) { end = [x, y]; break; }
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || blocked(nx, ny)) continue;
      if ((cur.def.warps || []).some((w) => w.x === nx && w.y === ny) && !(nx === tx && ny === ty)) continue;
      prev.set(k, [x, y, d]); q.push([nx, ny]);
    }
  }
  if (!end) return null;
  const dirs = []; let k = key(end[0], end[1]);
  while (prev.get(k)) { const [x, y, d] = prev.get(k); dirs.unshift(d); k = key(x, y); }
  return { dirs, end };
}
function dirTo(x0, y0, x1, y1) { return x1 > x0 ? 'right' : x1 < x0 ? 'left' : y1 > y0 ? 'down' : 'up'; }
function tapMap(lx, ly) {
  const { cx, cy } = camera();
  const pt = W3D.pickTile(lx, ly); if (!pt) return;
  const tx = pt.x, ty = pt.y;
  if (tx < 0 || ty < 0 || tx >= cur.w || ty >= cur.h) return;
  if (tx === P.x && ty === P.y) { interact(); return; }
  const c = tileAt(tx, ty);
  const interesting = npcAt(tx, ty) || pickupAt(tx, ty) || 'CJSOBLP'.includes(c) || (c === '~' && hasPower('bloom')) || (c === 'K' && (npcAt(tx, ty - 1) || npcAt(tx, ty + 1)));
  if (interesting) {
    if (Math.abs(tx - P.x) + Math.abs(ty - P.y) === 1) { P.dir = dirTo(P.x, P.y, tx, ty); interact(); return; }
    const r = findPath(tx, ty, true);
    if (!r) { toast("Can't reach that from here."); return; }
    P.path = r.dirs; P.after = { face: dirTo(r.end[0], r.end[1], tx, ty) }; P.marker = { x: tx, y: ty };
    return;
  }
  if (blocked(tx, ty)) return;
  const r = findPath(tx, ty, false);
  if (!r) return;
  P.path = r.dirs; P.after = null; P.marker = { x: tx, y: ty };
}

// ---------- interaction ----------
function hasPower(p) { return state.party.some((m) => HEROES[m.id].field === p); }
function facingTarget() {
  const [dx, dy] = DIRS[P.dir]; const x = P.x + dx, y = P.y + dy;
  let n = npcAt(x, y); const c = tileAt(x, y);
  if (!n && c === 'K') { n = npcAt(x + dx, y + dy); if (n) return { kind: 'talk', n, x: x + dx, y: y + dy }; }
  if (n) return { kind: 'talk', n, x, y };
  if (pickupAt(x, y)) return { kind: 'take', x, y };
  const door = P.dir === 'up' && (cur.def.houses || []).find((h) => h.locked && h.door === x && h.y + h.h - 1 === y);
  if (door) return { kind: 'locked', x, y, msg: door.locked };
    if (c === 'C') return { kind: 'open', x, y };
  if (c === 'J') return hasPower('pick') ? { kind: 'power', p: 'pick', x, y } : { kind: 'look', x, y };
  if (c === 'S') return { kind: 'read', x, y };
  if (c === 'L') return { kind: 'look', x, y };
  if (c === 'O') return hasPower('gust') ? { kind: 'power', p: 'gust', x, y } : { kind: 'look', x, y };
  if (c === 'B') return hasPower('kindle') ? { kind: 'power', p: 'kindle', x, y } : { kind: 'look', x, y };
  if (c === '~' && hasPower('bloom')) return { kind: 'power', p: 'bloom', x, y };
  if (c === 'P') return { kind: 'look', x, y };
  return null;
}
const A_LABELS = { talk: 'Talk', take: 'Take', open: 'Open', read: 'Read', look: 'Look', power: 'Use', locked: 'Knock' };
function interact() {
  const f = facingTarget();
  if (!f) return;
  const { x, y } = f;
  if (f.kind === 'talk') { const n = f.n; runScript(async () => { if (!n.enemy) n.dir = OPP[P.dir]; await n.talk(n); }); return; }
  if (f.kind === 'take') { runScript(() => takeTrinket(pickupAt(x, y))); return; }
  if (f.kind === 'open') { runScript(() => openChest(x, y)); return; }
  if (f.kind === 'read') { runScript(() => say(cur.def.signs[x + ',' + y])); return; }
  if (f.kind === 'locked') { runScript(async () => { sfx('buzz'); await say(f.msg); }); return; }
  if (f.kind === 'power') { runScript(() => usePower(f.p, x, y)); return; }
  const c = tileAt(x, y);
  if (c === 'L') { runScript(() => cur.def.spring()); return; }
  if (c === 'O') runScript(() => say('A huge boulder. Something with a strong gust might move it.'));
  if (c === 'B') runScript(() => say('A tangle of thorny brambles. A little fire would clear these right out.'));
  if (c === 'P') runScript(() => say('A deep pit. Something heavy could fill it in.'));
  if (c === 'J') runScript(() => say('A chest bound in iron, with a heavy brass lock. Someone with the right key could open it.'));
}
function usePowerKey() {
  const f = facingTarget();
  if (f && f.kind === 'power') { runScript(() => usePower(f.p, f.x, f.y)); return; }
  const tools = state.party.map((m) => POWERS[HEROES[m.id].field].name).join(', ');
  toast(`Tools: ${tools}. Face a boulder, bramble or water.`, 2400);
}
async function openChest(x, y) {
  const ch = cur.def.chests[x + ',' + y];
  setTile(x, y, 'c'); sfx('chest');
  for (let i = 0; i < 14; i++) fx.push({ x: x * TS + HT, y: y * TS + HT, vx: rand(-0.8, 0.8), vy: rand(-1.6, -0.4), life: 1, col: pick(['#ffe080', '#ffffff', '#ffc040']), s: 1 });
  if (ch.gold) { state.gold += ch.gold; await say(`Found ${ch.gold} coins!`); return; }
  addItem(ch.item, ch.n || 1);
  await say(`Found ${ch.n > 1 ? ch.n + ' × ' : ''}${ITEMS[ch.item].name}!`);
}
async function takeTrinket(w) {
  const t = TRINKETS[w.id];
  const free = state.party.find((m) => !trinketOf(m));
  state.trinkets[w.id] = free ? free.id : null;
  sfx('trinket');
  for (let i = 0; i < 24; i++) { const a = rand(0, 6.28); fx.push({ x: w.x * TS + HT, y: w.y * TS + HT, vx: Math.cos(a) * 1.3, vy: Math.sin(a) * 1.3, life: 1, col: pick(['#ffe080', '#ffffff', '#ff9ad0']), s: 1 }); }
  await say(`Found a Trinket: the ${t.name}! ${t.desc}`);
  if (free) await say(`${hname(free)} is now wearing the ${t.name}. (You can change who wears Trinkets from the menu.)`);
  else await say('Everyone already wears a Trinket. Swap them from the menu.');
}

// ---------- field tools ----------
const WALK_GROUND = new Set(['.', '_', '=', ',', '"', '%', 'p', 'o', 'W', 'g']);
const POWERS = {
  gust: { name: 'Gust', fp: 1, user: 'wren',
    async apply(x, y, dx, dy) {
      const nx = x + dx, ny = y + dy, dc = tileAt(nx, ny);
      const occ = npcAt(nx, ny) || pickupAt(nx, ny) || (P.x === nx && P.y === ny);
      sfx('gust');
      for (let i = 0; i < 18; i++) fx.push({ x: P.x * TS + HT + dx * HT, y: P.y * TS + HT + dy * HT, vx: dx * rand(1.5, 3) + rand(-0.4, 0.4), vy: dy * rand(1.5, 3) + rand(-0.4, 0.4), life: 0.8, col: pick(['#dffff4', '#ffffff', '#8ff0c8']), s: 1 });
      await sleep(200);
      if (occ || !(WALK_GROUND.has(dc) || dc === 'P' || dc === '~')) { sfx('buzz'); await say("The boulder won't budge that way."); return false; }
      setTile(x, y, cur.def.ground);
      cur.moving = { x, y, tx: nx, ty: ny, t: 0 };
      sfx('thud'); await sleep(240); cur.moving = null;
      if (dc === 'P') { setTile(nx, ny, 'p'); sfx('thud'); dust(nx, ny, '#a8a0b8'); await say('The boulder filled the pit!'); }
      else if (dc === '~') { setTile(nx, ny, 'o'); dust(nx, ny, '#c8e8ff'); }
      else { setTile(nx, ny, 'O'); dust(nx, ny, '#c8b89a'); }
      return true;
    } },
  kindle: { name: 'Kindle', fp: 2, user: 'bram',
    async apply(x, y) {
      sfx('fire');
      for (let i = 0; i < 40; i++) fx.push({ x: x * TS + rand(2, 30), y: y * TS + rand(6, 30), vx: rand(-0.3, 0.3), vy: rand(-1.2, -0.3), life: rand(0.6, 1), col: pick(['#ff7a3a', '#ffcf40', '#ff4020', '#fff0a0']), s: 1 });
      await sleep(550);
      setTile(x, y, cur.def.ground); dust(x, y, '#5a4a40');
      return true;
    } },
  pick: { name: 'Skeleton Key', fp: 0, user: 'corin',
    async apply(x, y) {
      sfx('blip'); await sleep(250); sfx('blip'); await sleep(250);
      setTile(x, y, 'C'); sfx('chest'); await sleep(200);
      await openChest(x, y);
      return true;
    } },
  bloom: { name: 'Lilypad', fp: 2, user: 'tamsin',
    async apply(x, y, dx, dy) {
      for (let i = 0; i < 8 && tileAt(x, y) === '~'; i++) { setTile(x, y, '%'); sfx('bloom'); dust(x, y, '#9ae86a'); await sleep(120); x += dx; y += dy; }
      return true;
    } },
};
function dust(x, y, col) { for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), s = rand(0.3, 1.2); fx.push({ x: x * TS + HT, y: y * TS + 22, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 0.3, life: 1, col, s: 1 }); } }
async function usePower(p, x, y) {
  const pw = POWERS[p];
  const m = state.party.find((h) => HEROES[h.id].field === p);
  if (m.fp < pw.fp) { await say(`${hname(m)} is out of focus (FP). Walk around a bit, rest at the inn, or drink some Focus Tea.`); return; }
  toast(`${hname(m)}: ${pw.name}!`, 900);
  const [dx, dy] = DIRS[P.dir];
  if (await pw.apply(x, y, dx, dy)) m.fp -= pw.fp;
}

// ---------- map rendering ----------
let lastMapT = 0;
function renderMap() {
  const dt = Math.min(50, T - (lastMapT || T)); lastMapT = T;
  W3D.syncMap(dt, { cur, P, state, T, dirTo, running: held.b || stickRun });
  bx.clearRect(0, 0, W, H);
  const cx = (P.x - 7) * TS, cy = (P.y - 8) * TS; VW = 14 * TS; VH = 16 * TS;
  ambient(cx, cy);
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i]; p.x += p.vx; p.y += p.vy; p.life -= p.amb ? 0.004 : 0.022;
    if (p.amb) p.vx += Math.sin(T / 600 + p.seed) * 0.004;
    if (p.life <= 0 || p.x < cx - 60 || p.x > cx + VW + 60 || p.y < cy - 60 || p.y > cy + VH + 60) { fx.splice(i, 1); continue; }
    const sp = W3D.toScreen(p.x / TS, p.amb ? 1.6 : 0.5, p.y / TS);
    bx.globalAlpha = Math.min(1, p.life * 1.5); bx.fillStyle = p.col; bx.fillRect(Math.round(sp.x), Math.round(sp.y), (p.s || 1) + 1, (p.s || 1) + 1); bx.globalAlpha = 1;
  }
  if (P.marker) {
    const sp = W3D.toScreen(P.marker.x + 0.5, 0.05, P.marker.y + 0.5), r = 9 + Math.sin(T / 150) * 1.5;
    bx.strokeStyle = 'rgba(255,242,192,0.9)'; bx.lineWidth = 1.5; bx.beginPath(); bx.ellipse(sp.x, sp.y, r, r * 0.55, 0, 0, 6.3); bx.stroke();
  }
  const f = !busy && !P.moving && !UI.dialog && !UI.menus.length && !P.path.length ? facingTarget() : null;
  if (f) {
    const sp = W3D.toScreen(f.x + 0.5, f.kind === 'talk' ? 1.75 : 1.15, f.y + 0.5);
    const ox = Math.round(sp.x), oy = Math.round(sp.y + Math.sin(T / 200));
    bx.fillStyle = OUTLINE_COL; bx.fillRect(ox - 8, oy - 8, 17, 13); bx.fillRect(ox - 2, oy + 5, 5, 3);
    bx.fillStyle = '#fff8e8'; bx.fillRect(ox - 7, oy - 7, 15, 11); bx.fillRect(ox - 1, oy + 4, 3, 3);
    if (f.kind === 'talk') { bx.fillStyle = '#3a2a4a'; for (const d of [-4, 0, 4]) bx.fillRect(ox + d - 1, oy - 2, 2, 2); }
    else if (f.kind === 'power') { bx.fillStyle = ELEM_TEXT[HEROES[POWERS[f.p].user].elem]; bx.fillRect(ox - 1, oy - 6, 3, 9); bx.fillRect(ox - 4, oy - 3, 9, 3); }
    else { bx.fillStyle = '#e05a3a'; bx.fillRect(ox - 1, oy - 6, 2, 6); bx.fillRect(ox - 1, oy + 1, 2, 2); }
    setButtonHints(A_LABELS[f.kind], f.kind === 'power');
  } else setButtonHints('Action', false);
}
function ambient(cx, cy) {
  const kind = cur.def.ambient; if (!kind) return;
  let count = 0; for (const p of fx) if (p.amb) count++;
  if (count < (kind === 'motes' ? 26 : 18) && Math.random() < 0.25) {
    const p = { amb: true, seed: rand(0, 100), x: cx + rand(-20, VW + 20), y: cy + rand(-20, VH), life: rand(1.4, 2.5), s: 1 };
    if (kind === 'petals') { p.vx = rand(0.2, 0.5); p.vy = rand(0.08, 0.25); p.col = pick(['#ffd0e0', '#ffffff', '#ffe890']); }
    else if (kind === 'leaves') { p.vx = rand(0.15, 0.4); p.vy = rand(0.1, 0.3); p.col = pick(['#e8a040', '#c86a30', '#a8c850']); p.s = 2; }
    else { p.vx = rand(-0.08, 0.08); p.vy = rand(-0.15, -0.03); p.col = pick(['#a8f0ff', '#d0b8ff', '#ffffff']); }
    fx.push(p);
  }
}
function drawMapHUD() {
  if (UI.banner) {
    const b = UI.banner, a = clamp(Math.min(b.t / 400, (2600 - b.t) / 300), 0, 1);
    ctx.globalAlpha = a; font(11, true); const w = ctx.measureText(b.text).width + 30;
    box((W - w) / 2, 6, w, 24, { dark: true }); text(b.text, W / 2, 22, '#ffd36a', 'center');
    ctx.globalAlpha = 1;
  } else if (!UI.dialog && !UI.menus.length && !busy && !UI.toast) {
    font(8); const g = goalText(), w = Math.min(W - 8, ctx.measureText(g).width + 20);
    ctx.globalAlpha = UI.goalT > 0 ? 1 : 0.82;
    box(4, 3, w + 4, 20);
    poly([11, 9, 14, 12.5, 11, 16, 8, 12.5], COL.gold);
    text(g, 18, 16, COL.text);
    ctx.globalAlpha = 1;
  }
}

// ===================== BATTLE =====================
function makeEnemy(id) {
  const d = ENEMIES[id], sz = { w: 40, h: 40 };
  return { id, d, sz, name: d.name, hp: d.hp, maxhp: d.hp, atk: d.atk, def: d.def, agi: d.agi, x: 0, y: 0, flash: 0, shake: 0, alive: true, dying: 0, lunge: 0 };
}
const bY = () => Math.round(H * 0.6) + 6;
let HERO_H = 40;
const BS = () => HERO_H / 16; // floating numbers etc. are offset by the hero's on-screen height
const heroPos = (i) => (state.party.length > 3 ? { x: 178 + i * 26, y: bY() - 34 + i * 21 } : { x: 198 + i * 30, y: bY() - 24 + i * 24 });
const enemyHit = (e) => ({ x: e.x, y: e.y - e.sz.h * 0.5 - (e.d.float ? 14 : 0) });
function anim(name, x, y, sc = 2, ms = 60) { if (B) B.anims.push({ name, x, y, sc, ms, t: 0 }); }
async function msg(t, ms = 650) { B.msg = t; await waitOrTap(ms + t.length * 12); }

async function fight(ids, opt = {}) {
  const snap = JSON.stringify(state);
  while (true) {
    const r = await battle(ids, opt);
    if (r !== 'lose') return r;
    const c = await choose(['Try again', 'Return to the inn'], { title: 'Defeated...', x: W / 2 - 64, y: Math.round(H / 2 - 40), w: 128, cancel: false });
    state = JSON.parse(snap);
    if (c === 0) continue;
    await fade(1);
    for (const m of state.party) { const s = stats(m); m.hp = s.hp; m.fp = s.fp; }
    B = null; W3D.battleEnd(); game.scene = 'map';
    loadMap('inn'); placePlayer(4, 5, 'up');
    saveGame();
    await fade(0);
    await say("Oh, you poor dears! Rest up. You're always welcome at the Sleepy Kettle.", 'marta');
    return 'lose';
  }
}
async function battle(ids, opt = {}) {
  B = { enemies: ids.map(makeEnemy), fx: [], floats: [], msg: '', guard: {}, buffs: {}, active: -1, target: null, allyTarget: null,
    boss: !!opt.boss, bg: opt.bg || 'field', lastCmd: {}, heroShake: {}, heroStep: {}, shake: 0, cutin: null, result: null, anims: [] };
  const cnt = {}, seen = {};
  B.enemies.forEach((e) => (cnt[e.id] = (cnt[e.id] || 0) + 1));
  B.enemies.forEach((e) => { if (cnt[e.id] > 1) { seen[e.id] = (seen[e.id] || 0) + 1; e.name += ' ' + 'ABC'[seen[e.id] - 1]; } });
  layoutEnemies();
  if (state.party.some((m) => isCls(m, 'ranger'))) B.enemies.forEach((e) => (state.known[e.id] = true));
  B.regen = {}; B.taunt = null;
  HERO_H = W3D.battleStart(B, state.party, heroPos).heroH;
  sfx('encounter');
  UI.flashCol = '#fff';
  for (let i = 0; i < 2; i++) { UI.flash = 0.9; await sleep(130); }
  await fade(1);
  game.scene = 'battle';
  music(opt.boss ? 'boss' : 'battle');
  await fade(0);
  await msg(B.enemies.map((e) => e.name).join(', ') + (B.enemies.length > 1 ? ' appear!' : ' appears!'), 500);
  let result = null;
  while (!result) {
    B.guard = {};
    let acts = await commandPhase();
    if (acts === 'flee') {
      if (B.boss) { await msg("There's no running from this one!"); acts = []; }
      else if (Math.random() < 0.7) { sfx('cancel'); await msg('Got away safely!'); result = 'flee'; break; }
      else { await msg("Couldn't get away!"); acts = []; }
    }
    for (const e of B.enemies) if (e.alive) { acts.push({ type: 'enemy', actor: e }); if (e.d.twice && e.hp < e.maxhp / 2) acts.push({ type: 'enemy', actor: e }); }
    acts.forEach((a) => (a.spd = (a.type === 'guard' ? 9999 : a.type === 'enemy' ? a.actor.agi : stats(a.actor).agi) * rand(0.8, 1.2)));
    acts.sort((a, b) => b.spd - a.spd);
    for (const a of acts) { await doAction(a); result = checkEnd(); if (result) break; }
    if (!result) await endRound();
  }
  if (result === 'win') await victory();
  if (result === 'lose') { sfx('down'); await msg('The party has fallen...', 900); return 'lose'; }
  for (const m of state.party) { if (m.hp <= 0) m.hp = 1; clampHero(m); }
  await fade(1);
  B = null; W3D.battleEnd(); game.scene = 'map'; music(cur.def.music);
  await fade(0);
  return result;
}
function layoutEnemies() {
  const al = B.enemies, n = al.length;
  const xs = [[86], [56, 122], [48, 104, 148]][n - 1] || [86];
  const ys = [[0], [-14, 14], [16, -22, 22]][n - 1] || [0];
  al.forEach((e, i) => { e.x = e.d.boss ? 96 : xs[i]; e.y = e.d.boss ? bY() + 6 : bY() + ys[i]; });
}
function checkEnd() { if (B.enemies.every((e) => !e.alive)) return 'win'; if (state.party.every((m) => m.hp <= 0)) return 'lose'; return null; }
async function endRound() {
  for (const id in B.buffs) for (const k in B.buffs[id]) if (--B.buffs[id][k] <= 0) delete B.buffs[id][k];
  if (B.taunt && --B.taunt.n <= 0) B.taunt = null;
  for (const e of B.enemies) if (e.debuff && --e.debuff.def <= 0) e.debuff = null;
  for (const m of state.party) {
    const r = B.regen[m.id];
    if (r && m.hp > 0) { healHero(m, Math.max(1, Math.round(stats(m).hp * 0.1 * r.k)), true); }
    if (r && --r.n <= 0) delete B.regen[m.id];
    if (isCls(m, 'mage') && m.hp > 0) m.fp = Math.min(stats(m).fp, m.fp + 2);
  }
  for (const m of state.party) {
    if (m.hp <= 0) continue;
    const t = trinketOf(m), s = stats(m);
    if (t && t.regen && m.hp < s.hp) healHero(m, Math.max(1, Math.round(s.hp * t.regen)), true);
    if (t && t.fpRegen) m.fp = Math.min(s.fp, m.fp + t.fpRegen);
  }
  for (const m of state.party) clampHero(m);
}
async function commandPhase() {
  const alive = state.party.map((m, i) => i).filter((i) => state.party[i].hp > 0);
  const acts = []; let k = 0;
  B.msg = '';
  const harmonyStart = state.harmony;
  while (k < alive.length) {
    const i = alive[k], m = state.party[i];
    B.active = i;
    const a = await chooseCommand(m, i, k === 0);
    if (a === 'back') { if (k > 0) { k--; const p = acts.pop(); if (p && p.type === 'burst') state.harmony = harmonyStart; } continue; }
    if (a === 'flee') { B.active = -1; return 'flee'; }
    if (a === 'auto') { B.active = -1; return alive.map((j) => ({ type: 'attack', actor: state.party[j], target: pick(B.enemies.filter((e) => e.alive)) })); }
    acts.push(a); k++;
    if (a.type === 'burst') state.harmony = 0;
  }
  B.active = -1;
  return acts;
}
async function chooseCommand(m, i, first) {
  const cmds = [['Attack', 'attack'], ['Skills', 'skills'], ['Items', 'items'], ['Guard', 'guard'], ['Burst', 'burst'], [first ? 'Auto' : 'Back', first ? 'auto' : 'back'], ['Flee', 'flee']];
  while (true) {
    const full = state.harmony >= 100, bu = BURSTS[HEROES[m.id].burst];
    const desc = { attack: 'Strike one foe with your weapon.', skills: `Use a skill. (FP ${m.fp}/${stats(m).fp})`, items: 'Use an item from your bag.', guard: 'Halve damage this round and regain 2 FP.',
      burst: full ? `${bu.name}: ${bu.desc}` : 'Fill the Harmony gauge (top right) to unleash a Burst.', auto: 'Everyone attacks this round.', back: 'Go back to the previous hero.', flee: 'Try to run away.' };
    const c = await choose(cmds.map((c) => ({ label: c[0], disabled: (c[1] === 'flee' && !first) || (c[1] === 'burst' && !full), color: c[1] === 'burst' && full ? COL.gold : null, desc: desc[c[1]] })),
      { x: 140, y: H - (state.party.length > 3 ? 54 : 47), w: 146, cols: 3, cursor: B.lastCmd[i] || 0, max: 3, cancel: !first });
    if (c < 0) return 'back';
    B.lastCmd[i] = c;
    const key = cmds[c][1];
    if (key === 'back' || key === 'auto' || key === 'flee') return key;
    if (key === 'attack') { const t = await pickEnemy(); if (t) return { type: 'attack', actor: m, target: t }; continue; }
    if (key === 'guard') return { type: 'guard', actor: m };
    if (key === 'burst') { const tg = await pickTargets(bu.target); if (tg == null) continue; return { type: 'burst', actor: m, target: tg }; }
    if (key === 'skills') {
      const list = skillsOf(m);
      const j = await choose(list.map((id) => ({ label: SKILLS[id].name, right: SKILLS[id].hpCost ? Math.round(SKILLS[id].hpCost * 100) + '% HP' : SKILLS[id].fp + ' FP', disabled: SKILLS[id].fp > m.fp, desc: SKILLS[id].desc, color: SKILLS[id].type === 'dmg' ? null : '#c8f0d0' })),
        { x: 2, bottom: H - 1, w: 136, title: `${hname(m)}'s Skills`, max: 4, cursor: (B.lastSk && B.lastSk[i]) || 0 });
      if (j < 0) continue;
      (B.lastSk = B.lastSk || {})[i] = j;
      const tg = await pickTargets(SKILLS[list[j]].target); if (tg == null) continue;
      return { type: 'skill', actor: m, skill: list[j], target: tg };
    }
    if (key === 'items') {
      const list = Object.keys(state.items).filter((id) => ITEMS[id].use);
      if (!list.length) { toast('No usable items.'); continue; }
      const j = await choose(list.map((id) => ({ label: ITEMS[id].name, right: '×' + state.items[id], icon: ART.icon(ITEMS[id].icon), desc: ITEMS[id].desc })), { x: 2, bottom: H - 1, w: 136, title: 'Items', max: 4 });
      if (j < 0) continue;
      const tg = await pickTargets(ITEMS[list[j]].target); if (tg == null) continue;
      return { type: 'item', actor: m, item: list[j], target: tg };
    }
  }
}
async function pickEnemy() {
  const al = B.enemies.filter((e) => e.alive);
  if (al.length === 1) return al[0];
  const extraHits = al.map((e, i) => ({ x: e.x - e.sz.w / 2, y: e.y - e.sz.h - 6, w: e.sz.w, h: e.sz.h + 10, index: i }));
  const j = await choose(al.map((e) => ({ label: e.name, right: `${Math.ceil((e.hp / e.maxhp) * 100)}%`, desc: state.known[e.id] ? `${e.d.name}: weak to ${ELEM_NAME[e.d.weak]}${e.d.resist ? ', resists ' + ELEM_NAME[e.d.resist] : ''}.` : 'Tap an enemy, or pick one from the list.' })),
    { x: 2, bottom: H - 1, w: 136, title: 'Target', max: 4, extraHits, onHover: (k) => (B.target = al[k]) });
  B.target = null;
  return j < 0 ? null : al[j];
}
async function pickAlly(dead) {
  const list = state.party.filter((m) => (dead ? m.hp <= 0 : m.hp > 0));
  if (!list.length) { toast(dead ? 'Nobody needs reviving.' : 'No valid target.'); return null; }
  const j = await choose(list.map((m) => ({ label: hname(m), right: `${m.hp}/${stats(m).hp}`, rightColor: COL.hp })), { x: 2, bottom: H - 1, w: 136, title: 'Who?', max: 4, onHover: (k) => (B.allyTarget = list[k]) });
  B.allyTarget = null;
  return j < 0 ? null : list[j];
}
async function pickTargets(type) {
  if (type === 'enemy') return pickEnemy();
  if (type === 'ally') return pickAlly(false);
  if (type === 'deadAlly') return pickAlly(true);
  return 'all';
}
function physDmg(atk, def) { return Math.max(1, Math.round((atk - def * 0.5) * rand(0.85, 1.15))); }
const isCls = (m, k) => HEROES[m.id].cls === k;
const defOf = (e) => e.def * (e.debuff && e.debuff.def ? 0.5 : 1);
// class passives that scale damage dealt to a foe
function dmgMul(m, t) { let k = 1; if (isCls(m, 'berserker') && m.hp < stats(m).hp / 2) k *= 1.3; if (isCls(m, 'ranger') && t.debuff) k *= 1.25; return k; }
const healMul = (m) => (isCls(m, 'druid') ? 1.25 : 1);
function enemyTarget(targets) {
  if (B.taunt) { const tm = targets.find((m) => m.id === B.taunt.id); if (tm && Math.random() < 0.8) return tm; }
  return pick(targets);
}
const dodges = (m) => B.buffs[m.id] && B.buffs[m.id].eva && Math.random() < 0.35;
function buffMul(m, k) { return B.buffs[m.id] && B.buffs[m.id][k] ? (k === 'def' ? 1.5 : 1.3) : 1; }
function elemMul(t, elem) { if (!elem) return 1; return t.d.weak === elem ? 1.5 : t.d.resist === elem ? 0.5 : 1; }
function retarget(t) { if (t && t.alive) return t; const al = B.enemies.filter((e) => e.alive); return al.length ? pick(al) : null; }
function float(x, y, txt, col, big) { B.floats.push({ x, y, txt, col, t: 0, big }); }
function gainHarmony(n) { const was = state.harmony; state.harmony = Math.min(100, state.harmony + n); if (was < 100 && state.harmony >= 100) { sfx('trinket'); float(W - 44, 32, 'Burst ready!', COL.gold); } }
function bfx(x, y, col, n = 16, spd = 2, up = 0, g = 0) { for (let i = 0; i < n; i++) { const a = rand(0, 6.28), s = rand(0.3, spd); B.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: 1, col, s: ri(1, 2), g }); } }
function elemFx(x, y, elem, big) {
  const map = { ember: 'ember', bloom: 'bloom', gale: 'gale', hush: 'hush' };
  anim(map[elem] || 'hush', x, y, (big ? 1.5 : 1) * BS(), 55);
  const col = { ember: ['#ff7a3a', '#ffcf40', '#fff0a0'], gale: ['#dffff4', '#8ff0c8', '#ffffff'], bloom: ['#9ae86a', '#5aa848', '#ffffff'], hush: ['#d8d0ff', '#a090e0', '#ffffff'] }[elem] || ['#fff'];
  for (let i = 0; i < (big ? 24 : 12); i++) { const a = rand(0, 6.28), sp = rand(0.4, 2); B.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 1, col: pick(col), s: ri(1, 2) }); }
}
async function hitEnemy(t, dmg, note) {
  t.hp = Math.max(0, t.hp - dmg); t.flash = 240; t.shake = 260;
  const p = enemyHit(t);
  float(p.x, p.y - 4, String(dmg), '#fff', dmg >= 60);
  if (note) float(p.x, p.y - 16, note, note === 'Weak!' ? COL.gold : '#c8c0e0');
  if (note === 'Weak!') state.known[t.id] = true;
  gainHarmony(note === 'Weak!' ? 12 : 8);
  if (t.hp <= 0 && t.alive) {
    t.alive = false; t.dying = 1;
    for (let i = 0; i < 30; i++) B.fx.push({ x: t.x + rand(-t.sz.w / 2, t.sz.w / 2), y: t.y - rand(0, t.sz.h), vx: rand(-0.6, 0.6), vy: rand(-1.4, -0.2), life: 1, col: pick(['#ffffff', '#e8e0ff', '#c8c0e0']), s: 1 });
    await sleep(260); sfx('down');
  }
}
async function hitHero(m, dmg) {
  if (B.guard[m.id]) dmg = Math.max(1, Math.round(dmg / 2));
  if (isCls(m, 'warden')) dmg = Math.max(1, Math.round(dmg * 0.85));
  m.hp = Math.max(0, m.hp - dmg);
  const hp = heroPos(state.party.indexOf(m));
  B.heroShake[m.id] = 320;
  float(hp.x, hp.y - 14 * BS(), String(dmg), '#ff9a9a', dmg >= 40);
  gainHarmony(6);
  if (m.hp <= 0) { sfx('down'); await sleep(200); await msg(`${hname(m)} is down!`, 300); }
}
function healHero(m, amt, quiet) {
  const s = stats(m), before = m.hp;
  m.hp = Math.min(s.hp, m.hp + amt);
  const hp = heroPos(state.party.indexOf(m));
  float(hp.x, hp.y - 14 * BS(), '+' + (m.hp - before), COL.hp);
  if (!quiet) { anim('heal', hp.x, hp.y - 8 * BS(), BS() * 0.75, 70); for (let k = 0; k < 10; k++) B.fx.push({ x: hp.x + rand(-9, 9), y: hp.y - rand(0, 26), vx: 0, vy: rand(-1, -0.3), life: 1, col: pick(['#9aff9a', '#e0ffe0', '#ffffff']), s: 1 }); }
}
async function doAction(a) {
  if (a.type === 'enemy') return enemyAct(a.actor);
  const m = a.actor; if (m.hp <= 0) return;
  const s = stats(m), name = hname(m);
  if (a.type === 'guard') { B.guard[m.id] = true; m.fp = Math.min(s.fp, m.fp + 2); B.msg = `${name} guards.`; await sleep(350); return; }
  if (a.type === 'attack') {
    const t = retarget(a.target); if (!t) return;
    B.msg = `${name} attacks!`; B.heroStep[m.id] = 380; await sleep(200);
    let dmg = Math.round(physDmg(s.atk * buffMul(m, 'atk'), defOf(t)) * dmgMul(m, t)), note = null;
    if (Math.random() < (isCls(m, 'rogue') ? 0.25 : 0.08)) { dmg = Math.round(dmg * 1.6); note = 'Critical!'; sfx('crit'); B.shake = 200; } else sfx('hit');
    const p = enemyHit(t);
    anim('slash', p.x, p.y, BS(), 45);
    await hitEnemy(t, dmg, note);
    await sleep(320);
    return;
  }
  if (a.type === 'skill') {
    const sk = SKILLS[a.skill];
    if (m.fp < sk.fp) { await msg(`${name} doesn't have enough FP!`); return; }
    if (sk.hpCost) {
      const cost = Math.ceil(stats(m).hp * sk.hpCost);
      if (m.hp <= cost) { await msg(`${name} is too hurt for that!`); return; }
      m.hp -= cost; const h = heroPos(state.party.indexOf(m)); float(h.x, h.y - 14 * BS(), '-' + cost, '#ff9a9a');
    }
    m.fp -= sk.fp;
    await castEffect(m, `${name}: ${sk.name}!`, sk, a.target, s, 1);
    return;
  }
  if (a.type === 'burst') {
    const b = BURSTS[HEROES[m.id].burst];
    sfx('burst'); B.cutin = { look: HEROES[m.id].look, name: b.name, t: 0 }; B.shake = 400;
    await sleep(950); B.cutin = null;
    await castEffect(m, `${name}: ${b.name}!`, b, a.target, s, 2);
    return;
  }
  if (a.type === 'item') {
    const it = ITEMS[a.item];
    if (!state.items[a.item]) { await msg(`No ${it.name} left!`); return; }
    removeItem(a.item);
    B.msg = `${name} uses ${it.name}.`; await sleep(380); sfx('heal');
    const t = a.target;
    if (it.use === 'heal' && t.hp > 0) healHero(t, it.power);
    else if (it.use === 'fp' && t.hp > 0) { const b = t.fp; t.fp = Math.min(stats(t).fp, t.fp + it.power); const hp = heroPos(state.party.indexOf(t)); float(hp.x, hp.y - 14 * BS(), '+' + (t.fp - b) + ' FP', COL.fp); }
    else if (it.use === 'revive' && t.hp <= 0) { t.hp = Math.ceil(stats(t).hp / 2); await msg(`${hname(t)} is back on their feet!`, 300); }
    else if (it.use === 'healAll') state.party.filter((p) => p.hp > 0).forEach((p) => healHero(p, it.power));
    await sleep(550);
  }
}
async function castEffect(m, label, eff, target, s, mode) {
  B.msg = label; sfx('magic');
  const hp = heroPos(state.party.indexOf(m));
  B.heroStep[m.id] = 500;
  bfx(hp.x, hp.y - 12, ELEM_COL[eff.elem] || '#fff', 16, 1.4, 0.6);
  await sleep(420);
  if (eff.type === 'dmg') {
    const all = target === 'all', alive = () => B.enemies.filter((e) => e.alive);
    const targets = all ? alive() : [retarget(target)].filter(Boolean);
    const tr = trinketOf(m), tm = mode === 1 && tr && tr.skillMul ? tr.skillMul : 1;
    const base = (eff.phys ? eff.power + s.atk * buffMul(m, 'atk') * 0.9 + m.lv * 1.2 : eff.power + s.atk * buffMul(m, 'atk') * 0.3 + m.lv * (mode === 2 ? 2.5 : 1.5)) * tm;
    const hits = eff.hits || 1;
    const sound = () => sfx(eff.phys && !eff.elem ? 'hit' : eff.elem === 'ember' ? 'fire' : eff.elem === 'gale' ? 'gust' : 'bloom');
    if (hits === 1) { targets.forEach((t) => { const p = enemyHit(t); if (eff.elem) elemFx(p.x, p.y, eff.elem, mode === 2); else anim('slash', p.x, p.y, BS(), 45); }); sound(); if (mode === 2) B.shake = 350; await sleep(380); }
    let total = 0;
    for (let h = 0; h < (hits === 1 ? targets.length : hits); h++) {
      const t = hits === 1 ? targets[h] : all ? pick(alive()) : retarget(targets[0]);
      if (!t || !t.alive) break;
      if (hits > 1) { const p = enemyHit(t); if (eff.elem) elemFx(p.x, p.y, eff.elem, false); else anim('slash', p.x, p.y, BS(), 40); sound(); await sleep(150); }
      const mul = elemMul(t, eff.elem);
      let dmg = (base * mul * dmgMul(m, t) - defOf(t) * (eff.phys ? 0.5 : 0.3)) * rand(0.9, 1.1), note = mul > 1 ? 'Weak!' : mul < 1 ? 'Resisted' : null;
      if (eff.crit) { dmg *= 1.5; note = 'Critical!'; sfx('crit'); B.shake = 200; }
      dmg = Math.max(1, Math.round(dmg)); total += dmg;
      await hitEnemy(t, dmg, note);
      if (eff.steal && !t.robbed) {
        t.robbed = true; const g = ri(4, 9) + Math.round(t.d.gold * 0.6); state.gold += g;
        const p = enemyHit(t); float(p.x, p.y - 26, `+${g} coins`, COL.gold);
        if (Math.random() < 0.3) { const it = pick(['herb', 'tea']); addItem(it); await msg(`${hname(m)} swiped ${g} coins and a ${ITEMS[it].name}!`, 300); }
        else await msg(`${hname(m)} swiped ${g} coins!`, 250);
      }
    }
    if (eff.drain && total > 0 && m.hp > 0) healHero(m, Math.round(total * 0.5), true);
  } else if (eff.type === 'taunt') {
    sfx('heal'); B.taunt = { id: m.id, n: 3 }; (B.buffs[m.id] = B.buffs[m.id] || {}).def = 3;
    const h = heroPos(state.party.indexOf(m)); float(h.x, h.y - 14 * BS(), 'TAUNT', COL.gold); bfx(h.x, h.y - 10, '#c8e0ff', 14);
    await msg(`${hname(m)} draws the enemies' attention!`, 250);
  } else if (eff.type === 'debuff') {
    const t = retarget(target);
    if (t) {
      t.debuff = { def: 3 }; state.known[t.id] = true; sfx('crit');
      const p = enemyHit(t); float(p.x, p.y - 16, 'DEF ↓', '#ff9a6a'); bfx(p.x, p.y, '#ff9a6a', 14);
      await msg(`${t.name} is marked! Weak to ${ELEM_NAME[t.d.weak]}.`, 300);
    }
  } else if (eff.type === 'regen') {
    sfx('heal');
    for (const p of state.party) if (p.hp > 0) { B.regen[p.id] = { n: 3, k: healMul(m) }; const h = heroPos(state.party.indexOf(p)); float(h.x, h.y - 14 * BS(), 'REGEN', COL.hp); bfx(h.x, h.y - 10, ELEM_COL.bloom, 10); }
    await msg('Roots of light wrap around the party!', 250);
  } else if (eff.type === 'aegis') {
    sfx('heal');
    for (const p of state.party) if (p.hp > 0) { healHero(p, Math.round(stats(p).hp * 0.4)); (B.buffs[p.id] = B.buffs[p.id] || {}).def = 3; }
    await msg("The party's defense rose!", 250);
  } else if (eff.type === 'heal') {
    sfx('heal');
    const amt = (eff.power + m.lv * 3) * healMul(m);
    (target === 'all' ? state.party.filter((p) => p.hp > 0) : [target].filter((p) => p.hp > 0)).forEach((t) => healHero(t, Math.round(amt * rand(0.95, 1.05))));
  } else if (eff.type === 'fullheal') {
    sfx('heal');
    for (const p of state.party) { if (p.hp <= 0) p.hp = 1; healHero(p, stats(p).hp); p.fp = Math.min(stats(p).fp, p.fp + 5); }
  } else if (eff.type === 'buff') {
    sfx('heal');
    for (const p of state.party) if (p.hp > 0) { (B.buffs[p.id] = B.buffs[p.id] || {})[eff.stat] = 3; const h = heroPos(state.party.indexOf(p)); float(h.x, h.y - 14 * BS(), eff.stat.toUpperCase() + ' ↑', COL.gold); bfx(h.x, h.y - 10, ELEM_COL[eff.elem], 10); }
    await msg(eff.stat === 'atk' ? "The party's attack rose!" : eff.stat === 'eva' ? 'Smoke hides the party!' : "The party's defense rose!", 250);
  } else if (eff.type === 'revive') {
    if (target.hp <= 0) { sfx('heal'); target.hp = Math.ceil(stats(target).hp / 2); const h = heroPos(state.party.indexOf(target)); bfx(h.x, h.y - 10, '#ffffff', 20); await msg(`${hname(target)} is back on their feet!`, 300); }
  }
  await sleep(500);
}
async function enemyAct(e) {
  if (!e.alive) return;
  const targets = state.party.filter((m) => m.hp > 0); if (!targets.length) return;
  const art = (e.d.arts || []).find((a) => Math.random() < a.chance);
  e.lunge = 300;
  if (art) {
    B.msg = `${e.name}: ${art.name}!`; sfx('magic'); await sleep(420);
    const tg = art.target === 'all' ? targets : [enemyTarget(targets)];
    tg.forEach((t) => { const h = heroPos(state.party.indexOf(t)); elemFx(h.x, h.y - 10, art.elem); });
    sfx('hit'); await sleep(280);
    let total = 0;
    for (const t of tg) {
      if (dodges(t)) { const h = heroPos(state.party.indexOf(t)); float(h.x, h.y - 14 * BS(), 'Miss', '#c8e8ff'); continue; }
      const st = stats(t), res = HEROES[t.id].elem === art.elem ? 0.75 : 1;
      const dmg = Math.max(1, Math.round(((art.power + e.atk * 0.4) * res - st.def * buffMul(t, 'def') * 0.3) * rand(0.9, 1.1)));
      total += dmg; await hitHero(t, dmg);
    }
    if (art.drain) { const h = Math.round(total * 0.5); e.hp = Math.min(e.maxhp, e.hp + h); const p = enemyHit(e); float(p.x, p.y - 20, '+' + h, COL.hp); }
  } else {
    const t = enemyTarget(targets);
    B.msg = `${e.name} attacks ${hname(t)}!`; await sleep(300);
    const h = heroPos(state.party.indexOf(t));
    if (dodges(t)) { sfx('cancel'); float(h.x, h.y - 14 * BS(), 'Miss', '#c8e8ff'); await sleep(360); return; }
    sfx('hit');
    bfx(h.x, h.y - 10, '#ffffff', 10, 1.6);
    await hitHero(t, physDmg(e.atk, stats(t).def * buffMul(t, 'def')));
  }
  await sleep(360);
}
async function victory() {
  music('victory');
  const xp = B.enemies.reduce((a, e) => a + e.d.xp, 0), gold = B.enemies.reduce((a, e) => a + e.d.gold, 0);
  state.gold += gold;
  const ups = [];
  for (const m of state.party) {
    if (m.hp <= 0) continue;
    m.xp += xp;
    while (m.xp >= xpNext(m.lv)) {
      m.xp -= xpNext(m.lv);
      const before = stats(m), old = skillsOf(m); m.lv++;
      const after = stats(m); m.hp += after.hp - before.hp; m.fp += after.fp - before.fp;
      ups.push(`${hname(m)} reached Lv ${m.lv}!  HP +${after.hp - before.hp}  ATK +${after.atk - before.atk}`);
      for (const a of skillsOf(m)) if (!old.includes(a)) ups.push(`${hname(m)} learned ${SKILLS[a].name}!`);
    }
  }
  let drop = null;
  if (!B.boss && Math.random() < 0.2) { drop = pick(['herb', 'herb', 'tea']); addItem(drop); }
  B.result = { xp, gold, ups, drop };
  B.msg = '';
  if (ups.length) { sfx('level'); setTimeout(() => music('level'), 1600); }
  await waitKey();
  B.result = null;
}

// ---------- battle render ----------
function hexRgb(h) { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function renderBattle(dt) {
  bx.clearRect(0, 0, W, H);
  B.shake = Math.max(0, B.shake - dt);
  for (const e of B.enemies) { e.flash = Math.max(0, e.flash - dt); e.shake = Math.max(0, e.shake - dt); e.lunge = Math.max(0, e.lunge - dt); if (!e.alive) e.dying = Math.max(0, e.dying - dt / 450); }
  W3D.battleSync(dt, B, state.party, T);
  state.party.forEach((m, i) => {
    B.heroShake[m.id] = Math.max(0, (B.heroShake[m.id] || 0) - dt); B.heroStep[m.id] = Math.max(0, (B.heroStep[m.id] || 0) - dt);
    const p = heroPos(i);
    if (B.guard[m.id]) { bx.strokeStyle = 'rgba(150,220,255,0.8)'; bx.lineWidth = 1.5; bx.beginPath(); bx.ellipse(p.x, p.y - HERO_H * 0.45, HERO_H * 0.5, HERO_H * 0.62, 0, 0, 6.3); bx.stroke(); }
    if (B.allyTarget === m) { const b = Math.round(Math.sin(T / 120) * 2), ay = p.y - HERO_H - 10 + b; bx.fillStyle = OUTLINE_COL; bx.fillRect(p.x - 5, ay - 1, 11, 4); bx.fillStyle = '#ffd36a'; bx.fillRect(p.x - 4, ay, 9, 2); bx.fillRect(p.x - 2, ay + 2, 5, 1); bx.fillRect(p.x - 1, ay + 3, 3, 1); bx.fillRect(p.x, ay + 4, 1, 1); }
  });
  for (let i = B.anims.length - 1; i >= 0; i--) {
    const a = B.anims[i]; a.t += dt;
    const f = Math.floor(a.t / a.ms);
    if (f >= ART.fxFrames(a.name)) { B.anims.splice(i, 1); continue; }
    const im = ART.fx(a.name, f), w = im.width * a.sc, h = im.height * a.sc;
    bx.drawImage(im, Math.round(a.x - w / 2), Math.round(a.y - h / 2), w, h);
  }
  for (let i = B.fx.length - 1; i >= 0; i--) {
    const p = B.fx[i]; p.x += p.vx; p.y += p.vy; if (p.g) p.vy += p.g; p.life -= 0.022;
    if (p.life <= 0) { B.fx.splice(i, 1); continue; }
    bx.globalAlpha = Math.min(1, p.life * 1.6); bx.fillStyle = p.col; bx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); bx.globalAlpha = 1;
  }
  if (B.target && B.target.alive) { const e = B.target, b = Math.round(Math.sin(T / 120) * 2), yy = e.y - e.sz.h - 10 - (e.d.float ? 14 : 0) + b; bx.fillStyle = OUTLINE_COL; bx.fillRect(e.x - 5, yy - 1, 11, 4); bx.fillStyle = '#ffd36a'; bx.fillRect(e.x - 4, yy, 9, 2); bx.fillRect(e.x - 2, yy + 2, 5, 1); bx.fillRect(e.x - 1, yy + 3, 3, 1); bx.fillRect(e.x, yy + 4, 1, 1); }
  if (B.cutin) {
    B.cutin.t += dt; const t = B.cutin.t, pt = ART.portrait(B.cutin.look);
    const slide = Math.min(1, t / 200), cy0 = Math.round(H / 2 - 50);
    bx.fillStyle = 'rgba(19,27,27,0.85)'; bx.fillRect(0, cy0, W, 88);
    bx.fillStyle = '#f06733'; bx.fillRect(0, cy0, W, 2); bx.fillRect(0, cy0 + 86, W, 2);
    for (let i = 0; i < 12; i++) { bx.fillStyle = 'rgba(255,173,85,0.3)'; bx.fillRect(((i * 53 + t * 0.6) % (W + 40)) - 40, cy0 + 6 + ((i * 17) % 76), 30, 1); }
    bx.drawImage(pt.big || pt, Math.round(-70 + slide * 110), cy0 + 6, 76, 76);
  }
}
function drawBattleUI() {
  for (let i = B.floats.length - 1; i >= 0; i--) {
    const f = B.floats[i]; f.t += 16;
    if (f.t > 1000) { B.floats.splice(i, 1); continue; }
    const yy = f.y - Math.min(12, f.t / 22) - (f.t < 160 ? Math.sin((f.t / 160) * Math.PI) * 4 : 0);
    ctx.globalAlpha = f.t > 720 ? 1 - (f.t - 720) / 280 : 1;
    font(f.big ? 14 : 11, true); ctx.textAlign = 'center';
    ctx.lineWidth = 2.2; ctx.strokeStyle = '#1a0e24'; ctx.lineJoin = 'round'; ctx.strokeText(f.txt, f.x, yy);
    ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, yy); ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  for (const e of B.enemies) if (e.alive) { const w = Math.min(36, Math.max(22, e.sz.w * 0.6)); bar(e.x - w / 2, e.y + 4, w, 2, e.hp, e.maxhp, e.hp < e.maxhp * 0.3 ? '#ff8a5a' : '#e05a7a'); }
  if (B.cutin) { font(16, true); const t = B.cutin.t; ctx.globalAlpha = Math.min(1, t / 250); text(B.cutin.name.toUpperCase(), W - 12, Math.round(H / 2 - 2), '#ffd36a', 'right'); ctx.globalAlpha = 1; }
  const full = state.harmony >= 100;
  box(W - 84, 3, 80, 24);
  font(7, true); text('HARMONY', W - 79, 13, full ? COL.gold : COL.text); font(7); text(Math.floor(state.harmony) + '%', W - 9, 13, full ? COL.gold : COL.dim, 'right');
  bar(W - 79, 16, 70, 3, state.harmony, 100, full ? (Math.floor(T / 150) % 2 ? '#f06733' : '#ffad55') : '#a060e0');
  const topMenu = UI.menus[UI.menus.length - 1];
  const showingDesc = topMenu && topMenu.items[topMenu.cursor] && topMenu.items[topMenu.cursor].desc;
  if (B.msg && !B.result && !showingDesc) { box(4, 3, W - 92, 24); font(9); text(B.msg, 11, 17); }
  const four = state.party.length > 3, py0 = H - (four ? 54 : 47), narrow = B.active >= 0 || UI.menus.length > 0;
  box(2, py0 - 3, narrow ? 136 : W - 4, four ? 57 : 50);
  state.party.forEach((m, i) => {
    const rh = four ? 12 : 13, s = stats(m), y = py0 + (four ? 2 : 5) + i * rh, act = B.active === i;
    if (act) { ctx.fillStyle = 'rgba(240,103,51,0.16)'; ctx.fillRect(6, y - 1, 128, 12); }
    font(9, true); text(hname(m), 8, y + 8, m.hp <= 0 ? COL.red : act ? COL.gold : COL.text);
    font(7); text('Lv' + m.lv, 40, y + 8, COL.dim);
    bar(54, y + 3, 40, 3, m.hp, s.hp, m.hp < s.hp * 0.3 ? '#ffb05a' : COL.hp);
    font(8); text(`${m.hp}`, 113, y + 8, m.hp <= 0 ? COL.red : COL.text, 'right');
    font(7); text(`FP ${m.fp}`, 134, y + 8, COL.fp, 'right');
    if (!narrow) {
      const t = trinketOf(m), bf = B.buffs[m.id] ? Object.keys(B.buffs[m.id]).map((k) => k.toUpperCase() + ' ↑').join(' ') : '';
      font(7); text(bf, 146, y + 8, COL.gold);
      if (t) text(t.name, W - 8, y + 8, COL.dim, 'right');
    }
  });
  if (B.result) {
    const r = B.result, lines = [`+${r.xp} XP    +${r.gold} coins`].concat(r.drop ? [`Found a ${ITEMS[r.drop].name}!`] : []).concat(r.ups);
    const h = 30 + lines.length * 12;
    box(W / 2 - 100, 30, 200, h, { border: COL.gold });
    font(12, true); text('Victory!', W / 2, 46, COL.gold, 'center');
    font(9); lines.forEach((l, i) => text(l, W / 2, 61 + i * 12, i === 0 ? COL.text : COL.hp, 'center'));
    font(7); text('tap to continue', W / 2, 30 + h - 4, COL.dim, 'center');
    hits.push({ x: 0, y: 0, w: W, h: H, fn: () => handleInput('a') });
  }
}

// ===================== FIELD MENUS =====================
function drawPartySummary() {
  rc(0, 0, W, H, 'rgba(8,4,18,0.6)');
  const ch = Math.min(52, Math.floor((H - 34) / Math.max(3, state.party.length)) - 3);
  state.party.forEach((m, i) => {
    const s = stats(m), y = 4 + i * (ch + 3), x = 4, w = 188;
    box(x, y, w, ch);
    img(ART.portrait(HEROES[m.id].look), x + 5, y + Math.max(4, Math.round((ch - 38) / 2)));
    font(10, true); text(hname(m), x + 44, y + 13, COL.gold);
    const nw = ctx.measureText(hname(m)).width;
    font(8); text(`Lv ${m.lv} · ${HEROES[m.id].role}`, x + 50 + nw, y + 13, ELEM_TEXT[HEROES[m.id].elem]);
    text('HP', x + 44, y + 25, COL.dim); bar(x + 60, y + 21, 70, 3, m.hp, s.hp, COL.hp); text(`${m.hp}/${s.hp}`, x + w - 6, y + 25, COL.text, 'right');
    text('FP', x + 44, y + 36, COL.dim); bar(x + 60, y + 32, 70, 3, m.fp, s.fp, COL.fp); text(`${m.fp}/${s.fp}`, x + w - 6, y + 36, COL.text, 'right');
    const t = trinketOf(m);
    if (ch > 44 && t) text('✦ ' + t.name, x + 44, y + 47, '#8a4ab0');
  });
  const by = H - 26;
  box(4, by, 188, 22);
  img(ART.icon('gold'), 9, by + 4); font(9, true); text(String(state.gold), 26, by + 15, COL.gold);
  font(8); const mins = Math.floor((state.time || 0) / 60000); text(`Played ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`, 186, by + 15, COL.dim, 'right');
  font(8); const g = wrap('◆ ' + goalText(), 80);
  const gh = g.length * 10 + 10;
  box(196, H - 4 - gh, 88, gh); g.forEach((l, i) => text(l, 201, H - 4 - gh + 13 + i * 10, COL.text));
}
async function pauseMenu() {
  let c = 0;
  UI.panel = drawPartySummary;
  while (true) {
    c = await choose(['Status', 'Items', 'Skills', 'Trinkets', 'Settings', 'Save'], { x: 196, y: 4, w: 88, cursor: c });
    if (c < 0) break;
    if (c === 0) await statusPage();
    if (c === 1) await itemsMenu();
    if (c === 2) await fieldSkillsMenu();
    if (c === 3) await trinketMenu();
    if (c === 4) await settingsMenu();
    if (c === 5) { const ok = saveGame(); sfx(ok ? 'chest' : 'buzz'); toast(ok ? 'Game saved!' : "Couldn't save on this device."); }
  }
  UI.panel = null;
}
async function statusPage() {
  let i = 0;
  const prev = UI.panel;
  while (true) {
    const m = state.party[i];
    UI.panel = () => {
      rc(0, 0, W, H, 'rgba(8,4,18,0.9)');
      const s = stats(m), L = HEROES[m.id].look;
      box(4, 4, W - 8, H - 8);
      { const pt = ART.portrait(L); ctx.drawImage(pt.big || pt, 12, 12, 76, 76); }
      font(14, true); text(hname(m), 140, 26, COL.gold);
      font(9); text(`Level ${m.lv} ${HEROES[m.id].role}`, 140, 40, COL.text); text(`${ELEM_NAME[HEROES[m.id].elem]} element`, 140, 52, ELEM_TEXT[HEROES[m.id].elem]);
      text(`Next level in ${xpNext(m.lv) - m.xp} XP`, 140, 64, COL.dim); bar(140, 68, W - 156, 3, m.xp, xpNext(m.lv), '#a060e0');
      [['HP', `${m.hp} / ${s.hp}`], ['FP', `${m.fp} / ${s.fp}`], ['Attack', s.atk], ['Defense', s.def], ['Agility', s.agi]]
        .forEach(([k, v], r) => { text(k, 16, 96 + r * 13, COL.dim); text(String(v), 130, 96 + r * 13, COL.text, 'right'); });
      const t = trinketOf(m);
      [['Weapon', (m.weapon ? ITEMS[m.weapon].name : '—') + (m.up && m.up.w ? ' +' + m.up.w : '')], ['Armor', (m.armor ? ITEMS[m.armor].name : '—') + (m.up && m.up.a ? ' +' + m.up.a : '')], ['Trinket', t ? t.name : '—'], ['Burst', BURSTS[HEROES[m.id].burst].name], ['Field tool', POWERS[HEROES[m.id].field].name]]
        .forEach(([k, v], r) => { text(k, 146, 96 + r * 13, COL.dim); text(String(v), W - 14, 96 + r * 13, COL.text, 'right'); });
      const hd = HEROES[m.id], py = 96 + 5 * 13 + 6;
      font(8, true); text(`Passive · ${hd.passive.name}`, 16, py, '#8a4ab0'); font(8); wrap(hd.passive.desc, W - 32).forEach((l, r) => text(l, 16, py + 11 + r * 10, COL.text));
      font(8, true); text('Skills', 16, py + 36, COL.gold);
      font(8); hd.skills.forEach(([id, lv], r) => { const got = m.lv >= lv; text(SKILLS[id].name, 16 + (r % 2) * 130, py + 47 + Math.floor(r / 2) * 11, got ? COL.text : COL.dim); if (!got) text('Lv ' + lv, 16 + (r % 2) * 130 + 120, py + 47 + Math.floor(r / 2) * 11, COL.dim, 'right'); });
      font(8); wrap(heroText(hd.bio), W - 32).forEach((l, r) => text(l, 16, py + 86 + r * 10, COL.dim));
      font(8); text(state.party.length > 1 ? 'Tap a side or press ◀ ▶ to switch hero · B to close' : 'B to close', W / 2, H - 12, COL.dim, 'center');
      hits.push({ x: 0, y: 0, w: W / 2, h: H - 24, fn: () => inputQ.push('left') });
      hits.push({ x: W / 2, y: 0, w: W / 2, h: H - 24, fn: () => inputQ.push('right') });
      hits.push({ x: 0, y: H - 24, w: W, h: 24, fn: () => inputQ.push('b') });
    };
    const k = await new Promise((res) => { panelKey = res; });
    if (k === 'left' || k === 'up') i = (i + state.party.length - 1) % state.party.length;
    else if (k === 'right' || k === 'down') i = (i + 1) % state.party.length;
    else if (k === 'b' || k === 'a' || k === 'm') break;
  }
  UI.panel = prev;
}
async function useItemField(id) {
  const it = ITEMS[id];
  if (!it.use) { await say(`${it.name} is equipment. Gear is equipped when you buy it at the shop.`); return; }
  if (it.use === 'healAll') { removeItem(id); sfx('heal'); state.party.filter((m) => m.hp > 0).forEach((m) => (m.hp = Math.min(stats(m).hp, m.hp + it.power))); toast('Everyone feels refreshed!'); return; }
  const dead = it.use === 'revive';
  const m = await chooseMember(`Use ${it.name} on:`, (m) => `${m.hp}/${stats(m).hp}`, (m) => (dead ? m.hp <= 0 : m.hp > 0));
  if (!m) { if (dead) toast('Nobody needs reviving.'); return; }
  removeItem(id); sfx('heal');
  const s = stats(m);
  if (it.use === 'heal') m.hp = Math.min(s.hp, m.hp + it.power);
  if (it.use === 'fp') m.fp = Math.min(s.fp, m.fp + it.power);
  if (it.use === 'revive') m.hp = Math.ceil(s.hp / 2);
  toast(`${hname(m)} used the ${it.name}.`);
}
async function chooseMember(title, right, filter, o = {}) {
  const list = state.party.filter(filter || (() => true));
  if (!list.length) return null;
  const j = await choose(list.map((m) => ({ label: hname(m), right: right ? right(m) : `HP ${m.hp}/${stats(m).hp}` })), { title, x: o.x ?? 100, y: o.y ?? 40, w: o.w || 130 });
  return j < 0 ? null : list[j];
}
async function itemsMenu() {
  let c = 0;
  while (true) {
    const list = Object.keys(state.items);
    if (!list.length) { toast('Your bag is empty.'); return; }
    c = await choose(list.map((id) => ({ label: ITEMS[id].name, right: '×' + state.items[id], icon: ART.icon(ITEMS[id].icon), desc: itemDesc(id) })), { title: 'Items', x: 40, y: 30, w: 160, cursor: Math.min(c, list.length - 1), max: 8 });
    if (c < 0) return;
    await useItemField(list[c]);
  }
}
async function fieldSkillsMenu() {
  const m = await chooseMember('Whose skills?', (m) => `FP ${m.fp}/${stats(m).fp}`, (m) => m.hp > 0);
  if (!m) return;
  while (true) {
    const list = skillsOf(m);
    const j = await choose(list.map((id) => ({ label: SKILLS[id].name, right: SKILLS[id].fp + ' FP', desc: SKILLS[id].desc + (SKILLS[id].type === 'heal' || SKILLS[id].type === 'revive' ? '' : ' (Battle only.)'), disabled: !(SKILLS[id].type === 'heal' || SKILLS[id].type === 'revive') || SKILLS[id].fp > m.fp })),
      { title: `${hname(m)} · FP ${m.fp}/${stats(m).fp}`, x: 40, y: 30, w: 170 });
    if (j < 0) return;
    const sk = SKILLS[list[j]];
    if (sk.target === 'allAllies') { m.fp -= sk.fp; sfx('heal'); state.party.filter((p) => p.hp > 0).forEach((p) => (p.hp = Math.min(stats(p).hp, p.hp + sk.power + m.lv * 3))); toast(`${sk.name}! Everyone is healed.`); continue; }
    const dead = sk.type === 'revive';
    const t = await chooseMember(`${sk.name} on:`, (p) => `${p.hp}/${stats(p).hp}`, (p) => (dead ? p.hp <= 0 : p.hp > 0), { x: 150 });
    if (!t) { if (dead) toast('Nobody needs reviving.'); continue; }
    m.fp -= sk.fp; sfx('heal');
    if (dead) t.hp = Math.ceil(stats(t).hp / 2); else t.hp = Math.min(stats(t).hp, t.hp + Math.round((sk.power + m.lv * 3) * healMul(m)));
    toast(`${hname(t)} feels better.`);
  }
}
async function trinketMenu() {
  let c = 0;
  while (true) {
    const list = Object.keys(state.trinkets);
    if (!list.length) { await say('No Trinkets yet. Look for little golden sparkles hidden around the vale!'); return; }
    c = await choose(list.map((k) => ({ label: TRINKETS[k].name, icon: ART.icon('trinket'), right: state.trinkets[k] ? HEROES[state.trinkets[k]].name : '—', desc: TRINKETS[k].desc })),
      { title: `Trinkets (${list.length}/4)`, x: 30, y: 34, w: 170, cursor: c });
    if (c < 0) return;
    const k = list[c];
    const opts = state.party.map((m) => ({ label: hname(m), right: trinketOf(m) ? trinketOf(m).name : 'empty' })).concat([{ label: 'Nobody' }]);
    const j = await choose(opts, { title: 'Who wears it?', x: 120, y: 64, w: 156 });
    if (j < 0) continue;
    if (j === state.party.length) state.trinkets[k] = null;
    else { const id = state.party[j].id; for (const o in state.trinkets) if (state.trinkets[o] === id) state.trinkets[o] = null; state.trinkets[k] = id; }
    for (const m of state.party) clampHero(m);
    sfx('trinket');
  }
}
async function settingsMenu() {
  let c = 0;
  while (true) {
    c = await choose([
      { label: 'Music', right: settings.music ? 'On' : 'Off' },
      { label: 'Sound effects', right: settings.sfx ? 'On' : 'Off' },
      { label: 'Text speed', right: ['Normal', 'Fast', 'Instant'][settings.text] },
      { label: 'Graphics', right: settings.gfx === 'low' ? 'Fast' : 'Fancy' },
    ], { title: 'Settings', x: 64, y: 50, w: 160, cursor: c });
    if (c < 0) return;
    if (c === 0) settings.music = !settings.music;
    if (c === 1) settings.sfx = !settings.sfx;
    if (c === 2) settings.text = (settings.text + 1) % 3;
    if (c === 3) { settings.gfx = settings.gfx === 'low' ? 'high' : 'low'; settings.gfxAuto = false; W3D.setQuality(settings.gfx); }
    applyAudio(); saveSettings();
  }
}

// ---------- shop & inn ----------
function itemDesc(id) { const it = ITEMS[id]; if (it.slot === 'weapon') return `Weapon · Attack +${it.atk}${it.note ? ' · ' + it.note : ''}${it.cls ? ' · ' + CLASSES[it.cls].name + ' only' : ''}`; if (it.slot === 'armor') return `Armor · Defense +${it.def}`; return it.desc; }
async function shopScript() {
  UI.goldBox = true;
  while (true) {
    const c = await choose(['Buy', 'Sell', 'Leave'], { x: 8, y: 30, w: 64 });
    if (c === 0) await shopBuy(); else if (c === 1) await shopSell(); else break;
  }
  UI.goldBox = false;
  await say('Thanks! Come again!', 'dorrit');
}
async function shopBuy() {
  let c = 0;
  while (true) {
    c = await choose(SHOP_LIST.map((id) => ({ label: ITEMS[id].name, icon: ART.icon(ITEMS[id].icon), right: ITEMS[id].price + 'c', desc: itemDesc(id) + (state.items[id] ? ` (You have ${state.items[id]}.)` : ''), disabled: ITEMS[id].price > state.gold })),
      { title: 'Buy', x: 76, y: 30, w: 168, cursor: c, max: Math.min(9, Math.floor((H - 80) / 13)) });
    if (c < 0) return;
    const id = SHOP_LIST[c], it = ITEMS[id];
    if (it.slot) {
      const m = await chooseMember('Equip on:', (m) => { const o = m[it.slot] ? ITEMS[m[it.slot]] : null; const d = (it.atk || it.def) - (o ? o.atk || o.def : 0); return (d >= 0 ? '+' : '') + d + (it.slot === 'weapon' ? ' ATK' : ' DEF'); }, null, { x: 120, w: 150 });
      if (!m) continue;
      const old = m[it.slot];
      if (old === id) { toast(`${hname(m)} already has that.`); continue; }
      state.gold -= it.price; m[it.slot] = id; sfx('chest');
      if (old) { const refund = Math.floor(ITEMS[old].price / 2); state.gold += refund; toast(`Equipped! Old gear sold for ${refund}c.`, 2200); }
      else toast(`${hname(m)} equipped the ${it.name}!`);
    } else { state.gold -= it.price; addItem(id); sfx('chest'); toast(`Bought a ${it.name}.`, 900); }
  }
}
async function shopSell() {
  let c = 0;
  while (true) {
    const list = Object.keys(state.items);
    if (!list.length) { toast('Nothing to sell.'); return; }
    c = await choose(list.map((id) => ({ label: ITEMS[id].name, icon: ART.icon(ITEMS[id].icon), right: Math.floor(ITEMS[id].price / 2) + 'c', desc: `You have ${state.items[id]}.` })), { title: 'Sell', x: 76, y: 30, w: 168, cursor: Math.min(c, list.length - 1), max: 7 });
    if (c < 0) return;
    state.gold += Math.floor(ITEMS[list[c]].price / 2); removeItem(list[c]); sfx('chest');
  }
}
// ---------- the smith ----------
async function smithScript() {
  const f = state.flags;
  if (!f.metHollis) {
    f.metHollis = true;
    await say("Hm? Oh. You're the one dragging my apprentice off on an adventure, aren't you.", 'hollis');
    await say("Hollis. I've kept this forge hot for thirty years. Bring me coin and I'll make your gear sing.", 'hollis');
    if (state.party.some((m) => m.id === 'bram')) await say("Don't worry, Master Hollis. I'll keep my lantern lit and my hammer swinging.", 'bram');
  } else await say(pick(["Back again? The coals are always hot.", "Steel doesn't lie. Let's see what you've got.", "Mind the sparks."]), 'hollis');
  UI.goldBox = true;
  let c = 0;
  while (true) {
    c = await choose([
      { label: 'Hone a weapon', desc: '+3 attack per level, up to +3. Stays with the hero even if you change weapons.' },
      { label: 'Reinforce armor', desc: '+2 defense per level, up to +3. Stays with the hero even if you change armor.' },
      { label: 'Signature weapons', desc: 'A weapon forged for each class, with a bonus of its own.' },
      { label: 'Leave' },
    ], { x: 8, y: 30, w: 120, cursor: c });
    if (c < 0 || c === 3) break;
    if (c === 0 || c === 1) await smithUpgrade(c === 0 ? 'w' : 'a');
    if (c === 2) await smithSignature();
  }
  UI.goldBox = false;
  await say('Go on, then. Bring my apprentice back in one piece.', 'hollis');
}
async function smithUpgrade(k) {
  const costs = k === 'w' ? HONE_COST : REINFORCE_COST, what = k === 'w' ? 'ATK' : 'DEF', per = k === 'w' ? 3 : 2;
  while (true) {
    const m = await chooseMember(k === 'w' ? 'Hone whose weapon?' : 'Reinforce whose armor?', (m) => { const lv = (m.up && m.up[k]) || 0; return lv >= 3 ? 'Maxed' : `+${lv} → +${lv + 1} · ${costs[lv]}c`; }, null, { x: 120, w: 160 });
    if (!m) return;
    m.up = m.up || {};
    const lv = m.up[k] || 0;
    if (lv >= 3) { toast(`${hname(m)}'s gear can't get any better.`); continue; }
    if (state.gold < costs[lv]) { sfx('buzz'); toast(`That costs ${costs[lv]} coins.`); continue; }
    state.gold -= costs[lv]; m.up[k] = lv + 1;
    sfx('fire'); await sleep(250); sfx('thud'); await sleep(200); sfx('chest');
    toast(`Clang! ${hname(m)}: ${what} +${per} (now +${lv + 1})`, 1800);
  }
}
async function smithSignature() {
  let c = 0;
  while (true) {
    const list = state.party.map((m) => SIGNATURE[HEROES[m.id].cls]);
    c = await choose(list.map((id, i) => ({ label: ITEMS[id].name, icon: ART.icon('weapon'), right: state.party[i].weapon === id ? 'Owned' : ITEMS[id].price + 'c', desc: `For ${hname(state.party[i])}. ` + itemDesc(id),
      disabled: state.party[i].weapon === id || ITEMS[id].price > state.gold })), { title: 'Signature weapons', x: 76, y: 30, w: 190, cursor: c });
    if (c < 0) return;
    const m = state.party[c], id = list[c], old = m.weapon;
    state.gold -= ITEMS[id].price; m.weapon = id; sfx('fire'); await sleep(300); sfx('chest');
    if (old) { const refund = Math.floor(ITEMS[old].price / 2); state.gold += refund; toast(`${hname(m)} wields the ${ITEMS[id].name}! Old weapon sold for ${refund}c.`, 2400); }
    else toast(`${hname(m)} wields the ${ITEMS[id].name}!`, 2000);
  }
}
async function innScript() {
  UI.goldBox = true;
  const c = await ask('Welcome to the Sleepy Kettle! A soft bed and a bowl of hot soup for 10 coins. Staying the night?', 'marta');
  UI.goldBox = false;
  if (c !== 0) { await say('Safe travels, then!', 'marta'); return; }
  if (state.gold < 10) { await say("Oh dear, you're a little short. Tell you what: this one's on the house.", 'marta'); state.gold += 10; }
  state.gold -= 10;
  await fade(1); music(null);
  for (const m of state.party) { const s = stats(m); m.hp = s.hp; m.fp = s.fp; }
  sfx('heal'); await sleep(1300);
  music(cur.def.music); await fade(0);
  saveGame();
  await say('Good morning! Everyone is fully rested. (Game saved.)', 'marta');
}

// ===================== ENDING & TITLE =====================
const END = { lines: [] };
async function endingScene() {
  await fade(1);
  game.scene = 'ending'; END.lines = []; music('ending');
  await fade(0);
  const lines = [
    'The Rootwell sang again, its music rippling up through the hill and out across the vale.',
    "Color flooded back into every petal. Gran's bees spilled from their hives into the warm air.",
    'That night, Mossbell held a festival, and Bram fixed every lantern himself.',
    'Tamsin stayed to study the silver band. "Larkspur markings," she said quietly. "From my own college..."',
    'Somewhere beyond the mountains, a question was waiting. But tonight, the vale was singing.',
  ];
  for (const l of lines) { END.lines.push({ s: l, t: T }); await waitOrTap(3400); }
  END.lines.push({ s: 'THE END', t: T, big: true });
  await waitOrTap(1500);
  END.lines.push({ s: 'Thank you for playing Rootwell! (Tap or press A)', t: T, small: true });
  await waitKey();
  await fade(1);
  titleBuilt = false; W3D.buildMap(cur, state); W3D.resetCamera(); game.scene = 'map'; music(cur.def.music); saveGame();
  await fade(0);
  goalChanged();
  await say('(Game saved. Feel free to keep exploring and hunting for Trinkets!)');
}
let titleBuilt = false, lastSceneT = 0;
function buildTitleWorld() {
  const def = MAPS.village, t = def.rows.map((r) => r.split(''));
  const m = { id: 'title', def, w: t[0].length, h: t.length, t, npcs: [], mask: [] };
  W3D.buildMap(m, { flags: {}, trinkets: {}, mods: {} }); titleBuilt = true;
}
function sceneBackdrop(dim) {
  const dt = Math.min(50, T - (lastSceneT || T)); lastSceneT = T;
  if (!titleBuilt) buildTitleWorld();
  W3D.hideActors(); W3D.titleSync(dt, {});
  bx.clearRect(0, 0, W, H);
  const g = bx.createLinearGradient(0, 0, 0, H * 0.45); g.addColorStop(0, 'rgba(10,6,20,0.45)'); g.addColorStop(1, 'rgba(10,6,20,0)'); bx.fillStyle = g; bx.fillRect(0, 0, W, H * 0.45);
  if (dim) { bx.fillStyle = `rgba(10,6,20,${dim})`; bx.fillRect(0, 0, W, H); }
}
function renderTitle() { sceneBackdrop(0); }
function drawTitleUI() {
  const ty = Math.round(H * 0.22);
  font(30, true); ctx.textAlign = 'center';
  ctx.fillStyle = '#131b1b'; ctx.fillText('ROOTWELL', W / 2 + 2, ty + 2); ctx.fillText('ROOTWELL', W / 2 - 1, ty + 2);
  const tg = ctx.createLinearGradient(0, ty - 24, 0, ty); tg.addColorStop(0, '#ffe6a0'); tg.addColorStop(1, '#ff9a4a');
  ctx.fillStyle = tg; ctx.fillText('ROOTWELL', W / 2, ty); ctx.textAlign = 'left';
  font(10); text('Song of Mossbell Vale', W / 2, ty + 16, '#ffe8d0', 'center');
  if (!Snd.ac && Math.floor(T / 700) % 2) { font(8); text('Tap anywhere to enable sound', W / 2, H - 8, 'rgba(255,255,255,0.7)', 'center'); }
}
function renderEnding() {
  let y = 22;
  for (const l of END.lines) {
    ctx.globalAlpha = clamp((T - l.t) / 800, 0, 1);
    if (l.big) { font(18, true); text(l.s, W / 2, y + 10, '#ffd36a', 'center'); y += 26; }
    else { font(l.small ? 8 : 9); for (const ln of wrap(l.s, 260)) { text(ln, W / 2, y, l.small ? '#fff2c0' : COL.light, 'center'); y += 12; } y += 5; }
  }
  ctx.globalAlpha = 1;
}
// ---------- class selection ----------
async function chooseClass(hero) {
  let hover = Math.max(0, CLASS_ORDER.indexOf(hero.cls));
  const prev = UI.panel;
  const MAX = { hp: 44, fp: 22, atk: 13, def: 11, agi: 14 };
  UI.panel = () => {
    rc(0, 0, W, H, 'rgba(8,4,18,0.82)');
    const k = CLASS_ORDER[hover], c = CLASSES[k], ph = H - 84;
    box(4, 4, W - 8, ph);
    font(11, true); text(`Choose ${hero.name}'s class`, W / 2, 20, COL.gold, 'center');
    const pt = W3D.portrait(k + ':wren:' + hero.outfit); ctx.drawImage(pt.big || pt, 10, 26, 76, 76);
    font(14, true); text(c.name, 94, 42, COL.text);
    font(8); text(`${ELEM_NAME[c.elem]} element`, 94, 54, ELEM_TEXT[c.elem]);
    font(8); wrap(c.blurb, W - 106).forEach((l, i) => text(l, 94, 68 + i * 10, COL.text));
    const st = [['HP', 'hp'], ['FP', 'fp'], ['Attack', 'atk'], ['Defense', 'def'], ['Agility', 'agi']];
    st.forEach(([lab, key], i) => { const y = 112 + i * 11; font(8); text(lab, 12, y, COL.dim); bar(56, y - 5, 80, 4, c.base[key], MAX[key], ['#5ac85a', '#5a9af0', '#f07a4a', '#c8a050', '#7ad0d0'][i]); });
    font(8, true); text('Skills', 146, 108, COL.gold);
    font(8); c.skills.slice(0, 6).forEach(([id, lv], i) => text(`${SKILLS[id].name}${lv > 1 ? '  (Lv ' + lv + ')' : ''}`, 146, 119 + i * 10, COL.text));
    const py = 172;
    font(8, true); text(`Passive: ${c.passive.name}`, 12, py, '#8a4ab0'); font(8); wrap(c.passive.desc, W - 28).forEach((l, i) => text(l, 12, py + 11 + i * 10, COL.text));
    font(8, true); text(`Burst: ${BURSTS[c.burst].name}`, 12, py + 36, COL.gold); font(8); wrap(BURSTS[c.burst].desc, W - 28).forEach((l, i) => text(l, 12, py + 47 + i * 10, COL.text));
    if (ph > 250) { font(8); wrap('Your three companions will each be a different class, so the party always has every element and a healer.', W - 28).forEach((l, i) => text(l, 12, py + 76 + i * 10, COL.dim)); }
  };
  let picked = null;
  while (!picked) {
    const j = await choose(CLASS_ORDER.map((k) => ({ label: CLASSES[k].name, color: ELEM_TEXT[CLASSES[k].elem] })), { x: 6, bottom: H - 6, w: W - 12, cols: 3, max: 2, cursor: hover, onHover: (i) => (hover = i) });
    if (j < 0) { picked = hero.cls; break; }
    picked = CLASS_ORDER[j];
  }
  UI.panel = prev;
  return picked;
}
function askName(current) {
  return new Promise((res) => {
    const stage = document.getElementById('stage') || document.body, r = stage.getBoundingClientRect();
    const wrapEl = document.createElement('div');
    wrapEl.style.cssText = `position:fixed;left:${r.left}px;top:${r.top + r.height * 0.3}px;width:${r.width}px;display:flex;flex-direction:column;align-items:center;gap:10px;z-index:50`;
    const inp = document.createElement('input');
    inp.value = current; inp.maxLength = 12; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('autocapitalize', 'words');
    inp.style.cssText = 'font:22px Pixelify, sans-serif;padding:10px 14px;width:70%;border-radius:10px;border:3px solid #f06733;background:#fff8e8;color:#3a2a4a;text-align:center;outline:none';
    const btn = document.createElement('button'); btn.textContent = 'Done';
    btn.style.cssText = 'font:18px Pixelify, sans-serif;padding:8px 28px;border-radius:10px;border:0;background:#f06733;color:#fff8e8';
    wrapEl.append(inp, btn); document.body.appendChild(wrapEl);
    const finish = () => {
      if (!wrapEl.parentNode) return;
      const v = inp.value.replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
      wrapEl.remove(); res(v || current);
    };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(); });
    inp.addEventListener('keyup', (e) => e.stopPropagation());
    btn.addEventListener('click', finish);
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  });
}
async function createCharacter() {
  const hero = { name: 'Wren', outfit: 0, cls: 'warden' };
  const prev = UI.panel;
  UI.panel = () => {
    rc(0, 0, W, H, 'rgba(8,4,18,0.78)');
    const c = CLASSES[hero.cls], ph = H - 104;
    box(4, 4, W - 8, ph);
    font(11, true); text('Create your hero', W / 2, 20, COL.gold, 'center');
    ctx.imageSmoothingEnabled = true; ctx.drawImage(W3D.figure(hero.cls + ':wren:' + hero.outfit), 14, 24, 84, 120); ctx.imageSmoothingEnabled = false;
    font(15, true); text(hero.name, 114, 46, COL.text);
    font(10, true); text(c.name, 114, 66, ELEM_TEXT[c.elem]); font(8); text(`${ELEM_NAME[c.elem]} element · ${OUTFITS[hero.outfit].name} outfit`, 114, 80, COL.dim);
    font(8); wrap(c.blurb, W - 128).forEach((l, i) => text(l, 114, 96 + i * 10, COL.text));
    font(8, true); text(`Passive: ${c.passive.name}`, 12, 156, '#8a4ab0'); font(8); wrap(c.passive.desc, W - 28).forEach((l, i) => text(l, 12, 167 + i * 10, COL.text));
    font(8, true); text('Starting skills', 12, 190, COL.gold);
    font(8); c.skills.filter((a) => a[1] === 1).forEach(([id], i) => wrap(`${SKILLS[id].name}: ${SKILLS[id].desc}`, W - 28).slice(0, 2).forEach((l, j) => text(l, 12, 201 + i * 22 + j * 10, COL.text)));
    if (ph > 274) { font(8); wrap('Three companions will join along the way, each with a different class.', W - 28).forEach((l, i) => text(l, 12, 252 + i * 10, COL.dim)); }
  };
  let c = 0;
  while (true) {
    c = await choose([
      { label: 'Name', right: hero.name },
      { label: 'Class', right: CLASSES[hero.cls].name, color: ELEM_TEXT[CLASSES[hero.cls].elem] },
      { label: 'Outfit colors', right: OUTFITS[hero.outfit].name },
      { label: 'Begin the adventure', color: COL.gold },
    ], { x: 8, bottom: H - 6, w: W - 16, cursor: c, cancel: false });
    if (c === 0) { sfx('confirm'); hero.name = await askName(hero.name); }
    else if (c === 1) { const keep = UI.panel; UI.panel = null; hero.cls = await chooseClass(hero); UI.panel = keep; }
    else if (c === 2) hero.outfit = (hero.outfit + 1) % OUTFITS.length;
    else if (c === 3) {
      const ok = await choose([`Yes, I'm ${hero.name} the ${CLASSES[hero.cls].name}`, 'Not yet'], { x: W / 2 - 90, bottom: H - 6, w: 180 });
      if (ok === 0) break;
    }
  }
  UI.panel = prev;
  return hero;
}
async function titleScreen() {
  game.scene = 'title'; music('title');
  UI.fadeTo = 0;
  while (true) {
    const has = !!store.get(SAVE_KEY);
    const items = (has ? ['Continue'] : []).concat(['New Game', 'Settings']);
    const c = await choose(items, { x: W / 2 - 42, y: Math.round(H * 0.22) + 30, w: 84, cancel: false });
    const choice = items[c];
    if (choice === 'Settings') { await settingsMenu(); continue; }
    if (choice === 'New Game' && has) {
      const ok = await choose(['Start over', 'Back'], { title: 'Erase your save?', x: W / 2 - 54, y: Math.round(H * 0.22) + 30, w: 108 });
      if (ok !== 0) continue;
    }
    await fade(1);
    if (choice === 'Continue' && loadGame()) {
      titleBuilt = false; loadMap(state.map); placePlayer(state.x, state.y, state.dir);
      game.scene = 'map';
      await fade(0);
      return;
    }
    newState();
    game.scene = 'intro';
    await fade(0);
    startParty(await createCharacter());
    await say('Mossbell Vale has always bloomed. Beneath the old hill, the Rootwell spring hums a quiet song, and wherever its water flows, flowers follow.');
    await say('But three days ago, the humming stopped. And the petals began to turn gray...');
    await say(`In the village of Mossbell, a young ${HEROES.wren.role.toLowerCase()} named Wren is about to set out to find out why.`);
    await fade(1);
    titleBuilt = false; loadMap('village'); placePlayer(12, 13, 'down');
    game.scene = 'map';
    await fade(0);
    await cur.def.onEnter();
    goalChanged();
    return;
  }
}

// ===================== MAIN LOOP =====================
let last = performance.now();
function frame(now) {
  const dt = Math.min(50, now - last); last = now; T = now;
  try { update(dt); render(dt); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function update(dt) {
  if (rep.k && held[rep.k] && (UI.menus.length || panelKey)) { rep.t += dt; if (rep.t >= 0) { rep.t = -110; inputQ.push(rep.k); } }
  while (inputQ.length) handleInput(inputQ.shift());
  if (UI.dialog) {
    const d = UI.dialog, total = d.pages[d.p].join('').length;
    if (d.c < total) { const before = Math.floor(d.c); d.c = Math.min(total, d.c + dt * [0.045, 0.1, 99][settings.text]); if (Math.floor(d.c) !== before && Math.floor(d.c) % 3 === 0) sfx('blip'); }
    if (d.hold && d.p === d.pages.length - 1 && d.c >= total && !d.done) { d.done = true; d.res(); }
  }
  if (UI.fade !== UI.fadeTo) {
    const s = dt / 240;
    UI.fade = UI.fade < UI.fadeTo ? Math.min(UI.fadeTo, UI.fade + s) : Math.max(UI.fadeTo, UI.fade - s);
    if (UI.fade === UI.fadeTo && UI.fadeRes) { const r = UI.fadeRes; UI.fadeRes = null; r(); }
  } else if (UI.fadeRes) { const r = UI.fadeRes; UI.fadeRes = null; r(); }
  UI.flash = Math.max(0, UI.flash - dt / 220);
  if (UI.banner) { UI.banner.t -= dt; if (UI.banner.t <= 0) UI.banner = null; }
  if (UI.toast) { UI.toast.t -= dt; if (UI.toast.t <= 0) UI.toast = null; }
  UI.goalT = Math.max(0, UI.goalT - dt);
  if (state && game.scene === 'map') state.time = (state.time || 0) + dt;
  if (game.scene === 'map' && cur) updateMap(dt);
}
function render(dt) {
  hits = [];
  bx.imageSmoothingEnabled = false; bx.setTransform(1, 0, 0, 1, 0, 0);
  if (game.scene === 'title') renderTitle();
  else if (game.scene === 'map' && cur) renderMap();
  else if (game.scene === 'battle' && B) renderBattle(dt);
  else if (game.scene === 'ending' || game.scene === 'intro') sceneBackdrop(game.scene === 'intro' ? 0.35 : 0.6);
  else { bx.fillStyle = '#131b1b'; bx.fillRect(0, 0, W, H); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const three = window.W3D && W3D.ready && ['map', 'battle', 'title', 'intro', 'ending'].includes(game.scene) && (game.scene !== 'map' || cur) && (game.scene !== 'battle' || B);
  if (three) { W3D.render(game.scene === 'battle' ? 'battle' : 'map'); ctx.clearRect(0, 0, cvs.width, cvs.height); }
  ctx.drawImage(buf, 0, 0, W * S, H * S);
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.textBaseline = 'alphabetic';
  if (game.scene === 'title') drawTitleUI();
  if (game.scene === 'map' && cur) drawMapHUD();
  if (game.scene === 'battle' && B) drawBattleUI();
  if (game.scene === 'ending') renderEnding();
  if (game.scene === 'loading') { font(10);
    if (loadErr) { hits.push({ x: 0, y: 0, w: W, h: H, fn: () => location.reload() }); const lines = ['Could not start the game.', 'Tap here to try again, or open the link in Safari.', '', ...wrap(String(loadErr), W - 20).slice(0, 6)]; lines.forEach((l, i) => text(l, W / 2, H / 2 - 30 + i * 13, i < 2 ? COL.light : '#ffad55', 'center')); }
    else text('Loading...', W / 2, H / 2 - 8, COL.light, 'center'); if (!loadErr) { ctx.fillStyle = '#46402e'; ctx.fillRect(W / 2 - 50, H / 2, 100, 5); ctx.fillStyle = '#ffad55'; ctx.fillRect(W / 2 - 50, H / 2, 100 * loadP, 5); } }
  drawUI();
  if (UI.flash > 0) { ctx.globalAlpha = UI.flash; rc(0, 0, W, H, UI.flashCol); ctx.globalAlpha = 1; }
  if (UI.fade > 0) { ctx.globalAlpha = UI.fade; rc(0, 0, W, H, '#07040e'); ctx.globalAlpha = 1; }
  if (game.scene !== 'map') setButtonHints(UI.menus.length || game.scene === 'battle' ? 'Confirm' : 'Action', false);
}

resize();
requestAnimationFrame(frame);
let loadP = 0, loadErr = null;
(async () => {
  game.scene = 'loading';
  preloadMusic();
  try {
    await window.W3DReady;
    W3D.init(document.getElementById('gl'), settings.gfx || 'high');
    // if the phone can't keep up with the fancy effects, drop to the fast mode once (the player can switch back in Settings)
    if (settings.gfxAuto !== false && !settings.gfx) W3D.onSlow = () => { settings.gfx = 'low'; saveSettings(); W3D.setQuality('low'); toast('Graphics set to Fast for smoother play (see Settings)'); };
    let p2 = 0, p3 = 0;
    await Promise.all([ART.load((p) => (p2 = p, loadP = p2 * 0.15 + p3 * 0.85)), W3D.load((p) => (p3 = p, loadP = p2 * 0.15 + p3 * 0.85)), Promise.race([document.fonts.load('10px Pixelify'), sleep(1500)])]);
    W3D.ready = true;
  }
  catch (e) { loadErr = (e && (e.message || e.type || e.toString())) || 'unknown error'; console.error(e); return; }
  resize();
  runScript(titleScreen);
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
