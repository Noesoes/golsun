'use strict';
// ===================== Rootwell — art =====================
// World, buildings and characters: Pipoya's FREE RPG Tileset 32x32 and FREE RPG Character Sprites 32x32.
// Battle monsters: Pipoya Free RPG Monster Pack + Creature Collector 64x64 (dadddydarko).
// Item icons, battle effects and UI frames: Ninja Adventure (Pixel-Boy & AAA, CC0).
const ART = (() => {
  const IMG = {};
  let META = {};
  const cache = new Map();
  const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
  function tint(c, col) { const [o, g] = mk(c.width, c.height); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return o; }
  function flash(c) { return memo(c, () => tint(c, 'rgba(255,255,255,0.85)')); }

  const FILES = {
    icons: ['herb', 'tonic', 'plume', 'berry', 'weapon', 'armor', 'trinket', 'gold'],
    fx: ['ember', 'bloom', 'gale', 'hush', 'smoke', 'heal', 'slash', 'leaf', 'leafpink'],
    ui: ['panel', 'panel_dark', 'faceframe', 'arrow'],
  };
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; }); }
  async function load(onProgress) {
    const jobs = []; let done = 0, total = 0;
    for (const [dir, names] of Object.entries(FILES)) for (const n of names) {
      total++;
      jobs.push(loadImg(`assets/${dir}/${n}.png`).then((im) => { IMG[dir + '/' + n] = im; if (onProgress) onProgress(++done / total); }));
    }
    jobs.push(fetch('assets/meta.json').then((r) => r.json()).then((m) => (META = m)));
    await Promise.all(jobs);
  }
  function crop(key, x, y, w, h) {
    return memo(`c|${key}|${x}|${y}|${w}|${h}`, () => { const [c, g] = mk(w, h); g.drawImage(IMG[key], x, y, w, h, 0, 0, w, h); return c; });
  }
  const B = (cx, cy, cw = 1, ch = 1) => crop('pipoya/base', cx * 32, cy * 32, cw * 32, ch * 32);

  // RPG Maker "A2" autotile (64x96): compose a 32px tile from four 16px quarters using an 8-neighbour mask
  // bits: 1 N, 2 E, 4 S, 8 W, 16 NE, 32 SE, 64 SW, 128 NW
  function autotile(key, mask) {
    return memo(`a|${key}|${mask}`, () => {
      const [c, g] = mk(32, 32), im = IMG['pipoya/' + key];
      const n = mask & 1, e = mask & 2, s = mask & 4, w = mask & 8, ne = mask & 16, se = mask & 32, sw = mask & 64, nw = mask & 128;
      const q = (sx, sy, dx, dy) => g.drawImage(im, sx * 16, sy * 16, 16, 16, dx, dy, 16, 16);
      q(...(!n && !w ? [0, 2] : !n ? [2, 2] : !w ? [0, 4] : !nw ? [2, 0] : [2, 4]), 0, 0);
      q(...(!n && !e ? [3, 2] : !n ? [1, 2] : !e ? [3, 4] : !ne ? [3, 0] : [1, 4]), 16, 0);
      q(...(!s && !w ? [0, 5] : !s ? [2, 5] : !w ? [0, 3] : !sw ? [2, 1] : [2, 3]), 0, 16);
      q(...(!s && !e ? [3, 5] : !s ? [1, 5] : !e ? [3, 3] : !se ? [3, 1] : [1, 3]), 16, 16);
      return c;
    });
  }
  const full = (key) => autotile(key, 255);

  // ------------------------------------------------------------------ ground tiles (32x32)
  function grass(g, v) { g.drawImage(full('grass'), 0, 0); if (v === 3) g.drawImage(B(1, 6), 0, 0); else if (v === 6) g.drawImage(B(3, 6), 0, 0); }
  function caveFloor(g, v) { g.drawImage(full('dirt'), 0, 0); if (v === 5) g.drawImage(B(0, 8), 4, 6, 20, 20); }
  function wood(g) { g.drawImage(B(0, 36), 0, 0); }
  function drawTile(ch, info) {
    const { v = 0, mask = 255, ground = '.', k = '' } = info;
    return memo(`t|${ch}|${v}|${mask}|${ground}|${k}`, () => {
      const [c, g] = mk(32, 32);
      const cave = ground === '_';
      const under = () => (cave ? caveFloor(g, v) : ground === 'W' ? wood(g) : grass(g, v));
      const water = () => { if (!cave) grass(g, 0); else caveFloor(g, 0); g.drawImage(autotile(cave ? 'cavewater' : 'water', mask), 0, 0); };
      switch (ch) {
        case '.': grass(g, v); break;
        case ',': grass(g, 0); g.drawImage(B(4 + (v % 3), 6), 0, 0); break;
        case '"': grass(g, 0); g.drawImage(autotile('tallgrass', mask), 0, 0); break;
        case '=': g.drawImage(autotile('path', mask), 0, 0); break;
        case '~': water(); break;
        case '%': water(); g.drawImage(B(3, 7), 0, 0); break;
        case 'o': water(); g.drawImage(B(0, 8), 0, 2); break;
        case '|': { g.drawImage(full('water'), 0, 0); g.drawImage(B(1, 34), 0, 0); break; }
        case 'M': g.drawImage(k === 'top' ? B(1, 10) : B(1, k === 'face0' ? 12 : 13), 0, 0); break;
        case 'v': g.drawImage(B(2, 18), 0, 0); break;
        case '#': if (k === 'face') g.drawImage(B(1, 17), 0, 0); else { caveFloor(g, 0); g.drawImage(autotile('wallup2', mask), 0, 0); } break;
        case '_': caveFloor(g, v); break;
        case 'P': caveFloor(g, 0); g.drawImage(B(2, 8), 0, 0); break;
        case 'p': caveFloor(g, 0); g.drawImage(B(4, 21), 0, 0); break;
        case 'X': if (ground === 'W') { wood(g); g.drawImage(B(5, 40), 4, 8, 24, 16); } else { caveFloor(g, 0); g.drawImage(B(2, 8), 0, 0); } break;
        case 'W': wood(g); break;
        case 'g': wood(g); g.drawImage(B(2, 38), 0, 0); break;
        case 'Q': if (k === 'T') g.drawImage(B(0, 45), 0, 0); else g.drawImage(autotile('wallup', mask), 0, 0); break;
        case 'F': grass(g, v); g.drawImage(B(7, 22), 0, 0); break;
        case 'b': grass(g, 0); g.drawImage(B(7, 6), 0, 0); break;
        default: under();
      }
      return c;
    });
  }

  // ------------------------------------------------------------------ props & buildings
  function house(kind) { return IMG['pipoya/houses/' + kind]; }
  function prop(name, v = 0) {
    switch (name) {
      case 'tree': return [B(0, 1, 2, 2), B(2, 1, 2, 2), B(0, 1, 2, 2)][v % 3];
      case 'hedge': case 'bush': return [B(0, 5), B(1, 5)][v % 2];
      case 'boulder': return B(1, 8);
      case 'rock': return B(0, 8);
      case 'bramble': return B(3, 5);
      case 'chest': return B(6, 107);
      case 'chestOpen': return B(6, 108);
      case 'sign': return B(5, 28, 1, 2);
      case 'crystal': return B(6, 124);
      case 'mushroom': return B(0, 7);
      case 'barrel': return B(3, 109);
      case 'crate': return B(4, 108);
      case 'well': return B(2, 28);
      case 'lamp': return B(3, 113, 1, 2);
      case 'plant': return B(7, 113, 1, 2);
      case 'shelf': return B(3, 89, 1, 2);
      case 'table': return B(4, 89);
      case 'bed': return B(1, 97, 1, 2);
      case 'counter': return B(1, 106);
      case 'spring': return memo('springDim', () => { const [c, g] = mk(96, 96); g.drawImage(B(0, 116, 3, 3), 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(40,40,60,0.55)'; g.fillRect(0, 0, 96, 96); return c; });
      case 'springLit': return B(0, 116, 3, 3);
      case 'tuft': return memo('tuft', () => { const [c, g] = mk(32, 32); g.drawImage(IMG['pipoya/tallgrass'], 16, 64, 32, 14, 0, 18, 32, 14); return c; });
    }
    return B(0, 8);
  }

  // ------------------------------------------------------------------ characters (3 frames x 4 directions, 32x32)
  const DIRROW = { down: 0, left: 1, right: 2, up: 3 };
  const FCOL = [1, 0, 1, 2, 0];
  function charSprite(look, dir, frame) { return crop('pipoya/chars/' + look.sheet, FCOL[(frame | 0) % 5] * 32, DIRROW[dir] * 32, 32, 32); }
  function portrait(look) { return window.W3D.portrait(look.sheet); }
  function enemySprite(shape, frame, fl) {
    const im = IMG['monsters/' + shape], c = crop('monsters/' + shape, 0, 0, im.width, im.height);
    return fl ? flash(c) : c;
  }
  const enemySize = (shape) => { const im = IMG['monsters/' + shape]; return { w: im.width, h: im.height }; };
  function icon(kind) { return IMG['icons/' + kind]; }
  function fx(name, i) { const m = META[name]; return crop('fx/' + name, (i % m.frames) * m.w, 0, m.w, m.h); }
  const fxFrames = (name) => (META[name] ? META[name].frames : 1);
  const ui = (name) => IMG['ui/' + name];

  return { mk, tint, drawTile, prop, house, charSprite, portrait, enemySprite, enemySize, icon, fx, fxFrames, ui, load, B, IMG };
})();
