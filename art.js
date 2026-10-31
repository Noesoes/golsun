'use strict';
// ===================== Rootwell — art =====================
// Pixel art from the "Ninja Adventure" asset pack by Pixel-Boy & AAA (CC0).
// This module loads the sprite sheets and slices them into cached 1:1 canvases.
const ART = (() => {
  const IMG = {};
  let META = {};
  const cache = new Map();
  const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
  function tint(c, col) { const [o, g] = mk(c.width, c.height); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return o; }
  function flash(c) { return memo(c, () => tint(c, 'rgba(255,255,255,0.85)')); }

  const FILES = {
    tiles: ['floor', 'nature', 'water', 'house', 'element', 'detail', 'hole', 'relief', 'ifloor', 'wall'],
    chars: ['Woman', 'Hunter', 'Cavegirl', 'OldWoman', 'OldMan2', 'Princess', 'Boy', 'SorcererOrange', 'Villager4', 'OldMan', 'Inspector'],
    monsters: ['Slime3', 'Racoon', 'Butterfly', 'Mole', 'Mushroom2', 'Mollusc2', 'ButterflyBlue', 'Spirit', 'GiantSpirit'],
    icons: ['herb', 'tonic', 'plume', 'berry', 'weapon', 'armor', 'trinket', 'gold'],
    fx: ['ember', 'bloom', 'gale', 'hush', 'smoke', 'heal', 'slash', 'leaf', 'leafpink'],
    ui: ['panel', 'panel_dark', 'faceframe', 'arrow'],
    misc: ['chest'],
  };
  FILES.faces = FILES.chars.slice();
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; }); }
  async function load(onProgress) {
    const jobs = [];
    let done = 0, total = 0;
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
  const T = (sheet, tx, ty, tw = 1, th = 1) => crop('tiles/' + sheet, tx * 16, ty * 16, tw * 16, th * 16);

  // 16-piece auto-tile layout used by the pack (3x3 blob + 1-wide strips), anchored at (bx,by)
  function m16(mask) {
    const N = mask & 1, E = mask & 2, S = mask & 4, Wd = mask & 8;
    if (N && E && S && Wd) return [1, 1];
    if (!N && E && S && Wd) return [1, 0];
    if (N && E && !S && Wd) return [1, 2];
    if (N && !E && S && Wd) return [2, 1];
    if (N && E && S && !Wd) return [0, 1];
    if (!N && E && S && !Wd) return [0, 0];
    if (!N && !E && S && Wd) return [2, 0];
    if (N && E && !S && !Wd) return [0, 2];
    if (N && !E && !S && Wd) return [2, 2];
    if (!N && !E && S && !Wd) return [3, 0];
    if (N && !E && S && !Wd) return [3, 1];
    if (N && !E && !S && !Wd) return [3, 2];
    if (!N && E && !S && !Wd) return [0, 3];
    if (!N && E && !S && Wd) return [1, 3];
    if (!N && !E && !S && Wd) return [2, 3];
    return [3, 3];
  }
  const auto = (sheet, bx, by, mask) => { const [dx, dy] = m16(mask); return T(sheet, bx + dx, by + dy); };

  // cave water: the pack's purple pool recoloured to deep blue
  function caveWaterSheet() {
    return memo('cavewater', () => {
      const [c, g] = mk(64, 64); g.drawImage(IMG['tiles/water'], 13 * 16, 6 * 16, 64, 64, 0, 0, 64, 64);
      const id = g.getImageData(0, 0, 64, 64), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r > gg + 20 && b > gg + 20) { const l = (r + gg + b) / 3; d[i] = l * 0.35; d[i + 1] = l * 0.62 + 20; d[i + 2] = Math.min(255, l * 1.05 + 30); }
      }
      g.putImageData(id, 0, 0); return c;
    });
  }
  // lily pad pixels lifted off the pack's lily-on-water tile
  function lily() {
    return memo('lily', () => {
      const [c, g] = mk(16, 16); g.drawImage(T('water', 11, 3), 0, 0);
      const plain = T('water', 11, 0).getContext('2d').getImageData(0, 0, 16, 16).data;
      const id = g.getImageData(0, 0, 16, 16), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const leafy = d[i + 1] > d[i + 2] + 8, dark = d[i] + d[i + 1] + d[i + 2] < 200; if (!leafy && !dark) d[i + 3] = 0; }
      g.putImageData(id, 0, 0); return c;
    });
  }

  // ------------------------------------------------------------------ ground tiles
  function grass(g, v) { g.drawImage(v < 5 ? T('floor', 0, 12) : T('floor', v - 4, 12), 0, 0); }
  function caveFloor(g, v) { g.drawImage(v < 6 ? T('floor', 11, 19) : T('floor', v === 6 ? 12 : 13, 19), 0, 0); }
  function wood(g) { g.drawImage(T('ifloor', 1, 1), 0, 0); }
  function water(g, mask, cave) {
    if (cave) { const [dx, dy] = m16(mask); g.drawImage(caveWaterSheet(), dx * 16, dy * 16, 16, 16, 0, 0, 16, 16); }
    else g.drawImage(auto('water', 0, 6, mask), 0, 0);
  }
  const WALL_PIECES = { TL: [0, 0], T: [1, 0], TR: [4, 0], L: [0, 1], R: [4, 1], BL: [0, 4], B: [1, 4], BR: [4, 4] };
  function drawTile(ch, info) {
    const { v = 0, mask = 15, f = 0, ground = '.', k = '' } = info;
    return memo(`t|${ch}|${v}|${mask}|${f}|${ground}|${k}`, () => {
      const [c, g] = mk(16, 16);
      const under = () => (ground === '_' ? caveFloor(g, v) : ground === 'W' ? wood(g) : grass(g, v));
      const cave = ground === '_';
      switch (ch) {
        case '.': grass(g, v); break;
        case ',': grass(g, 0); g.drawImage(v % 2 ? T('detail', 5, 2) : T('detail', 2, 0), 0, 0); break;
        case '"': grass(g, 0); g.drawImage(T('nature', v % 2 ? 3 : 5, 10), 0, 0); break;
        case '=': g.drawImage(auto('floor', 0, 7, mask), 0, 0); break;
        case '~':
          if (k.startsWith('fall')) { g.drawImage(T('relief', 7, +k[4]), 0, 0); break; }
          water(g, mask, cave); break;
        case '%': water(g, mask, cave); g.drawImage(lily(), 0, 0); break;
        case 'o': water(g, mask, cave); g.drawImage(T('nature', 4, 13), 0, 1); break;
        case '|': g.drawImage(T('water', 1, 7), 0, 0); g.drawImage(T('water', k === 'L' ? 0 : k === 'R' ? 2 : 1, 15), 0, 0); break;
        case 'M': if (k === 'top') grass(g, v); else g.drawImage(T('relief', 5, k === 'face0' ? 0 : 2), 0, 0); break;
        case 'v': g.drawImage(T('relief', 5, 2), 0, 0); g.drawImage(T('nature', 7, 13), 0, 0); break;
        case '#':
          if (k === 'face') g.drawImage(T('relief', 5, 2), 0, 0);
          else if (k === 'rim') g.drawImage(T('hole', 1, 0), 0, 0);
          else g.drawImage(T('hole', 1, 1), 0, 0);
          break;
        case '_': caveFloor(g, v); break;
        case 'P': caveFloor(g, v); g.drawImage(T('hole', 3, 0), 0, 0); break;
        case 'p': caveFloor(g, v); g.drawImage(T('detail', 15, 0), 0, 0); break;
        case 'X': if (ground === 'W') { wood(g); g.drawImage(T('ifloor', 0, 5), 0, 0); } else g.drawImage(T('hole', 1, 0), 0, 0); break;
        case 'W': wood(g); break;
        case 'g': g.drawImage(T('ifloor', 16, 2), 0, 0); break;
        case 'K': wood(g); g.drawImage(T('element', 3, 10), 0, 0); break;
        case 'Q': { const p = WALL_PIECES[k]; if (p) g.drawImage(T('wall', p[0], p[1]), 0, 0); else { g.fillStyle = '#151a1a'; g.fillRect(0, 0, 16, 16); } break; }
        case 'F': grass(g, v); g.drawImage(T('house', 11, 5), 0, 0); break;
        case 'b': grass(g, v); g.drawImage(T('nature', v % 2, 11), 0, 0); break;
        default: under();
      }
      return c;
    });
  }

  // ------------------------------------------------------------------ props
  const HOUSES = { cottage: [0, 0, 4, 3], red: [12, 0, 4, 3], shop: [16, 0, 3, 3], inn: [19, 0, 4, 3], forge: [26, 0, 3, 3], hut: [23, 0, 3, 3] };
  function house(kind) { const h = HOUSES[kind]; return T('house', h[0], h[1], h[2], h[3]); }
  function prop(name, v = 0) {
    switch (name) {
      case 'tree': return [T('nature', 0, 0, 2, 2), T('nature', 16, 0, 2, 2), T('nature', 18, 0, 2, 2), T('nature', 2, 0, 2, 2)][v % 4];
      case 'bush': return T('nature', v % 2 ? 0 : 1, 10);
      case 'boulder': return T('nature', 18, 9);
      case 'bramble': return memo('bramble', () => { const [c, g] = mk(16, 16); g.drawImage(T('nature', 9, 10), 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(70,20,60,0.35)'; g.fillRect(0, 0, 16, 16);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = '#ff7ab0'; for (const [x, y] of [[4, 5], [11, 4], [8, 9], [3, 11], [12, 11]]) g.fillRect(x, y, 1, 1); return c; });
      case 'chest': return crop('misc/chest', 0, 0, 16, 16);
      case 'chestOpen': return crop('misc/chest', 16, 0, 16, 16);
      case 'sign': return T('element', 0, 2);
      case 'crystal': return T('nature', 1, 14);
      case 'mushroom': return T('detail', 4, 0);
      case 'rock': return T('nature', 4, 13);
      case 'barrel': return T('element', 1, 0);
      case 'crate': return T('element', 0, 0);
      case 'well': return T('element', 6, 2);
      case 'lamp': return T('element', 6, 3, 1, 2);
      case 'plant': return T('element', 0, 7, 1, 2);
      case 'shelf': return T('element', v % 2 ? 4 : 3, 7, 1, 2);
      case 'table': return T('element', 3, 9);
      case 'spring': return T('wall', 2, 1, 2, 2);
      case 'springLit': return memo('springLit', () => {
        const [c, g] = mk(32, 32); g.drawImage(T('wall', 2, 1, 2, 2), 0, 0);
        g.fillStyle = '#3fd0c8'; g.beginPath(); g.ellipse(16, 16, 7, 7, 0, 0, 6.3); g.fill();
        g.fillStyle = '#a8fff0'; g.fillRect(12, 12, 3, 2); g.fillRect(18, 17, 2, 1); return c; });
      case 'tuft': return memo('tuft' + v, () => { const [c, g] = mk(16, 16); g.drawImage(T('nature', v % 2 ? 3 : 5, 10), 0, 8, 16, 8, 0, 8, 16, 8); return c; });
    }
    return T('nature', 4, 13);
  }

  // ------------------------------------------------------------------ actors
  const DIRCOL = { down: 0, up: 1, left: 2, right: 3 };
  function charSprite(look, dir, frame) { return crop('chars/' + look.sheet, DIRCOL[dir] * 16, (frame | 0) * 16, 16, 16); }
  function portrait(look) { return IMG['faces/' + look.sheet]; }
  function enemySprite(shape, frame, fl) {
    let c;
    if (shape === 'GiantSpirit') { const m = META.boss; c = crop('monsters/GiantSpirit', (frame % m.frames) * m.w, 0, m.w, m.h); }
    else c = crop('monsters/' + shape, 0, (frame % 4) * 16, 16, 16);
    return fl ? flash(c) : c;
  }
  const enemySize = (shape) => (shape === 'GiantSpirit' ? { w: 100, h: 92 } : { w: 32, h: 30 });
  function icon(kind) { return IMG['icons/' + kind]; }
  function fx(name, i) { const m = META[name]; return crop('fx/' + name, (i % m.frames) * m.w, 0, m.w, m.h); }
  const fxFrames = (name) => (META[name] ? META[name].frames : 1);
  const ui = (name) => IMG['ui/' + name];

  return { mk, tint, drawTile, prop, house, charSprite, portrait, enemySprite, enemySize, icon, fx, fxFrames, ui, load, T, IMG };
})();
