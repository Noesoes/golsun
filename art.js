'use strict';
// ===================== Rootwell — pixel art generation =====================
// Everything is drawn procedurally at 1:1 pixel scale into small cached canvases,
// then blitted to a low-res buffer that is scaled up with nearest-neighbour filtering.
const ART = (() => {
  const OUT = '#1c1428';
  const cache = new Map();
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
  function rgb(h) { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.max(0, Math.min(255, Math.round(v + (B[i] - v) * t))).toString(16).padStart(2, '0')).join(''); }
  const dk = (h, t = 0.28) => mix(h, '#1a1030', t);
  const lt = (h, t = 0.3) => mix(h, '#fffbe8', t);
  function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function memo(key, fn) { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; }

  // binarize alpha (crisp pixel edges) and add a 1px outline
  function crisp(c, outline = OUT, bin = true) {
    const g = c.getContext('2d'), w = c.width, h = c.height, id = g.getImageData(0, 0, w, h), d = id.data;
    if (bin) for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 100 ? 255 : 0;
    if (outline) {
      const [r, gg, b] = rgb(outline), a = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (a[i]) continue;
        if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
      }
    }
    g.putImageData(id, 0, 0); return c;
  }
  function tint(c, col) { const [o, g] = mk(c.width, c.height); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return o; }
  function flipX(c) { const [o, g] = mk(c.width, c.height); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return o; }

  // pixel drawing helpers bound to a context
  function H(g) {
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    const oval = (cx, cy, rx, ry, c) => {
      g.fillStyle = c;
      for (let y = -ry; y <= ry; y++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))) + 0.35); g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1); }
    };
    const el = (cx, cy, rx, ry, c, rot = 0) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2); g.fill(); };
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
    return { r, px, oval, el, poly };
  }

  // ------------------------------------------------------------------ palette
  const C = {
    g: '#64b24c', gD: '#4d9643', gDD: '#3b7b3b', gL: '#86cb5e', gLL: '#b0e47e',
    p: '#dfc089', pD: '#c49f69', pDD: '#a27d50', pL: '#eed9a6',
    w: '#3d88d6', wD: '#2c67b2', wDD: '#1f4a8a', wL: '#72b6f2', wF: '#e6f7ff',
    cf: '#a87e5a', cfD: '#7f5d44', cfDD: '#5c4334', cfL: '#c7a07a',
    cw: '#544a70', cwD: '#3e3558', cwL: '#6b6090', ct: '#1d1730', ctL: '#2a2242',
    fl: '#4f4766', flD: '#443d5a', flL: '#5f5778',
    wood: '#c48c54', woodD: '#9c6c3e', woodDD: '#734c2c', woodL: '#dcaa6e',
    pl: '#f2e4c2', plD: '#dcc8a0', beam: '#7c5032', beamD: '#5a3824',
  };
  const ROOFS = [['#cf5a3f', '#a6402f', '#ea8562'], ['#3f81ad', '#2c6088', '#62a6d0'], ['#5c9a4c', '#43763a', '#82bc68'], ['#a2609e', '#7c4480', '#c286be']];

  // ------------------------------------------------------------------ tiles
  function grass(g, v, alt) {
    const { r, px } = H(g), R = rng(v * 7919 + 13);
    r(0, 0, 16, 16, alt ? C.gD : C.g);
    for (let i = 0; i < 16; i++) px((R() * 16) | 0, (R() * 16) | 0, R() < 0.6 ? C.gD : C.gL);
    for (let i = 0; i < 2; i++) { const x = 1 + ((R() * 12) | 0), y = 3 + ((R() * 11) | 0); px(x, y, C.gDD); px(x + 2, y, C.gDD); px(x + 1, y + 1, C.gDD); px(x, y - 1, C.gL); px(x + 2, y - 1, C.gL); }
    if (v % 5 === 0) { const x = 3 + ((R() * 9) | 0), y = 3 + ((R() * 9) | 0); px(x, y, C.gLL); px(x + 1, y + 1, C.gLL); }
  }
  function flowers(g, v) {
    grass(g, v); const { px } = H(g), R = rng(v * 31 + 7);
    const cols = [['#fff2a0', '#f0b030'], ['#ffb0c8', '#e0507a'], ['#ffffff', '#f0c040'], ['#b0c8ff', '#6a80e0']];
    for (let i = 0; i < 3; i++) {
      const x = 2 + ((R() * 11) | 0), y = 2 + ((R() * 11) | 0), [a, b] = cols[(R() * 4) | 0];
      px(x, y - 1, a); px(x - 1, y, a); px(x + 1, y, a); px(x, y + 1, a); px(x, y, b); px(x, y + 2, C.gDD);
    }
  }
  function tallGrass(g, v, f) {
    const { r, px } = H(g), R = rng(v * 131 + 5);
    r(0, 0, 16, 16, C.gD);
    for (let i = 0; i < 10; i++) px((R() * 16) | 0, (R() * 16) | 0, C.gDD);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
      const x = ((i * 3 + row * 2 + ((R() * 2) | 0)) % 16), y = 5 + row * 5, sw = (f + row + i) % 2;
      r(x, y - 3, 1, 5, C.tgD || '#3f8a3e'); px(x + sw, y - 4, C.gL); px(x + sw, y - 5, C.gLL); px(x + 1, y - 2, C.gDD);
    }
  }
  // generic edge: draw `col` along sides where neighbour differs (mask bit = same)
  function rough(g, mask, col, depth, seed) {
    const { px } = H(g), R = rng(seed);
    for (let i = 0; i < 16; i++) {
      const d = depth + (R() < 0.45 ? 1 : 0);
      for (let k = 0; k < d; k++) {
        if (!(mask & 1)) px(i, k, col); if (!(mask & 4)) px(i, 15 - k, col);
        if (!(mask & 8)) px(k, i, col); if (!(mask & 2)) px(15 - k, i, col);
      }
    }
  }
  function path(g, v, mask) {
    const { r, px } = H(g), R = rng(v * 17 + 3);
    r(0, 0, 16, 16, C.p);
    for (let i = 0; i < 10; i++) px((R() * 16) | 0, (R() * 16) | 0, C.pD);
    for (let i = 0; i < 5; i++) px((R() * 16) | 0, (R() * 16) | 0, C.pL);
    for (let i = 0; i < 2; i++) { const x = 2 + ((R() * 11) | 0), y = 2 + ((R() * 11) | 0); r(x, y, 2, 1, C.pDD); px(x, y - 1, C.pL); }
    // grass border with a darker rim on the path side
    const { px: p2 } = H(g), Rb = rng(v * 53 + 11);
    for (let i = 0; i < 16; i++) {
      const d = 1 + (Rb() < 0.5 ? 1 : 0);
      for (let k = 0; k <= d; k++) {
        const c = k === d ? C.pD : k === d - 1 ? C.gD : C.g;
        if (!(mask & 1)) p2(i, k, c); if (!(mask & 4)) p2(i, 15 - k, k === d ? C.pD : C.g);
        if (!(mask & 8)) p2(k, i, c); if (!(mask & 2)) p2(15 - k, i, c);
      }
    }
  }
  function water(g, mask, f, v) {
    const { r, px } = H(g), R = rng(v * 13 + 1);
    r(0, 0, 16, 16, C.w);
    for (let i = 0; i < 6; i++) px((R() * 16) | 0, (R() * 16) | 0, C.wD);
    for (let i = 0; i < 3; i++) { const y = (i * 5 + 2 + ((R() * 3) | 0)) % 16, x = (((R() * 12) | 0) + f * 2) % 14; r(x, y, 3, 1, C.wL); px(x + 1, y, '#a8d8ff'); }
    const foam = (x, y) => { if (((x * 7 + y * 3 + f) % 5) < 2) px(x, y, C.wF); };
    if (!(mask & 1)) { r(0, 0, 16, 3, C.wDD); r(0, 3, 16, 1, C.wD); for (let x = 0; x < 16; x++) foam(x, 4); }
    if (!(mask & 4)) { r(0, 15, 16, 1, '#8cc4f0'); for (let x = 0; x < 16; x++) foam(x, 14); }
    if (!(mask & 8)) { r(0, 0, 1, 16, C.wD); r(1, 0, 1, 16, '#5aa0e8'); for (let y = 0; y < 16; y++) foam(2, y); }
    if (!(mask & 2)) { r(15, 0, 1, 16, C.wD); r(14, 0, 1, 16, '#5aa0e8'); for (let y = 0; y < 16; y++) foam(13, y); }
  }
  function cliff(g, mask, v) {
    const { r, px } = H(g), R = rng(v * 29 + 3);
    if (mask & 4) { // plateau top
      r(0, 0, 16, 16, C.gD); for (let i = 0; i < 14; i++) px((R() * 16) | 0, (R() * 16) | 0, R() < 0.5 ? C.gDD : C.g);
      if (v % 3 === 0) { r(5, 6, 4, 3, C.cfD); r(5, 6, 3, 1, C.cfL); }
      return;
    }
    r(0, 0, 16, 16, C.cf);
    for (let x = 0; x < 16; x += 4) { const o = (x * 7 + v) % 3; r(x + o, 3, 1, 12, C.cfD); r(x + o + 1, 4, 1, 9, C.cfL); }
    r(0, 13, 16, 3, C.cfD); r(0, 15, 16, 1, C.cfDD);
    for (let i = 0; i < 4; i++) px((R() * 16) | 0, 4 + ((R() * 9) | 0), C.cfDD);
    r(0, 0, 16, 3, C.gD); for (let x = 0; x < 16; x++) if ((x + v) % 3 === 0) px(x, 3, C.gDD); r(0, 0, 16, 1, C.g);
  }
  function caveWall(g, mask, v) {
    const { r, px } = H(g), R = rng(v * 41 + 9);
    if (mask & 4) { // top / ceiling mass
      r(0, 0, 16, 16, C.ct); for (let i = 0; i < 8; i++) px((R() * 16) | 0, (R() * 16) | 0, C.ctL);
      if (!(mask & 8)) r(0, 0, 1, 16, C.cwD); if (!(mask & 2)) r(15, 0, 1, 16, C.cwD); if (!(mask & 1)) r(0, 0, 16, 1, C.cwD);
      return;
    }
    r(0, 0, 16, 16, C.cw);
    r(0, 0, 16, 2, C.ct);
    const rows = [[2, 5], [7, 4], [11, 4]];
    rows.forEach(([y, hh], i) => { let x = -((i * 5 + v) % 7); while (x < 16) { const w = 5 + ((R() * 4) | 0); r(x + 1, y + 1, w - 1, hh - 1, i === 2 ? C.cwD : C.cw); r(x + 1, y + 1, w - 1, 1, C.cwL); px(x, y, C.cwD); r(x, y, 1, hh, C.cwD); x += w; } r(0, y + hh - 1, 16, 1, C.cwD); });
    r(0, 14, 16, 2, C.ct);
    if (!(mask & 8)) r(0, 0, 1, 16, C.cwD); if (!(mask & 2)) r(15, 0, 1, 16, C.cwD);
  }
  function caveFloor(g, v) {
    const { r, px } = H(g), R = rng(v * 23 + 5);
    r(0, 0, 16, 16, C.fl);
    for (let i = 0; i < 12; i++) px((R() * 16) | 0, (R() * 16) | 0, R() < 0.6 ? C.flD : C.flL);
    if (v % 3 === 1) { const x = 3 + ((R() * 9) | 0), y = 3 + ((R() * 9) | 0); r(x, y, 3, 2, C.flD); r(x, y, 2, 1, C.flL); }
  }
  function woodFloor(g, v) {
    const { r, px } = H(g);
    r(0, 0, 16, 16, C.wood);
    for (let y = 0; y < 16; y += 4) { r(0, y + 3, 16, 1, C.woodD); r(0, y, 16, 1, C.woodL); const o = ((y / 4 + v) * 7) % 16; r(o, y, 1, 4, C.woodD); }
    px((v * 5) % 16, 6, C.woodDD); px((v * 3 + 9) % 16, 13, C.woodDD);
  }
  function innerWall(g, mask, v) {
    const { r } = H(g);
    if (mask & 4) { r(0, 0, 16, 16, '#4a3020'); r(0, 0, 16, 1, '#5e3e2a'); return; }
    r(0, 0, 16, 16, '#efe0bf');
    for (let x = 1; x < 16; x += 4) r(x, 2, 1, 11, '#e2cea6');
    r(0, 0, 16, 2, '#5e3e2a'); r(0, 12, 16, 4, '#8a5a36'); r(0, 12, 16, 1, '#a8744a'); r(0, 15, 16, 1, '#5e3e2a');
    if (v % 4 === 1) { r(5, 4, 6, 5, '#7a5236'); r(6, 5, 4, 3, '#9ccfee'); r(6, 5, 2, 1, '#e8f8ff'); }
  }
  function roof(g, mask, pal, x0) {
    const { r, px } = H(g), [b, d, l] = pal;
    r(0, 0, 16, 16, b);
    for (let y = 0; y < 16; y += 4) { r(0, y + 3, 16, 1, d); for (let x = (y % 8 ? 2 : 0) + (x0 % 2) * 2; x < 16; x += 4) { r(x, y, 3, 1, l); px(x + 3, y + 1, d); px(x + 3, y + 2, d); } }
    if (!(mask & 1)) { r(0, 0, 16, 2, l); r(0, 2, 16, 1, d); }
    if (!(mask & 4)) { r(0, 12, 16, 2, d); r(0, 14, 16, 2, dk(d, 0.4)); }
    if (!(mask & 8)) { r(0, 0, 2, 16, l); r(0, 0, 1, 16, dk(d, 0.4)); }
    if (!(mask & 2)) { r(14, 0, 2, 16, d); r(15, 0, 1, 16, dk(d, 0.4)); }
  }
  function houseWall(g, mask, v, door) {
    const { r, px } = H(g);
    r(0, 0, 16, 16, C.pl);
    r(0, 0, 16, 3, C.beam); r(0, 3, 16, 1, C.plD);
    r(0, 14, 16, 2, '#9a8a78');
    if (!(mask & 8)) r(0, 0, 2, 16, C.beam); if (!(mask & 2)) r(14, 0, 2, 16, C.beam);
    if (door) {
      r(3, 4, 10, 12, C.beamD); r(4, 5, 8, 11, '#8a5634'); r(4, 5, 8, 1, '#a8704a');
      for (let x = 5; x < 12; x += 2) r(x, 6, 1, 10, '#76462a');
      px(10, 10, '#f0c850'); r(3, 4, 10, 1, C.beam);
      return;
    }
    if (v % 2 === 0) {
      r(4, 5, 8, 7, C.beamD); r(5, 6, 6, 5, '#ffe7a0'); r(5, 6, 6, 2, '#fff6cc'); r(7, 6, 1, 5, C.beamD); r(5, 8, 6, 1, C.beamD);
      r(3, 12, 10, 2, '#7a4a2a'); px(4, 11, '#ff7090'); px(6, 11, '#ffd040'); px(9, 11, '#ff7090'); px(11, 11, '#ffffff');
    } else { r(7, 4, 2, 10, C.beam); r(2, 8, 12, 1, C.beam); }
  }
  function bridge(g, f, v) {
    water(g, 1 | 4, f, v);
    const { r } = H(g);
    r(0, 2, 16, 12, C.woodD);
    for (let x = 0; x < 16; x += 4) { r(x, 3, 3, 10, C.wood); r(x, 3, 3, 1, C.woodL); }
    r(0, 1, 16, 2, C.woodDD); r(0, 13, 16, 2, C.woodDD); r(0, 1, 16, 1, C.woodL);
    r(1, 0, 2, 3, C.woodDD); r(13, 0, 2, 3, C.woodDD); r(1, 13, 2, 3, C.woodDD); r(13, 13, 2, 3, C.woodDD);
  }

  function drawTile(ch, info) {
    const { v = 0, mask = 15, f = 0, ground = '.', roofPal = 0, x0 = 0 } = info;
    const key = ch + '|' + v + '|' + mask + '|' + f + '|' + ground + '|' + roofPal + '|' + x0;
    return memo('t' + key, () => {
      const [c, g] = mk(16, 16); const { r, px, oval } = H(g);
      const under = () => { if (ground === '_') caveFloor(g, v); else if (ground === 'W') woodFloor(g, v); else grass(g, v); };
      switch (ch) {
        case '.': grass(g, v); break;
        case ',': flowers(g, v); break;
        case '"': tallGrass(g, v, f); break;
        case '=': path(g, v, mask); break;
        case '~': water(g, mask, f, v); break;
        case '%': water(g, mask, f, v); oval(8, 8, 6, 5, '#3f9a48'); oval(8, 7, 5, 4, '#5cbf5a'); r(8, 3, 1, 5, '#3f9a48'); r(9, 4, 2, 1, C.w); px(6, 6, '#a8e88a'); if (v % 2) { px(11, 9, '#ffb0d0'); px(12, 9, '#ff80b0'); px(11, 10, '#ff80b0'); } break;
        case 'o': water(g, mask, f, v); oval(8, 9, 6, 4, '#5a5664'); oval(8, 8, 5, 3, '#8a8696'); r(5, 6, 3, 1, '#b0acbc'); break;
        case '|': bridge(g, f, v); break;
        case 'T': case 't': case 'l': case 'u': case 'x': case 'w': case 'O': case 'B': case 'C': case 'c': case 'S': case 'z': case 'm': case 'r': case 'q': case 'L':
          under(); break;
        case 'M': cliff(g, mask, v); break;
        case 'v': cliff(g, 0, v); r(3, 4, 10, 12, '#120c10'); r(4, 3, 8, 1, '#120c10'); r(2, 5, 1, 11, C.cfDD); r(13, 5, 1, 11, C.cfDD); r(4, 4, 8, 1, '#2a1c18'); break;
        case '#': caveWall(g, mask, v); break;
        case '_': caveFloor(g, v); break;
        case 'P': caveFloor(g, v); oval(8, 8, 7, 6, C.flD); oval(8, 9, 6, 5, '#120c1c'); oval(8, 10, 4, 3, '#05030a'); r(3, 4, 10, 1, C.flL); break;
        case 'p': caveFloor(g, v); oval(8, 8, 7, 6, '#3e3650'); oval(8, 8, 6, 5, '#6c6680'); r(4, 6, 6, 1, '#8a84a0'); r(7, 9, 1, 3, '#4a4460'); r(8, 11, 3, 1, '#4a4460'); break;
        case 'X':
          if (ground === 'W') { woodFloor(g, v); r(2, 0, 12, 16, '#3a2414'); r(3, 0, 10, 16, '#f6e4a8'); r(3, 0, 10, 4, '#fff6d0'); r(4, 12, 8, 4, '#c86450'); r(4, 12, 8, 1, '#e08a70'); }
          else { r(0, 0, 16, 16, '#0d0914'); r(2, 2, 12, 3, '#1e1828'); r(3, 7, 10, 3, '#181220'); r(4, 12, 8, 3, '#120e1a'); }
          break;
        case 'H': houseWall(g, mask, v, false); break;
        case 'D': houseWall(g, mask, 1, true); break;
        case 'R': roof(g, mask, ROOFS[roofPal % ROOFS.length], x0); break;
        case 'F': grass(g, v); r(0, 5, 16, 2, C.wood); r(0, 10, 16, 2, C.wood); r(0, 5, 16, 1, C.woodL); r(0, 7, 16, 1, C.woodDD); r(0, 12, 16, 1, C.woodDD); if (!(mask & 8)) { r(1, 2, 3, 13, C.woodD); r(1, 2, 3, 1, C.woodL); } if (!(mask & 2) || mask & 2) { r(12, 2, 3, 13, C.woodD); r(12, 2, 3, 1, C.woodL); } break;
        case 'b': grass(g, v); r(1, 4, 14, 11, '#6e4a30'); r(2, 5, 12, 9, '#4a8a3c'); for (let i = 0; i < 6; i++) { const x = 3 + ((i * 5 + v) % 10), y = 6 + ((i * 3) % 6); px(x, y, ['#ff7090', '#ffd040', '#ffffff', '#c080ff'][i % 4]); px(x + 1, y, '#3a7a30'); } r(1, 14, 14, 1, '#4a301e'); break;
        case 'W': woodFloor(g, v); break;
        case 'Q': innerWall(g, mask, v); break;
        case 'g': woodFloor(g, v); r(0, 0, 16, 16, '#9a3f4a'); if (!(mask & 1)) r(0, 0, 16, 1, '#e8c070'); if (!(mask & 4)) r(0, 15, 16, 1, '#e8c070'); if (!(mask & 8)) r(0, 0, 1, 16, '#e8c070'); if (!(mask & 2)) r(15, 0, 1, 16, '#e8c070'); for (let i = 2; i < 14; i += 4) { px(i, 7, '#e8c070'); px(i + 1, 8, '#e8c070'); px(i + 2, 7, '#e8c070'); } break;
        case 'K': woodFloor(g, v); r(0, 3, 16, 13, C.woodDD); r(0, 2, 16, 5, C.woodL); r(0, 2, 16, 1, '#f0c88c'); r(0, 7, 16, 1, '#5a3a20'); for (let x = 2; x < 16; x += 5) r(x, 9, 2, 5, '#8a5a34'); break;
        case 'Y': r(0, 0, 16, 16, '#5a3a22'); r(1, 1, 14, 14, '#6e4a2c'); r(1, 7, 14, 1, '#3e2614'); r(1, 14, 14, 1, '#3e2614');
          for (let x = 2; x < 14; x += 2) { const cA = ['#c84040', '#3a6ac8', '#3aa860', '#e0b040', '#9050b0'][(x + v) % 5]; r(x, 2 + (x % 3 === 0 ? 1 : 0), 2, 5 - (x % 3 === 0 ? 1 : 0), cA); r(x, 9, 2, 5, ['#3a6ac8', '#e0b040', '#c84040', '#3aa860'][(x + 1) % 4]); }
          break;
        case 'e': woodFloor(g, v); r(1, 0, 14, 16, '#6a4024'); r(2, 1, 12, 5, '#f4f0ff'); r(3, 2, 10, 3, '#ffffff'); r(2, 6, 12, 9, '#4f7fd0'); r(2, 6, 12, 2, '#7aa6e8'); for (let x = 3; x < 14; x += 3) px(x, 10, '#3a62b0'); break;
        case 'k': woodFloor(g, v); r(1, 3, 14, 9, C.woodDD); r(1, 3, 14, 7, C.woodL); r(1, 3, 14, 1, '#f4d09a'); r(2, 12, 2, 3, C.woodDD); r(12, 12, 2, 3, C.woodDD); r(6, 4, 4, 3, '#f4f4f4'); r(7, 5, 2, 1, '#c86450'); break;
        default: r(0, 0, 16, 16, '#000');
      }
      return c;
    });
  }

  // ------------------------------------------------------------------ props (outlined sprites)
  function prop(name, v = 0) {
    return memo('prop' + name + v, () => {
      let c, g;
      const R = rng(v * 97 + name.length);
      if (name === 'tree') {
        [c, g] = mk(28, 32); const { r, oval, px } = H(g);
        r(12, 20, 4, 10, '#7a4e2e'); r(12, 20, 1, 10, '#9a6a40'); r(15, 22, 1, 8, '#5a361e'); r(10, 29, 8, 1, '#5a361e');
        const base = ['#3f8f3f', '#4a9a42', '#3a8848'][v % 3];
        oval(14, 14, 12, 10, dk(base, 0.25)); oval(8, 13, 6, 6, dk(base, 0.25)); oval(20, 13, 6, 6, dk(base, 0.25));
        oval(14, 11, 11, 9, base); oval(9, 10, 6, 5, base); oval(19, 9, 6, 5, base);
        oval(11, 7, 6, 4, lt(base, 0.18)); oval(17, 6, 4, 3, lt(base, 0.18)); oval(10, 6, 3, 2, lt(base, 0.38));
        for (let i = 0; i < 8; i++) px(4 + ((R() * 20) | 0), 6 + ((R() * 14) | 0), dk(base, 0.4));
        for (let i = 0; i < 5; i++) px(6 + ((R() * 14) | 0), 4 + ((R() * 8) | 0), lt(base, 0.45));
        if (v % 4 === 3) { px(9, 15, '#ff5050'); px(18, 12, '#ff5050'); px(14, 17, '#ff5050'); }
      } else if (name === 'bush') {
        [c, g] = mk(16, 14); const { oval, px } = H(g);
        oval(8, 8, 7, 5, '#3a8040'); oval(8, 6, 6, 4, '#4f9e4a'); oval(6, 5, 3, 2, '#72c060'); px(4, 9, '#2c6a34'); px(11, 8, '#2c6a34');
        if (v % 2) { px(5, 6, '#ff80a0'); px(10, 5, '#ffffff'); px(8, 9, '#ff80a0'); }
      } else if (name === 'boulder') {
        [c, g] = mk(16, 16); const { oval, r, px } = H(g);
        oval(8, 9, 7, 6, '#5c5868'); oval(8, 8, 6, 5, '#807b8c'); oval(6, 6, 3, 2, '#a7a2b2'); px(5, 5, '#d0ccd8'); r(9, 10, 1, 3, '#4a4656'); r(10, 12, 3, 1, '#4a4656'); px(3, 9, '#6c6878');
      } else if (name === 'bramble') {
        [c, g] = mk(16, 16); const { oval, px, r } = H(g);
        oval(8, 9, 7, 6, '#2c4a2a'); oval(8, 8, 6, 5, '#3d6332');
        for (let i = 0; i < 6; i++) { const x = 2 + ((R() * 12) | 0), y = 3 + ((R() * 10) | 0); r(x, y, 3, 1, '#5a2a48'); px(x + 3, y - 1, '#e85a90'); px(x - 1, y + 1, '#e85a90'); }
        for (let i = 0; i < 4; i++) px(3 + ((R() * 10) | 0), 4 + ((R() * 9) | 0), '#ff9ac0');
      } else if (name === 'chest' || name === 'chestOpen') {
        [c, g] = mk(16, 14); const { r, px } = H(g);
        if (name === 'chest') { r(1, 4, 14, 9, '#8a5226'); r(1, 1, 14, 4, '#b06c34'); r(2, 1, 12, 1, '#d08a4c'); r(1, 5, 14, 1, '#5e3416'); r(1, 6, 14, 1, '#e8b850'); r(7, 5, 2, 4, '#f0c850'); px(7, 7, '#5e3416'); r(1, 4, 1, 9, '#e8b850'); r(14, 4, 1, 9, '#e8b850'); r(2, 8, 12, 4, '#9a5e2c'); }
        else { r(1, 5, 14, 8, '#8a5226'); r(2, 5, 12, 2, '#200e04'); r(1, 0, 14, 4, '#b06c34'); r(2, 1, 12, 1, '#5e3416'); r(1, 7, 14, 1, '#e8b850'); r(2, 9, 12, 3, '#9a5e2c'); }
      } else if (name === 'sign') {
        [c, g] = mk(16, 16); const { r } = H(g);
        r(7, 9, 2, 7, '#6a4426'); r(1, 2, 14, 8, '#7a4e2a'); r(2, 3, 12, 6, '#c89a62'); r(2, 3, 12, 1, '#e0b47a'); r(4, 5, 8, 1, '#7a4e2a'); r(4, 7, 6, 1, '#7a4e2a');
      } else if (name === 'lamp') {
        [c, g] = mk(10, 26); const { r, px } = H(g);
        r(4, 8, 2, 17, '#3a3448'); r(2, 24, 6, 2, '#3a3448'); r(1, 2, 8, 7, '#3a3448'); r(2, 3, 6, 5, '#ffe090'); r(3, 4, 2, 2, '#fff8d0'); r(0, 1, 10, 2, '#4a4458'); px(4, 0, '#4a4458'); px(5, 0, '#4a4458');
      } else if (name === 'barrel') {
        [c, g] = mk(14, 15); const { r } = H(g);
        r(1, 1, 12, 13, '#8a5a32'); r(2, 1, 3, 13, '#a8743e'); r(1, 3, 12, 1, '#4a4a58'); r(1, 10, 12, 1, '#4a4a58'); r(1, 0, 12, 2, '#5e3a1e'); r(2, 0, 10, 1, '#c08a50');
      } else if (name === 'crate') {
        [c, g] = mk(15, 15); const { r } = H(g);
        r(0, 1, 15, 14, '#a8743e'); r(1, 2, 13, 12, '#c48c50'); r(0, 1, 15, 2, '#8a5a32'); r(0, 13, 15, 2, '#8a5a32'); r(0, 1, 2, 14, '#8a5a32'); r(13, 1, 2, 14, '#8a5a32');
        for (let i = 0; i < 11; i++) r(2 + i, 3 + i, 2, 1, '#8a5a32');
      } else if (name === 'well') {
        [c, g] = mk(16, 22); const { r, oval } = H(g);
        r(1, 0, 14, 2, '#a6402f'); r(0, 1, 16, 3, '#cf5a3f'); r(2, 4, 2, 10, '#6a4426'); r(12, 4, 2, 10, '#6a4426'); r(4, 7, 8, 1, '#6a4426'); r(7, 7, 2, 4, '#8a6a4a');
        oval(8, 16, 7, 5, '#7c7890'); oval(8, 15, 6, 3, '#9a96aa'); oval(8, 15, 4, 2, '#1f4a8a');
      } else if (name === 'crystal') {
        [c, g] = mk(16, 18); const { poly } = H(g);
        poly([4, 17, 2, 8, 5, 3, 7, 17], '#3fb8c8'); poly([7, 17, 8, 1, 11, 6, 11, 17], '#6ae0e8'); poly([11, 17, 12, 9, 14, 12, 14, 17], '#3fb8c8');
        poly([8, 2, 9, 2, 9, 12, 8, 12], '#d8ffff'); poly([4, 5, 5, 5, 5, 12, 4, 12], '#a0f0f8');
      } else if (name === 'mushroom') {
        [c, g] = mk(16, 14); const { r, oval, px } = H(g);
        r(4, 8, 2, 5, '#e8e0d0'); oval(5, 7, 4, 3, '#c25ad8'); px(4, 5, '#f8c8ff'); px(6, 6, '#f8c8ff');
        r(10, 6, 2, 7, '#e8e0d0'); oval(11, 5, 4, 3, '#9a48c8'); px(10, 3, '#f8c8ff'); px(12, 4, '#f8c8ff');
      } else if (name === 'rock') {
        [c, g] = mk(14, 11); const { oval, px } = H(g);
        oval(7, 6, 6, 4, '#5c5868'); oval(6, 5, 5, 3, '#7c788a'); px(4, 3, '#aaa6b8');
      } else if (name === 'plant') {
        [c, g] = mk(12, 18); const { r, oval, px } = H(g);
        r(3, 12, 6, 6, '#b8603a'); r(2, 12, 8, 2, '#d07a4a'); oval(6, 7, 5, 5, '#3f8f3f'); oval(4, 5, 2, 3, '#5aaf4e'); oval(8, 4, 2, 3, '#5aaf4e'); px(6, 2, '#72c860');
      } else if (name === 'spring' || name === 'springLit') {
        [c, g] = mk(32, 24); const { oval, r, px } = H(g);
        const lit = name === 'springLit';
        oval(16, 14, 15, 9, '#6a6680'); oval(16, 13, 14, 8, '#8c88a2'); oval(16, 13, 11, 6, lit ? '#3fd0c8' : '#3a3a4c'); oval(14, 12, 6, 3, lit ? '#9ff6ee' : '#4a4a5e');
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; r(Math.round(16 + Math.cos(a) * 13), Math.round(14 + Math.sin(a) * 7.5), 2, 2, '#5a566e'); }
        if (lit) { px(12, 11, '#ffffff'); px(19, 13, '#ffffff'); }
        r(14, 0, 4, 9, lit ? '#7ae8c8' : '#6a6a78'); r(15, 0, 2, 9, lit ? '#c8fff0' : '#8a8a98'); oval(16, 1, 3, 2, lit ? '#ffd8f0' : '#8a8a98');
      }
      return crisp(c);
    });
  }

  // ------------------------------------------------------------------ characters
  // look: { skin, hair, hairStyle, top, bottom, boots, accent, cape, apron, dress, build, beard, glasses, crown, feather, hat, eye }
  function humanoid(L, dir, frame) {
    const [c, g] = mk(18, 26); g.translate(1, 1);
    const { r, px } = H(g);
    const skin = L.skin, skinD = dk(skin, 0.22), hair = L.hair, hairD = dk(hair, 0.3), hairL = lt(hair, 0.28);
    const top = L.top, topD = dk(top, 0.28), topL = lt(top, 0.22), bot = L.bottom || dk(top, 0.4), botD = dk(bot, 0.25);
    const boots = L.boots || '#4a3326', eye = L.eye || '#2a1d33';
    const broad = L.build === 'broad', small = L.build === 'small';
    const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    const oy = step ? -1 : 0; // body rises on step frames
    const side = dir === 'right';
    const U = (x, y, w, h, col) => r(x, y + oy, w, h, col);
    const UP = (x, y, col) => px(x, y + oy, col);

    // ---- legs
    if (!side) {
      const la = step === 1 ? 1 : 0, lb = step === -1 ? 1 : 0;
      if (!L.dress) { r(5, 17, 2, 4 + la - lb, bot); r(9, 17, 2, 4 + lb - la, bot); r(5, 17, 1, 3, botD); r(10, 17, 1, 3, botD); }
      else { r(5, 19, 2, 2 + la - lb, skinD); r(9, 19, 2, 2 + lb - la, skinD); }
      r(4, 21 + la - lb, 3, 2, boots); r(9, 21 + lb - la, 3, 2, boots);
    } else {
      if (step) { r(4, 17, 3, 4, botD); r(9, 17, 3, 4, bot); r(3, 21, 4, 2, dk(boots, 0.2)); r(9, 21, 4, 2, boots); }
      else { r(6, 17, 4, 4, bot); r(6, 17, 1, 4, botD); r(6, 21, 5, 2, boots); }
      if (L.dress) { r(4, 17, 9, 2, L.dress); }
    }
    // ---- cape (behind)
    if (L.cape && dir !== 'up') {
      if (side) { U(2, 11, 4, 8, dk(L.cape, 0.15)); U(2, 18, 3, 1, dk(L.cape, 0.35)); }
      else { U(3, 11, 10, 2, L.cape); U(2, 12, 2, 6, dk(L.cape, 0.15)); U(12, 12, 2, 6, dk(L.cape, 0.15)); }
    }
    // ---- torso
    const tx = broad ? 3 : 4, tw = broad ? 10 : 8;
    if (!side) {
      U(tx, 11, tw, 7, top); U(tx, 11, 1, 7, topL); U(tx + tw - 2, 11, 2, 7, topD); U(tx + 1, 11, tw - 2, 1, topL);
      if (L.dress) { U(3, 15, 10, 4, L.dress); U(3, 18, 10, 1, dk(L.dress, 0.3)); U(3, 15, 1, 4, lt(L.dress, 0.2)); U(11, 15, 2, 4, dk(L.dress, 0.2)); }
      else U(tx, 15, tw, 1, L.belt || '#5a3a24');
      if (L.apron && dir === 'down') { U(5, 12, 6, 6, L.apron); U(5, 12, 6, 1, lt(L.apron, 0.2)); U(6, 11, 1, 1, L.apron); U(9, 11, 1, 1, L.apron); UP(8, 15, '#d8b070'); }
      if (L.apron && dir === 'up') { U(5, 13, 6, 1, L.apron); U(7, 11, 2, 3, L.apron); }
      if (L.sash && dir === 'down') { for (let i = 0; i < 6; i++) UP(tx + 1 + i, 11 + i, L.sash); }
      if (L.cape && dir === 'up') { U(3, 11, 10, 8, L.cape); U(3, 11, 10, 1, lt(L.cape, 0.2)); U(3, 18, 10, 1, dk(L.cape, 0.3)); U(12, 11, 1, 8, dk(L.cape, 0.2)); }
      // arms
      const sw = step;
      const ax1 = tx - 1, ax2 = tx + tw;
      U(ax1, 12 + Math.max(0, sw), 1, 4, topD); U(ax1, 16 + Math.max(0, sw), 1, 1, skin);
      U(ax2, 12 + Math.max(0, -sw), 1, 4, topD); U(ax2, 16 + Math.max(0, -sw), 1, 1, skin);
      if (L.lantern && dir === 'down') { U(ax2, 17, 2, 3, '#4a4458'); UP(ax2, 18, '#ffcc60'); UP(ax2 + 1, 18, '#ff9a30'); }
    } else {
      U(5, 11, 6, 7, top); U(10, 11, 1, 7, topL); U(5, 11, 1, 7, topD); U(5, 11, 6, 1, topL);
      if (L.dress) { U(3, 15, 10, 4, L.dress); U(3, 18, 10, 1, dk(L.dress, 0.3)); U(11, 15, 1, 4, lt(L.dress, 0.2)); }
      else U(5, 15, 6, 1, L.belt || '#5a3a24');
      if (L.apron) { U(9, 12, 2, 6, L.apron); }
      if (L.cape) { U(4, 11, 2, 2, L.cape); }
      const ax = 7 + step;
      U(ax, 12, 2, 4, topD); U(ax, 16, 2, 1, skin);
      if (L.lantern) { U(ax + 1, 17, 2, 3, '#4a4458'); UP(ax + 1, 18, '#ffcc60'); }
    }
    // ---- head
    const hy = 0;
    if (dir === 'down') {
      U(4, 3 + hy, 8, 8, skin); U(4, 10 + hy, 1, 1, '#0000'); g.clearRect(4, 10 + oy, 1, 1); g.clearRect(11, 10 + oy, 1, 1);
      U(5, 10, 6, 1, skinD);
      UP(6, 7, eye); UP(6, 8, eye); UP(9, 7, eye); UP(9, 8, eye); UP(6, 7, eye);
      UP(5, 9, '#f0a0a0'); UP(10, 9, '#f0a0a0');
      if (L.glasses) { U(5, 6, 3, 1, '#5a3a2a'); U(8, 6, 3, 1, '#5a3a2a'); UP(5, 7, '#5a3a2a'); UP(10, 7, '#5a3a2a'); UP(7, 7, '#c8e8ff'); UP(8, 7, '#c8e8ff'); }
      if (L.beard) { U(5, 9, 6, 2, L.beard); U(6, 11, 4, 1, L.beard); UP(7, 9, skinD); UP(8, 9, skinD); }
    } else if (dir === 'up') {
      U(4, 3, 8, 8, skin);
    } else {
      U(5, 3, 7, 8, skin); UP(12, 7, skin); UP(12, 8, skinD); U(6, 10, 5, 1, skinD);
      UP(10, 7, eye); UP(10, 8, eye); UP(11, 9, '#f0a0a0'); UP(7, 7, skinD);
      if (L.glasses) { U(9, 6, 3, 1, '#5a3a2a'); UP(9, 7, '#5a3a2a'); UP(11, 7, '#5a3a2a'); }
      if (L.beard) { U(7, 9, 5, 2, L.beard); U(8, 11, 3, 1, L.beard); }
    }
    // ---- hair
    const st = L.hairStyle;
    const capTop = (y0, h) => { U(4, y0, 8, h, hair); U(3, y0 + 1, 10, h - 1, hair); U(5, y0, 4, 1, hairL); };
    if (dir === 'down') {
      if (st === 'bald') { U(3, 5, 1, 3, hair); U(12, 5, 1, 3, hair); U(5, 2, 6, 1, skinD); U(4, 3, 8, 1, skin); }
      else {
        capTop(1, 4);
        if (st === 'bob') { U(4, 5, 4, 1, hair); U(3, 5, 1, 5, hair); U(12, 5, 1, 5, hair); U(11, 5, 1, 2, hair); UP(4, 9, hairD); UP(11, 9, hairD); U(5, 2, 3, 1, hairL); }
        else if (st === 'messy') { UP(4, 0, hair); UP(7, 0, hair); UP(10, 0, hair); U(3, 5, 1, 3, hair); U(12, 5, 1, 3, hair); U(5, 5, 2, 1, hair); U(9, 5, 2, 1, hair); }
        else if (st === 'braid') { U(4, 5, 8, 1, hair); U(3, 5, 1, 4, hair); U(12, 5, 1, 3, hair); for (let y = 8; y < 16; y++) UP(12 + (y % 2), y, y % 2 ? hairD : hair); UP(12, 16, L.accent || '#ff80b0'); }
        else if (st === 'bun') { U(6, -1, 4, 2, hair); UP(7, -1, hairL); U(3, 4, 1, 4, hair); U(12, 4, 1, 4, hair); }
        else if (st === 'long') { U(4, 5, 8, 1, hair); U(3, 5, 1, 8, hair); U(12, 5, 1, 8, hair); U(2, 8, 1, 5, hairD); U(13, 8, 1, 5, hairD); }
        else { U(3, 5, 1, 2, hair); U(12, 5, 1, 2, hair); U(5, 5, 6, 1, hair); }
        U(3, 2, 1, 3, hairD); U(12, 2, 1, 3, hairD);
      }
    } else if (dir === 'up') {
      if (st === 'bald') { U(4, 3, 8, 3, skin); U(4, 6, 8, 3, hair); U(5, 3, 3, 1, lt(skin, 0.3)); }
      else {
        capTop(1, 9); U(4, 10, 8, 1, hairD);
        if (st === 'braid') for (let y = 10; y < 17; y++) UP(7 + (y % 2), y, y % 2 ? hairD : hair);
        if (st === 'bun') { U(6, -1, 4, 3, hair); UP(7, -1, hairL); }
        if (st === 'long') { U(3, 10, 10, 4, hair); U(3, 13, 10, 1, hairD); }
        if (st === 'messy') { UP(4, 0, hair); UP(7, 0, hair); UP(10, 0, hair); }
        U(5, 2, 4, 1, hairL);
      }
    } else {
      if (st === 'bald') { U(4, 5, 3, 3, hair); U(5, 2, 6, 1, skinD); }
      else {
        U(4, 1, 8, 4, hair); U(5, 0, 6, 1, hair); U(6, 1, 4, 1, hairL);
        U(4, 5, 4, 4, hair); U(4, 9, 2, 1, hairD); U(10, 5, 2, 1, hair);
        if (st === 'bob') { U(3, 5, 2, 5, hair); UP(4, 10, hairD); }
        if (st === 'messy') { UP(5, -1, hair); UP(8, -1, hair); UP(11, 0, hair); UP(12, 1, hair); }
        if (st === 'braid') { for (let y = 9; y < 16; y++) UP(4 + (y % 2), y, y % 2 ? hairD : hair); }
        if (st === 'bun') { U(3, 0, 3, 3, hair); }
        if (st === 'long') { U(3, 5, 3, 8, hair); U(3, 12, 3, 1, hairD); }
      }
    }
    // ---- headwear / accessories
    if (L.hat) {
      if (dir === 'up' || dir === 'down') { U(2, 3, 12, 2, L.hat); U(4, 0, 8, 3, L.hat); U(4, 2, 8, 1, dk(L.hat, 0.3)); U(5, 0, 4, 1, lt(L.hat, 0.25)); }
      else { U(3, 3, 11, 2, L.hat); U(4, 0, 8, 3, L.hat); U(4, 2, 8, 1, dk(L.hat, 0.3)); }
    }
    if (L.crown && dir !== 'up') { const cols = ['#ff8ab8', '#ffffff', '#ffd84a']; for (let x = 4; x < 12; x += 2) UP(x, 1, cols[(x / 2) % 3]); }
    if (L.crown && dir === 'up') { const cols = ['#ff8ab8', '#ffffff', '#ffd84a']; for (let x = 4; x < 12; x += 2) UP(x, 2, cols[(x / 2) % 3]); }
    if (L.feather) {
      if (dir === 'down') { UP(12, 0, L.feather); UP(13, -1, L.feather); UP(12, 1, dk(L.feather, 0.3)); }
      else if (dir === 'up') { UP(3, 0, L.feather); UP(2, -1, L.feather); }
      else { UP(4, 0, L.feather); UP(3, -1, L.feather); UP(4, 1, dk(L.feather, 0.3)); }
    }
    if (L.hood && dir !== 'down') { /* hood folded behind */ U(dir === 'up' ? 4 : 3, 10, dir === 'up' ? 8 : 3, 2, L.cape || L.top); }
    return crisp(c);
  }
  function charSprite(L, dir, frame) {
    const key = 'ch' + JSON.stringify(L) + dir + frame;
    return memo(key, () => (dir === 'left' ? flipX(humanoid(L, 'right', frame)) : humanoid(L, dir, frame)));
  }

  // ------------------------------------------------------------------ portraits (32x32)
  function portrait(L) {
    return memo('pt' + JSON.stringify(L), () => {
      const [c, g] = mk(34, 34); g.translate(1, 1);
      const { r, px, oval } = H(g);
      const skin = L.skin, skinD = dk(skin, 0.2), hair = L.hair, hairD = dk(hair, 0.3), hairL = lt(hair, 0.3), eye = L.eye || '#2a1d33';
      const st = L.hairStyle, top = L.top;
      // back hair
      if (st === 'long' || st === 'braid') { r(6, 10, 20, 16, hairD); }
      if (st === 'bob') { r(6, 10, 20, 12, hairD); }
      // shoulders
      oval(16, 31, 13, 6, top); r(3, 28, 26, 4, top); oval(16, 29, 5, 3, lt(top, 0.2));
      if (L.cape) { r(3, 26, 6, 6, L.cape); r(23, 26, 6, 6, L.cape); r(9, 26, 14, 2, L.cape); }
      if (L.apron) { r(11, 27, 10, 5, L.apron); r(12, 25, 1, 3, L.apron); r(19, 25, 1, 3, L.apron); }
      if (L.dress) r(10, 27, 12, 5, L.dress);
      r(13, 21, 6, 6, skinD);
      // face
      oval(16, 15, 9, 10, skin); oval(16, 21, 6, 3, skin);
      r(6, 14, 2, 4, skin); r(25, 14, 2, 4, skin); px(6, 15, skinD); px(26, 15, skinD);
      // eyes
      for (const ex of [11, 19]) { r(ex, 15, 3, 4, '#ffffff'); r(ex + 1, 15, 2, 4, eye); px(ex + 1, 15, '#ffffff'); px(ex, 18, '#e8e0f0'); }
      r(10, 13, 4, 1, hairD); r(19, 13, 4, 1, hairD);
      px(16, 19, skinD); px(17, 20, skinD);
      r(14, 22, 4, 1, '#b05a5a'); px(13, 21, '#b05a5a'); px(18, 21, '#b05a5a');
      r(8, 19, 3, 2, '#f4a8a8'); r(22, 19, 3, 2, '#f4a8a8');
      if (L.glasses) { const fc = '#5a3a2a'; for (const ex of [10, 18]) { r(ex, 14, 5, 1, fc); r(ex, 19, 5, 1, fc); r(ex, 14, 1, 6, fc); r(ex + 4, 14, 1, 6, fc); } r(15, 15, 3, 1, fc); px(11, 15, '#e0f4ff'); px(19, 15, '#e0f4ff'); }
      if (L.beard) { oval(16, 23, 8, 5, L.beard); r(8, 17, 3, 6, L.beard); r(22, 17, 3, 6, L.beard); r(14, 22, 4, 1, dk(L.beard, 0.4)); oval(16, 21, 3, 1, skin); }
      // hair front
      if (st === 'bald') { oval(16, 8, 9, 3, skin); r(6, 10, 3, 6, hair); r(24, 10, 3, 6, hair); px(12, 5, lt(skin, 0.4)); }
      else {
        oval(16, 8, 11, 7, hair); r(5, 8, 22, 4, hair);
        if (st === 'bob') { r(5, 10, 4, 12, hair); r(24, 10, 4, 12, hair); r(8, 10, 10, 3, hair); px(18, 10, hair); r(5, 21, 4, 1, hairD); r(24, 21, 4, 1, hairD); }
        else if (st === 'messy') { for (const [x, y] of [[6, 4], [10, 1], [15, 0], [20, 1], [25, 4], [27, 8]]) { r(x - 1, y, 3, 4, hair); } r(7, 11, 4, 2, hair); r(13, 11, 3, 2, hair); r(20, 11, 5, 2, hair); r(5, 10, 3, 6, hair); r(25, 10, 3, 6, hair); }
        else if (st === 'braid') { r(6, 11, 20, 2, hair); r(5, 10, 3, 8, hair); r(24, 10, 3, 8, hair); for (let y = 16; y < 30; y += 2) { r(24 + ((y / 2) % 2), y, 4, 2, (y / 2) % 2 ? hairD : hair); } r(24, 30, 4, 2, L.accent || '#ff80b0'); }
        else if (st === 'bun') { oval(16, 1, 5, 4, hair); px(14, 0, hairL); r(5, 10, 3, 8, hair); r(25, 10, 3, 8, hair); r(8, 10, 16, 2, hair); }
        else if (st === 'long') { r(4, 10, 4, 18, hair); r(25, 10, 4, 18, hair); r(8, 11, 16, 2, hair); }
        else { r(5, 10, 3, 5, hair); r(25, 10, 3, 5, hair); r(8, 11, 16, 2, hair); }
        r(10, 3, 6, 2, hairL); r(9, 5, 3, 1, hairL);
      }
      if (L.hat) { r(2, 7, 28, 3, L.hat); oval(16, 5, 9, 5, L.hat); r(7, 7, 18, 1, dk(L.hat, 0.3)); r(9, 1, 6, 1, lt(L.hat, 0.3)); }
      if (L.crown) { for (let x = 6; x <= 26; x += 4) { const col = ['#ff8ab8', '#ffffff', '#ffd84a'][(x / 4) % 3]; r(x - 1, 3 + (x % 8 === 2 ? 1 : 0), 3, 3, col); px(x, 4 + (x % 8 === 2 ? 1 : 0), '#f0a020'); } }
      if (L.feather) { r(25, 0, 2, 8, L.feather); r(27, 1, 1, 5, L.feather); r(24, 2, 1, 4, lt(L.feather, 0.3)); px(25, 8, dk(L.feather, 0.3)); }
      return crisp(c);
    });
  }

  // ------------------------------------------------------------------ enemies
  // drawn with vector shapes into a small canvas then crisped (binarized + outlined)
  const ENEMY_ART = {
    jelly: { w: 34, h: 28, draw(g, ph) { const { el } = H(g); const s = 1 + 0.08 * Math.sin(ph * Math.PI * 2); const by = 26;
      el(17, by - 9 * s, 14 / s, 9 * s, '#4aa0e0'); el(17, by - 10 * s, 12 / s, 7.5 * s, '#62b8f0'); el(12, by - 13 * s, 4, 2.5, '#b8e4ff'); el(11, by - 14 * s, 1.5, 1, '#ffffff');
      el(22, by - 6 * s, 2, 2, '#8ad0ff'); el(12, by - 5 * s, 1.5, 1.5, '#8ad0ff');
      el(13, by - 9 * s, 1.6, 2.4, '#1a2a4a'); el(21, by - 9 * s, 1.6, 2.4, '#1a2a4a'); el(13.5, by - 10 * s, 0.6, 0.6, '#fff'); el(21.5, by - 10 * s, 0.6, 0.6, '#fff');
      el(17, by - 6 * s, 2, 1, '#1a2a4a'); } },
    bun: { w: 34, h: 36, draw(g, ph) { const { el, r } = H(g); const hop = Math.abs(Math.sin(ph * Math.PI * 2)) * 3, by = 34 - hop;
      el(11, by - 22, 3, 8, '#c8a878', -0.25); el(23, by - 22, 3, 8, '#c8a878', 0.25); el(11, by - 22, 1.5, 6, '#f0a8b0', -0.25); el(23, by - 22, 1.5, 6, '#f0a8b0', 0.25);
      el(17, by - 9, 13, 10, '#b8956a'); el(17, by - 10, 12, 8.5, '#d8b888'); el(13, by - 14, 4, 2.5, '#f0dcb0');
      for (const [x, y] of [[8, -6], [25, -8], [20, -15], [10, -13], [15, -3]]) { el(x, by + y, 2, 2, '#4a6a2a'); r(x - 3, by + y, 6, 1, '#2f4a1c'); r(x, by + y - 3, 1, 6, '#2f4a1c'); }
      el(13, by - 11, 1.5, 2, '#2a1d33'); el(21, by - 11, 1.5, 2, '#2a1d33'); el(17, by - 8, 1.5, 1, '#e07080'); el(9, by - 8, 2, 1, '#f0a0a0'); el(25, by - 8, 2, 1, '#f0a0a0'); } },
    wasp: { w: 40, h: 38, draw(g, ph) { const { el, poly } = H(g); const f = Math.sin(ph * Math.PI * 8) * 0.5, by = 30 + Math.sin(ph * Math.PI * 2) * 2;
      el(16, by - 16, 9, 4 + f * 3, '#e8f6ff', -0.6); el(24, by - 17, 8, 3.5 - f * 2, '#d0e8ff', 0.5);
      el(26, by - 7, 9, 6, '#f2c230'); for (const x of [22, 27, 31]) poly([x, by - 13, x + 2, by - 13, x + 2, by - 1, x, by - 1], '#3a2a4a');
      poly([34, by - 8, 39, by - 6, 34, by - 4], '#3a2a4a');
      el(12, by - 9, 6, 5, '#8a5ab0'); el(7, by - 11, 5, 5, '#f2c230'); el(5, by - 12, 1.5, 2, '#1a1020'); el(9, by - 12, 1.5, 2, '#1a1020');
      poly([5, by - 15, 2, by - 21, 3, by - 21, 7, by - 15], '#3a2a4a'); poly([9, by - 15, 10, by - 21, 11, by - 21, 10, by - 15], '#3a2a4a');
      poly([10, by - 5, 8, by, 9, by, 12, by - 5], '#3a2a4a'); poly([15, by - 5, 15, by, 16, by, 17, by - 5], '#3a2a4a'); } },
    mole: { w: 36, h: 30, draw(g, ph) { const { el, poly } = H(g); const b = Math.sin(ph * Math.PI * 2), by = 28;
      el(18, by - 11 + b * 0.5, 15, 11, '#8a6040'); el(18, by - 12 + b * 0.5, 13, 9, '#a87a50'); el(18, by - 7, 8, 6, '#e0c098');
      el(18, by - 13, 5, 3.5, '#f08898'); el(16.5, by - 14, 1.5, 1, '#ffd0d8'); el(12, by - 17, 1.5, 1.5, '#1a1020'); el(24, by - 17, 1.5, 1.5, '#1a1020');
      poly([3, by - 9, 0, by - 3, 3, by - 4, 4, by - 1, 6, by - 5, 8, by - 3, 8, by - 9], '#f4ecdc'); poly([33, by - 9, 36, by - 3, 33, by - 4, 32, by - 1, 30, by - 5, 28, by - 3, 28, by - 9], '#f4ecdc');
      el(12, by - 20, 3, 1.5, '#4a6a2a'); el(14, by - 22, 1, 2, '#6a9a3a'); } },
    glowcap: { w: 34, h: 38, draw(g, ph) { const { el, r } = H(g); const s = Math.sin(ph * Math.PI * 2), by = 36;
      r(11, by - 16, 12, 14, '#e8dcc8'); r(11, by - 16, 3, 14, '#fff4e4'); el(17, by - 2, 8, 2, '#c8bca8');
      el(13, by - 10, 1.5, 2, '#2a1d33'); el(21, by - 10, 1.5, 2, '#2a1d33'); el(17, by - 6, 2, 1, '#2a1d33');
      el(17, by - 19 + s, 16, 10, '#9a3ab8'); el(17, by - 21 + s, 15, 8, '#c25ad8'); el(12, by - 24 + s, 5, 2.5, '#e8a0f8');
      for (const [x, y] of [[9, -20], [17, -25], [25, -20], [21, -17]]) el(x, by + y + s, 2.5, 2, '#fbe0ff'); } },
    shell: { w: 44, h: 34, draw(g, ph) { const { el, poly } = H(g); const s = Math.sin(ph * Math.PI * 2), by = 32;
      for (const x of [9, 15, 29, 35]) poly([x, by - 8, x - 3, by, x - 1, by, x + 2, by - 8], '#7a5a48');
      poly([4, by - 16 - s * 2, -2, by - 24 - s * 2, 6, by - 26 - s * 2, 10, by - 18], '#b06a50'); poly([40, by - 16 + s * 2, 46, by - 24 + s * 2, 38, by - 26 + s * 2, 34, by - 18], '#b06a50');
      el(22, by - 10, 17, 9, '#6a6278'); el(22, by - 13, 15, 10, '#8a8298'); el(22, by - 18, 11, 6, '#5a9a4a'); el(18, by - 20, 5, 2, '#88c870');
      el(15, by - 14, 4, 2, '#a8a0b8'); el(29, by - 10, 3, 2, '#706880');
      poly([16, by - 6, 15, by - 13, 17, by - 13, 18, by - 6], '#7a5a48'); poly([26, by - 6, 27, by - 13, 29, by - 13, 28, by - 6], '#7a5a48');
      el(16, by - 14, 2, 2, '#1a1020'); el(28, by - 14, 2, 2, '#1a1020'); } },
    moth: { w: 44, h: 38, draw(g, ph) { const { el, poly } = H(g); const f = Math.sin(ph * Math.PI * 2 * 2), by = 32;
      const wy = f * 5;
      poly([22, by - 16, 4, by - 30 + wy, 1, by - 18 + wy * 0.5, 10, by - 10, 22, by - 12], '#8a80a8'); poly([22, by - 16, 40, by - 30 + wy, 43, by - 18 + wy * 0.5, 34, by - 10, 22, by - 12], '#8a80a8');
      poly([22, by - 12, 8, by - 6, 12, by + 2, 22, by - 8], '#6a6088'); poly([22, by - 12, 36, by - 6, 32, by + 2, 22, by - 8], '#6a6088');
      el(10, by - 22 + wy * 0.7, 4, 3, '#d8d0f0'); el(10, by - 22 + wy * 0.7, 2, 1.5, '#4a3a6a'); el(34, by - 22 + wy * 0.7, 4, 3, '#d8d0f0'); el(34, by - 22 + wy * 0.7, 2, 1.5, '#4a3a6a');
      el(22, by - 12, 4, 8, '#c8c0d8'); el(22, by - 18, 5, 3, '#f0ecf8'); el(20, by - 20, 1.2, 1.2, '#ff60c0'); el(24, by - 20, 1.2, 1.2, '#ff60c0');
      poly([20, by - 21, 14, by - 30, 15, by - 30, 21, by - 21], '#d0c8e0'); poly([24, by - 21, 30, by - 30, 29, by - 30, 23, by - 21], '#d0c8e0'); } },
    queen: { w: 132, h: 104, draw(g, ph) { const { el, poly } = H(g); const f = Math.sin(ph * Math.PI * 2), by = 98, cx = 66, wy = f * 8;
      el(cx, by - 48, 62, 40, 'rgba(160,120,220,0.0)');
      poly([cx, by - 56, 6, by - 96 + wy, 0, by - 60 + wy * 0.6, 14, by - 40, cx, by - 44], '#6c5c94'); poly([cx, by - 56, 126, by - 96 + wy, 132, by - 60 + wy * 0.6, 118, by - 40, cx, by - 44], '#6c5c94');
      poly([cx, by - 54, 14, by - 88 + wy, 10, by - 62 + wy * 0.6, 22, by - 46, cx, by - 46], '#9a8ac0'); poly([cx, by - 54, 118, by - 88 + wy, 122, by - 62 + wy * 0.6, 110, by - 46, cx, by - 46], '#9a8ac0');
      poly([cx, by - 44, 18, by - 26, 30, by - 2, cx, by - 30], '#584a7c'); poly([cx, by - 44, 114, by - 26, 102, by - 2, cx, by - 30], '#584a7c');
      poly([cx, by - 42, 26, by - 26, 34, by - 10, cx, by - 32], '#7a6aa4'); poly([cx, by - 42, 106, by - 26, 98, by - 10, cx, by - 32], '#7a6aa4');
      for (const s of [-1, 1]) { const x = cx + s * 38; el(x, by - 70 + wy * 0.6, 10, 8, '#e8e0ff'); el(x, by - 70 + wy * 0.6, 6, 5, '#3a2a5a'); el(x, by - 70 + wy * 0.6, 3, 2.5, '#ff60d0'); el(cx + s * 20, by - 24, 6, 5, '#d8d0f0'); el(cx + s * 20, by - 24, 3, 2.5, '#3a2a5a'); }
      el(cx, by - 36, 9, 22, '#b8b0cc'); for (let i = 0; i < 4; i++) el(cx, by - 26 + i * 6, 8 - i, 2, '#8a82a0');
      el(cx, by - 58, 14, 7, '#f4f0fc'); el(cx, by - 62, 10, 9, '#d8d0e8');
      el(cx - 4, by - 64, 3, 2.4, '#ff50c8'); el(cx + 4, by - 64, 3, 2.4, '#ff50c8'); el(cx - 4.5, by - 64.5, 1, 1, '#ffffff'); el(cx + 3.5, by - 64.5, 1, 1, '#ffffff');
      poly([cx - 4, by - 70, cx - 18, by - 92, cx - 26, by - 90, cx - 6, by - 68], '#e0d8f0'); poly([cx + 4, by - 70, cx + 18, by - 92, cx + 26, by - 90, cx + 6, by - 68], '#e0d8f0');
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) poly([cx + s * (8 + i * 4), by - 74 - i * 5, cx + s * (12 + i * 4), by - 80 - i * 5, cx + s * (13 + i * 4), by - 76 - i * 5], '#e0d8f0');
      poly([cx - 10, by - 92, cx - 6, by - 100, cx - 2, by - 94, cx, by - 102, cx + 2, by - 94, cx + 6, by - 100, cx + 10, by - 92], '#c8c8d8'); } },
  };
  function enemySprite(shape, frame, flash) {
    return memo('en' + shape + frame + (flash ? 'f' : ''), () => {
      if (flash) return tint(enemySprite(shape, frame, false), '#ffffff');
      const a = ENEMY_ART[shape]; const [c, g] = mk(a.w + 4, a.h + 4); g.translate(2, 2);
      a.draw(g, frame / 8);
      return crisp(c);
    });
  }
  const enemySize = (shape) => ENEMY_ART[shape];

  // ------------------------------------------------------------------ icons (12x12)
  function icon(kind) {
    return memo('ic' + kind, () => {
      const [c, g] = mk(14, 14); g.translate(1, 1);
      const { r, px, oval, poly } = H(g);
      switch (kind) {
        case 'herb': oval(6, 6, 4, 5, '#4fae4a'); r(6, 2, 1, 9, '#2f7a30'); px(4, 5, '#2f7a30'); px(8, 7, '#2f7a30'); px(4, 3, '#9ae07a'); r(5, 10, 1, 2, '#6a4a2a'); break;
        case 'tonic': r(4, 0, 4, 3, '#c8a878'); r(3, 3, 6, 1, '#e0e0f0'); oval(6, 8, 4, 4, '#e0e0f0'); oval(6, 8, 3, 3, '#5a9aff'); px(4, 7, '#d8ecff'); break;
        case 'plume': poly([2, 11, 9, 1, 11, 2, 4, 11], '#ffb040'); poly([3, 10, 9, 2, 10, 4, 5, 10], '#ff6040'); r(2, 10, 2, 2, '#e0d8c0'); break;
        case 'berry': oval(6, 7, 4, 4, '#e83a50'); px(4, 5, '#ffb0b8'); r(5, 1, 2, 3, '#3a8a30'); px(7, 2, '#5ab040'); break;
        case 'weapon': r(5, 0, 2, 8, '#d8e0f0'); r(6, 0, 1, 8, '#ffffff'); r(2, 8, 8, 1, '#c8a040'); r(5, 9, 2, 3, '#6a4426'); break;
        case 'armor': r(2, 1, 8, 9, '#8a9ab8'); r(3, 2, 6, 7, '#a8b8d0'); r(0, 1, 3, 4, '#8a9ab8'); r(9, 1, 3, 4, '#8a9ab8'); r(5, 2, 2, 7, '#c8d8f0'); break;
        case 'trinket': oval(6, 7, 4, 4, '#f0c850'); oval(6, 7, 2, 2, '#ff70a0'); r(5, 0, 2, 4, '#c8a040'); px(5, 6, '#ffffff'); break;
        case 'gold': oval(6, 6, 5, 5, '#c89a20'); oval(6, 6, 4, 4, '#f0c850'); r(5, 3, 2, 6, '#c89a20'); break;
      }
      return crisp(c);
    });
  }

  return { C, mk, mix, dk, lt, rng, crisp, tint, drawTile, prop, charSprite, portrait, enemySprite, enemySize, icon, ROOFS };
})();
