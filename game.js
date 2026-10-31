'use strict';
// ===================== Dawnbeacon — engine =====================
const W = 288, H = 192, TS = 16;
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let S = 3;
const tileCache = new Map();
const FONT = '"Trebuchet MS","Segoe UI",Verdana,sans-serif';
const SAVE_KEY = 'dawnbeacon_save_v1';

function font(px, bold) { ctx.font = (bold ? 'bold ' : '') + px + 'px ' + FONT; }

function resize() {
  const scr = document.getElementById('screen');
  const r = scr.getBoundingClientRect();
  let cw = r.width, ch = (cw * H) / W;
  if (ch > r.height) { ch = r.height; cw = (ch * W) / H; }
  cvs.style.width = cw + 'px';
  cvs.style.height = ch + 'px';
  const dpr = window.devicePixelRatio || 1;
  const ns = Math.max(1, Math.min(8, Math.ceil((cw * dpr) / W)));
  if (ns !== S || cvs.width !== W * ns) { S = ns; cvs.width = W * S; cvs.height = H * S; tileCache.clear(); }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- utils ----------
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shade(hex, k = 0.7) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgb(${((n >> 16) * k) | 0},${(((n >> 8) & 255) * k) | 0},${((n & 255) * k) | 0})`;
}
const snap = (v) => Math.round(v * S) / S;

// ===================== AUDIO =====================
const Snd = { ac: null, master: null, on: localStorage.getItem('dawnbeacon_sound') !== 'off', song: null, songName: null, want: null, step: 0, next: 0 };
function audioInit() {
  if (Snd.ac) { if (Snd.ac.state === 'suspended') Snd.ac.resume(); return; }
  try {
    Snd.ac = new (window.AudioContext || window.webkitAudioContext)();
    Snd.master = Snd.ac.createGain();
    Snd.master.gain.value = Snd.on ? 0.45 : 0;
    Snd.master.connect(Snd.ac.destination);
    setInterval(schedule, 40);
    const w = Snd.want; Snd.songName = null; music(w);
  } catch (e) { Snd.ac = null; }
}
function noteFreq(n) {
  const m = n.match(/^([A-G])([#b]?)(-?\d)$/);
  if (!m) return 0;
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (+m[3] - 4) * 12) / 12);
}
function parseTrack(s) {
  const tk = s.trim().split(/\s+/), out = [];
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    if (t === '.' || t === '-') { out.push(null); continue; }
    let d = 1; while (tk[i + d] === '-') d++;
    out.push({ f: noteFreq(t), d });
  }
  return out;
}
const SONG_SRC = {
  title: { step: 0.26, tracks: [
    ['triangle', 0.22, 'G4 - - - C5 - - - E5 - - - D5 - - - C5 - - - A4 - - - B4 - - - G4 - - - E5 - - - G5 - - - A5 - - - G5 - - - F5 - - - E5 - - - D5 - - - - - - -'],
    ['sine', 0.22, 'C3 - - - - - - - A2 - - - - - - - F2 - - - - - - - G2 - - - - - - -'],
  ] },
  village: { step: 0.2, tracks: [
    ['triangle', 0.22, 'E5 - D5 C5 D5 - G4 - C5 - E5 - G5 - - - F5 - E5 D5 E5 - C5 - D5 - - - - - . . E5 - D5 C5 D5 - G4 - C5 - E5 - A5 - G5 - F5 - E5 - D5 - E5 - C5 - - - - - . .'],
    ['sine', 0.24, 'C3 - - - G2 - - - A2 - - - E2 - - - F2 - - - C3 - - - G2 - - - G2 - - -'],
  ] },
  field: { step: 0.15, tracks: [
    ['square', 0.07, 'D5 - A4 - D5 E5 F#5 - E5 - D5 - A4 - - - B4 - G4 - B4 C#5 D5 - C#5 - A4 - - - - - D5 - A4 - D5 E5 F#5 - G5 - F#5 - E5 - D5 - E5 - F#5 - E5 - C#5 - D5 - - - - - - -'],
    ['triangle', 0.25, 'D3 - A2 - D3 - A2 - G2 - D3 - G2 - D3 - A2 - E3 - A2 - E3 - D3 - A2 - D3 - A2 - G2 - B2 - A2 - C#3 -'],
  ] },
  cave: { step: 0.3, tracks: [
    ['triangle', 0.22, 'A4 - - C5 B4 - E4 - - - - - F4 - - A4 G4 - D4 - - - - - E4 - G4 - F4 - E4 - D4 - - - E4 - - - - - - -'],
    ['sine', 0.26, 'A2 - - - - - - - F2 - - - - - - - D2 - - - - - - - E2 - - - - - - -'],
  ] },
  battle: { step: 0.11, tracks: [
    ['square', 0.06, 'A4 C5 E5 A5 G5 E5 C5 E5 F4 A4 C5 F5 E5 C5 A4 C5 G4 B4 D5 G5 F5 D5 B4 D5 E4 G#4 B4 E5 D5 B4 G#4 B4'],
    ['triangle', 0.28, 'A2 . A2 . A2 . A3 . F2 . F2 . F2 . F3 . G2 . G2 . G2 . G3 . E2 . E2 . E2 . E3 .'],
  ] },
  boss: { step: 0.12, tracks: [
    ['square', 0.06, 'D5 - C5 - A4 - Bb4 - A4 - G4 - A4 - - - D5 - C5 - A4 - Bb4 - C5 - D5 - Eb5 - D5 - - -'],
    ['triangle', 0.3, 'D2 D2 D3 D2 D2 D2 C3 D2 Bb1 Bb1 Bb2 Bb1 A1 A1 A2 A1'],
  ] },
  victory: { step: 0.12, once: true, tracks: [
    ['square', 0.08, 'C5 E5 G5 C6 - - G5 - C6 - - - - - - -'],
    ['triangle', 0.25, 'C3 - - - - - G2 - C3 - - - - - - -'],
  ] },
  ending: { step: 0.24, tracks: [
    ['triangle', 0.22, 'C5 - E5 - G5 - - - F5 - E5 - D5 - - - E5 - G5 - C6 - - - B5 - A5 - G5 - - - A5 - F5 - D5 - - - G5 - E5 - C5 - - - D5 - - - E5 - - - C5 - - - - - - -'],
    ['sine', 0.24, 'C3 - - - - - - - F2 - - - - - - - A2 - - - - - - - G2 - - - - - - -'],
  ] },
};
const SONGS = {};
for (const k in SONG_SRC) {
  const s = SONG_SRC[k];
  const tracks = s.tracks.map(([type, vol, src]) => ({ type, vol, notes: parseTrack(src) }));
  SONGS[k] = { step: s.step, once: s.once, tracks, len: Math.max(...tracks.map((t) => t.notes.length)) };
}
function tone(f, t, dur, type = 'square', vol = 0.15) {
  if (!Snd.ac || !f) return;
  const ac = Snd.ac, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.06, dur));
  o.connect(g); g.connect(Snd.master); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function noise(t, dur, vol = 0.2, hp = 800) {
  if (!Snd.ac) return;
  const ac = Snd.ac, len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp; src.buffer = buf; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(Snd.master); src.start(t);
}
function schedule() {
  const s = Snd.song; if (!s || !Snd.ac) return;
  while (Snd.next < Snd.ac.currentTime + 0.2) {
    for (const tr of s.tracks) {
      if (s.once && Snd.step >= tr.notes.length) continue;
      const n = tr.notes[Snd.step % tr.notes.length];
      if (n) tone(n.f, Snd.next, n.d * s.step * 0.95, tr.type, tr.vol);
    }
    Snd.next += s.step; Snd.step++;
    if (s.once && Snd.step >= s.len) { Snd.song = null; break; }
  }
}
function music(name) {
  Snd.want = name;
  if (!Snd.ac || Snd.songName === name) return;
  Snd.songName = name; Snd.song = name ? SONGS[name] : null; Snd.step = 0; Snd.next = Snd.ac.currentTime + 0.08;
}
function sfx(n) {
  if (!Snd.ac) return;
  const t = Snd.ac.currentTime;
  switch (n) {
    case 'cursor': tone(880, t, 0.04, 'square', 0.05); break;
    case 'confirm': tone(988, t, 0.05, 'square', 0.07); tone(1319, t + 0.05, 0.07, 'square', 0.07); break;
    case 'cancel': tone(660, t, 0.05, 'square', 0.06); tone(440, t + 0.05, 0.06, 'square', 0.06); break;
    case 'buzz': tone(110, t, 0.15, 'sawtooth', 0.08); break;
    case 'hit': noise(t, 0.12, 0.35, 600); tone(140, t, 0.1, 'square', 0.08); break;
    case 'crit': noise(t, 0.2, 0.4, 300); tone(90, t, 0.2, 'sawtooth', 0.1); break;
    case 'magic': for (let i = 0; i < 6; i++) tone(500 + i * 140, t + i * 0.035, 0.12, 'triangle', 0.09); break;
    case 'heal': [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.2, 'sine', 0.12)); break;
    case 'chest': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.18, 'square', 0.07)); break;
    case 'level': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.2, 'square', 0.07)); break;
    case 'encounter': [220, 330, 220, 440].forEach((f, i) => tone(f, t + i * 0.06, 0.08, 'sawtooth', 0.08)); break;
    case 'door': noise(t, 0.08, 0.15, 2000); tone(200, t, 0.08, 'triangle', 0.1); break;
    case 'thud': tone(70, t, 0.25, 'sine', 0.3); noise(t, 0.2, 0.2, 100); break;
    case 'fire': noise(t, 0.5, 0.25, 1200); break;
    case 'ice': [1800, 2200, 2600].forEach((f, i) => tone(f, t + i * 0.05, 0.1, 'triangle', 0.06)); break;
    case 'down': tone(300, t, 0.3, 'sawtooth', 0.08); tone(150, t + 0.15, 0.4, 'sawtooth', 0.08); break;
    case 'wisp': [1047, 1319, 1568, 2093, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.15, 'sine', 0.1)); break;
  }
}
function setSound(on) {
  Snd.on = on; localStorage.setItem('dawnbeacon_sound', on ? 'on' : 'off');
  if (Snd.master) Snd.master.gain.value = on ? 0.45 : 0;
}
document.addEventListener('visibilitychange', () => { if (Snd.ac) { if (document.hidden) Snd.ac.suspend(); else Snd.ac.resume(); } });

// ===================== INPUT =====================
const held = { up: 0, down: 0, left: 0, right: 0, a: 0, b: 0, p: 0, m: 0 };
const inputQ = [];
const dirStack = [];
const rep = { k: null, t: 0 };
function press(k) {
  audioInit();
  if (held[k]) return;
  held[k] = 1; inputQ.push(k);
  if (DIRS[k]) { dirStack.push(k); rep.k = k; rep.t = -330; }
}
function release(k) {
  held[k] = 0;
  const i = dirStack.indexOf(k); if (i >= 0) dirStack.splice(i, 1);
  if (rep.k === k) rep.k = null;
}
function heldDir() { for (let i = dirStack.length - 1; i >= 0; i--) if (held[dirStack[i]]) return dirStack[i]; return null; }
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'a', Z: 'a', Enter: 'a', ' ': 'a', x: 'b', X: 'b', Escape: 'b', Backspace: 'b', Shift: 'b', c: 'p', C: 'p', q: 'p', Q: 'p', m: 'm', M: 'm', Tab: 'm' };
window.addEventListener('keydown', (e) => { const k = KEYMAP[e.key]; if (!k) return; e.preventDefault(); if (!e.repeat) press(k); });
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) release(k); });
window.addEventListener('blur', () => { for (const k in held) release(k); });

(function setupTouch() {
  const dpad = document.getElementById('dpad');
  let dDir = null, dId = null;
  const setDir = (d) => {
    if (d === dDir) return;
    if (dDir) release(dDir);
    dDir = d;
    if (d) press(d);
    dpad.dataset.dir = d || '';
  };
  const upd = (e) => {
    const r = dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.1) { setDir(null); return; }
    setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { dpad.setPointerCapture(e.pointerId); } catch (_) {} dId = e.pointerId; upd(e); });
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

// ===================== UI SYSTEM =====================
const UI = { dialog: null, menus: [], waiter: null, panel: null, fade: 1, fadeTo: 0, fadeRes: null, flash: 0, banner: null, goldBox: false };
let hits = [];

function tap(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return; }
  }
  if (UI.menus.length) return;
  if (UI.dialog || UI.waiter) { handleInput('a'); return; }
}

function wrap(text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

function say(text, name, hold) {
  return new Promise((res) => {
    font(10);
    const lines = wrap(text, 266), pages = [];
    for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    UI.dialog = { pages, p: 0, c: 0, name, res, hold, done: false };
  });
}
function advanceDialog() {
  const d = UI.dialog;
  const total = d.pages[d.p].join('').length;
  if (d.c < total) { d.c = total; return; }
  if (d.hold && d.p === d.pages.length - 1) return;
  d.p++; d.c = 0; sfx('cursor');
  if (d.p >= d.pages.length) { UI.dialog = null; d.res(); }
}
async function ask(text, name, opts = ['Yes', 'No']) {
  await say(text, name, true);
  const c = await choose(opts, { x: W - 64, y: 128 - opts.length * 12 - 12, w: 58, cancel: true });
  UI.dialog = null;
  return c;
}

function choose(items, o = {}) {
  return new Promise((res) => {
    items = items.map((it) => (typeof it === 'string' ? { label: it } : it));
    const m = { items, cursor: clamp(o.cursor || 0, 0, Math.max(0, items.length - 1)), cols: o.cols || 1, x: o.x, y: o.y, w: o.w, title: o.title,
      cancel: o.cancel !== false, res, max: o.max || 8, scroll: 0, onHover: o.onHover, extraHits: o.extraHits, desc: o.desc !== false };
    font(9);
    const rows = Math.ceil(items.length / m.cols);
    m.vis = Math.min(rows, m.max);
    if (!m.w) {
      let mw = 0; for (const it of items) mw = Math.max(mw, ctx.measureText(it.label).width + (it.right ? ctx.measureText(it.right).width + 12 : 0));
      if (m.title) { font(9, true); mw = Math.max(mw, ctx.measureText(m.title).width - 8); }
      m.w = Math.ceil(mw + 22) * m.cols + 8;
    }
    m.h = m.vis * 12 + 8 + (m.title ? 13 : 0);
    if (m.x == null) m.x = W - m.w - 4;
    if (m.y == null) m.y = 4;
    m.x = clamp(m.x, 0, W - m.w); m.y = clamp(m.y, 0, H - m.h);
    scrollMenu(m);
    UI.menus.push(m);
    if (m.onHover) m.onHover(m.cursor);
  });
}
function scrollMenu(m) {
  const r = Math.floor(m.cursor / m.cols);
  if (r < m.scroll) m.scroll = r;
  if (r >= m.scroll + m.vis) m.scroll = r - m.vis + 1;
}
function closeMenu(m, v) { const i = UI.menus.indexOf(m); if (i >= 0) UI.menus.splice(i, 1); m.res(v); }
function selectMenu(m) {
  const it = m.items[m.cursor];
  if (!it || it.disabled) { sfx('buzz'); return; }
  sfx('confirm'); closeMenu(m, m.cursor);
}
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
    let done = false;
    const w = () => fin();
    const fin = () => { if (done) return; done = true; if (UI.waiter === w) UI.waiter = null; res(); };
    UI.waiter = w; setTimeout(fin, ms);
  });
}
function fade(to) { return new Promise((res) => { UI.fadeTo = to; UI.fadeRes = res; }); }

function handleInput(k) {
  if (UI.menus.length) { menuInput(UI.menus[UI.menus.length - 1], k); return; }
  if (UI.dialog) { if (k === 'a' || k === 'b') advanceDialog(); return; }
  if (UI.waiter) { if (k === 'a' || k === 'b') { const w = UI.waiter; UI.waiter = null; w(); } return; }
  if (game.scene === 'map' && !busy) {
    if (P.moving) { if (k === 'a' || k === 'p' || k === 'm') pendingAction = k; return; }
    doMapAction(k);
  }
}
let pendingAction = null;
function doMapAction(k) {
  if (k === 'a') interact();
  else if (k === 'p') runScript(usePower);
  else if (k === 'm') runScript(pauseMenu);
}

// ---------- drawing helpers ----------
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function box(x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(46,64,150,0.96)'); g.addColorStop(1, 'rgba(18,26,80,0.96)');
  ctx.fillStyle = g; rrect(x, y, w, h, 3); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = '#e4eaff'; rrect(x + 0.5, y + 0.5, w - 1, h - 1, 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,30,0.6)'; rrect(x + 1.5, y + 1.5, w - 3, h - 3, 2); ctx.stroke();
}
function text(s, x, y, col = '#fff', align = 'left') {
  ctx.textAlign = align; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(s, x + 0.8, y + 0.8);
  ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
}
function bar(x, y, w, h, v, max, col) {
  ctx.fillStyle = '#0a0f30'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, (w * v) / Math.max(1, max)), h);
}
function el(x, y, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); ctx.fill(); }
function poly(pts, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
function rc(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

function drawMenu(m, top) {
  box(m.x, m.y, m.w, m.h);
  let y0 = m.y + 4;
  if (m.title) { font(9, true); text(m.title, m.x + 6, y0 + 9, '#ffe08a'); y0 += 13; }
  font(9);
  const n = m.items.length, c = m.cols, cw = (m.w - 8) / c, rows = Math.ceil(n / c);
  for (let r = m.scroll; r < m.scroll + m.vis && r < rows; r++) {
    for (let col = 0; col < c; col++) {
      const i = r * c + col; if (i >= n) break;
      const it = m.items[i], ix = m.x + 4 + col * cw, iy = y0 + (r - m.scroll) * 12;
      if (i === m.cursor && top) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(ix, iy, cw, 12);
        const bob = Math.sin(T / 120) * 0.8;
        poly([ix + 2 + bob, iy + 3, ix + 7 + bob, iy + 6, ix + 2 + bob, iy + 9], '#ffe08a');
      }
      text(it.label, ix + 10, iy + 9, it.disabled ? '#7d84a8' : it.color || '#fff');
      if (it.right) text(it.right, ix + cw - 3, iy + 9, it.disabled ? '#7d84a8' : '#cfe0ff', 'right');
      if (top) hits.push({ x: ix, y: iy, w: cw, h: 12, fn: () => { if (UI.menus[UI.menus.length - 1] !== m) return; m.cursor = i; if (m.onHover) m.onHover(i); selectMenu(m); } });
    }
  }
  if (m.scroll > 0) poly([m.x + m.w / 2 - 3, m.y + 3, m.x + m.w / 2 + 3, m.y + 3, m.x + m.w / 2, m.y], '#fff');
  if (m.scroll + m.vis < rows) poly([m.x + m.w / 2 - 3, m.y + m.h - 3, m.x + m.w / 2 + 3, m.y + m.h - 3, m.x + m.w / 2, m.y + m.h], '#fff');
  if (top && m.extraHits) for (const eh of m.extraHits) hits.push({ ...eh, fn: () => { if (UI.menus[UI.menus.length - 1] !== m) return; m.cursor = eh.index; if (m.onHover) m.onHover(eh.index); selectMenu(m); } });
}

function drawUI() {
  if (UI.panel) UI.panel();
  for (let i = 0; i < UI.menus.length; i++) drawMenu(UI.menus[i], i === UI.menus.length - 1);
  const top = UI.menus[UI.menus.length - 1];
  if (top && top.desc && top.items[top.cursor] && top.items[top.cursor].desc) {
    box(2, 2, W - 4, 18); font(9); text(top.items[top.cursor].desc, 8, 14, '#fff');
  }
  if (UI.goldBox && state) { box(W - 76, H - 22, 72, 18); font(9, true); text(state.gold + ' G', W - 10, H - 9, '#ffe08a', 'right'); }
  const d = UI.dialog;
  if (d) {
    const y = 132;
    box(4, y, W - 8, 56);
    if (d.name) { font(9, true); const w = ctx.measureText(d.name).width + 14; box(8, y - 15, w, 16); text(d.name, 15, y - 4, '#ffe08a'); }
    font(10);
    let left = d.c;
    d.pages[d.p].forEach((ln, i) => { const s = ln.slice(0, Math.max(0, left)); left -= ln.length; text(s, 12, y + 16 + i * 14); });
    const total = d.pages[d.p].join('').length;
    if (d.c >= total && !(d.hold && d.p === d.pages.length - 1)) poly([W - 18, y + 46 + Math.sin(T / 150), W - 10, y + 46 + Math.sin(T / 150), W - 14, y + 51 + Math.sin(T / 150)], '#ffe08a');
  }
}

// ===================== TILES =====================
const SOLID = new Set('T~#HRBOPCcSFKbYLrM '.split(''));
const VARY = new Set(['.', '_', 'H', '=', 'M', 'W']);
const ANIM = new Set(['~', 'o', '|']);
function tileImg(c, v, f, gr) {
  const key = c + v + '|' + f + '|' + gr;
  let cv = tileCache.get(key);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = cv.height = TS * S;
    const g = cv.getContext('2d'); g.setTransform(S, 0, 0, S, 0, 0);
    paintTile(g, c, v, f, gr);
    tileCache.set(key, cv);
  }
  return cv;
}
function paintTile(g, c, v, f, gr) {
  const R = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const rng = mulberry(v * 97 + c.charCodeAt(0) * 13 + 7);
  const under = () => paintTile(g, gr, v, 0, gr);
  switch (c) {
    case '.':
      R('#58a23e', 0, 0, 16, 16);
      for (let i = 0; i < 6; i++) { const x = (rng() * 14) | 0, y = (rng() * 13) | 0; R('#448a32', x, y + 1, 1, 2); R('#448a32', x + 1, y, 1, 2); }
      for (let i = 0; i < 3; i++) R('#7cc45a', (rng() * 15) | 0, (rng() * 15) | 0);
      break;
    case 'f':
      paintTile(g, '.', v, 0, gr);
      for (let i = 0; i < 3; i++) {
        const x = 1 + ((rng() * 12) | 0), y = 1 + ((rng() * 12) | 0), col = ['#f4e04d', '#f07aa0', '#ffffff', '#a0c0ff'][(rng() * 4) | 0];
        R(col, x, y + 1, 3, 1); R(col, x + 1, y, 1, 3); R('#e09030', x + 1, y + 1);
      }
      break;
    case 'T':
      paintTile(g, '.', v, 0, gr);
      R('rgba(0,0,0,0.25)', 2, 13, 12, 3); R('#6b4423', 6, 10, 4, 5); R('#4e3018', 6, 10, 1, 5);
      R('#2a6326', 2, 3, 12, 8); R('#2a6326', 3, 1, 10, 11); R('#2a6326', 1, 5, 14, 4);
      R('#3a8232', 3, 2, 9, 7); R('#3a8232', 2, 5, 11, 3); R('#5aa845', 5, 3, 4, 2); R('#5aa845', 4, 4, 2, 2); R('#76c060', 6, 3, 2, 1);
      break;
    case '~': {
      R('#2f6fc0', 0, 0, 16, 16);
      for (let i = 0; i < 4; i++) { const y = (i * 4 + f) % 16, x = (i * 7 + f * 2) % 14; R('#4f8fe0', x, y, 5, 1); R('#9ccaff', x + 1, y, 2, 1); }
      R('#2a63b0', 0, 15, 16, 1);
      break;
    }
    case 'o': paintTile(g, '~', 0, f, gr); R('#5a5652', 2, 4, 12, 9); R('#7d7872', 3, 4, 10, 6); R('#9a948c', 4, 5, 5, 2); break;
    case '|': R('#2f6fc0', 0, 0, 16, 16); R('#6a4422', 1, 0, 14, 16); for (let y = 0; y < 16; y += 4) { R('#9a6a3a', 2, y, 12, 3); R('#b8844a', 2, y, 12, 1); } R('#4a2e16', 1, 0, 1, 16); R('#4a2e16', 14, 0, 1, 16); break;
    case '=':
      R('#c9a46a', 0, 0, 16, 16);
      for (let i = 0; i < 5; i++) R('#b08850', (rng() * 15) | 0, (rng() * 15) | 0, 2, 1);
      for (let i = 0; i < 4; i++) R('#dcbb85', (rng() * 15) | 0, (rng() * 15) | 0);
      break;
    case '#':
      R('#2c2638', 0, 0, 16, 16);
      R('#433b52', 1, 1, 6, 5); R('#433b52', 9, 1, 6, 5); R('#433b52', 4, 8, 8, 4); R('#433b52', 0, 8, 2, 4); R('#433b52', 14, 8, 2, 4); R('#433b52', 1, 13, 6, 3); R('#433b52', 9, 13, 6, 3);
      R('#5a5070', 1, 1, 6, 1); R('#5a5070', 9, 1, 6, 1); R('#5a5070', 4, 8, 8, 1); R('#5a5070', 1, 13, 6, 1); R('#5a5070', 9, 13, 6, 1);
      break;
    case '_':
      R('#544a42', 0, 0, 16, 16);
      for (let i = 0; i < 5; i++) R('#463d36', (rng() * 15) | 0, (rng() * 15) | 0, 2, 1);
      for (let i = 0; i < 3; i++) R('#685c50', (rng() * 15) | 0, (rng() * 15) | 0);
      break;
    case 'M':
      R('#6e6050', 0, 0, 16, 16);
      R('#857462', 0, 0, 16, 3); R('#5a4e42', 0, 7, 16, 1); R('#5a4e42', 0, 12, 16, 1);
      R('#958370', (v * 4) % 12, 1, 4, 1); R('#4a4036', 3 + v, 3, 1, 4); R('#4a4036', 10 - v, 8, 1, 4);
      break;
    case 'v': paintTile(g, 'M', 0, 0, gr); R('#130e0c', 3, 4, 10, 12); R('#130e0c', 4, 2, 8, 2); R('#2a201a', 3, 4, 1, 12); R('#2a201a', 12, 4, 1, 12); break;
    case 'H':
      R('#e6d4a6', 0, 0, 16, 16); R('#c8b488', 0, 8, 16, 1);
      R('#8a5a32', 0, 0, 16, 2); R('#8a5a32', 0, 14, 16, 2); R('#8a5a32', 0, 0, 2, 16);
      if (v % 2 === 0) { R('#6b4a2a', 5, 4, 8, 7); R('#9fd3f0', 6, 5, 6, 5); R('#d8f0ff', 6, 5, 2, 2); R('#6b4a2a', 8, 5, 1, 5); R('#6b4a2a', 6, 7, 6, 1); }
      break;
    case 'R':
      R('#b8442f', 0, 0, 16, 16);
      for (let y = 0; y < 16; y += 4) { R('#8f2f22', 0, y + 3, 16, 1); for (let x = (y % 8 ? 2 : 0); x < 16; x += 4) { R('#d0603f', x, y, 3, 1); R('#8f2f22', x + 3, y, 1, 3); } }
      break;
    case 'D': paintTile(g, 'H', 1, 0, gr); R('#4a2e16', 3, 2, 10, 14); R('#7a5030', 4, 3, 8, 13); R('#5a3a1e', 8, 3, 1, 13); R('#e8c040', 10, 9, 1, 2); break;
    case 'W':
      R('#b07a48', 0, 0, 16, 16);
      for (let y = 3; y < 16; y += 4) R('#94623a', 0, y, 16, 1);
      R('#94623a', (v * 5) % 14, 0, 1, 3); R('#94623a', (v * 3 + 7) % 14, 4, 1, 3); R('#94623a', (v * 7) % 14, 8, 1, 3); R('#94623a', (v * 2 + 4) % 14, 12, 1, 3);
      break;
    case 'K': paintTile(g, 'W', 0, 0, 'W'); R('#5a3418', 0, 4, 16, 12); R('#7a4a26', 0, 5, 16, 9); R('#b07a48', 0, 2, 16, 4); R('#d09a60', 0, 2, 16, 1); break;
    case 'b': paintTile(g, 'W', 0, 0, 'W'); R('#6b4423', 1, 0, 14, 16); R('#e8e8f8', 2, 1, 12, 5); R('#ffffff', 4, 2, 8, 3); R('#3a68b0', 2, 6, 12, 9); R('#5a88d0', 2, 6, 12, 2); break;
    case 'Y': R('#5a3418', 0, 0, 16, 16); R('#7a4a26', 1, 1, 14, 14); R('#5a3418', 1, 7, 14, 1);
      for (let x = 2; x < 14; x += 2) { R(['#c03030', '#3060c0', '#30a050', '#d0a030', '#8040a0'][(x + v) % 5], x, 2 + (x % 3 === 0 ? 1 : 0), 2, 5 - (x % 3 === 0 ? 1 : 0)); R(['#3060c0', '#d0a030', '#c03030', '#30a050'][(x + 1) % 4], x, 9, 2, 5); }
      break;
    case 'X': R('#1a1410', 0, 0, 16, 16); R('#3a3028', 0, 0, 16, 2); R('#2a221c', 2, 4, 12, 2); R('#2a221c', 3, 8, 10, 2); break;
    case 'B':
      under();
      R('rgba(0,0,0,0.25)', 1, 13, 14, 3); R('#22471d', 1, 3, 14, 12); R('#2f6026', 2, 2, 12, 11); R('#3d7a30', 4, 3, 7, 5);
      for (let i = 0; i < 9; i++) { const x = 1 + ((rng() * 13) | 0), y = 2 + ((rng() * 11) | 0); R('#7a2048', x, y, 2, 1); R('#e04080', x, y); }
      R('#c8a0b0', 3, 2); R('#c8a0b0', 12, 5); R('#c8a0b0', 7, 12);
      break;
    case 'O':
      under();
      R('rgba(0,0,0,0.3)', 2, 12, 13, 4); R('#56524e', 2, 3, 12, 11); R('#56524e', 3, 2, 10, 13);
      R('#7d7872', 3, 3, 10, 8); R('#9a948c', 4, 3, 6, 4); R('#c0bab0', 5, 4, 3, 2); R('#46423e', 8, 9, 1, 4); R('#46423e', 9, 11, 3, 1);
      break;
    case 'r': under(); R('rgba(0,0,0,0.3)', 3, 12, 10, 3); R('#5a5652', 3, 6, 10, 8); R('#7d7872', 4, 6, 8, 5); R('#9a948c', 5, 7, 3, 2); break;
    case 'P': R('#544a42', 0, 0, 16, 16); R('#2a221c', 1, 1, 14, 14); R('#0d0a08', 2, 3, 12, 11); R('#000', 4, 5, 8, 7); break;
    case 'p': paintTile(g, '_', v, 0, gr); R('#46423e', 1, 1, 14, 14); R('#6d6862', 2, 2, 12, 11); R('#58534e', 4, 6, 8, 1); R('#58534e', 6, 10, 5, 1); break;
    case 'I': R('#bfe6ff', 0, 0, 16, 16); R('#e8f8ff', 2, 2, 7, 2); R('#e8f8ff', 2, 4, 2, 3); R('#9ccff0', 0, 15, 16, 1); R('#9ccff0', 15, 0, 1, 16); R('#ffffff', 11, 10, 2, 1); R('#ffffff', 12, 9, 1, 3); break;
    case 'C':
      under();
      R('rgba(0,0,0,0.3)', 2, 13, 13, 3); R('#5a3414', 2, 5, 12, 9); R('#9a5e26', 3, 6, 10, 7); R('#7a4a1e', 2, 3, 12, 3); R('#b87a3a', 3, 3, 10, 1);
      R('#e0b040', 2, 8, 12, 1); R('#e0b040', 7, 7, 2, 3); R('#fff0a0', 7, 7);
      break;
    case 'c': under(); R('rgba(0,0,0,0.3)', 2, 13, 13, 3); R('#5a3414', 2, 5, 12, 9); R('#9a5e26', 3, 8, 10, 5); R('#1a0e06', 3, 6, 10, 2); R('#7a4a1e', 2, 1, 12, 4); R('#e0b040', 2, 8, 12, 1); break;
    case 'S': under(); R('rgba(0,0,0,0.3)', 4, 13, 9, 3); R('#5a3a1e', 7, 9, 2, 6); R('#6b4423', 2, 2, 12, 8); R('#b08050', 3, 3, 10, 6); R('#6b4423', 4, 4, 8, 1); R('#6b4423', 4, 6, 6, 1); break;
    case 'F': under(); R('#8a6a42', 0, 5, 16, 2); R('#8a6a42', 0, 10, 16, 2); R('#6a4a2a', 2, 3, 2, 11); R('#6a4a2a', 12, 3, 2, 11); break;
    case 'L': paintTile(g, '_', 0, 0, gr); R('rgba(0,0,0,0.35)', 2, 12, 12, 4); R('#6a6278', 3, 9, 10, 6); R('#9a92aa', 2, 8, 12, 2); R('#4a4258', 3, 14, 10, 1); break;
    default: R('#000', 0, 0, 16, 16);
  }
}

// ===================== CHARACTERS =====================
function lookOf(n) {
  if (typeof n.look === 'string') return n.look.startsWith('hero:') ? HEROES[n.look.slice(5)].look : LOOKS[n.look];
  return n.look;
}
function drawChar(x, y, L, dir, step) {
  x = snap(x); y = snap(y);
  const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  R('rgba(0,0,0,0.28)', 3, 14, 10, 2);
  const side = dir === 'left' || dir === 'right';
  const bob = step ? -1 : 0;
  if (side) {
    const a = step === 1 ? -1 : step === 2 ? 1 : 0;
    R(L.pants, 6 + a, 11, 2, 4); R(L.pants, 8 - a, 11, 2, 4);
    R('#2a1e14', 6 + a, 14, 2, 1); R('#2a1e14', 8 - a, 14, 2, 1);
  } else {
    const la = step === 1 ? 1 : 0, lb = step === 2 ? 1 : 0;
    R(L.pants, 5, 11, 2, 4 - la); R(L.pants, 9, 11, 2, 4 - lb);
    R('#2a1e14', 5, 14 - la, 2, 1); R('#2a1e14', 9, 14 - lb, 2, 1);
  }
  R(L.tunic, 4, 7 + bob, 8, 5); R(shade(L.tunic), 4, 11 + bob, 8, 1);
  if (side) { const ax = dir === 'left' ? 8 : 6; R(shade(L.tunic, 0.85), ax, 8 + bob, 2, 3); R(L.skin, ax, 11 + bob, 2, 1); }
  else { R(L.tunic, 3, 8 + bob, 1, 3); R(L.tunic, 12, 8 + bob, 1, 3); R(L.skin, 3, 11 + bob, 1, 1); R(L.skin, 12, 11 + bob, 1, 1); }
  R(L.accent, 4, 10 + bob, 8, 1);
  if (L.scarf) { R(L.accent, 4, 7 + bob, 8, 1); if (dir === 'up') R(L.accent, 7, 8 + bob, 2, 3); else if (side) R(L.accent, dir === 'left' ? 11 : 3, 8 + bob, 2, 2); }
  const hy = bob;
  R(L.skin, 4, 1 + hy, 8, 6);
  const hc = L.hair;
  if (dir === 'down') {
    R(hc, 3, 0 + hy, 10, 2); R(hc, 3, 2 + hy, 2, 2); R(hc, 11, 2 + hy, 2, 2); R(hc, 5, 2 + hy, 3, 1);
    R('#1e1e2a', 6, 4 + hy, 1, 2); R('#1e1e2a', 9, 4 + hy, 1, 2);
    if (L.style === 'long') { R(hc, 3, 4 + hy, 1, 5); R(hc, 12, 4 + hy, 1, 5); }
    if (L.beard) R(L.beard, 5, 5 + hy, 6, 3);
  } else if (dir === 'up') {
    R(hc, 3, 0 + hy, 10, 6); if (L.style === 'long') R(hc, 4, 6 + hy, 8, 3);
  } else {
    const lf = dir === 'left';
    R(hc, 3, 0 + hy, 10, 2);
    if (lf) { R(hc, 8, 2 + hy, 5, 3); R(hc, 11, 5 + hy, 1, 2); R('#1e1e2a', 5, 4 + hy, 1, 2); if (L.style === 'long') R(hc, 10, 5 + hy, 3, 4); if (L.beard) R(L.beard, 4, 5 + hy, 4, 3); }
    else { R(hc, 3, 2 + hy, 5, 3); R(hc, 4, 5 + hy, 1, 2); R('#1e1e2a', 10, 4 + hy, 1, 2); if (L.style === 'long') R(hc, 3, 5 + hy, 3, 4); if (L.beard) R(L.beard, 8, 5 + hy, 4, 3); }
  }
  if (L.style === 'spiky') { R(hc, 3, -1 + hy, 2, 1); R(hc, 7, -2 + hy, 2, 2); R(hc, 11, -1 + hy, 2, 1); R(hc, 2, 1 + hy, 1, 2); R(hc, 13, 1 + hy, 1, 2); }
  if (L.style === 'bald') { R(L.skin, 4, 0 + hy, 8, 2); }
  if (L.style === 'hat') { R(L.accent, 2, 0 + hy, 12, 2); R(shade(L.accent), 4, -2 + hy, 8, 2); }
}

// ===================== ENEMIES =====================
const ESHAPES = {
  slime(t, c, C) {
    const s = 1 + 0.07 * Math.sin(t / 170);
    el(0, -11 * s, 15 / s, 11 * s, C(c)); el(0, -5, 13 / s, 5, C(shade(c, 0.8)));
    el(-5, -16 * s, 4, 3, C('rgba(255,255,255,0.55)'));
    el(-5, -11 * s, 2, 3, C('#1a1a2a')); el(5, -11 * s, 2, 3, C('#1a1a2a')); rc(-2, -6 * s, 4, 1, C('#1a1a2a'));
  },
  bat(t, c, C) {
    const f = Math.sin(t / 80) * 8;
    poly([-4, -24, -26, -32 + f, -21, -20, -15, -23, -9, -16], C(shade(c, 0.75)));
    poly([4, -24, 26, -32 + f, 21, -20, 15, -23, 9, -16], C(shade(c, 0.75)));
    el(0, -21, 7, 8, C(c));
    poly([-6, -26, -4, -34, -1, -28], C(c)); poly([6, -26, 4, -34, 1, -28], C(c));
    rc(-4, -23, 2, 2, C('#ff4a4a')); rc(2, -23, 2, 2, C('#ff4a4a')); rc(-2, -17, 1, 2, C('#fff')); rc(1, -17, 1, 2, C('#fff'));
  },
  bug(t, c, C) {
    const k = Math.sin(t / 120) * 1.5;
    rc(-10, -7, 2, 7, C('#3a5a20')); rc(-2, -7, 2, 7, C('#3a5a20')); rc(6, -7, 2, 7, C('#3a5a20'));
    el(-3, -12, 13, 8, C(c)); el(-6, -19, 9, 4, C('rgba(230,255,220,0.45)'));
    el(10, -18, 6, 6, C(c)); el(12, -19, 2, 2, C('#fff')); rc(12, -19, 1, 1, C('#000'));
    poly([4, -16, 13 + k, -36, 20 + k, -32, 9, -17], C('#dde4ec')); poly([7, -18, 15 + k, -34, 13 + k, -36], C('#ffffff'));
    rc(-14, -14, 4, 2, C(shade(c, 0.6)));
  },
  mole(t, c, C) {
    const b = Math.sin(t / 220);
    el(0, -13 + b, 15, 13, C(c)); el(0, -9 + b, 9, 8, C('#d8b088'));
    el(0, -16 + b, 4, 3, C('#f08890')); rc(-7, -22 + b, 2, 2, C('#1a1a1a')); rc(5, -22 + b, 2, 2, C('#1a1a1a'));
    poly([-15, -10, -21, -4, -18, -3, -16, -7, -15, -2, -12, -6], C('#f0e8d8')); poly([15, -10, 21, -4, 18, -3, 16, -7, 15, -2, 12, -6], C('#f0e8d8'));
  },
  golem(t, c, C) {
    const b = Math.sin(t / 300);
    rc(-11, -9, 8, 9, C(shade(c, 0.7))); rc(3, -9, 8, 9, C(shade(c, 0.7)));
    rc(-13, -33 + b, 26, 25, C(c)); rc(-13, -33 + b, 26, 3, C(shade(c, 1.2)));
    rc(-21, -31 + b, 8, 21, C(shade(c, 0.8))); rc(13, -31 + b, 8, 21, C(shade(c, 0.8)));
    rc(-8, -45 + b, 16, 12, C(c)); rc(-5, -41 + b, 3, 2, C('#7ff8ff')); rc(2, -41 + b, 3, 2, C('#7ff8ff'));
    rc(-4, -27 + b, 1, 9, C(shade(c, 0.5))); rc(-4, -19 + b, 5, 1, C(shade(c, 0.5))); rc(6, -30 + b, 1, 6, C(shade(c, 0.5)));
  },
  lantern(t, c, C) {
    const fl = Math.sin(t / 60) * 1.5;
    poly([-7, -18, 7, -18, 3, -6, 0, 2 + Math.sin(t / 200) * 3, -3, -6], C('rgba(170,210,255,0.4)'));
    rc(-9, -38, 18, 20, C('#2a2a3a')); rc(-7, -36, 14, 16, C(c)); el(0, -27, 4, 6 + fl, C('#ff8030')); el(0, -26, 2, 3, C('#fff6c0'));
    rc(-10, -40, 20, 3, C('#3a3a50')); rc(-10, -19, 20, 2, C('#3a3a50')); rc(-1, -36, 2, 16, C('#2a2a3a'));
    ctx.strokeStyle = C('#3a3a50'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -42, 4, Math.PI, 0); ctx.stroke();
    rc(-5, -32, 2, 3, C('#2a1a3a')); rc(3, -32, 2, 3, C('#2a1a3a'));
  },
  boss(t, c, C) {
    const sw = Math.sin(t / 300) * 3;
    el(0, -38, 40 + sw, 42, C('rgba(140,50,220,0.16)'));
    poly([-34, 0, 34, 0, 24, -48, 12, -62, 0, -66, -12, -62, -24, -48], C(c));
    poly([-24, 0, -10, 0, -12, -50, -18, -46], C(shade(c, 1.35))); poly([24, 0, 10, 0, 12, -50, 18, -46], C(shade(c, 0.7)));
    poly([-22, -46, -42, -22 + sw, -36, -18 + sw, -16, -36], C(shade(c, 0.8))); poly([22, -46, 42, -22 - sw, 36, -18 - sw, 16, -36], C(shade(c, 0.8)));
    for (let i = 0; i < 3; i++) { poly([-42 + i * 3, -22 + sw, -44 + i * 3, -14 + sw, -40 + i * 3, -20 + sw], C('#d8c8f0')); poly([42 - i * 3, -22 - sw, 44 - i * 3, -14 - sw, 40 - i * 3, -20 - sw], C('#d8c8f0')); }
    poly([-10, -62, -18, -80, -5, -66], C('#c8b8d8')); poly([10, -62, 18, -80, 5, -66], C('#c8b8d8'));
    el(0, -56, 14, 13, C('#1a0f28')); el(0, -54, 10, 9, C('#05020a'));
    const gl = 0.7 + Math.sin(t / 150) * 0.3;
    el(-4, -55, 2.5, 1.6, C(`rgba(255,80,220,${gl})`)); el(4, -55, 2.5, 1.6, C(`rgba(255,80,220,${gl})`));
    rc(-14, -40, 28, 2, C('#a070d0')); el(0, -39, 3, 3, C('#ff60e0'));
  },
};
function drawEnemy(d, cx, by, t, sc = 1, flash = false, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, by); ctx.scale(sc, sc);
  el(0, 0, d.boss ? 30 : 14, d.boss ? 5 : 3, 'rgba(0,0,0,0.3)');
  if (d.float) ctx.translate(0, -8 + Math.sin(t / 260 + cx) * 3);
  const C = flash ? () => '#ffffff' : (c) => c;
  ESHAPES[d.shape](t, d.color, C);
  ctx.restore();
}

// ===================== STATE =====================
let state = null, cur = null, B = null;
const game = { scene: 'boot' };
const P = { x: 0, y: 0, fx: 0, fy: 0, t: 1, moving: false, dir: 'down', anim: 0 };
let busy = false, encSteps = 20, T = 0;
const mapFx = [];

function newState() {
  state = { map: 'village', x: 12, y: 8, dir: 'down', party: [], gold: 30, items: { herb: 2 }, flags: {}, mods: {}, wisps: {}, steps: 0,
    inn: { map: 'village', x: 20, y: 5, dir: 'down' } };
  state.party.push(makeMember('kai', 1), makeMember('lyra', 1));
}
function makeMember(id, lv) { const m = { id, lv, xp: 0, hp: 1, ep: 1, weapon: null, armor: null }; const s = stats(m); m.hp = s.hp; m.ep = s.ep; return m; }
function stats(m) {
  const h = HEROES[m.id], o = {};
  for (const k of ['hp', 'ep', 'atk', 'def', 'agi']) o[k] = Math.floor(h.base[k] + h.grow[k] * (m.lv - 1));
  if (m.weapon) o.atk += ITEMS[m.weapon].atk;
  if (m.armor) o.def += ITEMS[m.armor].def;
  const ws = state ? state.wisps : {};
  for (const wid in ws) if (ws[wid] === m.id && !(B && B.resting[wid])) { const b = WISPS[wid].bonus; for (const k in b) o[k] += b[k]; }
  return o;
}
const xpNext = (lv) => Math.floor(10 * Math.pow(lv, 1.5));
const hname = (m) => HEROES[m.id].name;
function addItem(id, n = 1) { state.items[id] = (state.items[id] || 0) + n; }
function removeItem(id) { if (--state.items[id] <= 0) delete state.items[id]; }
function artsOf(m) { return HEROES[m.id].arts.filter((a) => a[1] <= m.lv).map((a) => a[0]); }
function clampHero(m) { const s = stats(m); m.hp = Math.min(m.hp, s.hp); m.ep = Math.min(m.ep, s.ep); }
function saveGame() {
  state.map = cur.id; state.x = P.x; state.y = P.y; state.dir = P.dir;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
}
function loadGame() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.party) { state = s; return true; } } catch (e) {}
  return false;
}

// ===================== MAP =====================
function loadMap(id) {
  const def = MAPS[id];
  const t = def.rows.map((r) => r.split(''));
  const mods = state.mods[id] || {};
  for (const k in mods) { const [x, y] = k.split(',').map(Number); t[y][x] = mods[k]; }
  cur = { id, def, w: t[0].length, h: t.length, t, npcs: [], moving: null };
  syncNpcs();
  mapFx.length = 0;
  encSteps = ri(10, 20);
  music(def.music);
  if (!def.interior) UI.banner = { text: def.name, t: 2600 };
}
function syncNpcs() {
  if (!cur) return;
  cur.npcs = cur.npcs.filter((n) => !n.cond || n.cond());
  for (const n of cur.def.npcs || []) {
    if (cur.npcs.some((m) => m.id === n.id)) continue;
    if (n.cond && !n.cond()) continue;
    cur.npcs.push({ ...n, fx: n.x, fy: n.y, t: 1, moving: false, dir: n.dir || 'down', home: { x: n.x, y: n.y }, wt: rand(800, 2500) });
  }
}
function tileAt(x, y) { if (x < 0 || y < 0 || x >= cur.w || y >= cur.h) return ' '; return cur.t[y][x]; }
function setTile(x, y, c) { cur.t[y][x] = c; (state.mods[cur.id] = state.mods[cur.id] || {})[x + ',' + y] = c; }
function npcAt(x, y) { return cur.npcs.find((n) => (n.x === x && n.y === y) || (n.moving && n.fx === x && n.fy === y)); }
function wispAt(x, y) { return (cur.def.wisps || []).find((w) => w.x === x && w.y === y && !(w.id in state.wisps)); }
function blocked(x, y, self) {
  if (SOLID.has(tileAt(x, y))) return true;
  if (cur.npcs.some((n) => n !== self && ((n.x === x && n.y === y) || (n.moving && n.fx === x && n.fy === y)))) return true;
  if (wispAt(x, y)) return true;
  if (self && ((P.x === x && P.y === y) || (P.moving && P.fx === x && P.fy === y))) return true;
  return false;
}
function placePlayer(x, y, dir) { P.x = P.fx = x; P.y = P.fy = y; P.t = 1; P.moving = false; P.dir = dir || P.dir; }

async function runScript(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } catch (e) { console.error(e); }
  busy = false;
}
async function warp(to, x, y, dir) {
  sfx('door');
  await fade(1);
  loadMap(to); placePlayer(x, y, dir);
  await fade(0);
  if (cur.def.onEnter) await cur.def.onEnter();
}

function updateMap(dt) {
  for (const n of cur.npcs) {
    if (n.moving) { n.t += dt / 300; n.anim = (n.anim || 0) + dt; if (n.t >= 1) { n.t = 1; n.moving = false; } continue; }
    if (!n.wander || busy || UI.dialog || UI.menus.length) continue;
    n.wt -= dt; if (n.wt > 0) continue;
    n.wt = rand(1200, 3400);
    const d = pick(Object.keys(DIRS)); n.dir = d;
    const nx = n.x + DIRS[d][0], ny = n.y + DIRS[d][1];
    if (Math.abs(nx - n.home.x) > 2 || Math.abs(ny - n.home.y) > 2 || blocked(nx, ny, n)) continue;
    n.fx = n.x; n.fy = n.y; n.x = nx; n.y = ny; n.t = 0; n.moving = true;
  }
  if (P.moving) {
    P.t += dt / (held.b ? 105 : 185); P.anim += dt;
    if (P.t < 1) return;
    P.t = 1; P.moving = false;
    onStep();
    if (busy) return;
    if (pendingAction) { const k = pendingAction; pendingAction = null; doMapAction(k); return; }
  }
  if (busy || UI.dialog || UI.menus.length || UI.panel || game.scene !== 'map') return;
  const d = heldDir();
  if (!d) { P.anim = 0; return; }
  P.dir = d;
  const nx = P.x + DIRS[d][0], ny = P.y + DIRS[d][1];
  if (!blocked(nx, ny)) { P.fx = P.x; P.fy = P.y; P.x = nx; P.y = ny; P.t = 0; P.moving = true; }
}
function onStep() {
  state.steps++;
  if (state.steps % 4 === 0) for (const m of state.party) if (m.hp > 0) m.ep = Math.min(stats(m).ep, m.ep + 1);
  const w = (cur.def.warps || []).find((w) => w.x === P.x && w.y === P.y);
  if (w) { runScript(() => warp(w.to, w.tx, w.ty, w.dir)); return; }
  if (cur.def.onStep) { const s = cur.def.onStep(P.x, P.y); if (s) { runScript(s); return; } }
  if (cur.def.enc && !SAFE_TILES.has(tileAt(P.x, P.y))) {
    if (--encSteps <= 0) { encSteps = ri(12, 24); runScript(randomBattle); }
  }
}
const SAFE_TILES = new Set(['v', 'X', 'I', '|']);

async function randomBattle() {
  const group = pick(ENCOUNTERS[cur.def.enc]);
  const r = await battle(group, { bg: cur.def.bg });
  if (r === 'lose') await gameOver();
}

function interact() {
  const [dx, dy] = DIRS[P.dir];
  const x = P.x + dx, y = P.y + dy;
  let n = npcAt(x, y);
  const c = tileAt(x, y);
  if (!n && c === 'K') n = npcAt(x + dx, y + dy);
  if (n) {
    runScript(async () => {
      if (!n.enemy) n.dir = OPP[P.dir];
      await n.talk(n);
    });
    return;
  }
  const w = wispAt(x, y);
  if (w) { runScript(() => getWisp(w)); return; }
  if (c === 'C') { runScript(() => openChest(x, y)); return; }
  if (c === 'S') { runScript(() => say(cur.def.signs[x + ',' + y])); return; }
  if (c === 'L') { runScript(() => cur.def.beacon()); return; }
  if (c === 'B') { runScript(() => say("A tangle of thorny brambles. A little fire would clear these right out...")); return; }
  if (c === 'O') { runScript(() => say("A huge boulder. A Terra adept could Shove it with Attunement.")); return; }
  if (c === 'P') { runScript(() => say("A deep pit. Something heavy could fill it in.")); return; }
  if (c === '~' && cur.def.dark) { runScript(() => say("Dark, icy water. Too cold and deep to swim.")); return; }
}

async function openChest(x, y) {
  const ch = cur.def.chests[x + ',' + y];
  setTile(x, y, 'c'); sfx('chest');
  if (ch.gold) { state.gold += ch.gold; await say(`Found ${ch.gold} gold!`); return; }
  addItem(ch.item, ch.n || 1);
  await say(`Found ${ch.n > 1 ? ch.n + ' ' : ''}${ITEMS[ch.item].name}${ch.n > 1 ? 's' : ''}!`);
}
async function getWisp(w) {
  const counts = state.party.map((m) => Object.values(state.wisps).filter((o) => o === m.id).length);
  const who = state.party[counts.indexOf(Math.min(...counts))];
  state.wisps[w.id] = who.id;
  const d = WISPS[w.id];
  sfx('wisp');
  for (let i = 0; i < 20; i++) mapFx.push({ x: w.x * TS + 8, y: w.y * TS + 8, vx: rand(-1, 1), vy: rand(-1.5, 0.5), life: 1, col: ELEM_COL[d.elem], s: 2 });
  await say(`You found the ${ELEM_NAME[d.elem]} Wisp "${d.name}"! It joins ${hname(who)}.`);
  const b = Object.entries(d.bonus).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ');
  await say(`${d.name} boosts ${b}. In battle, unleash it for ${d.un.name}!`);
}

// ---------- field powers ----------
const WALKABLE_GROUND = new Set(['.', '_', '=', 'f', 'I', 'p', 'o', 'W']);
const POWERS = {
  shove: { name: 'Shove', ep: 1, desc: 'Terra: push a boulder away from you.', match: (c) => c === 'O', miss: 'There is nothing to Shove.',
    async apply(x, y, dx, dy) {
      const nx = x + dx, ny = y + dy, dc = tileAt(nx, ny);
      const occupied = npcAt(nx, ny) || wispAt(nx, ny) || (P.x === nx && P.y === ny);
      if (occupied || !(WALKABLE_GROUND.has(dc) || dc === 'P' || dc === '~')) { sfx('buzz'); await say("The boulder won't budge that way."); return false; }
      setTile(x, y, cur.def.ground);
      cur.moving = { x, y, tx: nx, ty: ny, t: 0 };
      sfx('thud');
      await sleep(260);
      cur.moving = null;
      if (dc === 'P') { setTile(nx, ny, 'p'); sfx('thud'); burst(nx * TS + 8, ny * TS + 8, '#a09080', 14); await say('The boulder filled the pit!'); }
      else if (dc === '~') { setTile(nx, ny, 'o'); burst(nx * TS + 8, ny * TS + 8, '#9ccaff', 14); }
      else setTile(nx, ny, 'O');
      return true;
    } },
  kindle: { name: 'Kindle', ep: 2, desc: 'Flame: burn away thorny brambles.', match: (c) => c === 'B', miss: 'There is nothing to burn.',
    async apply(x, y) {
      sfx('fire');
      for (let i = 0; i < 30; i++) mapFx.push({ x: x * TS + rand(2, 14), y: y * TS + rand(4, 15), vx: rand(-0.3, 0.3), vy: rand(-1.2, -0.4), life: rand(0.6, 1), col: pick(['#ff7a3a', '#ffcf40', '#ff4020']), s: 2 });
      await sleep(500);
      setTile(x, y, cur.def.ground);
      return true;
    } },
  chill: { name: 'Chill', ep: 2, desc: 'Tide: freeze water into a path of ice.', match: (c) => c === '~', miss: 'There is no water to freeze.',
    async apply(x, y, dx, dy) {
      for (let i = 0; i < 8 && tileAt(x, y) === '~'; i++) {
        setTile(x, y, 'I'); sfx('ice');
        burst(x * TS + 8, y * TS + 8, '#dff4ff', 8);
        await sleep(110);
        x += dx; y += dy;
      }
      return true;
    } },
};
function burst(x, y, col, n = 12) { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(0.4, 1.6); mapFx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col, s: 2 }); } }

async function usePower() {
  const opts = state.party.filter((m) => HEROES[m.id].field).map((m) => ({ m, p: POWERS[HEROES[m.id].field] }));
  const i = await choose(opts.map((o) => ({ label: o.p.name, right: o.p.ep + ' EP', desc: `${hname(o.m)} · ${o.p.desc}` })), { title: 'Attunement', x: 8, y: 26 });
  if (i < 0) return;
  const { m, p } = opts[i];
  if (m.hp <= 0) { await say(`${hname(m)} is down and can't use Attunement.`); return; }
  if (m.ep < p.ep) { await say(`${hname(m)} doesn't have enough EP.`); return; }
  const [dx, dy] = DIRS[P.dir];
  let target = null;
  for (let d = 1; d <= 2; d++) {
    const x = P.x + dx * d, y = P.y + dy * d, c = tileAt(x, y);
    if (p.match(c)) { target = { x, y }; break; }
    if (SOLID.has(c) && c !== '~') break;
    if (p === POWERS.chill) break;
  }
  const col = ELEM_COL[HEROES[m.id].elem];
  sfx('magic');
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; mapFx.push({ x: P.x * TS + 8, y: P.y * TS + 8, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, life: 1, col, s: 2 }); }
  await sleep(300);
  if (!target) { await say(p.miss); return; }
  if (await p.apply(target.x, target.y, dx, dy)) m.ep -= p.ep;
}

// ---------- map rendering ----------
function camera() {
  const px = (P.fx + (P.x - P.fx) * P.t) * TS, py = (P.fy + (P.y - P.fy) * P.t) * TS;
  const mw = cur.w * TS, mh = cur.h * TS;
  const cx = mw <= W ? (mw - W) / 2 : clamp(px + 8 - W / 2, 0, mw - W);
  const cy = mh <= H ? (mh - H) / 2 : clamp(py + 8 - H / 2, 0, mh - H);
  return { cx: snap(cx), cy: snap(cy), px, py };
}
function renderMap() {
  rc(0, 0, W, H, '#000');
  const { cx, cy, px, py } = camera();
  const x0 = Math.max(0, Math.floor(cx / TS)), y0 = Math.max(0, Math.floor(cy / TS));
  const x1 = Math.min(cur.w - 1, Math.floor((cx + W) / TS)), y1 = Math.min(cur.h - 1, Math.floor((cy + H) / TS));
  const fr = Math.floor(T / 260) % 4, gr = cur.def.ground;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = cur.t[y][x];
    const v = VARY.has(c) || c === 'T' || c === 'f' || c === 'B' || c === 'O' ? hash(x, y) % 4 : 0;
    ctx.drawImage(tileImg(c, v, ANIM.has(c) ? fr : 0, gr), x * TS - cx, y * TS - cy, TS, TS);
  }
  // beacon crystal
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cur.t[y][x] === 'L') {
    const bx = x * TS - cx + 8, by = y * TS - cy + 4 + Math.sin(T / 400);
    const lit = state.flags.beaconLit;
    if (lit) { const g = ctx.createRadialGradient(bx, by, 2, bx, by, 60); g.addColorStop(0, 'rgba(255,230,140,0.55)'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.fillRect(bx - 60, by - 60, 120, 120); }
    poly([bx, by - 9, bx + 5, by, bx, by + 6, bx - 5, by], lit ? '#ffe070' : '#6a7a9a');
    poly([bx, by - 9, bx + 5, by, bx, by], lit ? '#fff8c0' : '#8a9aba');
  }
  if (cur.moving) {
    const m = cur.moving; m.t = Math.min(1, m.t + 1 / 14);
    ctx.drawImage(tileImg('O', 0, 0, cur.def.ground), (m.x + (m.tx - m.x) * m.t) * TS - cx, (m.y + (m.ty - m.y) * m.t) * TS - cy, TS, TS);
  }
  // sprites sorted by y
  const spr = [];
  for (const n of cur.npcs) {
    const nx = (n.fx + (n.x - n.fx) * n.t) * TS, ny = (n.fy + (n.y - n.fy) * n.t) * TS;
    spr.push({ y: ny, draw: () => {
      if (n.enemy) drawEnemy(ENEMIES[n.enemy], nx - cx + 8, ny - cy + 16, T, 0.42);
      else drawChar(nx - cx, ny - cy, lookOf(n), n.dir, n.moving ? (Math.floor(n.anim / 150) % 2) + 1 : 0);
    } });
  }
  for (const w of cur.def.wisps || []) {
    if (w.id in state.wisps) continue;
    const col = ELEM_COL[WISPS[w.id].elem];
    spr.push({ y: w.y * TS, draw: () => {
      const wx = w.x * TS - cx + 8, wy = w.y * TS - cy + 7 + Math.sin(T / 250) * 2;
      const g = ctx.createRadialGradient(wx, wy, 1, wx, wy, 12); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.6; ctx.fillStyle = g; ctx.fillRect(wx - 12, wy - 12, 24, 24); ctx.globalAlpha = 1;
      el(wx, wy, 4, 4, col); el(wx - 1, wy - 1, 2, 2, '#fff');
      el(wx - 5, wy - 1 + Math.sin(T / 90), 3, 1.5, 'rgba(255,255,255,0.7)'); el(wx + 5, wy - 1 + Math.sin(T / 90), 3, 1.5, 'rgba(255,255,255,0.7)');
    } });
  }
  const step = P.moving ? (Math.floor(P.anim / 140) % 2) + 1 : 0;
  spr.push({ y: py + 0.1, draw: () => drawChar(px - cx, py - cy, HEROES[state.party[0].id].look, P.dir, step) });
  spr.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  // particles
  for (let i = mapFx.length - 1; i >= 0; i--) {
    const p = mapFx[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.025;
    if (p.life <= 0) { mapFx.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life * 1.5); rc(p.x - cx - p.s / 2, p.y - cy - p.s / 2, p.s, p.s, p.col); ctx.globalAlpha = 1;
  }
  if (cur.def.dark && !state.flags.beaconLit) {
    const sx = px - cx + 8, sy = py - cy + 8;
    const g = ctx.createRadialGradient(sx, sy, 30, sx, sy, 170);
    g.addColorStop(0, 'rgba(5,0,15,0)'); g.addColorStop(1, 'rgba(5,0,15,0.72)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (UI.banner) {
    const b = UI.banner; const a = clamp(Math.min(b.t / 400, (2600 - b.t) / 300), 0, 1);
    ctx.globalAlpha = a; font(10, true); const w = ctx.measureText(b.text).width + 24;
    box((W - w) / 2, 6, w, 20); text(b.text, W / 2, 20, '#ffe08a', 'center'); ctx.globalAlpha = 1;
  }
}

// ===================== BATTLE =====================
function makeEnemy(id) {
  const d = ENEMIES[id];
  return { id, d, name: d.name, hp: d.hp, maxhp: d.hp, atk: d.atk, def: d.def, agi: d.agi, x: 0, y: 0, flash: 0, shake: 0, alive: true, dying: 0, lunge: 0 };
}
const heroPos = (i) => ({ x: 194 + i * 28, y: 98 });
const enemyHitPos = (e) => ({ x: e.x, y: e.y - (e.d.float ? 8 : 0) - e.d.h * (e.d.boss ? 1.1 : 1) * 0.55 });

async function msg(t, ms = 650) { B.msg = t; await waitOrTap(ms + t.length * 14); }

async function battle(ids, opt = {}) {
  B = { enemies: ids.map(makeEnemy), fx: [], floats: [], msg: '', resting: {}, guard: {}, buffs: {}, active: -1, target: null, allyTarget: null,
    boss: !!opt.boss, bg: opt.bg || 'field', lastCmd: {}, heroShake: {}, heroLunge: {} };
  const counts = {};
  B.enemies.forEach((e) => (counts[e.id] = (counts[e.id] || 0) + 1));
  const seen = {};
  B.enemies.forEach((e) => { if (counts[e.id] > 1) { seen[e.id] = (seen[e.id] || 0) + 1; e.name += ' ' + 'ABC'[seen[e.id] - 1]; } });
  const n = B.enemies.length;
  B.enemies.forEach((e, i) => { e.x = e.d.boss ? 100 : 104 + (i - (n - 1) / 2) * 58; e.y = e.d.boss ? 118 : 112; });

  sfx('encounter');
  for (let i = 0; i < 3; i++) { UI.flash = 0.9; await sleep(110); }
  game.scene = 'battle';
  music(opt.boss ? 'boss' : 'battle');
  await msg(B.enemies.map((e) => e.name).join(', ') + (n > 1 ? ' appear!' : ' appears!'), 600);

  let result = null;
  while (!result) {
    B.guard = {};
    let acts = await commandPhase();
    if (acts === 'flee') {
      await msg('The party tries to run...', 300);
      if (B.boss) { await msg("There's no escape!"); acts = []; }
      else if (Math.random() < 0.65) { sfx('cancel'); await msg('Got away safely!'); result = 'flee'; break; }
      else { await msg("Couldn't escape!"); acts = []; }
    }
    for (const e of B.enemies) if (e.alive) { acts.push({ type: 'enemy', actor: e }); if (e.d.twice && e.hp < e.maxhp / 2) acts.push({ type: 'enemy', actor: e }); }
    const spd = (a) => (a.type === 'defend' ? 9999 : a.type === 'enemy' ? a.actor.agi : stats(a.actor).agi) * rand(0.8, 1.2);
    acts.forEach((a) => (a.spd = spd(a)));
    acts.sort((a, b) => b.spd - a.spd);
    for (const a of acts) {
      await doAction(a);
      result = checkEnd();
      if (result) break;
    }
    if (!result) await endRound();
  }

  if (result === 'win') await victory();
  B.resting = {};
  for (const m of state.party) { if (m.hp <= 0 && result === 'win') m.hp = 1; clampHero(m); }
  if (result !== 'lose') {
    await fade(1);
    B = null; game.scene = 'map'; music(cur.def.music);
    await fade(0);
  }
  return result;
}
function checkEnd() {
  if (B.enemies.every((e) => !e.alive)) return 'win';
  if (state.party.every((m) => m.hp <= 0)) return 'lose';
  return null;
}
async function endRound() {
  for (const id in B.buffs) for (const k in B.buffs[id]) { if (--B.buffs[id][k] <= 0) delete B.buffs[id][k]; }
  for (const wid in B.resting) {
    if (--B.resting[wid] <= 0) {
      delete B.resting[wid];
      const owner = state.party.find((m) => m.id === state.wisps[wid]);
      if (owner && owner.hp > 0) await msg(`${WISPS[wid].name} is ready again on ${hname(owner)}.`, 400);
    }
  }
  for (const m of state.party) clampHero(m);
}

async function commandPhase() {
  const alive = state.party.map((m, i) => i).filter((i) => state.party[i].hp > 0);
  const acts = [];
  let k = 0;
  B.msg = '';
  while (k < alive.length) {
    const i = alive[k], m = state.party[i];
    B.active = i;
    const a = await chooseCommand(m, i, k === 0);
    if (a === 'back') { if (k > 0) { k--; acts.pop(); } continue; }
    if (a === 'flee') { B.active = -1; return 'flee'; }
    acts.push(a); k++;
  }
  B.active = -1;
  return acts;
}
async function chooseCommand(m, i, first) {
  const cmds = [['Fight', 'fight'], ['Arts', 'arts'], ['Wisp', 'wisp'], ['Item', 'item'], ['Defend', 'defend'], ['Flee', 'flee']];
  const s = stats(m);
  while (true) {
    const c = await choose(cmds.map((c) => ({ label: c[0], disabled: c[1] === 'flee' && !first })), { x: 82, y: 136, w: 202, cols: 3, cursor: B.lastCmd[i] || 0, max: 2 });
    if (c < 0) return 'back';
    B.lastCmd[i] = c;
    const key = cmds[c][1];
    if (key === 'fight') { const t = await pickEnemy(); if (t) return { type: 'fight', actor: m, target: t }; continue; }
    if (key === 'defend') return { type: 'defend', actor: m };
    if (key === 'flee') return 'flee';
    if (key === 'arts') {
      const list = artsOf(m);
      const j = await choose(list.map((id) => ({ label: ARTS[id].name, right: ARTS[id].ep + ' EP', disabled: ARTS[id].ep > m.ep, desc: ARTS[id].desc })),
        { x: 82, y: 192 - Math.min(list.length, 4) * 12 - 21, w: 160, title: `Arts  (EP ${m.ep}/${s.ep})`, max: 4, cursor: B.lastArt?.[i] || 0 });
      if (j < 0) continue;
      (B.lastArt = B.lastArt || {})[i] = j;
      const art = ARTS[list[j]];
      const tg = await pickTargets(art.target);
      if (tg == null) continue;
      return { type: 'art', actor: m, art: list[j], target: tg };
    }
    if (key === 'wisp') {
      const list = Object.keys(state.wisps).filter((w) => state.wisps[w] === m.id);
      if (!list.length) { B.msg = `${hname(m)} has no Wisps. Find them while exploring!`; await waitOrTap(1500); B.msg = ''; continue; }
      const j = await choose(list.map((w) => ({ label: WISPS[w].name, right: B.resting[w] ? 'resting' : WISPS[w].un.name, disabled: !!B.resting[w], color: ELEM_COL[WISPS[w].elem],
        desc: `Unleash ${WISPS[w].un.name}. (Its stat boost is lost while it rests.)` })), { x: 82, y: 192 - list.length * 12 - 21, w: 190, title: 'Wisps' });
      if (j < 0) continue;
      const tg = await pickTargets(WISPS[list[j]].un.target);
      if (tg == null) continue;
      return { type: 'wisp', actor: m, wisp: list[j], target: tg };
    }
    if (key === 'item') {
      const list = Object.keys(state.items).filter((id) => ITEMS[id].use);
      if (!list.length) { B.msg = 'You have no usable items.'; await waitOrTap(1200); B.msg = ''; continue; }
      const j = await choose(list.map((id) => ({ label: ITEMS[id].name, right: 'x' + state.items[id], desc: ITEMS[id].desc })), { x: 82, y: 192 - Math.min(list.length, 4) * 12 - 21, w: 160, title: 'Items', max: 4 });
      if (j < 0) continue;
      const tg = await pickTargets(ITEMS[list[j]].target);
      if (tg == null) continue;
      return { type: 'item', actor: m, item: list[j], target: tg };
    }
  }
}
async function pickEnemy() {
  const al = B.enemies.filter((e) => e.alive);
  if (al.length === 1) return al[0];
  const extraHits = al.map((e, i) => ({ x: e.x - 20, y: e.y - e.d.h - 14, w: 40, h: e.d.h + 16, index: i }));
  const j = await choose(al.map((e) => ({ label: e.name, right: `${Math.ceil((e.hp / e.maxhp) * 100)}%` })), { x: 82, y: 136, w: 202, max: 4, extraHits, onHover: (k) => (B.target = al[k]) });
  B.target = null;
  return j < 0 ? null : al[j];
}
async function pickAlly(dead) {
  const list = state.party.filter((m) => (dead ? m.hp <= 0 : m.hp > 0));
  if (!list.length) { B.msg = dead ? 'Nobody needs reviving.' : 'No valid target.'; await waitOrTap(1000); B.msg = ''; return null; }
  const j = await choose(list.map((m) => ({ label: hname(m), right: `${m.hp}/${stats(m).hp}` })), { x: 82, y: 136, w: 150, max: 4, onHover: (k) => (B.allyTarget = list[k]) });
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
function buffMul(m, k) { return B.buffs[m.id] && B.buffs[m.id][k] ? (k === 'def' ? 1.5 : 1.3) : 1; }
function elemMul(t, elem) { return t.d.weak === elem ? 1.5 : t.d.resist === elem ? 0.5 : 1; }
function retarget(t) { if (t && t.alive) return t; const al = B.enemies.filter((e) => e.alive); return al.length ? pick(al) : null; }
function float(x, y, txt, col) { B.floats.push({ x, y, txt, col, t: 0 }); }
function bfx(x, y, col, n = 16, spread = 2, up = 0) {
  for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(0.3, spread); B.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: 1, col, s: rand(1.5, 3) }); }
}
function elemFx(x, y, elem) {
  const col = ELEM_COL[elem] || '#fff';
  if (elem === 'flame') { for (let i = 0; i < 26; i++) B.fx.push({ x: x + rand(-12, 12), y: y + rand(-4, 14), vx: rand(-0.3, 0.3), vy: rand(-2, -0.6), life: 1, col: pick(['#ff7a3a', '#ffcf40', '#ff3a20']), s: rand(2, 4) }); }
  else if (elem === 'tide') { for (let i = 0; i < 20; i++) B.fx.push({ x: x + rand(-14, 14), y: y - rand(10, 30), vx: 0, vy: rand(1, 2.5), life: 1, col: pick(['#bfe6ff', '#5ab8ff', '#ffffff']), s: rand(2, 3) }); }
  else if (elem === 'terra') { for (let i = 0; i < 18; i++) B.fx.push({ x: x + rand(-14, 14), y: y + 14, vx: rand(-0.8, 0.8), vy: rand(-3, -1.2), life: 1, col: pick(['#a07850', '#e0b050', '#7a5a3a']), s: rand(2, 4), g: 0.12 }); }
  else bfx(x, y, col, 22, 2.4);
}

async function hitEnemy(t, dmg, note) {
  t.hp = Math.max(0, t.hp - dmg); t.flash = 260; t.shake = 260;
  const p = enemyHitPos(t);
  float(p.x, p.y - 8, String(dmg), '#fff');
  if (note) float(p.x, p.y - 20, note, '#ffe060');
  if (t.hp <= 0 && t.alive) {
    t.alive = false; t.dying = 1;
    await sleep(320); sfx('down');
    await msg(`${t.name} was defeated!`, 350);
  }
}
async function hitHero(m, dmg) {
  if (B.guard[m.id]) dmg = Math.max(1, Math.round(dmg / 2));
  m.hp = Math.max(0, m.hp - dmg);
  const i = state.party.indexOf(m), hp = heroPos(i);
  B.heroShake[m.id] = 300;
  float(hp.x + 8, hp.y - 2, String(dmg), '#ff8080');
  if (m.hp <= 0) { sfx('down'); await sleep(250); await msg(`${hname(m)} is down!`, 400); }
}
function healHero(m, amt) {
  const s = stats(m), before = m.hp;
  m.hp = Math.min(s.hp, m.hp + amt);
  const i = state.party.indexOf(m), hp = heroPos(i);
  float(hp.x + 8, hp.y - 2, '+' + (m.hp - before), '#80ff9a');
  for (let k = 0; k < 12; k++) B.fx.push({ x: hp.x + rand(2, 14), y: hp.y + rand(4, 16), vx: 0, vy: rand(-1.2, -0.4), life: 1, col: pick(['#80ff9a', '#e0ffe0', '#ffffff']), s: 2 });
}

async function doAction(a) {
  if (a.type === 'enemy') return enemyAct(a.actor);
  const m = a.actor;
  if (m.hp <= 0) return;
  const s = stats(m), name = hname(m), i = state.party.indexOf(m);
  switch (a.type) {
    case 'defend':
      B.guard[m.id] = true; await msg(`${name} takes a defensive stance.`, 300); break;
    case 'fight': {
      const t = retarget(a.target); if (!t) return;
      B.msg = `${name} attacks!`; B.heroLunge[m.id] = 250; await sleep(220);
      let dmg = physDmg(s.atk * buffMul(m, 'atk'), t.def), note = null;
      if (Math.random() < 0.08) { dmg = Math.round(dmg * 1.6); note = 'Critical!'; sfx('crit'); } else sfx('hit');
      const p = enemyHitPos(t);
      for (let k = 0; k < 10; k++) B.fx.push({ x: p.x - 12 + k * 2.4, y: p.y - 12 + k * 2.4, vx: 0, vy: 0, life: 0.8, col: '#ffffff', s: 2 });
      await hitEnemy(t, dmg, note);
      await sleep(350);
      break;
    }
    case 'art': {
      const art = ARTS[a.art];
      if (m.ep < art.ep) { await msg(`${name} doesn't have enough EP!`); return; }
      m.ep -= art.ep;
      await castEffect(m, name, art.name, art, a.target, s);
      break;
    }
    case 'wisp': {
      const w = WISPS[a.wisp];
      if (B.resting[a.wisp]) return;
      B.resting[a.wisp] = 3; // ends after this round + 2 more
      await castEffect(m, name, `${w.name}! ${w.un.name}`, { ...w.un, elem: w.elem }, a.target, s, true);
      clampHero(m);
      break;
    }
    case 'item': {
      const it = ITEMS[a.item];
      if (!state.items[a.item]) { await msg(`No ${it.name}s left!`); return; }
      removeItem(a.item);
      B.msg = `${name} uses a ${it.name}.`; await sleep(400); sfx('heal');
      if (it.use === 'heal') { const t = a.target.hp > 0 ? a.target : null; if (t) healHero(t, it.power); }
      else if (it.use === 'ep') { const t = a.target; if (t.hp > 0) { const st = stats(t), b = t.ep; t.ep = Math.min(st.ep, t.ep + it.power); const hp = heroPos(state.party.indexOf(t)); float(hp.x + 8, hp.y - 2, '+' + (t.ep - b) + ' EP', '#80c8ff'); } }
      else if (it.use === 'revive') { const t = a.target; if (t.hp <= 0) { t.hp = Math.ceil(stats(t).hp / 2); await msg(`${hname(t)} is revived!`, 300); } }
      else if (it.use === 'healAll') state.party.filter((p) => p.hp > 0).forEach((p) => healHero(p, it.power));
      await sleep(600);
      break;
    }
  }
  void i;
}
async function castEffect(m, name, label, eff, target, s, isWisp) {
  B.msg = `${name} casts ${label}!`;
  if (isWisp) B.msg = `${name} unleashes ${label}!`;
  sfx('magic');
  const hp = heroPos(state.party.indexOf(m));
  bfx(hp.x + 8, hp.y + 8, ELEM_COL[eff.elem], 14, 1.5, 0.5);
  await sleep(450);
  if (eff.type === 'dmg') {
    const targets = target === 'all' ? B.enemies.filter((e) => e.alive) : [retarget(target)].filter(Boolean);
    const base = eff.power + s.atk * buffMul(m, 'atk') * 0.3 + m.lv * (isWisp ? 2 : 1.5);
    targets.forEach((t) => { const p = enemyHitPos(t); elemFx(p.x, p.y, eff.elem); });
    sfx(eff.elem === 'flame' ? 'fire' : eff.elem === 'tide' ? 'ice' : 'hit');
    await sleep(350);
    for (const t of targets) {
      const mul = elemMul(t, eff.elem);
      const dmg = Math.max(1, Math.round((base * mul - t.def * 0.3) * rand(0.9, 1.1)));
      await hitEnemy(t, dmg, mul > 1 ? 'Weak spot!' : mul < 1 ? 'Resisted' : null);
    }
  } else if (eff.type === 'heal') {
    sfx('heal');
    const amt = eff.power + m.lv * 3;
    const targets = target === 'all' ? state.party.filter((p) => p.hp > 0) : [target].filter((p) => p.hp > 0);
    targets.forEach((t) => healHero(t, Math.round(amt * rand(0.95, 1.05))));
  } else if (eff.type === 'buff') {
    sfx('heal');
    for (const p of state.party) if (p.hp > 0) { (B.buffs[p.id] = B.buffs[p.id] || {})[eff.stat] = 3; const hp = heroPos(state.party.indexOf(p)); float(hp.x + 8, hp.y - 2, eff.stat.toUpperCase() + '↑', '#ffe060'); bfx(hp.x + 8, hp.y + 8, ELEM_COL[eff.elem], 8); }
    await msg(eff.stat === 'atk' ? "The party's attack rose!" : "The party's defense rose!", 300);
  } else if (eff.type === 'revive') {
    if (target.hp <= 0) { sfx('heal'); target.hp = Math.ceil(stats(target).hp / 2); const hp = heroPos(state.party.indexOf(target)); bfx(hp.x + 8, hp.y + 8, '#ffffff', 20); await msg(`${hname(target)} is revived!`, 300); }
  }
  await sleep(550);
}
async function enemyAct(e) {
  if (!e.alive) return;
  const targets = state.party.filter((m) => m.hp > 0);
  if (!targets.length) return;
  const art = (e.d.arts || []).find((a) => Math.random() < a.chance);
  e.lunge = 260;
  if (art) {
    B.msg = `${e.name} uses ${art.name}!`; sfx('magic'); await sleep(450);
    const tg = art.target === 'all' ? targets : [pick(targets)];
    tg.forEach((t) => { const hp = heroPos(state.party.indexOf(t)); elemFx(hp.x + 8, hp.y + 4, art.elem); });
    sfx('hit'); await sleep(300);
    for (const t of tg) {
      const st = stats(t);
      const resist = HEROES[t.id].elem === art.elem ? 0.75 : 1;
      const dmg = Math.max(1, Math.round(((art.power + e.atk * 0.4) * resist - st.def * buffMul(t, 'def') * 0.3) * rand(0.9, 1.1)));
      await hitHero(t, dmg);
    }
  } else {
    const t = pick(targets);
    B.msg = `${e.name} attacks ${hname(t)}!`; await sleep(320); sfx('hit');
    const hp = heroPos(state.party.indexOf(t));
    bfx(hp.x + 8, hp.y + 6, '#ffffff', 10, 1.6);
    await hitHero(t, physDmg(e.atk, stats(t).def * buffMul(t, 'def')));
  }
  await sleep(380);
}
async function victory() {
  music('victory');
  B.resting = {};
  const xp = B.enemies.reduce((a, e) => a + e.d.xp, 0), gold = B.enemies.reduce((a, e) => a + e.d.gold, 0);
  state.gold += gold;
  await msg(`Victory! Gained ${xp} XP and ${gold} gold.`, 1300);
  for (const m of state.party) {
    if (m.hp <= 0) continue;
    m.xp += xp;
    while (m.xp >= xpNext(m.lv)) {
      m.xp -= xpNext(m.lv);
      const before = stats(m), oldArts = artsOf(m);
      m.lv++;
      const after = stats(m);
      m.hp += after.hp - before.hp; m.ep += after.ep - before.ep;
      sfx('level');
      await msg(`${hname(m)} reached level ${m.lv}!`, 1100);
      for (const a of artsOf(m)) if (!oldArts.includes(a)) await msg(`${hname(m)} learned ${ARTS[a].name}!`, 1100);
    }
  }
  if (!B.boss && Math.random() < 0.18) { const it = pick(['herb', 'herb', 'tonic']); addItem(it); sfx('chest'); await msg(`The enemy dropped a ${ITEMS[it].name}!`, 900); }
}

// ---------- battle render ----------
function drawBattleBg(kind) {
  if (kind === 'field') {
    const g = ctx.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#5aa8e8'); g.addColorStop(1, '#d4efff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 134);
    el(30, 30, 18, 6, 'rgba(255,255,255,0.8)'); el(44, 27, 12, 6, 'rgba(255,255,255,0.8)'); el(220, 44, 22, 6, 'rgba(255,255,255,0.7)'); el(236, 40, 12, 6, 'rgba(255,255,255,0.7)');
    el(60, 98, 110, 26, '#7ab868'); el(240, 100, 100, 22, '#6aa858');
    rc(0, 96, W, 38, '#5aa040'); for (let x = 0; x < W; x += 9) rc(x + ((x * 7) % 5), 100 + ((x * 13) % 26), 2, 2, '#4a8a34');
    el(104, 114, 92, 14, '#4c8c36'); el(228, 112, 56, 10, '#4c8c36');
  } else if (kind === 'cave') {
    const g = ctx.createLinearGradient(0, 0, 0, 134); g.addColorStop(0, '#120c1c'); g.addColorStop(1, '#3a2c2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 134);
    for (let i = 0; i < 12; i++) { const x = i * 26 + 6; poly([x, 0, x + 12, 0, x + 6, 16 + ((i * 37) % 22)], '#2a2034'); }
    rc(0, 96, W, 38, '#3a3028'); el(104, 114, 92, 14, '#4a3c32'); el(228, 112, 56, 10, '#4a3c32');
    for (let i = 0; i < 8; i++) el((i * 47) % W, 40 + ((i * 29) % 40), 1.2, 1.2, 'rgba(160,140,255,0.5)');
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 134); g.addColorStop(0, '#12041a'); g.addColorStop(1, '#4a1030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 134);
    for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.12; el(144 + Math.cos(T / 1500 + i) * 60, 60 + Math.sin(T / 1300 + i * 2) * 25, 80, 18, '#b040ff'); }
    ctx.globalAlpha = 1;
    rc(0, 96, W, 38, '#2a1428'); el(104, 116, 100, 16, '#3a1c38'); el(228, 112, 56, 10, '#3a1c38');
  }
}
function renderBattle(dt) {
  drawBattleBg(B.bg);
  for (const e of B.enemies) {
    e.flash = Math.max(0, e.flash - dt); e.shake = Math.max(0, e.shake - dt); e.lunge = Math.max(0, e.lunge - dt);
    if (!e.alive) { e.dying = Math.max(0, e.dying - dt / 500); if (e.dying <= 0) continue; }
    const x = e.x + (e.shake > 0 ? Math.sin(T / 15) * 2 : 0) + (e.lunge > 0 ? Math.sin((e.lunge / 260) * Math.PI) * 8 : 0);
    drawEnemy(e.d, x, e.y, T, e.d.boss ? 1.05 : 1, e.flash > 0 && Math.floor(e.flash / 60) % 2 === 0, e.alive ? 1 : e.dying);
    if (B.target === e) { const p = enemyHitPos(e); const yy = e.y - e.d.h * (e.d.boss ? 1.1 : 1) - 14 - (e.d.float ? 8 : 0) + Math.sin(T / 120) * 2; poly([p.x - 5, yy, p.x + 5, yy, p.x, yy + 6], '#ffe060'); }
  }
  state.party.forEach((m, i) => {
    const p = heroPos(i);
    const sh = B.heroShake[m.id] || 0; B.heroShake[m.id] = Math.max(0, sh - dt);
    const lu = B.heroLunge[m.id] || 0; B.heroLunge[m.id] = Math.max(0, lu - dt);
    let x = p.x + (sh > 0 ? Math.sin(T / 15) * 2 : 0) - (lu > 0 ? Math.sin((lu / 250) * Math.PI) * 14 : 0), y = p.y;
    if (B.active === i) y -= 2 + Math.abs(Math.sin(T / 150)) * 2;
    if (m.hp <= 0) { ctx.globalAlpha = 0.45; drawChar(x, y + 2, HEROES[m.id].look, 'up', 0); ctx.globalAlpha = 1; }
    else drawChar(x, y, HEROES[m.id].look, 'up', 0);
    if (B.guard[m.id]) { ctx.strokeStyle = 'rgba(160,220,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 8, y + 8, 11, 0, Math.PI * 2); ctx.stroke(); }
    if (B.allyTarget === m) poly([x + 3, y - 8 + Math.sin(T / 120) * 2, x + 13, y - 8 + Math.sin(T / 120) * 2, x + 8, y - 2 + Math.sin(T / 120) * 2], '#ffe060');
  });
  for (let i = B.fx.length - 1; i >= 0; i--) {
    const p = B.fx[i]; p.x += p.vx; p.y += p.vy; if (p.g) p.vy += p.g; p.life -= 0.022;
    if (p.life <= 0) { B.fx.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life * 1.6); rc(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s, p.col); ctx.globalAlpha = 1;
  }
  font(10, true);
  for (let i = B.floats.length - 1; i >= 0; i--) {
    const f = B.floats[i]; f.t += dt;
    if (f.t > 1000) { B.floats.splice(i, 1); continue; }
    const yy = f.y - Math.min(10, f.t / 25);
    ctx.globalAlpha = f.t > 700 ? 1 - (f.t - 700) / 300 : 1;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.textAlign = 'center'; ctx.strokeText(f.txt, f.x, yy); text(f.txt, f.x, yy, f.col, 'center');
    ctx.globalAlpha = 1;
  }
  // status panels
  state.party.forEach((m, i) => {
    const s = stats(m), x = 2 + i * 95, y = 2;
    box(x, y, 94, 31);
    if (B.active === i) { ctx.strokeStyle = '#ffe060'; ctx.lineWidth = 1; rrect(x + 0.5, y + 0.5, 93, 30, 3); ctx.stroke(); }
    font(9, true); text(hname(m), x + 5, y + 10, m.hp <= 0 ? '#ff7070' : '#fff');
    font(8); text('Lv' + m.lv, x + 89, y + 10, '#cfe0ff', 'right');
    const buffs = B.buffs[m.id] ? Object.keys(B.buffs[m.id]) : [];
    if (buffs.length) text(buffs.map((b) => b.toUpperCase() + '↑').join(' '), x + 40, y + 10, '#ffe060');
    font(8); text('HP', x + 5, y + 20, '#9fb4ff'); text(`${m.hp}/${s.hp}`, x + 89, y + 20, m.hp < s.hp / 4 ? '#ffb060' : '#fff', 'right');
    bar(x + 18, y + 21, 71, 2, m.hp, s.hp, '#5ae07a');
    text('EP', x + 5, y + 29, '#9fb4ff'); text(`${m.ep}/${s.ep}`, x + 89, y + 29, '#fff', 'right');
    bar(x + 18, y + 30, 71, 1.5, m.ep, s.ep, '#5ab8ff');
  });
  // message / command box
  box(2, 134, W - 4, 56);
  if (B.active >= 0) {
    const m = state.party[B.active];
    font(10, true); text(hname(m), 10, 152, '#ffe08a');
    font(8); text(ELEM_NAME[HEROES[m.id].elem] + ' adept', 10, 164, ELEM_COL[HEROES[m.id].elem]);
    const ws = Object.keys(state.wisps).filter((w) => state.wisps[w] === m.id);
    if (ws.length) text('Wisps: ' + ws.filter((w) => !B.resting[w]).length + '/' + ws.length, 10, 176, '#cfe0ff');
  } else if (B.msg) {
    font(10); wrap(B.msg, 268).slice(0, 3).forEach((ln, i) => text(ln, 10, 152 + i * 14));
  }
}

// ===================== MENUS (field) =====================
async function chooseMember(title, right, filter, o = {}) {
  const list = state.party.filter(filter || (() => true));
  if (!list.length) return null;
  const j = await choose(list.map((m) => ({ label: hname(m), right: right ? right(m) : `HP ${m.hp}/${stats(m).hp}` })), { title, x: o.x ?? 100, y: o.y ?? 30, w: o.w });
  return j < 0 ? null : list[j];
}
async function pauseMenu() {
  let c = 0;
  UI.goldBox = true;
  while (true) {
    c = await choose(['Party', 'Items', 'Arts', 'Wisps', 'Save', Snd.on ? 'Sound: On' : 'Sound: Off'], { x: W - 84, y: 4, w: 80, cursor: c });
    if (c < 0) break;
    if (c === 0) { UI.goldBox = false; UI.panel = drawPartyPanel; await waitKey(); UI.panel = null; UI.goldBox = true; }
    if (c === 1) await itemsMenu();
    if (c === 2) await fieldArtsMenu();
    if (c === 3) await wispMenu();
    if (c === 4) { UI.goldBox = false; const ok = saveGame(); sfx(ok ? 'chest' : 'buzz'); await say(ok ? 'Your progress has been saved.' : 'Could not save on this device.'); UI.goldBox = true; }
    if (c === 5) setSound(!Snd.on);
  }
  UI.goldBox = false;
}
function drawPartyPanel() {
  rc(0, 0, W, H, 'rgba(0,0,0,0.4)');
  state.party.forEach((m, i) => {
    const n = state.party.length, w = n === 3 ? 94 : 140, x = 2 + i * (w + 1), y = 2;
    box(x, y, w, 188);
    const s = stats(m), L = HEROES[m.id].look;
    drawChar(x + 6, y + 6, L, 'down', 0);
    font(10, true); text(hname(m), x + 26, y + 14, '#ffe08a');
    font(8); text(`Lv ${m.lv}  ${ELEM_NAME[HEROES[m.id].elem]}`, x + 26, y + 24, ELEM_COL[HEROES[m.id].elem]);
    const rows = [['HP', `${m.hp}/${s.hp}`], ['EP', `${m.ep}/${s.ep}`], ['ATK', s.atk], ['DEF', s.def], ['AGI', s.agi], ['Next', `${xpNext(m.lv) - m.xp} XP`]];
    rows.forEach(([k, v], r) => { text(k, x + 6, y + 40 + r * 11, '#9fb4ff'); text(String(v), x + w - 6, y + 40 + r * 11, '#fff', 'right'); });
    text('Wpn: ' + (m.weapon ? ITEMS[m.weapon].name : '—'), x + 6, y + 110, '#fff');
    text('Arm: ' + (m.armor ? ITEMS[m.armor].name : '—'), x + 6, y + 121, '#fff');
    const ws = Object.keys(state.wisps).filter((w) => state.wisps[w] === m.id);
    text('Wisps:', x + 6, y + 136, '#9fb4ff');
    ws.forEach((w, k) => text(WISPS[w].name, x + 10, y + 147 + k * 10, ELEM_COL[WISPS[w].elem]));
    if (!ws.length) text('none', x + 10, y + 147, '#7d84a8');
  });
  font(8); text('Press A to close', W - 6, H - 4, '#cfe0ff', 'right');
}
async function useItemField(id) {
  const it = ITEMS[id];
  if (!it.use) { await say(`${it.name} is equipment. Buy gear at the shop to equip it.`); return; }
  if (it.use === 'healAll') { removeItem(id); sfx('heal'); state.party.filter((m) => m.hp > 0).forEach((m) => (m.hp = Math.min(stats(m).hp, m.hp + it.power))); await say('Everyone feels refreshed!'); return; }
  const dead = it.use === 'revive';
  const m = await chooseMember(`Use ${it.name} on:`, (m) => `${m.hp}/${stats(m).hp}`, (m) => (dead ? m.hp <= 0 : m.hp > 0));
  if (!m) { if (dead) await say('Nobody needs reviving.'); return; }
  removeItem(id); sfx('heal');
  const s = stats(m);
  if (it.use === 'heal') m.hp = Math.min(s.hp, m.hp + it.power);
  if (it.use === 'ep') m.ep = Math.min(s.ep, m.ep + it.power);
  if (it.use === 'revive') m.hp = Math.ceil(s.hp / 2);
  await say(`${hname(m)} used the ${it.name}.`);
}
async function itemsMenu() {
  let c = 0;
  while (true) {
    const list = Object.keys(state.items);
    if (!list.length) { await say('Your bag is empty.'); return; }
    c = await choose(list.map((id) => ({ label: ITEMS[id].name, right: 'x' + state.items[id], desc: ITEMS[id].desc })), { title: 'Items', x: 8, y: 26, w: 150, cursor: c, max: 9 });
    if (c < 0) return;
    await useItemField(list[c]);
  }
}
async function fieldArtsMenu() {
  const m = await chooseMember('Whose Arts?', (m) => `EP ${m.ep}/${stats(m).ep}`, (m) => m.hp > 0);
  if (!m) return;
  while (true) {
    const list = artsOf(m);
    const j = await choose(list.map((id) => ({ label: ARTS[id].name, right: ARTS[id].ep + ' EP', desc: ARTS[id].desc, disabled: !(ARTS[id].type === 'heal' || ARTS[id].type === 'revive') || ARTS[id].ep > m.ep })),
      { title: `${hname(m)}  EP ${m.ep}/${stats(m).ep}`, x: 8, y: 26, w: 160 });
    if (j < 0) return;
    const art = ARTS[list[j]];
    if (art.target === 'allAllies') { m.ep -= art.ep; sfx('heal'); state.party.filter((p) => p.hp > 0).forEach((p) => (p.hp = Math.min(stats(p).hp, p.hp + art.power + m.lv * 3))); await say(`${hname(m)} casts ${art.name}. Everyone is healed!`); continue; }
    const dead = art.type === 'revive';
    const t = await chooseMember(`${art.name} on:`, (p) => `${p.hp}/${stats(p).hp}`, (p) => (dead ? p.hp <= 0 : p.hp > 0), { x: 172 });
    if (!t) { if (dead) await say('Nobody needs reviving.'); continue; }
    m.ep -= art.ep; sfx('heal');
    if (dead) t.hp = Math.ceil(stats(t).hp / 2); else t.hp = Math.min(stats(t).hp, t.hp + art.power + m.lv * 3);
    await say(`${hname(m)} casts ${art.name} on ${hname(t)}.`);
  }
}
async function wispMenu() {
  let c = 0;
  while (true) {
    const list = Object.keys(state.wisps);
    if (!list.length) { await say("You haven't found any Wisps yet. They're glowing spirits hidden around the world."); return; }
    c = await choose(list.map((w) => ({ label: WISPS[w].name, right: hname(state.party.find((m) => m.id === state.wisps[w])), color: ELEM_COL[WISPS[w].elem],
      desc: `${ELEM_NAME[WISPS[w].elem]}: ${Object.entries(WISPS[w].bonus).map(([k, v]) => k.toUpperCase() + '+' + v).join(' ')} · Unleash: ${WISPS[w].un.name}` })),
      { title: 'Wisps (select to move)', x: 8, y: 26, w: 170, cursor: c });
    if (c < 0) return;
    const m = await chooseMember(`Give ${WISPS[list[c]].name} to:`, (m) => Object.values(state.wisps).filter((o) => o === m.id).length + ' wisps', null, { x: 184 });
    if (m) { state.wisps[list[c]] = m.id; for (const p of state.party) clampHero(p); sfx('wisp'); }
  }
}

// ---------- shop & inn ----------
async function shopScript() {
  while (true) {
    UI.goldBox = true;
    const c = await choose(['Buy', 'Sell', 'Leave'], { x: 8, y: 26, w: 60 });
    if (c === 0) await shopBuy();
    else if (c === 1) await shopSell();
    else break;
  }
  UI.goldBox = false;
  await say('Thanks! Come again!', 'Shopkeeper');
}
function itemDesc(id) { const it = ITEMS[id]; if (it.slot === 'weapon') return `Weapon · ATK +${it.atk}`; if (it.slot === 'armor') return `Armor · DEF +${it.def}`; return it.desc; }
async function shopBuy() {
  let c = 0;
  while (true) {
    c = await choose(SHOP_LIST.map((id) => ({ label: ITEMS[id].name, right: ITEMS[id].price + ' G', desc: itemDesc(id), disabled: ITEMS[id].price > state.gold })),
      { title: 'Buy', x: 72, y: 26, w: 150, cursor: c, max: 9 });
    if (c < 0) return;
    const id = SHOP_LIST[c], it = ITEMS[id];
    if (it.slot) {
      const m = await chooseMember('Equip on:', (m) => (m[it.slot] ? ITEMS[m[it.slot]].name : '—'), null, { x: 120, w: 150 });
      if (!m) continue;
      const old = m[it.slot];
      if (old === id) { await say(`${hname(m)} already has that.`); continue; }
      state.gold -= it.price;
      m[it.slot] = id; sfx('chest');
      if (old) { const refund = Math.floor(ITEMS[old].price / 2); state.gold += refund; await say(`${hname(m)} equipped the ${it.name}! (Old ${ITEMS[old].name} sold for ${refund} G.)`); }
      else await say(`${hname(m)} equipped the ${it.name}!`);
    } else { state.gold -= it.price; addItem(id); sfx('chest'); }
  }
}
async function shopSell() {
  let c = 0;
  while (true) {
    const list = Object.keys(state.items);
    if (!list.length) { await say("You don't have anything to sell."); return; }
    c = await choose(list.map((id) => ({ label: ITEMS[id].name + ' x' + state.items[id], right: Math.floor(ITEMS[id].price / 2) + ' G' })), { title: 'Sell', x: 72, y: 26, w: 150, cursor: Math.min(c, list.length - 1), max: 9 });
    if (c < 0) return;
    state.gold += Math.floor(ITEMS[list[c]].price / 2); removeItem(list[c]); sfx('chest');
  }
}
async function innScript() {
  UI.goldBox = true;
  const c = await ask('Welcome to the Mossy Kettle Inn! A warm bed and hot stew for 10 gold. Will you stay the night?', 'Innkeeper');
  UI.goldBox = false;
  if (c !== 0) { await say('Safe travels, then!', 'Innkeeper'); return; }
  if (state.gold < 10) { await say("Oh dear, you're a little short. Come back when you have 10 gold.", 'Innkeeper'); return; }
  state.gold -= 10;
  await fade(1); music(null);
  for (const m of state.party) { const s = stats(m); m.hp = s.hp; m.ep = s.ep; }
  sfx('heal'); await sleep(1200);
  state.inn = { map: 'village', x: 20, y: 5, dir: 'down' };
  music(cur.def.music); await fade(0);
  saveGame();
  await say('Good morning! Everyone is fully rested. (Game saved.)', 'Innkeeper');
}

// ---------- story scripts ----------
async function fenScript() {
  const F = 'Fen';
  await say("Hello? Someone's there! You moved that boulder. Thank the tides!", '???');
  await say("I'm Fen, from the coast village of Saltmere. I came to see why the Beacon went dark, but a tremor sealed me in here.", F);
  await say("You're heading for the Beacon too? Then let me come with you.", F);
  await say("I'm Attuned to Tide. I can Chill water into solid ice. That underground river won't stop us!", F);
  const lv = Math.max(...state.party.map((m) => m.lv));
  const fen = makeMember('fen', lv);
  state.party.push(fen);
  state.flags.fenJoined = true;
  syncNpcs(); sfx('level');
  await say('Fen joined the party!');
  await say("(Tip: face the river and press ✦, then choose Chill to freeze a path across.)");
}
async function bossScript() {
  if (state.flags.bossDead) return;
  P.dir = 'up';
  await sleep(300);
  await say('So... the little lights come crawling to my door.', '???');
  await say("I am the Gloomwarden. The Beacon's flame was delicious. Soon this whole land will sink into shadow.", 'Gloomwarden');
  await say("Not while we're standing! Kai, let's take this thing down!", 'Lyra');
  const r = await battle(['gloomwarden'], { boss: true, bg: 'boss' });
  if (r === 'lose') { await gameOver(); return; }
  state.flags.bossDead = true;
  syncNpcs();
  await say('The Gloomwarden dissolves into drifting shadow...');
  await say("We did it! Quick, Kai, the Beacon! Let's relight it.", 'Lyra');
}
async function gameOver() {
  await fade(1);
  B = null;
  game.scene = 'gameover'; music(null);
  await fade(0);
  await say('The party has fallen...');
  await say('...but the light within them still flickers. They awaken at the inn in Brindlewood.');
  await fade(1);
  for (const m of state.party) { const s = stats(m); m.hp = s.hp; m.ep = s.ep; }
  state.gold = Math.floor(state.gold / 2);
  loadMap(state.inn.map); placePlayer(state.inn.x, state.inn.y, state.inn.dir);
  game.scene = 'map';
  await fade(0);
  await say('(You lost half your gold. Rest, gear up, and try again!)');
}
const END = { lines: [], t: 0 };
async function endingScene() {
  await fade(1);
  game.scene = 'ending'; END.lines = []; music('ending');
  await fade(0);
  const lines = [
    'The Dawnbeacon blazed to life, its light pouring over Windmere Fields.',
    'The Gloom retreated, and the monsters scattered into the wilds.',
    'In Brindlewood, the villagers saw the northern sky glow, and they cheered.',
    'But far beyond the mountains, three more Beacons still lie dark...',
    "Kai, Lyra and Fen's journey has only just begun.",
  ];
  for (const l of lines) { END.lines.push({ s: l, t: T }); await waitOrTap(3200); }
  END.lines.push({ s: 'THE END', t: T, big: true });
  await waitOrTap(1500);
  END.lines.push({ s: 'Thank you for playing Dawnbeacon! (Press A)', t: T, small: true });
  await waitKey();
  await fade(1);
  game.scene = 'map'; music(cur.def.music); saveGame();
  await fade(0);
  await say("(Your game was saved. Feel free to keep exploring and hunting for Wisps!)");
}
function renderEnding() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0620'); g.addColorStop(1, '#3a1a40');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const a = 0.4 + 0.4 * Math.sin(T / 500 + i); rc((i * 73) % W, (i * 41) % 90, 1, 1, `rgba(255,255,255,${a})`); }
  const r = 40 + Math.sin(T / 300) * 4;
  const gg = ctx.createRadialGradient(W / 2, 150, 2, W / 2, 150, r * 2); gg.addColorStop(0, 'rgba(255,230,140,0.8)'); gg.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = gg; ctx.fillRect(0, 60, W, H);
  poly([0, H, 60, 160, 110, 175, 144, 150, 180, 172, 230, 158, W, H], '#120a18');
  let y = 24;
  for (const l of END.lines) {
    ctx.globalAlpha = clamp((T - l.t) / 800, 0, 1);
    if (l.big) { font(16, true); text(l.s, W / 2, y + 8, '#ffe08a', 'center'); y += 24; }
    else { font(l.small ? 8 : 9); for (const ln of wrap(l.s, 260)) { text(ln, W / 2, y, l.small ? '#cfe0ff' : '#fff', 'center'); y += 12; } y += 4; }
  }
  ctx.globalAlpha = 1;
}

// ===================== TITLE =====================
function renderTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c0a2a'); g.addColorStop(0.6, '#4a2a5a'); g.addColorStop(1, '#e08a50');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) { const a = 0.3 + 0.5 * Math.abs(Math.sin(T / 700 + i * 1.7)); rc((i * 97) % W, (i * 53) % 100, 1, 1, `rgba(255,255,255,${a})`); }
  const bx = 214, by = 92;
  const gg = ctx.createRadialGradient(bx, by, 1, bx, by, 50 + Math.sin(T / 300) * 5); gg.addColorStop(0, 'rgba(255,230,140,0.9)'); gg.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = gg; ctx.fillRect(bx - 60, by - 60, 120, 120);
  poly([bx, by - 7, bx + 4, by, bx, by + 5, bx - 4, by], '#fff8c0');
  poly([0, H, 0, 140, 40, 120, 80, 136, 130, 110, 170, 128, 200, 104, 214, 98, 230, 106, 260, 124, W, 116, W, H], '#1a1028');
  poly([0, H, 0, 162, 60, 150, 120, 164, 190, 150, 250, 160, W, 152, W, H], '#0d0816');
  drawChar(56, 146, HEROES.kai.look, 'right', 0); drawChar(38, 147, HEROES.lyra.look, 'right', 0);
  font(26, true);
  ctx.textAlign = 'center'; ctx.fillStyle = '#3a1a10'; ctx.fillText('DAWNBEACON', W / 2 + 2, 52);
  const tg = ctx.createLinearGradient(0, 30, 0, 52); tg.addColorStop(0, '#fff6c0'); tg.addColorStop(1, '#f0a040');
  ctx.fillStyle = tg; ctx.fillText('DAWNBEACON', W / 2, 50); ctx.textAlign = 'left';
  font(9); text('An Elemental Adventure', W / 2, 66, '#ffe0c0', 'center');
  if (!Snd.ac && Math.floor(T / 600) % 2) { font(8); text('Tap to enable sound', W / 2, 186, '#ffffffaa', 'center'); }
}
async function titleScreen() {
  game.scene = 'title'; music('title');
  UI.fadeTo = 0;
  const has = !!localStorage.getItem(SAVE_KEY);
  const items = has ? ['Continue', 'New Game'] : ['New Game'];
  const c = await choose(items, { x: W / 2 - 40, y: 84, w: 80, cancel: false });
  let choice = items[c];
  if (choice === 'New Game' && has) {
    const ok = await choose(['Start over', 'Back'], { title: 'Overwrite save?', x: W / 2 - 50, y: 84, w: 100, cancel: false });
    if (ok === 1) return titleScreen();
  }
  await fade(1);
  if (choice === 'Continue' && loadGame()) {
    loadMap(state.map); placePlayer(state.x, state.y, state.dir);
    game.scene = 'map';
    await fade(0);
    return;
  }
  newState();
  game.scene = 'black'; music('title');
  await fade(0);
  await say('Long ago, four Dawnbeacons were raised at the corners of the world, holding back a creeping darkness called the Gloom.');
  await say('Their light has shone for a hundred years. Until now.');
  await fade(1);
  loadMap('village'); placePlayer(12, 8, 'down');
  game.scene = 'map';
  await fade(0);
  await cur.def.onEnter();
}

// ===================== MAIN LOOP =====================
let last = performance.now();
function frame(now) {
  const dt = Math.min(50, now - last); last = now; T = now;
  update(dt); render(dt);
  requestAnimationFrame(frame);
}
function update(dt) {
  if (rep.k && held[rep.k] && UI.menus.length) { rep.t += dt; if (rep.t >= 0) { rep.t = -110; inputQ.push(rep.k); } }
  while (inputQ.length) handleInput(inputQ.shift());
  if (UI.dialog) { const d = UI.dialog; const total = d.pages[d.p].join('').length; if (d.c < total) d.c = Math.min(total, d.c + dt * 0.06); if (d.hold && d.p === d.pages.length - 1 && d.c >= total && !d.done) { d.done = true; d.res(); } }
  if (UI.fade !== UI.fadeTo) {
    const s = dt / 260;
    UI.fade = UI.fade < UI.fadeTo ? Math.min(UI.fadeTo, UI.fade + s) : Math.max(UI.fadeTo, UI.fade - s);
    if (UI.fade === UI.fadeTo && UI.fadeRes) { const r = UI.fadeRes; UI.fadeRes = null; r(); }
  } else if (UI.fadeRes) { const r = UI.fadeRes; UI.fadeRes = null; r(); }
  UI.flash = Math.max(0, UI.flash - dt / 200);
  if (UI.banner) { UI.banner.t -= dt; if (UI.banner.t <= 0) UI.banner = null; }
  if (game.scene === 'map' && cur) updateMap(dt);
}
function render(dt) {
  hits = [];
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'alphabetic';
  if (game.scene === 'title') renderTitle();
  else if (game.scene === 'map' && cur) renderMap();
  else if (game.scene === 'battle' && B) renderBattle(dt);
  else if (game.scene === 'ending') renderEnding();
  else rc(0, 0, W, H, '#000');
  drawUI();
  if (UI.flash > 0) { ctx.globalAlpha = UI.flash; rc(0, 0, W, H, '#fff'); ctx.globalAlpha = 1; }
  if (UI.fade > 0) { ctx.globalAlpha = UI.fade; rc(0, 0, W, H, '#000'); ctx.globalAlpha = 1; }
}

resize();
requestAnimationFrame(frame);
runScript(titleScreen);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
