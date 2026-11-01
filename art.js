'use strict';
// ===================== Rootwell — art =====================
// The world, characters and monsters are 3D (see world3d.js); portraits are rendered from the 3D models.
// Item icons, battle effects and UI frames: Ninja Adventure (Pixel-Boy & AAA, CC0).
const ART = (() => {
  const IMG = {};
  let META = {};
  const cache = new Map();
  const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
  function tint(c, col) { const [o, g] = mk(c.width, c.height); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return o; }

  const FILES = {
    icons: ['herb', 'tonic', 'plume', 'berry', 'weapon', 'armor', 'trinket', 'gold'],
    fx: ['ember', 'bloom', 'gale', 'hush', 'smoke', 'heal', 'slash', 'leaf', 'leafpink'],
    ui: ['panel', 'panel_dark', 'faceframe', 'arrow'],
  };
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; }); }
  // patchy mobile data: retry each file; if it still fails, carry on with a blank stand-in (these are only icons and effects)
  async function retry(fn, tries = 4) { let err; for (let a = 0; a < tries; a++) { try { return await fn(a); } catch (e) { err = e; await new Promise((r) => setTimeout(r, 500 * (a + 1))); } } throw err; }
  async function load(onProgress) {
    const jobs = []; let done = 0, total = 0;
    for (const [dir, names] of Object.entries(FILES)) for (const n of names) {
      total++;
      const src = `assets/${dir}/${n}.png`;
      jobs.push(retry((a) => loadImg(a ? `${src}?r=${a}` : src)).catch(() => mk(16, 16)[0]).then((im) => { IMG[dir + '/' + n] = im; if (onProgress) onProgress(++done / total); }));
    }
    jobs.push(retry((a) => fetch(a ? `assets/meta.json?r=${a}` : 'assets/meta.json').then((r) => { if (!r.ok) throw new Error('meta'); return r.json(); })).then((m) => (META = m)).catch(() => (META = {})));
    await Promise.all(jobs);
  }
  function crop(key, x, y, w, h) {
    return memo(`c|${key}|${x}|${y}|${w}|${h}`, () => { const [c, g] = mk(w, h); g.drawImage(IMG[key], x, y, w, h, 0, 0, w, h); return c; });
  }
  function portrait(look) { return window.W3D.portrait(look.sheet); }
  function icon(kind) { return IMG['icons/' + kind]; }
  function fx(name, i) { const m = META[name] || { frames: 1, w: IMG['fx/' + name].width, h: IMG['fx/' + name].height }; return crop('fx/' + name, (i % m.frames) * m.w, 0, m.w, m.h); }
  const fxFrames = (name) => (META[name] ? META[name].frames : 1);
  const ui = (name) => IMG['ui/' + name];

  return { mk, tint, portrait, icon, fx, fxFrames, ui, load, IMG };
})();
