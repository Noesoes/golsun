// ===================== Rootwell — 3D world renderer =====================
// Draws the overworld, interiors, caves, battles and title in 3D with three.js.
// Game logic (maps, movement, battles, menus) stays in game.js and data.js; this
// module only reads that state each frame and turns it into a 3D scene.
// Models: Quaternius (Stylized Nature, Fantasy Props, Easy Enemies, Animated Monsters)
// and KayKit by Kay Lousberg (Adventurers, Medieval Hexagon). All CC0.
import * as THREE from './lib/three.module.min.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';
import { clone as skClone } from './lib/SkeletonUtils.js';

const A = 'assets/3d/';
const FILES = {
  nature: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'Pine_1', 'Pine_2', 'Pine_3', 'Bush_Common', 'Bush_Common_Flowers',
    'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3', 'Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Tall', 'Flower_3_Group', 'Flower_4_Group',
    'Mushroom_Common', 'Mushroom_Laetiporus', 'Fern_1', 'Plant_1', 'Plant_7', 'Clover_1', 'Pebble_Round_1', 'Pebble_Round_3', 'RockPath_Round_Small_1', 'RockPath_Round_Wide'],
  props: ['Chest_Wood', 'Bed_Twin1', 'Bookcase_2', 'Table_Large', 'Chair_1', 'Stool', 'Barrel', 'Barrel_Apples', 'Lantern_Wall', 'Anvil', 'Cauldron', 'Workbench',
    'Potion_1', 'Shelf_Simple', 'Crate_Wooden', 'FarmCrate_Apple', 'CandleStick_Stand', 'Bench', 'Vase_2', 'Pot_1'],
  bld: ['home_A_red', 'home_B_yellow', 'tavern_blue', 'market_green', 'blacksmith_red', 'well_blue', 'windmill_yellow', 'fence_wood_straight', 'waterlily_A', 'waterlily_B', 'sack', 'resource_lumber'],
  cute: ['Alien_Tall', 'Cactus', 'Bee', 'Pig', 'Mushroom', 'Cyclops', 'Bat', 'Ghost', 'YellowDragon'],
  chars: ['Ranger', 'Barbarian', 'Mage', 'Knight', 'Rogue', 'Rogue_Hooded', 'Rig_Medium_General', 'Rig_Medium_MovementBasic'],
};
const G = {};
const CLIPS = {};
const TAU = Math.PI * 2;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

let renderer, glCanvas;
let LW = 288, LH = 360; // logical size of the 2D UI layer
const tmpV = new THREE.Vector3();

// ------------------------------------------------------------------ loading
async function load(onProgress) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  // phones on a patchy connection: a few files at a time, and retry each one before giving up
  const queue = []; let done = 0;
  for (const [dir, names] of Object.entries(FILES)) for (const n of names) queue.push(dir + '/' + n);
  const total = queue.length;
  async function fetchOne(key) {
    let err;
    for (let attempt = 0; attempt < 6; attempt++) {
      try { G[key] = await loader.loadAsync(`${A}${key}.glb${attempt ? '?r=' + attempt : ''}`); onProgress && onProgress(++done / total); return; }
      catch (e) { err = e; await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); }
    }
    throw new Error(`${key}: ${(err && (err.message || err.type)) || err}`);
  }
  async function worker() { while (queue.length) await fetchOne(queue.shift()); }
  await Promise.all([0, 1, 2, 3, 4, 5].map(worker));
  for (const k of ['chars/Rig_Medium_General', 'chars/Rig_Medium_MovementBasic']) for (const c of G[k].animations) CLIPS[c.name] = c;
  for (const g of Object.values(G)) g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.map) o.material.map.anisotropy = 4; } });
  setupWind();
}

// ------------------------------------------------------------------ templates & instancing
const tplCache = new Map();
// normalised copy of a model: centred on x/z, standing on y=0, scaled so its height (or width) = size
function tpl(key, size, mode = 'h') {
  const ck = key + '|' + size + '|' + mode;
  if (tplCache.has(ck)) return tplCache.get(ck);
  const src = G[key].scene, root = new THREE.Group(), inner = src.clone(true);
  root.add(inner); inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner), sz = box.getSize(new THREE.Vector3());
  const s = size / (mode === 'h' ? sz.y : mode === 'd' ? sz.z : Math.max(sz.x, sz.z));
  inner.scale.setScalar(s);
  inner.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  root.updateMatrixWorld(true);
  tplCache.set(ck, root);
  return root;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function instances(parent, key, size, mode, items, opt = {}) {
  if (!items.length) return;
  const t = tpl(key, size, mode); const parts = [];
  t.traverse((o) => { if (o.isMesh) parts.push(o); });
  for (const m of parts) {
    let mat = m.material;
    if (opt.tint != null) { mat = mat.clone(); mat.color.multiply(Array.isArray(opt.tint) ? new THREE.Color(...opt.tint) : new THREE.Color(opt.tint)); }
    if (opt.emissive) { mat = mat.clone(); mat.emissive = new THREE.Color(opt.emissive); mat.emissiveIntensity = opt.ei || 0.6; }
    const im = new THREE.InstancedMesh(m.geometry, mat, items.length);
    items.forEach((it, i) => {
      _e.set(0, it.r || 0, 0); _q.setFromEuler(_e); _s.setScalar(it.s || 1); if (it.sy) _s.y *= it.sy; _p.set(it.x, it.y || 0, it.z);
      _m.compose(_p, _q, _s).multiply(m.matrixWorld); im.setMatrixAt(i, _m);
    });
    im.castShadow = opt.cast !== false; im.receiveShadow = true;
    im.computeBoundingSphere();
    parent.add(im);
  }
}
function place(key, size, mode = 'h') { return tpl(key, size, mode).clone(true); }

// ------------------------------------------------------------------ procedural textures
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4; return t;
}
let TEX = null;
function makeTextures() {
  const rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  TEX = {
    ground: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { const v = 170 + rnd() * 85 | 0; g.fillStyle = `rgb(${v},${v},${v})`; const x = rnd() * w, y = rnd() * h; g.fillRect(x, y, 2 + rnd() * 3, 1 + rnd() * 2); }
      for (let i = 0; i < 260; i++) { const v = 120 + rnd() * 50 | 0; g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 1; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 4); g.stroke(); }
    }),
    water: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#3d8fc8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(220,245,255,${0.15 + rnd() * 0.3})`; g.lineWidth = 1.5 + rnd() * 1.5; const x = rnd() * w, y = rnd() * h, l = 10 + rnd() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke(); }
    }),
    wood: canvasTex(128, 128, (g, w, h) => {
      for (let y = 0; y < h; y += 16) { const v = 150 + rnd() * 30 | 0; g.fillStyle = `rgb(${v + 25},${v - 15},${v - 60})`; g.fillRect(0, y, w, 16); g.fillStyle = 'rgba(60,30,10,0.5)'; g.fillRect(0, y + 15, w, 1); const o = rnd() * w; g.fillRect(o, y, 1, 16); }
      for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(80,40,10,0.12)'; g.fillRect(rnd() * w, rnd() * h, 10 + rnd() * 20, 1); }
    }),
    rug: canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#9a3a3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c070'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
      g.fillStyle = '#e8c070'; for (let i = 0; i < 4; i++) { g.save(); g.translate(w / 2, h / 2); g.rotate(i * Math.PI / 2); g.fillRect(-3, -14, 6, 6); g.restore(); }
    }, false),
    rock: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#b8b0a4'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h;) { const bh = 10 + rnd() * 26, v = 150 + rnd() * 70 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(0, y, w, bh); g.fillStyle = 'rgba(40,30,25,0.45)'; g.fillRect(0, y + bh - 2, w, 2); y += bh; }
      for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(40,30,25,${0.25 + rnd() * 0.3})`; g.lineWidth = 1 + rnd(); const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 10, y + 8 + rnd() * 18); g.stroke(); }
      for (let i = 0; i < 500; i++) { const v = rnd() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},0.12)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 3); }
    }),
    blossoms: canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const x = 8 + rnd() * (w - 16), y = 8 + rnd() * (h - 16), r = 2.2 + rnd() * 1.8, yellow = rnd() < 0.18;
        g.fillStyle = yellow ? '#ffe070' : '#fbfaf0';
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rnd(); g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = yellow ? '#e89a30' : '#f2c84a'; g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2); g.fill();
      }
    }, false),
    falls: canvasTex(64, 128, (g, w, h) => {
      g.fillStyle = '#8fd0f0'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.5})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 10 + rnd() * 30); }
    }),
  };
  TEX.water.repeat.set(1, 1);
}

// ------------------------------------------------------------------ lights / scenes
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 0.8, 0.1, 120);
const hemi = new THREE.HemisphereLight(0xd8ecff, 0x5a6a3a, 1.25);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
const playerLight = new THREE.PointLight(0xffc888, 0, 9, 1.6);
const glowLights = [0, 1, 2, 3].map(() => new THREE.PointLight(0x7af0ff, 0, 7, 1.8));
scene.add(hemi, sun, sun.target, playerLight, ...glowLights);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
let world = null;      // current map group
let dynGroup = null;   // objects that change with tiles (boulders, chests, lilies...)
let mapInfo = null;    // { id, def, w, h, chars, glows }
const actors = new Map(); // id -> { obj, mixer, actions, cur, rot }
let water = null, falls = [];

function init(canvas, quality) {
  glCanvas = canvas; FX.quality = quality === 'low' ? 'low' : 'high';
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { throw new Error('3D graphics (WebGL) are not available in this browser.'); }
  renderer.setPixelRatio(FX.quality === 'low' ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
  if (FX.quality === 'high') { try { FX.post = new Post(renderer); } catch (e) { FX.post = null; } }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  makeTextures();
}
function resize(cssW, cssH, lw, lh) {
  LW = lw; LH = lh;
  if (!renderer) return;
  pxW = cssW; pxH = cssH;
  renderer.setSize(cssW, cssH, false);
  if (FX.post) { const v = renderer.getDrawingBufferSize(new THREE.Vector2()); FX.post.setSize(v.x, v.y); }
  glCanvas.style.width = cssW + 'px'; glCanvas.style.height = cssH + 'px';
  camera.aspect = lw / lh; camera.updateProjectionMatrix();
  battleCam.aspect = lw / lh; battleCam.updateProjectionMatrix();
}

function dispose(group) {
  if (!group) return;
  group.traverse((o) => { if (o.userData.own) { o.geometry && o.geometry.dispose(); } });
  group.removeFromParent();
}

// ------------------------------------------------------------------ map building
const WATERISH = new Set(['~', '%', 'o', '|']);
const WALLS = { M: 1.7, '#': 1.15, Q: 2.4 };
function groundColor(c, x, y, def) {
  const v = hash(x, y);
  if (def.ground === 'W') return c === 'g' ? 0xb07a4a : 0xb38050;
  if (def.ground === '_') return v < 0.5 ? 0x6a5c50 : 0x5f5348;
  switch (c) {
    case '=': case 'D': return v < 0.5 ? 0xd9b98a : 0xcfae7d;
    case 'H': return 0xb39a72;
    case '"': return 0x5b9a3c;
    case 'T': return 0x3f7a34;
    case '~': case '%': case 'o': case '|': return 0x7f8a4f;
    case 'M': case 'v': return 0x557f3a;
  }
  return v < 0.33 ? 0x72b24c : v < 0.66 ? 0x68a845 : 0x7cba52;
}
function buildGround(m, def) {
  const W = m.w, H = m.h, cols = new Float32Array((W + 1) * (H + 1) * 3), pos = new Float32Array((W + 1) * (H + 1) * 3), uv = new Float32Array((W + 1) * (H + 1) * 2);
  const c = new THREE.Color(), acc = new THREE.Color();
  const tile = (x, y) => m.t[Math.min(H - 1, Math.max(0, y))][Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
    acc.setRGB(0, 0, 0); let wet = 0;
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const t = tile(x + dx, y + dy); acc.add(c.setHex(groundColor(t, x + dx, y + dy, def))); if (WATERISH.has(t)) wet++; }
    acc.multiplyScalar(0.25);
    const i = y * (W + 1) + x, n = (def.ground === '.' ? (vnoise(x * 0.3, y * 0.3) - 0.5) * 0.32 + (vnoise(x * 0.9 + 20, y * 0.9) - 0.5) * 0.12 : 0) + hash(x * 3 + 1, y * 5 + 2) * 0.08 - 0.04;
    cols[i * 3] = acc.r * (1 + n); cols[i * 3 + 1] = acc.g * (1 + n); cols[i * 3 + 2] = acc.b * (1 + n);
    pos[i * 3] = x; pos[i * 3 + 1] = wet === 4 ? -0.5 : wet >= 2 ? -0.18 : 0; pos[i * 3 + 2] = y;
    uv[i * 2] = x / 3; uv[i * 2 + 1] = y / 3;
  }
  const idx = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = y * (W + 1) + x, b = a + 1, d = a + W + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: def.ground === 'W' ? TEX.wood : TEX.ground, roughness: 0.95, metalness: 0 });
  if (def.ground === 'W') { TEX.wood.repeat.set(1, 1); }
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.userData.own = true;
  return mesh;
}
const CLIFF_H = 2.6;
function buildWalls(m, def) {
  const T = { P: [], C: [] }, S = { P: [], C: [] }, V = { P: [], C: [] }, col = new THREE.Color();
  const wallAt = (c) => c in WALLS || c === 'v';
  const isWall = (x, y) => { if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true; return wallAt(m.t[y][x]); };
  const jit = (x, y, amp) => (hash(x * 7 + 3, y * 11 + 5) - 0.5) * amp;
  const quad = (o, a, b, c2, d, ca, cb) => { o.P.push(...a, ...b, ...c2, ...a, ...c2, ...d); o.C.push(...ca, ...ca, ...cb, ...ca, ...cb, ...cb); };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    let c = m.t[y][x]; if (!wallAt(c)) continue;
    if (c === 'v') c = 'M';
    const interior = c === 'Q', cave = c === '#';
    let Hh = c === 'M' ? CLIFF_H : WALLS[c]; if (interior && y === m.h - 1) Hh = 0.35;
    const amp = interior ? 0 : 0.35, xa = interior ? 0 : 0.12;
    const corner = (cx, cy) => [cx + jit(cx + 50, cy, xa), Hh + jit(cx, cy, amp), cy + jit(cx, cy + 50, xa)];
    const tl = corner(x, y), tr = corner(x + 1, y), bl = corner(x, y + 1), br = corner(x + 1, y + 1);
    const topC = cave ? [0.09, 0.07, 0.12] : interior ? [0.36, 0.24, 0.16] : (col.setHex(hash(x, y) < 0.5 ? 0x5e9a40 : 0x6aa646), [col.r, col.g, col.b]);
    quad(cave ? V : interior ? S : T, tl, bl, br, tr, topC, topC); // counter-clockwise from above, so the top faces up
    const sideTop = cave ? [0.55, 0.48, 0.6] : interior ? [0.93, 0.88, 0.76] : [0.95, 0.86, 0.72];
    const sideBot = cave ? [0.26, 0.22, 0.3] : interior ? [0.55, 0.38, 0.24] : [0.55, 0.46, 0.38];
    const down = (p) => [p[0], -0.6, p[2]];
    const o = interior || cave ? S : S;
    if (!isWall(x, y + 1)) quad(o, br, bl, down(bl), down(br), sideTop, sideBot);
    if (!isWall(x, y - 1)) quad(o, tl, tr, down(tr), down(tl), sideTop, sideBot);
    if (!isWall(x - 1, y)) quad(o, bl, tl, down(tl), down(bl), sideTop, sideBot);
    if (!isWall(x + 1, y)) quad(o, tr, br, down(br), down(tr), sideTop, sideBot);
  }
  const grp = new THREE.Group();
  const mk = (o, map, sideUV) => {
    if (!o.P.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(o.C, 3));
    g.computeVertexNormals();
    const uv = [], P = o.P;
    for (let i = 0; i < P.length; i += 3) {
      if (sideUV) { const tri = Math.floor(i / 9) * 9, nx = Math.abs(P[tri + 3] - P[tri]) + Math.abs(P[tri + 6] - P[tri]), nz = Math.abs(P[tri + 5] - P[tri + 2]) + Math.abs(P[tri + 8] - P[tri + 2]); uv.push((nx >= nz ? P[i] : P[i + 2]) / 2.5, P[i + 1] / 2.5); }
      else uv.push((P[i] + P[i + 1] * 0.7) / 3, (P[i + 2] + P[i + 1] * 0.7) / 3);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, map }));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.own = true; grp.add(mesh);
  };
  const outdoor = !!def.outdoor;
  mk(T, TEX.ground, false);
  if (V.P.length) { // cave ceilings: unlit darkness, the classic cut-away look
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V.P, 3));
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x0b0910 })); mesh.userData.own = true; grp.add(mesh);
  }
  mk(S, outdoor ? TEX.rock : TEX.ground, outdoor);
  return grp.children.length ? grp : null;
}
function caveMouth() {
  // an arched opening in the cliff face, framed by boulders
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(-0.55, 0); sh.lineTo(-0.55, 1.0); sh.absarc(0, 1.0, 0.55, Math.PI, 0, true); sh.lineTo(0.55, 0); sh.lineTo(-0.55, 0);
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), new THREE.MeshBasicMaterial({ color: 0x05030a })); hole.position.z = 0.03; hole.userData.own = true; g.add(hole);
  const rim = new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), new THREE.MeshStandardMaterial({ color: 0x2a2228, roughness: 1 })); rim.scale.set(1.22, 1.12, 1); rim.position.z = 0.02; rim.userData.own = true; g.add(rim);
  return g;
}
function sign() {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.9 }), board = new THREE.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood); post.position.y = 0.45;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 0.06), board); b.position.set(0, 0.78, 0.06);
  for (const o of [post, b]) { o.castShadow = true; o.userData.own = true; g.add(o); }
  return g;
}
function lampPost() {
  const g = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: 0x2e2a30, roughness: 0.6, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 1.3 });
  const parts = [[new THREE.CylinderGeometry(0.05, 0.07, 1.5, 8), iron, 0.75], [new THREE.CylinderGeometry(0.16, 0.18, 0.08, 8), iron, 0.04],
    [new THREE.BoxGeometry(0.24, 0.26, 0.24), glass, 1.62], [new THREE.ConeGeometry(0.2, 0.16, 4), iron, 1.83], [new THREE.BoxGeometry(0.28, 0.04, 0.28), iron, 1.48]];
  for (const [geo, mat, y] of parts) { const m = new THREE.Mesh(geo, mat); m.position.y = y; if (geo.type === 'ConeGeometry') m.rotation.y = Math.PI / 4; m.castShadow = true; m.userData.own = true; g.add(m); }
  return g;
}
function crystal() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x6af0ff, emissive: 0x2ab8d8, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.1, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + i * 0.03, 0), mat); m.scale.set(0.7, 2.2 - i * 0.3, 0.7);
    m.position.set(Math.cos(i * 2.1) * 0.15 * (i > 0), 0.25 + 0.05 * i, Math.sin(i * 2.1) * 0.15 * (i > 0)); m.rotation.z = (i - 1.5) * 0.25; m.userData.own = true; g.add(m);
  }
  return g;
}
function bridge() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.9 });
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.08, 1.15), mat); p.position.set(-0.4 + i * 0.2, 0.04, 0); p.castShadow = p.receiveShadow = true; p.userData.own = true; g.add(p); }
  return g;
}
// where each model's front door is, measured from its centre (in model widths of DOOR_W tiles)
const DOOR_DX = { cottage: -0.02, inn: -0.46, shop: 0.37, forge: -1.4, mill: 0 };
const DOOR_W = { cottage: 5, inn: 5, shop: 3, forge: 5, mill: 4 };
function building(kind, fw, fh) {
  const map = { cottage: 'home_A_red', inn: 'tavern_blue', shop: 'home_B_yellow', market: 'market_green', forge: 'blacksmith_red', mill: 'windmill_yellow' };
  const o = place('bld/' + map[kind], fw * 0.98, 'w');
  const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3());
  if (sz.z > fh * 1.05) { const s = (fh * 1.02) / sz.z; o.scale.multiplyScalar(s); }
  return o;
}

function buildMap(m, st) {
  dispose(world); dispose(dynGroup);
  for (const a of actors.values()) a.obj.removeFromParent();
  actors.clear();
  const def = m.def;
  world = new THREE.Group(); scene.add(world);
  world.add(buildGround(m, def));
  const walls = buildWalls(m, def); if (walls) world.add(walls);
  const outdoor = def.ground === '.', cave = def.ground === '_', interior = def.ground === 'W';
  // water plane
  water = null; falls = [];
  let wet = false; for (const r of m.t) for (const c of r) if (WATERISH.has(c)) wet = true;
  if (wet) {
    water = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.h), waterMaterial(m, cave)); water.rotation.x = -Math.PI / 2; water.position.set(m.w / 2, -0.12, m.h / 2);
    water.userData.own = true; water.receiveShadow = true; world.add(water);
  }
  const blossoms = [];
  const L = {}; const add = (k, it) => { const ck = k + '|' + Math.floor(it.x / 8) + ',' + Math.floor(it.z / 8); (L[ck] = L[ck] || []).push(it); };
  const glows = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.t[y][x], cx = x + 0.5, cz = y + 0.5, h = hash(x, y), h2 = hash(y + 17, x + 3), r = h2 * TAU;
    if (c === 'T' && y >= m.h - 2) {
      // the bottom edge sits between the camera and the player: low hedges instead of tall trees
      if (y === m.h - 2 || (x + y) % 2) add('nature/Bush_Common_Flowers', { x: cx + (h2 - 0.5) * 0.3, z: cz, r, s: 1.1 + h * 0.4 });
    } else if (c === 'T') {
      const deep = [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => { const t = m.t[y + dy] && m.t[y + dy][x + dx]; return !t || t === 'T'; });
      if (deep && (x + 2 * y) % 3) continue;
      const k = h < 0.5 ? ['nature/CommonTree_3', 'nature/CommonTree_2', 'nature/CommonTree_4'][((h * 100) | 0) % 3] : 'nature/Pine_' + (1 + ((h * 100) | 0) % 3);
      add(k, { x: cx + (h2 - 0.5) * 0.4, z: cz + (h - 0.5) * 0.4, r, s: (deep ? 1.6 : 1) * (0.85 + h2 * 0.3) });
    } else if (c === 't') add('nature/Bush_Common_Flowers', { x: cx, z: cz, r, s: 1.0 + h * 0.3 });
    else if (c === 'b') { add('nature/Flower_3_Group', { x: cx - 0.2, z: cz, r, s: 1.1 }); add('nature/Flower_4_Group', { x: cx + 0.2, z: cz + 0.15, r, s: 1.1 }); add('nature/Grass_Common_Short', { x: cx, z: cz - 0.2, r, s: 1 }); }
    else if (c === ',') { add('nature/Flower_3_Group', { x: cx - 0.2, z: cz - 0.1, r, s: 1 }); if (h < 0.4) add('nature/Flower_4_Group', { x: cx + 0.22, z: cz + 0.2, r: r + 2, s: 0.8 }); }
    else if (c === '"') for (let i = 0; i < 4; i++) { const a = hash(x * 5 + i, y * 3 - i); add(i === 0 ? 'nature/Grass_Wispy_Tall' : 'nature/Grass_Common_Tall', { x: cx + (a - 0.5) * 0.85, z: cz + (hash(i, x + y) - 0.5) * 0.85, r: a * TAU, s: 0.8 + a * 0.5 }); }
    else if (c === 'r') add('nature/Rock_Medium_2', { x: cx, z: cz, r, s: 0.9 + h * 0.3 });
    else if (c === 'F') add('bld/fence_wood_straight', { x: cx, z: cz, r: (m.t[y][x - 1] === 'F' || m.t[y][x + 1] === 'F') ? Math.PI / 2 : 0, s: 1 });
    else if (c === 'u') add(interior ? 'props/Barrel' : 'props/Barrel_Apples', { x: cx, z: cz, r, s: 1 });
    else if (c === 'x') add('props/Crate_Wooden', { x: cx, z: cz, r: r * 0.1, s: 1 });
    else if (c === 'q') { add('props/Pot_1', { x: cx, z: cz, r, s: 1 }); add('nature/Fern_1', { x: cx, y: 0.32, z: cz, r, s: 0.6 }); }
    else if (c === 'Y') add('props/Bookcase_2', { x: cx, z: cz - 0.25, r: 0, s: 1 });
    else if (c === 'k') { add('props/Table_Large', { x: cx, z: cz, r: 0, s: 1 }); add('props/Stool', { x: cx - 0.6, z: cz + 0.5, r: 0, s: 1 }); }
    else if (c === 'e') add('props/Bed_Twin1', { x: cx, z: cz, r: 0, s: 1 });
    else if (c === 'K') add('props/Workbench', { x: cx, z: cz, r: 0, s: 1 });
    else if (c === 'm') { add('nature/Mushroom_Laetiporus', { x: cx, z: cz, r, s: 1 }); add('nature/Mushroom_Common', { x: cx + 0.25, z: cz + 0.2, r, s: 0.8 }); glows.push({ x: cx, z: cz, col: 0xd87aff, i: 2.5 }); }
    else if (c === 'l') { const o = lampPost(); o.position.set(cx, 0, cz); world.add(o); if (!outdoor) glows.push({ x: cx, z: cz, col: 0xffc070, i: 3 }); }
    else if (c === 'w') { const o = place('bld/well_blue', 1.6, 'w'); o.position.set(cx, 0, cz); world.add(o); }
    else if (c === 'S') { const o = sign(); o.position.set(cx, 0, cz); o.rotation.y = (h - 0.5) * 0.4; world.add(o); }
    else if (c === 'z') { const o = crystal(); o.position.set(cx, 0, cz); o.scale.setScalar(1.3); world.add(o); glows.push({ x: cx, z: cz, col: 0x6af0ff, i: 4 }); }
    else if (c === '|') { const o = bridge(); o.position.set(cx, -0.04, cz); o.rotation.y = Math.PI / 2; world.add(o); }
    else if (c === 'g') { const rug = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: TEX.rug, roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(cx, 0.01, cz); rug.receiveShadow = true; rug.userData.own = true; world.add(rug); }
    else if (c === 'X') {
      const mat = new THREE.MeshBasicMaterial({ color: interior ? 0x6a3a2a : 0x05030a });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(interior ? 0.8 : 1.1, interior ? 0.5 : 1.2), mat); p.rotation.x = -Math.PI / 2; p.position.set(cx, 0.02, cz); p.userData.own = true; world.add(p);
    } else if (c === 'v') {
      const o = caveMouth(); o.position.set(cx, 0, y + 1); world.add(o);
      add('nature/Rock_Medium_1', { x: cx - 0.75, z: y + 1.15, r: 0.4, s: 1.6 }); add('nature/Rock_Medium_3', { x: cx + 0.78, z: y + 1.1, r: 2.1, s: 1.5 });
      add('nature/Rock_Medium_2', { x: cx + 0.1, y: 1.75, z: y + 0.95, r: 1.2, s: 1.3 });
      for (const sx of [-1, 1]) { const t = lampPost(); t.position.set(cx + sx * 1.15, 0, y + 1.35); t.scale.setScalar(0.8); world.add(t); }
    } else if (c === '~' && outdoor && y > 0 && (m.t[y - 1][x] === 'M' || y === 0)) {
      // waterfall where the river leaves the cliffs
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.02, CLIFF_H + 0.7), new THREE.MeshStandardMaterial({ map: TEX.falls.clone(), transparent: true, opacity: 0.9, emissive: 0x335566, roughness: 0.2 }));
      f.material.map.needsUpdate = true; f.position.set(cx, (CLIFF_H - 0.7) / 2, y + 0.05); f.userData.own = true; world.add(f); falls.push(f);
      // churning white foam where the falls hit the river
      const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe8ff, emissiveIntensity: 0.35, roughness: 0.6, transparent: true, opacity: 0.92 });
      for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + hash(x + k, y) * 0.14, 0), foamMat); b.position.set(cx + (k / 6 - 0.5) * 0.95, -0.02, y + 0.15 + hash(k, x) * 0.35); b.userData.own = true; b.userData.ph = k; world.add(b); falls.push(b); }
    }
    if (outdoor && (c === '.' || c === ',' || c === 'b') && h2 > 0.35) blossoms.push({ x: cx + (h - 0.5) * 0.4, z: cz + (h2 - 0.5) * 0.4, r: h * TAU, s: 0.8 + h2 * 0.5 });
    // grass detail on open ground
    if (outdoor && (c === '.' || c === ',')) {
      if (h < 0.45) add('nature/Grass_Common_Short', { x: cx + (h2 - 0.5) * 0.8, z: cz + (h - 0.5) * 0.8, r, s: 0.7 + h2 * 0.6 });
      else if (h < 0.53) add('nature/Clover_1', { x: cx, z: cz, r, s: 1 });
      else if (h < 0.56) add('nature/Pebble_Round_' + (h2 < 0.5 ? 1 : 3), { x: cx + 0.2, z: cz - 0.2, r, s: 1 });
      else if (h < 0.58) add('nature/Mushroom_Common', { x: cx, z: cz, r, s: 1 });
      else if (h < 0.62) add('nature/Fern_1', { x: cx, z: cz, r, s: 1 });
    }
    if (cave && c === '#') {
      const edge = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => { const t = m.t[y + dy] && m.t[y + dy][x + dx]; return t && t !== '#'; });
      if (edge) add('nature/Rock_Medium_' + (1 + ((h * 30) | 0) % 3), { x: cx + edge[0] * 0.3, y: -0.2, z: cz + edge[1] * 0.3, r, s: 1.5 + h2 * 0.7 });
      else if (h < 0.6) add('nature/Rock_Medium_' + (1 + ((h * 30) | 0) % 3), { x: cx + (h2 - 0.5) * 0.5, y: 0.75, z: cz, r, s: 1.1 + h2 * 0.8 });
    }
    if (cave && c === '_' && h < 0.14) add('nature/Pebble_Round_' + (h2 < 0.5 ? 1 : 3), { x: cx, z: cz, r, s: 1 });
    if (outdoor && c === 'M') {
      const front = m.t[y + 1] && m.t[y + 1][x] !== 'M' && m.t[y + 1][x] !== 'v';
      if (front) {
        // stacked stone blocks along the cliff face, like a natural rock wall
        add('nature/Rock_Medium_' + (1 + ((h * 30) | 0) % 3), { x: cx + (h2 - 0.5) * 0.3, y: -0.15, z: cz + 0.55, r, s: 1.5 + h2 * 0.5 });
        if (h > 0.25) add('nature/Rock_Medium_' + (1 + ((h2 * 30) | 0) % 3), { x: cx + (h - 0.5) * 0.4, y: 1.0, z: cz + 0.42, r: r + 1.3, s: 1.2 + h * 0.5 });
      }
      for (const [dx, sx] of [[-1, -0.5], [1, 0.5]]) { const t = m.t[y] && m.t[y][x + dx]; if (t && !(t in WALLS) && t !== 'v' && h2 < 0.7) add('nature/Rock_Medium_' + (1 + ((h * 30) | 0) % 3), { x: cx + sx * 1.05, y: -0.1, z: cz, r, s: 1.3 + h * 0.5 }); }
      if (!front && h < 0.55) add('nature/Pine_' + (1 + ((h * 30) | 0) % 3), { x: cx + (h2 - 0.5) * 0.5, y: CLIFF_H, z: cz, r, s: 1 + h2 * 0.5 });
      else if (h > 0.8) add('nature/Bush_Common_Flowers', { x: cx, y: CLIFF_H, z: cz, r, s: 0.9 });
    }
  }
  const SIZES = { CommonTree: [3.1, 'h'], Pine: [3.0, 'h'], Bush_Common: [1.0, 'w'], Bush_Common_Flowers: [0.95, 'w'], Flower_3_Group: [0.5, 'h'], Flower_4_Group: [0.5, 'h'],
    Grass_Wispy_Tall: [0.75, 'h'], Grass_Common_Tall: [0.7, 'h'], Grass_Common_Short: [0.28, 'h'], Clover_1: [0.35, 'w'], Pebble_Round: [0.25, 'w'], Mushroom_Common: [0.28, 'h'], Mushroom_Laetiporus: [0.45, 'h'],
    Fern_1: [0.6, 'w'], Rock_Medium: [0.75, 'w'], fence_wood_straight: [1.0, 'd'], Barrel: [0.75, 'h'], Barrel_Apples: [0.75, 'h'], Crate_Wooden: [0.6, 'h'], Plant_7: [0.8, 'h'], Pot_1: [0.4, 'h'],
    Bookcase_2: [1.9, 'h'], Table_Large: [1.1, 'w'], Stool: [0.45, 'h'], Bed_Twin1: [1.0, 'w'], Workbench: [1.0, 'w'] };
  const sizeOf = (k) => { const n = k.split('/')[1]; for (const [p, v] of Object.entries(SIZES)) if (n === p || n.startsWith(p + '_') || n.startsWith(p)) return v; return [1, 'h']; };
  if (blossoms.length) {
    const geo = new THREE.PlaneGeometry(1.1, 1.1); geo.rotateX(-Math.PI / 2);
    const bm = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: TEX.blossoms, transparent: true, alphaTest: 0.4, roughness: 1, depthWrite: false }), blossoms.length);
    blossoms.forEach((b, i) => { _e.set(0, b.r, 0); _q.setFromEuler(_e); _s.setScalar(b.s); _p.set(b.x, 0.03, b.z); _m.compose(_p, _q, _s); bm.setMatrixAt(i, _m); });
    bm.receiveShadow = true; bm.userData.own = true; world.add(bm);
  }
  for (const [ck, items] of Object.entries(L)) { const k = ck.split('|')[0]; const [sz, mode] = sizeOf(k); const caveRock = cave && k.includes('Rock_Medium'), sunRock = outdoor && k.includes('Rock_Medium'); instances(world, k, sz, mode, items, { tint: caveRock ? 0x8a7aa8 : sunRock ? [2.2, 2.25, 2.4] : null, cast: !k.includes('Grass') && !k.includes('Clover') && !k.includes('Pebble') && !k.includes('Flower') }); }
  // buildings: collision follows the real model, not the rectangle reserved for it on the map
  const open = new Set(), rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), org = new THREE.Vector3();
  const closed = new Set();
  for (const hs of def.houses || []) {
    const o = building(hs.kind, hs.w, hs.h);
    // slide the model sideways so its front door sits exactly on the door tile
    const cx = hs.door != null ? hs.door + 0.5 - (DOOR_DX[hs.kind] || 0) * hs.w / DOOR_W[hs.kind] : hs.x + hs.w / 2;
    o.position.set(cx, 0, hs.y + hs.h / 2 + 0.1); world.add(o);
    o.updateMatrixWorld(true);
    for (let y = hs.y - 1; y <= hs.y + hs.h; y++) for (let x = hs.x - 1; x <= hs.x + hs.w; x++) {
      if (y < 0 || x < 0 || y >= m.h || x >= m.w) continue;
      const inside = x >= hs.x && x < hs.x + hs.w && y >= hs.y && y < hs.y + hs.h, t = m.t[y][x];
      if (t === 'D' || (hs.door === x && y === hs.y + hs.h - 1)) continue;
      let hit = 0;
      for (const sx of [0.2, 0.5, 0.8]) for (const sz of [0.2, 0.5, 0.8]) {
        org.set(x + sx, 12, y + sz); rc.set(org, down);
        const h = rc.intersectObject(o, true)[0];
        if (h && h.point.y > 0.3) hit++;
      }
      if (inside && hit < 3) open.add(x + ',' + y); // mostly empty ground: walkable
      if (!inside && hit >= 4) closed.add(x + ',' + y); // the model overhangs this tile: solid
    }
  }
  W3D.openTiles = open; W3D.closedTiles = closed;
  // atmosphere
  if (outdoor) { scene.background = new THREE.Color(0xa8d8f0); scene.fog = new THREE.Fog(0xa8d8f0, 20, 42); hemi.intensity = 1.25; sun.intensity = 2.4; hemi.color.set(0xd8ecff); hemi.groundColor.set(0x5a6a3a); }
  else if (interior) { scene.background = new THREE.Color(0x1a1410); scene.fog = null; hemi.intensity = 1.1; sun.intensity = 1.4; hemi.color.set(0xfff0d8); hemi.groundColor.set(0x6a4a30); }
  else { scene.background = new THREE.Color(0x07050c); scene.fog = new THREE.Fog(0x07050c, 14, 30); }
  mapInfo = { id: m.id, def, w: m.w, h: m.h, glows, outdoor, cave, interior };
  setCaveLight(st);
  rebuildDynamic(m, st);
}
function setCaveLight(st) {
  if (!mapInfo || !mapInfo.cave) { playerLight.intensity = 0; glowLights.forEach((l) => (l.intensity = 0)); return; }
  const lit = st && st.flags && st.flags.springSings;
  hemi.color.set(lit ? 0xa8c0ff : 0x8a7ac8); hemi.groundColor.set(0x2a2030); hemi.intensity = lit ? 1.1 : 0.8; sun.intensity = lit ? 0.9 : 0.45;
  playerLight.intensity = lit ? 6 : 22; playerLight.distance = 11;
}
const lastTiles = new Map();
function rebuildDynamic(m, st) {
  dispose(dynGroup); dynGroup = new THREE.Group(); scene.add(dynGroup);
  const prev = lastTiles.get(m.id); const now = m.t.map((r) => r.join(''));
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.t[y][x], cx = x + 0.5, cz = y + 0.5, h = hash(x, y);
    if (c === 'O') { const o = place('nature/Rock_Medium_1', 0.95, 'w'); o.position.set(cx, 0, cz); o.rotation.y = h * TAU; dynGroup.add(o); }
    else if (c === 'B') { const o = place('nature/Bush_Common', 1.1, 'w'); o.position.set(cx, 0, cz); o.rotation.y = h * TAU; dynGroup.add(o); }
    else if (c === 'C' || c === 'c') {
      const o = place('props/Chest_Wood', 0.8, 'w'); o.position.set(cx, 0, cz); dynGroup.add(o);
      const g = G['props/Chest_Wood'], mixer = new THREE.AnimationMixer(o);
      const opening = c === 'c' && prev && prev[y][x] === 'C';
      const clip = g.animations.find((a) => a.name === (c === 'C' ? 'Chest_Closed' : opening ? 'Chest_Open' : 'Chest_Opened'));
      if (clip) { const a = mixer.clipAction(clip); a.clampWhenFinished = true; a.setLoop(THREE.LoopOnce); a.play(); }
      o.userData.mixer = mixer;
    } else if (c === 'J') {
      const o = place('props/Chest_Wood', 0.85, 'w'); o.position.set(cx, 0, cz);
      o.traverse((q) => { if (q.isMesh) { q.material = q.material.clone(); q.material.color.multiply(new THREE.Color(0x8a9ab8)); } });
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.06), new THREE.MeshStandardMaterial({ color: 0xffc840, metalness: 0.8, roughness: 0.3, emissive: 0x402800 }));
      lock.position.set(0, 0.36, 0.33); lock.userData.own = true; o.add(lock);
      for (const sx of [-0.3, 0.3]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.66), new THREE.MeshStandardMaterial({ color: 0x3a3a48, metalness: 0.7, roughness: 0.4 })); band.position.set(sx, 0.3, 0); band.userData.own = true; o.add(band); }
      const g = G['props/Chest_Wood'], mixer = new THREE.AnimationMixer(o); const clip = g.animations.find((a) => a.name === 'Chest_Closed');
      if (clip) { const a = mixer.clipAction(clip); a.clampWhenFinished = true; a.setLoop(THREE.LoopOnce); a.play(); } o.userData.mixer = mixer;
      dynGroup.add(o);
    } else if (c === 'P') { const p = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), new THREE.MeshBasicMaterial({ color: 0x020104 })); p.rotation.x = -Math.PI / 2; p.position.set(cx, 0.015, cz); p.userData.own = true; dynGroup.add(p); }
    else if (c === 'p') { const o = place('nature/RockPath_Round_Wide', 0.95, 'w'); o.position.set(cx, 0.01, cz); dynGroup.add(o); }
    else if (c === '%') { const o = place('bld/waterlily_' + (h < 0.5 ? 'A' : 'B'), 0.95, 'w'); o.position.set(cx, -0.1, cz); o.rotation.y = h * TAU; dynGroup.add(o); }
    else if (c === 'o') { const o = place('nature/RockPath_Round_Small_1', 0.8, 'w'); o.position.set(cx, -0.08, cz); dynGroup.add(o); }
    else if (c === 'L') {
      const lit = st.flags.springSings, ring = new THREE.Group();
      for (let i = 0; i < 12; i++) { const s = place('nature/Pebble_Round_' + (i % 2 ? 1 : 3), 0.38, 'w'); s.position.set(Math.cos(i / 12 * TAU) * 0.9, 0, Math.sin(i / 12 * TAU) * 0.9); ring.add(s); }
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshStandardMaterial({ color: lit ? 0x5af0e0 : 0x3a4a5a, emissive: lit ? 0x2ad8c0 : 0x0a1018, emissiveIntensity: lit ? 1.4 : 0.3, roughness: 0.1 }));
      pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05; pool.userData.own = true; ring.add(pool);
      ring.position.set(cx, 0, cz + 0.4); dynGroup.add(ring);
      mapInfo.glows = mapInfo.glows.filter((g) => !g.spring); mapInfo.glows.push({ x: cx, z: cz, col: lit ? 0x6affe0 : 0x6a7aa0, i: lit ? 12 : 2, spring: true });
    }
  }
  for (const w of m.def.trinkets || []) if (!(w.id in st.trinkets)) {
    const o = place('props/Potion_1', 0.45); o.traverse((q) => { if (q.isMesh) { q.material = q.material.clone(); q.material.emissive = new THREE.Color(0xffc040); q.material.emissiveIntensity = 0.6; } });
    o.position.set(w.x + 0.5, 0.25, w.y + 0.5); o.userData.spin = true; dynGroup.add(o);
    mapInfo.glows.push({ x: w.x + 0.5, z: w.y + 0.5, col: 0xffd070, i: 2.5, trinket: w.id });
  }
  lastTiles.set(m.id, now);
}

// ------------------------------------------------------------------ actors
const CAST = {
  wren: ['Ranger'], bram: ['Barbarian'], tamsin: ['Mage'], gran: ['Mage', 0xe0d0ff, 0.95], pell: ['Knight', 0xf0e0c0], rosa: ['Rogue', 0xffd0e0],
  pip: ['Ranger', 0xfff0c0, 0.72], ivy: ['Rogue_Hooded', 0xd0c8ff], marta: ['Barbarian', 0xffe0c8, 0.95], hollis: ['Barbarian', 0xc8b8a8, 1.08], dorrit: ['Knight', 0xd8c8a8], odo: ['Rogue_Hooded', 0xc8d8ff],
};
// heroes look like their class (Warden = Knight, Druid = hooded...), tinted per character
function castOf(who) {
  if (typeof HEROES !== 'undefined' && HEROES[who]) who = HEROES[who].look.sheet;
  if (who.includes(':')) {
    const [cls, id, outfit] = who.split(':'), o = outfit != null && OUTFITS[+outfit];
    return [CLASSES[cls].model, CHARS[id] && CHARS[id].tint, 1, o && o.tint];
  }
  return CAST[who] || ['Rogue'];
}
const sheetOf = (who) => (typeof HEROES !== 'undefined' && HEROES[who] ? HEROES[who].look.sheet : who);
const CLOTHES = /Body|Cape|Leg|Hat|Helmet|Mask|Quiver/;
function makeActor(model, tint, scale = 1, outfit = null) {
  const src = G['chars/' + model].scene, obj = skClone(src);
  const wrap = new THREE.Group(); wrap.add(obj);
  obj.scale.setScalar(0.6 * scale);
  if (tint || outfit) obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    if (tint) o.material.color.multiply(new THREE.Color(tint));
    if (outfit && CLOTHES.test(o.name)) o.material.color.multiply(new THREE.Color(outfit)); // outfit colours: clothes only, never skin
  });
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(obj), actions = {};
  for (const n of ['Idle_A', 'Walking_A', 'Running_A', 'Hit_A', 'Death_A', 'Throw', 'Use_Item', 'Interact', 'Spawn_Ground']) if (CLIPS[n]) actions[n] = mixer.clipAction(CLIPS[n]);
  for (const n of ['Hit_A', 'Death_A', 'Throw', 'Use_Item', 'Interact']) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce); actions[n].clampWhenFinished = true; }
  actions.Idle_A.play();
  return { obj: wrap, inner: obj, mixer, actions, cur: 'Idle_A', rot: 0 };
}
function playAct(a, name, fade = 0.18) {
  if (!a || a.cur === name || !a.actions[name]) return;
  const next = a.actions[name], prev = a.actions[a.cur];
  next.reset().play(); if (prev) next.crossFadeFrom(prev, fade, false);
  a.cur = name;
}
const DIR_ROT = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
function actor(id, who) {
  let a = actors.get(id);
  if (!a) {
    const c = castOf(who);
    a = makeActor(c[0], c[1], c[2], c[3]); actors.set(id, a); scene.add(a.obj);
  }
  return a;
}
function monsterObj(shape, height) {
  const src = G['cute/' + shape].scene, obj = skClone(src), wrap = new THREE.Group(), inner = new THREE.Group();
  inner.add(obj); wrap.add(inner); obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3());
  const s = height / Math.max(sz.y, Math.max(sz.x, sz.z) * 0.55); obj.scale.multiplyScalar(s);
  obj.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s);
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.userData.baseEm = o.material.emissive ? o.material.emissive.clone() : null; } });
  const mixer = new THREE.AnimationMixer(obj), anims = G['cute/' + shape].animations, actions = {};
  const find = (k) => anims.find((c) => c.name.toLowerCase().includes(k));
  for (const [k, n] of [['idle', 'idle'], ['fly', 'flying'], ['attack', 'bite_front'], ['death', 'death'], ['hit', 'hit'], ['walk', 'walk']]) { const c = find(n) || (k === 'attack' && find('bite')); if (c) actions[k] = mixer.clipAction(c); }
  const idle = actions.idle || actions.fly || actions.walk; if (idle) idle.play();
  for (const k of ['attack', 'death', 'hit']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
  return { obj: wrap, inner, mixer, actions, cur: 'idle', idle };
}
function monPlay(m, k) {
  if (!m.actions[k] || m.cur === k) return;
  const n = m.actions[k]; n.reset().play(); const p = m.cur === 'idle' ? m.idle : m.actions[m.cur]; if (p) n.crossFadeFrom(p, 0.12, false); m.cur = k;
  if (k !== 'death') { const back = () => { m.mixer.removeEventListener('finished', back); if (m.cur === k) { m.idle.reset().play(); m.idle.crossFadeFrom(n, 0.2, false); m.cur = 'idle'; } }; m.mixer.addEventListener('finished', back); }
}

// ------------------------------------------------------------------ per-frame map sync
let camTarget = new THREE.Vector3(), camInit = false;
function syncMap(dt, S) {
  const { cur, P, state, T } = S;
  // party
  const lerpT = P.moving ? P.t : 1;
  const px = P.fx + (P.x - P.fx) * lerpT + 0.5, pz = P.fy + (P.y - P.fy) * lerpT + 0.5;
  const ids = new Set();
  state.party.forEach((m, i) => {
    const pid = 'party_' + sheetOf(m.id), a = actor(pid, m.id); ids.add(pid);
    let x = px, z = pz, dir = P.dir, moving = P.moving;
    if (i > 0) {
      const A2 = P.hist[i + 1] || P.hist[P.hist.length - 1], B2 = P.hist[i] || A2;
      x = A2.x + (B2.x - A2.x) * lerpT + 0.5; z = A2.y + (B2.y - A2.y) * lerpT + 0.5;
      moving = P.moving && (B2.x !== A2.x || B2.y !== A2.y);
      dir = moving ? S.dirTo(A2.x, A2.y, B2.x, B2.y) : (P.hist[i - 1] ? S.dirTo(B2.x, B2.y, P.hist[i - 1].x, P.hist[i - 1].y) : P.dir);
      if (Math.abs(x - px) < 0.2 && Math.abs(z - pz) < 0.2) { x -= 0.2 * i; z -= 0.12; }
    }
    a.obj.visible = true;
    a.obj.position.set(x, 0, z);
    // face the actual direction of travel (diagonals included)
    if (i === 0) a.rotTarget = P.rot != null ? P.rot : DIR_ROT[dir];
    else if (moving) { const A3 = P.hist[i + 1] || P.hist[P.hist.length - 1], B3 = P.hist[i] || A3; a.rotTarget = Math.atan2(B3.x - A3.x, B3.y - A3.y); }
    else a.rotTarget = DIR_ROT[dir];
    // a jog whose stride matches how fast the party crosses tiles, so feet don't slide
    playAct(a, moving ? 'Running_A' : 'Idle_A', 0.1);
    if (a.actions.Running_A) a.actions.Running_A.timeScale = S.running ? 1.45 : 1.05;
  });
  for (const n of cur.npcs) {
    const id = 'npc_' + cur.id + '_' + n.id; ids.add(id);
    const x = n.fx + (n.x - n.fx) * n.t + 0.5, z = n.fy + (n.y - n.fy) * n.t + 0.5;
    if (n.enemy) {
      let a = actors.get(id);
      if (!a) { const mo = monsterObj(ENEMY_MODEL[ENEMIES[n.enemy].shape] || 'YellowDragon', 2.4); a = { obj: mo.obj, mixer: mo.mixer, mon: mo }; actors.set(id, a); scene.add(a.obj); tintMonster(mo, ENEMIES[n.enemy].shape); }
      a.obj.position.set(x, 0.2 + Math.sin(T / 500) * 0.15, z); a.obj.rotation.y = 0;
      continue;
    }
    const a = actor(id + '|' + sheetOf(n.who), n.who); ids.add(id + '|' + sheetOf(n.who));
    a.obj.position.set(x, 0, z); a.rotTarget = DIR_ROT[n.dir]; a.obj.visible = true;
    playAct(a, n.moving ? 'Walking_A' : 'Idle_A');
  }
  for (const [id, a] of actors) {
    if (!ids.has(id)) { a.obj.visible = false; continue; }
    if (a.rotTarget !== undefined) {
      let d = a.rotTarget - a.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      a.obj.rotation.y += d * Math.min(1, dt / 40);
    }
    a.mixer.update(dt / 1000);
  }
  // boulder slide
  if (cur.moving) {
    const m = cur.moving; let b = dynGroup.userData.slide;
    if (!b) { b = place('nature/Rock_Medium_1', 0.95, 'w'); dynGroup.add(b); dynGroup.userData.slide = b; }
    b.position.set(m.x + (m.tx - m.x) * m.t + 0.5, 0, m.y + (m.ty - m.y) * m.t + 0.5);
  } else if (dynGroup.userData.slide) { dynGroup.userData.slide.removeFromParent(); dynGroup.userData.slide = null; }
  dynGroup.traverse((o) => { if (o.userData.mixer) o.userData.mixer.update(dt / 1000); if (o.userData.spin) { o.rotation.y += dt / 600; o.position.y = 0.25 + Math.sin(T / 300) * 0.08; } });
  // water / falls

  for (const f of falls) { if (f.material.map) f.material.map.offset.y = (T / 700) % 1; else { const k = f.userData.ph; f.scale.setScalar(0.8 + Math.sin(T / 160 + k * 1.7) * 0.25); f.position.y = -0.02 + Math.abs(Math.sin(T / 230 + k)) * 0.08; } }
  // camera
  const interior = mapInfo.interior;
  const tx = interior ? mapInfo.w / 2 : px, tz = interior ? mapInfo.h / 2 + 0.6 : pz;
  const halfW = 4.2, halfTop = 4.0, halfBot = 4.6;
  const cx = interior ? tx : Math.max(halfW + 1, Math.min(mapInfo.w - halfW - 1, tx));
  const cz = interior ? tz : Math.max(halfTop + 1, Math.min(mapInfo.h - halfBot, tz));
  const goal = new THREE.Vector3(cx, 0, cz);
  if (!camInit) { camTarget.copy(goal); camInit = true; } else camTarget.lerp(goal, Math.min(1, dt / 55));
  const dist = interior ? 9.5 : 13.5;
  camera.position.set(camTarget.x, camTarget.y + dist * 0.87, camTarget.z + dist * 0.5);
  camera.lookAt(camTarget.x, 0, camTarget.z - 0.6);
  sun.position.set(camTarget.x - 6, 14, camTarget.z + 5); sun.target.position.copy(camTarget);
  // lights in caves / interiors
  playerLight.position.set(px, 3.2, pz + 1.6);
  const near = (mapInfo.glows || []).filter((g) => !g.trinket || !(g.trinket in state.trinkets)).map((g) => ({ g, d: (g.x - px) ** 2 + (g.z - pz) ** 2 })).sort((a, b) => a.d - b.d);
  glowLights.forEach((l, i) => {
    const n = near[i];
    if (n && (mapInfo.cave || mapInfo.interior || n.g.trinket)) { l.position.set(n.g.x, 1.1, n.g.z); l.color.set(n.g.col); l.intensity = n.g.i * (0.9 + Math.sin(T / 200 + i) * 0.1); } else l.intensity = 0;
  });
}
function resetCamera() { camInit = false; }

// ------------------------------------------------------------------ battle
const battleScene = new THREE.Scene();
const battleCam = new THREE.PerspectiveCamera(36, 0.8, 0.1, 100);
battleCam.position.set(0.6, 4.3, 10.5); battleCam.lookAt(0.6, 0.8, 0);
const bHemi = new THREE.HemisphereLight(0xd8ecff, 0x5a6a3a, 1.2), bSun = new THREE.DirectionalLight(0xfff0d8, 2.4), bGlow = new THREE.PointLight(0x7affe0, 0, 12, 1.5);
bSun.position.set(-3, 10, 9); bSun.castShadow = true; bSun.shadow.mapSize.set(1024, 1024); Object.assign(bSun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
battleScene.add(bHemi, bSun, bGlow);
let arena = null, arenaKind = '', bModels = [];
const b3 = new WeakMap(); // battle participant -> 3D model (kept out of the save state)
const ENEMY_MODEL = { slime: 'Alien_Tall', squirrel: 'Cactus', wasp: 'Bee', worm: 'Pig', mushroom: 'Mushroom', turtle: 'Cyclops', moth: 'Bat', ghost: 'Ghost', wraith: 'YellowDragon' };
const ENEMY_H = { Alien_Tall: 0.95, Cactus: 1.0, Bee: 0.85, Pig: 0.95, Mushroom: 1.0, Cyclops: 1.35, Bat: 0.9, Ghost: 1.1, YellowDragon: 2.1 };
const ENEMY_TINT = { wraith: 0xb090f0, ghost: 0xe0dcff };
const ENEMY_GLOW = { wraith: 0x3a2a5a, ghost: 0x2a2440, moth: 0x2a2040 };
function tintMonster(mo, shape) { const t = ENEMY_TINT[shape], g = ENEMY_GLOW[shape]; mo.obj.traverse((o) => { if (!o.isMesh) return; if (t) o.material.color.multiply(new THREE.Color(t)); if (g && o.material.emissive) { o.material.emissive.set(g); o.userData.baseEm = o.material.emissive.clone(); } }); }
// ------------------------------------------------------------------ battle arenas
// smooth value noise for terrain colour and height
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.3 + 7, z * 2.3 + 3) * 0.3 + vnoise(x * 5.1, z * 5.1) * 0.1;
const arenaLights = [0, 1, 2].map(() => new THREE.PointLight(0x7af0ff, 0, 9, 1.6));
battleScene.add(...arenaLights);
let motes = null;
function arenaGround(kind) {
  const W = 46, D = 34, g = new THREE.PlaneGeometry(W, D, 92, 68); g.rotateX(-Math.PI / 2); g.translate(0.6, 0, -6);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const field = kind === 'field';
  const A = field ? [new THREE.Color(0x5c9a3c), new THREE.Color(0x7cbc50), new THREE.Color(0x4a7e30)] : kind === 'boss' ? [new THREE.Color(0x3a3150), new THREE.Color(0x4c4266), new THREE.Color(0x2a2238)] : [new THREE.Color(0x4a3e44), new THREE.Color(0x5e5258), new THREE.Color(0x342a30)];
  const dirt = field ? new THREE.Color(0xa88a58) : new THREE.Color(kind === 'boss' ? 0x5a5070 : 0x6a5a58);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = fbm(x * 0.35, z * 0.35), n2 = vnoise(x * 0.9 + 40, z * 0.9);
    c.copy(A[0]).lerp(A[1], n).lerp(A[2], Math.max(0, n2 - 0.6) * 1.6);
    // the worn clearing where the battle happens
    const e = Math.hypot((x - 0.4) / 6.2, (z - 0.9) / 3.2) + (n - 0.5) * 0.5;
    c.lerp(dirt, Math.max(0, Math.min(1, (1.05 - e) * 2.2)) * (field ? 0.85 : 0.5));
    col.set([c.r, c.g, c.b], i * 3);
    const away = Math.max(0, Math.min(1, (Math.hypot((x - 0.4) / 7.5, (z - 0.9) / 4) - 1.15) * 0.8));
    pos.setY(i, (fbm(x * 0.18 + 9, z * 0.18) - 0.35) * 2.4 * away * (field ? 1 : 1.4));
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.ground, roughness: 1 }));
  m.receiveShadow = true; m.userData.own = true; return m;
}
function skyTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function arenaMotes(color, n, size) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), sp = new Float32Array(n);
  for (let i = 0; i < n; i++) { p.set([(hash(i, 1) - 0.5) * 18 + 0.6, hash(i, 2) * 5, (hash(i, 3) - 0.5) * 12 - 2], i * 3); sp[i] = 0.2 + hash(i, 4) * 0.5; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.userData.speed = sp;
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  pts.userData.own = true; pts.frustumCulled = false; return pts;
}
function buildArena(kind) {
  if (arena && arenaKind === kind) return;
  dispose(arena); arena = new THREE.Group(); battleScene.add(arena); arenaKind = kind;
  const field = kind === 'field', R = (i, k) => hash(i * 7 + k, k * 13 + 5);
  arena.add(arenaGround(kind));
  const heightAt = (x, z) => { const away = Math.max(0, Math.min(1, (Math.hypot((x - 0.4) / 7.5, (z - 0.9) / 4) - 1.15) * 0.8)); return (fbm(x * 0.18 + 9, z * 0.18) - 0.35) * 2.4 * away * (field ? 1 : 1.4); };
  // scatter helper: n items in a band behind / beside the fight, never on the clearing
  const scatter = (n, seed, opts) => {
    const out = [];
    for (let i = 0; out.length < n && i < n * 8; i++) {
      const x = (R(i, seed) - 0.5) * (opts.w || 30) + 0.6, z = opts.z0 + R(i, seed + 1) * (opts.z1 - opts.z0);
      const e = Math.hypot((x - 0.4) / (opts.rx || 6.8), (z - 0.9) / (opts.rz || 3.6));
      if (e < 1 || (opts.front === false && z > 2.5)) continue;
      out.push({ x, y: heightAt(x, z) + (opts.y || 0), z, r: R(i, seed + 2) * TAU, s: (opts.s0 || 1) + R(i, seed + 3) * (opts.s1 || 0), sy: opts.sy ? opts.sy + R(i, seed + 4) * opts.sy : undefined });
    }
    return out;
  };
  arenaLights.forEach((l) => (l.intensity = 0));
  if (motes) { motes.removeFromParent(); motes = null; }
  if (field) {
    // a sunny forest clearing
    const trees = scatter(46, 10, { w: 40, z0: -19, z1: -6, rx: 1, rz: 1 }).concat(scatter(10, 11, { w: 30, z0: -6, z1: 2, rx: 9.5, rz: 9 }));
    const tk = ['nature/CommonTree_1', 'nature/CommonTree_2', 'nature/CommonTree_3', 'nature/CommonTree_4', 'nature/CommonTree_5', 'nature/Pine_1', 'nature/Pine_2', 'nature/Pine_3'];
    tk.forEach((k, j) => instances(arena, k, 3.6, 'h', trees.filter((_, i) => i % tk.length === j).map((t) => ({ ...t, s: 0.85 + R(t.x * 10 | 0, 3) * 0.6 }))));
    instances(arena, 'nature/Bush_Common_Flowers', 1.1, 'w', scatter(16, 20, { w: 26, z0: -7, z1: 1.5, s0: 0.9, s1: 0.6 }));
    instances(arena, 'nature/Bush_Common', 1.1, 'w', scatter(4, 21, { w: 26, z0: -8, z1: -3, s0: 0.9, s1: 0.4 }), { tint: 0xc0e0a0 });
    instances(arena, 'nature/Rock_Medium_2', 0.9, 'w', scatter(7, 30, { w: 22, z0: -6, z1: 4, s0: 0.7, s1: 0.9 }));
    instances(arena, 'nature/Grass_Common_Tall', 0.7, 'h', scatter(140, 40, { w: 24, z0: -8, z1: 5, s0: 0.8, s1: 0.6 }), { cast: false });
    instances(arena, 'nature/Grass_Common_Short', 0.3, 'h', scatter(160, 41, { w: 22, z0: -6, z1: 5, rx: 4.5, rz: 2.2, s0: 0.8, s1: 0.6 }), { cast: false });
    instances(arena, 'nature/Flower_3_Group', 0.5, 'h', scatter(26, 50, { w: 20, z0: -5, z1: 4, s0: 0.9, s1: 0.5 }), { cast: false });
    instances(arena, 'nature/Flower_4_Group', 0.5, 'h', scatter(26, 51, { w: 20, z0: -5, z1: 4, s0: 0.9, s1: 0.5 }), { cast: false });
    instances(arena, 'nature/Fern_1', 0.6, 'w', scatter(18, 60, { w: 24, z0: -7, z1: 3, s0: 0.9, s1: 0.6 }), { cast: false });
    instances(arena, 'nature/Clover_1', 0.35, 'w', scatter(30, 61, { w: 18, z0: -4, z1: 5, rx: 5, rz: 2.6 }), { cast: false });
    instances(arena, 'nature/Mushroom_Common', 0.28, 'h', scatter(10, 62, { w: 18, z0: -5, z1: 3 }), { cast: false });
    instances(arena, 'bld/fence_wood_straight', 1.0, 'd', [-8.6, -7.6, -6.6, -5.6].map((x, i) => ({ x, y: heightAt(x, -5.2), z: -5.2 - i * 0.05, r: Math.PI / 2 })));
    battleScene.background = skyTexture('#6fa6dc', '#cfe7f0'); battleScene.fog = new THREE.Fog(0xbcdcea, 16, 36);
    bHemi.color.set(0xd6ecff); bHemi.groundColor.set(0x4a6a30); bHemi.intensity = 1.15; bSun.color.set(0xfff0d0); bSun.intensity = 2.7; bSun.position.set(-6, 10, 5); bGlow.intensity = 0;
    motes = arenaMotes(0xfff6c0, 60, 0.07);
  } else {
    // a crystal cavern: rock walls, stalagmites, glowing crystals, mushrooms and pools
    const boss = kind === 'boss';
    const wall = []; for (let i = 0; i < 34; i++) { const x = -17 + i + (R(i, 70) - 0.5) * 0.8, z = -8.5 - R(i, 71) * 2.5; wall.push({ x, y: heightAt(x, z) - 0.6, z, r: R(i, 72) * TAU, s: 3 + R(i, 73) * 2.2, sy: 1.3 + R(i, 74) * 0.8 }); }
    for (let i = 0; i < 14; i++) { const side = i % 2 ? 1 : -1, x = side * (10.5 + R(i, 75) * 3) + 0.6, z = -7 + (i >> 1) * 1.6; wall.push({ x, y: -0.5, z, r: R(i, 76) * TAU, s: 2.6 + R(i, 77) * 2, sy: 1.2 + R(i, 78) }); }
    instances(arena, 'nature/Rock_Medium_1', 1, 'w', wall.filter((_, i) => i % 3 === 0), { tint: 0x6a6080 });
    instances(arena, 'nature/Rock_Medium_2', 1, 'w', wall.filter((_, i) => i % 3 === 1), { tint: 0x5e5674 });
    instances(arena, 'nature/Rock_Medium_3', 1, 'w', wall.filter((_, i) => i % 3 === 2), { tint: 0x726a88 });
    instances(arena, 'nature/Rock_Medium_3', 0.8, 'w', scatter(14, 80, { w: 24, z0: -7, z1: 3, s0: 0.8, s1: 0.7, sy: 1.4 }), { tint: 0x7a7090 }); // stalagmites
    instances(arena, 'nature/Pebble_Round_1', 0.25, 'w', scatter(40, 81, { w: 20, z0: -6, z1: 5, rx: 4, rz: 2 }), { tint: 0x8a80a0, cast: false });
    instances(arena, 'nature/Mushroom_Laetiporus', 0.5, 'h', scatter(9, 82, { w: 22, z0: -6, z1: 2 }), { emissive: 0x8a3ad8, ei: 0.9, cast: false });
    instances(arena, 'nature/Mushroom_Common', 0.3, 'h', scatter(14, 83, { w: 22, z0: -6, z1: 3 }), { emissive: 0x3a8ad8, ei: 0.7, cast: false });
    const spots = [[-7.5, -6.2], [-3, -7.4], [4.2, -7], [8.3, -5.2], [-9.6, -2.2]];
    spots.forEach(([x, z], i) => { const c = crystal(); c.position.set(x, heightAt(x, z), z); c.scale.setScalar(1.1 + R(i, 90) * 0.5); c.rotation.y = R(i, 91) * TAU; arena.add(c); });
    arenaLights.forEach((l, i) => { const [x, z] = spots[i * 2 % spots.length]; l.position.set(x, 1.6, z + 0.6); l.color.set(i === 1 ? 0xb07aff : 0x6af0ff); l.intensity = boss ? 8 : 6; l.distance = 10; });
    for (const [x, z, r] of [[-5.2, 3.2, 1.1], [6.4, -3.6, 0.9], [-1.5, -5.4, 0.8]]) {
      if (boss && x < 0 && z < 0) continue;
      const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color: 0x1a3a5a, emissive: 0x0a5a7a, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.3 }));
      p.rotation.x = -Math.PI / 2; p.position.set(x, heightAt(x, z) + 0.03, z); p.userData.own = true; arena.add(p);
    }
    battleScene.background = skyTexture('#05030a', boss ? '#1a1030' : '#141020'); battleScene.fog = new THREE.Fog(boss ? 0x140c26 : 0x0e0a16, 12, 26);
    bHemi.color.set(0xb0a8e8); bHemi.groundColor.set(0x2a2038); bHemi.intensity = 1.25; bSun.intensity = 1.5; bSun.color.set(0xd0c8ff); bSun.position.set(-3, 10, 9);
    bGlow.color.set(0x6af0ff); bGlow.position.set(-2, 3, -3); bGlow.intensity = 6;
    motes = arenaMotes(boss ? 0xa8fff0 : 0x9ad8ff, boss ? 90 : 60, 0.06);
    if (boss) {
      const ring = new THREE.Group();
      for (let i = 0; i < 18; i++) { const s = place('nature/Pebble_Round_' + (i % 2 ? 1 : 3), 0.6, 'w'); s.position.set(Math.cos(i / 18 * TAU) * 2.1, 0, Math.sin(i / 18 * TAU) * 2.1); s.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(0xa098c0)); } }); ring.add(s); }
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2, 40), new THREE.MeshStandardMaterial({ color: 0x5af0e0, emissive: 0x1aa890, emissiveIntensity: 1.0, roughness: 0.1 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; pool.userData.own = true; ring.add(pool);
      ring.position.set(-2.4, 0, -1.6); arena.add(ring); bGlow.color.set(0x8affe8); bGlow.position.set(-2.4, 2, -1); bGlow.intensity = 14;
    }
  }
  if (motes) battleScene.add(motes);
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function screenToGround(cam, sx, sy, out = new THREE.Vector3()) {
  ray.setFromCamera(new THREE.Vector2(sx / LW * 2 - 1, -(sy / LH * 2 - 1)), cam);
  ray.ray.intersectPlane(plane, out); return out;
}
function project(cam, x, y, z) { tmpV.set(x, y, z).project(cam); return { x: (tmpV.x + 1) / 2 * LW, y: (1 - tmpV.y) / 2 * LH, z: tmpV.z }; }
function battleStart(B, party, heroPos) {
  buildArena(B.bg);
  battleCam.updateMatrixWorld(true); battleCam.matrixWorldInverse.copy(battleCam.matrixWorld).invert();
  for (const m of bModels) m.obj.removeFromParent();
  bModels = [];
  for (const e of B.enemies) {
    const model = ENEMY_MODEL[e.d.shape] || 'Slime', hgt = ENEMY_H[model] * (e.d.boss ? 1 : 1);
    const mo = monsterObj(model, hgt); tintMonster(mo, e.d.shape);
    const p = screenToGround(battleCam, e.x, e.y); mo.obj.position.copy(p); mo.home = p.clone();
    mo.obj.rotation.y = 0.6; // mostly toward the camera, turned a little toward the heroes
    battleScene.add(mo.obj); b3.set(e, mo); bModels.push(mo);
    // screen-space size for the 2D effects layer
    const top = project(battleCam, p.x, hgt, p.z), bot = project(battleCam, p.x, 0, p.z);
    const hpx = Math.max(10, bot.y - top.y);
    e.sz = { w: hpx * 0.9, h: hpx };
  }
  party.forEach((m, i) => {
    const c = castOf(m.id); const a = makeActor(c[0], c[1], c[2], c[3]);
    const hp = heroPos(i), p = screenToGround(battleCam, hp.x, hp.y);
    a.obj.position.copy(p); a.home = p.clone(); a.obj.rotation.y = -Math.PI / 2 + 0.35; a.obj.scale.setScalar(1.05);
    battleScene.add(a.obj); b3.set(m, a); bModels.push(a);
  });
  const p0 = screenToGround(battleCam, heroPos(0).x, heroPos(0).y);
  const t = project(battleCam, p0.x, 1.12, p0.z), b = project(battleCam, p0.x, 0, p0.z);
  return { heroH: b.y - t.y };
}
function battleSync(dt, B, party, T) {
  if (motes) {
    const p = motes.geometry.attributes.position, sp = motes.geometry.userData.speed;
    for (let i = 0; i < sp.length; i++) { let y = p.getY(i) + sp[i] * dt / 1000 * 0.6; if (y > 5) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(T / 900 + i) * 0.002); }
    p.needsUpdate = true; motes.material.opacity = 0.55 + Math.sin(T / 400) * 0.25;
  }
  for (const e of B.enemies) {
    const mo = b3.get(e); if (!mo) continue;
    const ox = (e.shake > 0 ? Math.sin(T / 14) * 0.06 : 0) + (e.lunge > 0 ? Math.sin((e.lunge / 300) * Math.PI) * 0.7 : 0);
    mo.obj.position.set(mo.home.x + ox, mo.home.y + (e.d.float ? 0.35 + Math.sin(T / 300 + mo.home.x) * 0.12 : 0), mo.home.z);
    if (e.lunge > 200 && mo.cur === 'idle') monPlay(mo, 'attack');
    if (e.flash > 0 && mo.cur === 'idle' && mo.actions.hit) monPlay(mo, 'hit');
    const fl = e.flash > 0 && Math.floor(e.flash / 60) % 2 === 0;
    mo.obj.traverse((o) => { if (o.isMesh && o.material.emissive) { if (fl) o.material.emissive.setRGB(0.9, 0.9, 0.9); else if (o.userData.baseEm) o.material.emissive.copy(o.userData.baseEm); else o.material.emissive.setRGB(0, 0, 0); } });
    if (!e.alive) {
      if (mo.cur !== 'death') monPlay(mo, 'death');
      mo.dieT = (mo.dieT || 0) + dt;
      if (mo.dieT > 700) { const k = Math.max(0, 1 - (mo.dieT - 700) / 400); mo.inner.scale.setScalar(k); }
    }
    mo.mixer.update(dt / 1000);
  }
  party.forEach((m, i) => {
    const a = b3.get(m); if (!a) return;
    const shk = B.heroShake[m.id] || 0, st = B.heroStep[m.id] || 0;
    const ox = (shk > 0 ? Math.sin(T / 14) * 0.05 + 0.1 : 0) - (st > 0 ? Math.sin((st / 380) * Math.PI) * 0.8 : 0);
    a.obj.position.set(a.home.x + ox, a.home.y + (B.active === i ? Math.abs(Math.sin(T / 160)) * 0.08 : 0), a.home.z);
    if (m.hp <= 0) playAct(a, 'Death_A');
    else if (st > 300) playAct(a, B.msg && B.msg.includes(':') ? 'Use_Item' : 'Throw', 0.1);
    else if (shk > 250) playAct(a, 'Hit_A', 0.08);
    else if (a.cur === 'Death_A' || ((a.cur === 'Throw' || a.cur === 'Use_Item' || a.cur === 'Hit_A') && !a.actions[a.cur].isRunning())) playAct(a, 'Idle_A', 0.25);
    a.mixer.update(dt / 1000);
  });
}
function battleEnd() { for (const m of bModels) m.obj.removeFromParent(); bModels = []; }
function enemyScreen(e) { const mo = b3.get(e), p = mo ? mo.obj.position : null; return p ? project(battleCam, p.x, 0, p.z) : null; }

// ------------------------------------------------------------------ title / ending
let titleT = 0;
function titleSync(dt, S) {
  titleT += dt;
  const a = titleT / 14000, cx = 15, cz = 11;
  camera.position.set(cx + Math.cos(a) * 10, 7.5, cz + Math.sin(a) * 10);
  camera.lookAt(cx, 0.5, cz);
  sun.position.set(cx - 6, 14, cz + 5); sun.target.position.set(cx, 0, cz);
  const ids = [['party_wren', 'wren', 14.2, 13.3], ['party_bram', 'bram', 15.4, 13.6], ['npc_title_gran', 'gran', 13.4, 11.6]];
  for (const [id, who, x, z] of ids) { const ac = actor(id, who); ac.obj.visible = true; ac.obj.position.set(x, 0, z); ac.obj.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); ac.mixer.update(dt / 1000); }
}

// ------------------------------------------------------------------ portraits
const portraitCache = new Map();
let pRenderer = null;
function portrait(who) {
  if (portraitCache.has(who)) return portraitCache.get(who);
  if (!pRenderer) { const c = document.createElement('canvas'); pRenderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); pRenderer.setSize(76, 76, false); pRenderer.outputColorSpace = THREE.SRGBColorSpace; }
  const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(1, 2, 3); s.add(d);
  const c = castOf(who); const a = makeActor(c[0], c[1], 1, c[3]); a.mixer.update(0.4); s.add(a.obj); a.obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.obj), top = box.max.y;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 20); cam.position.set(0.25, top - 0.22, 1.35); cam.lookAt(0, top - 0.3, 0);
  pRenderer.render(s, cam);
  const out = document.createElement('canvas'); out.width = out.height = 76; out.getContext('2d').drawImage(pRenderer.domElement, 0, 0);
  const small = document.createElement('canvas'); small.width = small.height = 38; const sg = small.getContext('2d'); sg.imageSmoothingEnabled = true; sg.drawImage(out, 0, 0, 38, 38);
  small.big = out;
  portraitCache.set(who, small);
  return small;
}
// full-length picture for character creation (shows the outfit colours)
function figure(who) {
  const key = who + '|full'; if (portraitCache.has(key)) return portraitCache.get(key);
  if (!portraitCache.size) portrait(who);
  pRenderer.setSize(84, 120, false);
  const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(1, 2, 3); s.add(d);
  const c = castOf(who); const a = makeActor(c[0], c[1], 1, c[3]); a.mixer.update(0.4); a.obj.rotation.y = 0.45; s.add(a.obj); a.obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.obj), hgt = box.max.y, mid = hgt / 2;
  const cam = new THREE.PerspectiveCamera(30, 84 / 120, 0.01, 20); cam.position.set(0.15, mid + 0.1, hgt * 2.05); cam.lookAt(0, mid, 0);
  pRenderer.render(s, cam);
  const out = document.createElement('canvas'); out.width = 84; out.height = 120; out.getContext('2d').drawImage(pRenderer.domElement, 0, 0);
  pRenderer.setSize(76, 76, false);
  portraitCache.set(key, out);
  return out;
}


// ------------------------------------------------------------------ polish: wind, water, post-processing
const FX = { time: { value: 0 }, quality: 'high', post: null };
// sway foliage in the wind: vertices move more the higher they are above the plant's base
function addWind(mat, k) {
  if (mat.userData.wind) return; mat.userData.wind = k;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = FX.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 wPos = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wPos = instanceMatrix * wPos;
        float wBase = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).y;
      #else
        float wBase = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).y;
      #endif
      wPos = modelMatrix * wPos;
      float wH = max( 0.0, wPos.y - wBase );
      float ph = uTime * 1.7 + wPos.x * 0.35 + wPos.z * 0.27;
      float gust = 0.65 + 0.35 * sin( uTime * 0.45 + wPos.x * 0.08 );
      wPos.xz += vec2( sin( ph ), cos( ph * 0.83 ) * 0.5 ) * wH * ${k.toFixed(3)} * gust;
      vec4 mvPosition = viewMatrix * wPos;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'wind' + k;
}
const WIND = [[/^nature\/(CommonTree|Pine|TwistedTree|DeadTree)/, 0.035], [/^nature\/Bush/, 0.06], [/^nature\/(Grass|Flower|Fern|Clover|Plant)/, 0.22]];
function setupWind() {
  for (const [key, g] of Object.entries(G)) {
    const w = WIND.find(([re]) => re.test(key)); if (!w) continue;
    g.scene.traverse((o) => { if (o.isMesh && !/bark|trunk|wood/i.test(o.material.name || '')) { addWind(o.material, w[1]); if (/Tree|Pine|Bush/.test(key) && !o.material.userData.lush) { o.material.userData.lush = true; o.material.color.multiplyScalar(1.38); } } });
  }
}
// rivers and ponds: depth colour, shoreline foam, ripples and glints
function shoreTexture(m) {
  const R = 8, w = m.w * R, h = m.h * R; let a = new Float32Array(w * h), b = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = WATERISH.has(m.t[(y / R) | 0][(x / R) | 0]) ? 0 : 1;
  const blur = (src, dst, dx, dy, r) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k * dx, yy = y + k * dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) { s += 1; n++; continue; } s += src[yy * w + xx]; n++; } dst[y * w + x] = s / n; } };
  for (let i = 0; i < 2; i++) { blur(a, b, 1, 0, 5); blur(b, a, 0, 1, 5); }
  const d = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { const v = Math.min(255, a[i] * 255) | 0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, w, h); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
function waterMaterial(m, cave) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, roughness: 0.12, metalness: 0.05, emissive: cave ? 0x0a2a48 : 0x000000 });
  const shore = shoreTexture(m);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: FX.time, uShore: { value: shore }, uSize: { value: new THREE.Vector2(m.w, m.h) },
      uDeep: { value: new THREE.Color(cave ? 0x0e3a6a : 0x127a8e) }, uShallow: { value: new THREE.Color(cave ? 0x3aa8c8 : 0x58d8c8) } });
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = 'varying vec3 vWPos; uniform float uTime; uniform sampler2D uShore; uniform vec2 uSize; uniform vec3 uDeep, uShallow;\nfloat wN1, wN2, wFoam;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        float shore = texture2D( uShore, vWPos.xz / uSize ).r;
        wN1 = sin( vWPos.x * 2.1 + uTime * 1.3 ) * sin( vWPos.z * 1.7 - uTime * 1.1 );
        wN2 = sin( vWPos.x * 3.7 - uTime * 1.7 + vWPos.z * 2.3 ) * sin( vWPos.z * 2.9 + uTime * 0.9 );
        diffuseColor.rgb = mix( uDeep, uShallow, clamp( shore * 1.5 + wN1 * 0.06, 0.0, 1.0 ) );
        float streak = smoothstep( 0.9, 1.0, sin( vWPos.x * 1.1 + vWPos.z * 3.6 + uTime * 0.9 + wN1 * 2.0 ) );
        diffuseColor.rgb += streak * 0.07;
        float fs = shore + wN2 * 0.03 + sin( uTime * 1.6 + shore * 20.0 ) * 0.02;
        wFoam = smoothstep( 0.35, 0.39, fs ) * ( 1.0 - smoothstep( 0.42, 0.47, fs ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.95, 0.98, 1.0 ), wFoam * 0.75 );
        diffuseColor.a = mix( 0.85, 0.95, wFoam ) * ( 1.0 - smoothstep( 0.44, 0.52, shore ) );`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize( normal + vec3( wN1, 0.0, wN2 ) * 0.16 * ( 1.0 - wFoam ) );');
  };
  mat.customProgramCacheKey = () => 'water' + (cave ? 1 : 0);
  return mat;
}
// full-screen effects: soft glow on bright things, tilt-shift depth blur, colour grading, vignette
class Post {
  constructor(r) {
    this.r = r;
    const ext = r.extensions, hdr = ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float');
    const opt = { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, colorSpace: THREE.LinearSRGBColorSpace };
    this.main = new THREE.WebGLRenderTarget(4, 4, { ...opt, samples: 4 });
    this.main.depthTexture = new THREE.DepthTexture(4, 4); this.main.depthTexture.type = THREE.UnsignedIntType;
    this.a = new THREE.WebGLRenderTarget(4, 4, opt); this.b = new THREE.WebGLRenderTarget(4, 4, opt);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(tri); this.quad.frustumCulled = false; this.sc = new THREE.Scene(); this.sc.add(this.quad);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.down = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: vs,
      fragmentShader: 'uniform sampler2D t; uniform vec2 px; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv + px * vec2(-1.0,-1.0)).rgb + texture2D(t, vUv + px * vec2(1.0,-1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0,1.0)).rgb + texture2D(t, vUv + px * vec2(1.0,1.0)).rgb; gl_FragColor = vec4(min(c * 0.25, vec3(8.0)), 1.0); }' });
    this.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs,
      fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + dir * 1.3846).rgb + texture2D(t, vUv - dir * 1.3846).rgb) * 0.316; c += (texture2D(t, vUv + dir * 3.2308).rgb + texture2D(t, vUv - dir * 3.2308).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
    this.comp = new THREE.ShaderMaterial({ uniforms: { tS: { value: null }, tB: { value: null }, tD: { value: null }, px: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 100 }, ink: { value: 0.75 }, exposure: { value: 1.05 }, bloom: { value: 0.55 }, thr: { value: 0.75 }, tilt: { value: 0.85 }, sat: { value: 1.12 }, vig: { value: 0.32 } }, vertexShader: vs,
      fragmentShader: `uniform sampler2D tS, tB, tD; uniform vec2 px; uniform float near, far, ink; uniform float exposure, bloom, thr, tilt, sat, vig; varying vec2 vUv;
        float lin(vec2 uv){ float d = texture2D(tD, uv).r; return near * far / (far - d * (far - near)); }
        vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 aces(vec3 c){ const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777)); const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602)); c *= exposure / 0.6; return clamp(O * fit(I * c), 0.0, 1.0); }
        vec3 srgb(vec3 c){ return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
        void main(){
          vec3 c = texture2D(tS, vUv).rgb, b = texture2D(tB, vUv).rgb;
          // ink outlines: where depth jumps (silhouettes of trees, rocks, characters), draw a soft dark line
          float d0 = lin(vUv);
          float dm = max(max(abs(lin(vUv + vec2(px.x, 0.0)) - d0), abs(lin(vUv - vec2(px.x, 0.0)) - d0)), max(abs(lin(vUv + vec2(0.0, px.y)) - d0), abs(lin(vUv - vec2(0.0, px.y)) - d0)));
          float edge = smoothstep(0.05, 0.11, dm / d0) * (1.0 - smoothstep(18.0, 30.0, d0)) * ink;
          c = mix(c, c * vec3(0.22, 0.2, 0.26), edge);
          float d = smoothstep(0.26, 0.55, abs(vUv.y - 0.5)) * tilt;
          c = mix(c, b, d);
          c += max(b - thr, 0.0) * bloom;
          c = aces(c);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, sat);
          c = c * vec3(1.03, 1.0, 0.95) + vec3(0.0, 0.004, 0.02) * (1.0 - l);
          c = srgb(clamp(c, 0.0, 1.0));
          vec2 q = vUv - 0.5; c *= 1.0 - vig * dot(q, q) * 2.2;
          gl_FragColor = vec4(c, 1.0);
        }` });
  }
  setSize(w, h) { this.main.setSize(w, h); const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2); this.a.setSize(qw, qh); this.b.setSize(qw, qh); this.w = w; this.h = h; this.qw = qw; this.qh = qh; }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.sc, this.cam); }
  render(scene, cam, kind) {
    const r = this.r; const bloomBoost = kind === 'cave' ? 1.6 : 1;
    r.setRenderTarget(this.main); r.render(scene, cam);
    this.down.uniforms.t.value = this.main.texture; this.down.uniforms.px.value.set(1.5 / this.w, 1.5 / this.h); this.pass(this.down, this.a);
    for (let i = 0; i < 2; i++) {
      this.blur.uniforms.t.value = this.a.texture; this.blur.uniforms.dir.value.set((1 + i) / this.qw, 0); this.pass(this.blur, this.b);
      this.blur.uniforms.t.value = this.b.texture; this.blur.uniforms.dir.value.set(0, (1 + i) / this.qh); this.pass(this.blur, this.a);
    }
    const u = this.comp.uniforms; u.tS.value = this.main.texture; u.tB.value = this.a.texture;
    u.tD.value = this.main.depthTexture; u.near.value = cam.near; u.far.value = cam.far; u.px.value.set(1.2 / this.w, 1.2 / this.h); u.ink.value = kind === 'interior' ? 0.55 : 0.8; u.bloom.value = (kind === 'battle' ? 0.3 : 0.5) * bloomBoost; u.thr.value = kind === 'cave' ? 0.35 : kind === 'battle' ? 1.0 : 0.8;
    u.tilt.value = kind === 'battle' ? 0.4 : kind === 'interior' ? 0.3 : 0.6;
    u.exposure.value = renderer.toneMappingExposure;
    this.pass(this.comp, null);
  }
}
let pxW = 0, pxH = 0;
function setQuality(q) {
  FX.quality = q === 'low' ? 'low' : 'high';
  if (!renderer) return;
  const pr = FX.quality === 'low' ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pr);
  if (FX.quality === 'high' && !FX.post) { try { FX.post = new Post(renderer); } catch (e) { FX.post = null; } }
  if (pxW) resize(pxW, pxH, LW, LH);
}
// watch the frame rate for a few seconds of play; if it's poor in the fancy mode, tell the game once
const perf = { t0: 0, n: 0, last: 0, done: false };
function watchPerf(now) {
  if (perf.done || FX.quality !== 'high' || !W3D.onSlow) return;
  if (!perf.last || now - perf.last > 500) { perf.last = now; perf.t0 = now + 3000; perf.n = 0; return; } // paused / hidden: restart (skip 3 s of warm-up)
  if (now < perf.t0) { perf.last = now; return; }
  perf.last = now; perf.n++;
  if (now - perf.t0 > 5000) {
    const fps = perf.n * 1000 / (now - perf.t0);
    perf.done = true;
    if (fps < 26) W3D.onSlow();
  }
}

// ------------------------------------------------------------------ public API
function render(kind) {
  if (!renderer) return;
  const now = performance.now(); FX.time.value = now / 1000;
  const sc = kind === 'battle' ? battleScene : scene, cam = kind === 'battle' ? battleCam : camera;
  if (FX.quality === 'high' && FX.post) {
    const k = kind === 'battle' ? (arenaKind === 'field' ? 'battle' : 'cave') : mapInfo && mapInfo.cave ? 'cave' : mapInfo && mapInfo.interior ? 'interior' : 'field';
    FX.post.render(sc, cam, k);
  } else renderer.render(sc, cam);
  if (kind === 'battle' || (mapInfo && kind === 'map')) watchPerf(now);
}
function pickTile(lx, ly) {
  const p = screenToGround(camera, lx, ly);
  if (!p || !mapInfo) return null;
  return { x: Math.floor(p.x), y: Math.floor(p.z) };
}
function toScreen(wx, wy, wz) { return project(camera, wx, wy, wz); }
function tileChanged(m, st) { if (mapInfo && m.id === mapInfo.id) { rebuildDynamic(m, st); setCaveLight(st); } }
function hideActors() { for (const a of actors.values()) a.obj.visible = false; }

window.W3D = { figure, setQuality, init, load, resize, buildMap, syncMap, render, pickTile, toScreen, tileChanged, resetCamera, battleStart, battleSync, battleEnd, enemyScreen, titleSync, portrait, hideActors, setCaveLight, ENEMY_MODEL };
window.__w3dReady && window.__w3dReady();
