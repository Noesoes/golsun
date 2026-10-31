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
  mon: ['Slime', 'Rat', 'Wasp', 'Snake', 'Frog', 'Spider', 'Bat', 'Skeleton', 'Dragon'],
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
  const jobs = []; let done = 0, total = 0;
  for (const [dir, names] of Object.entries(FILES)) for (const n of names) {
    total++;
    jobs.push(loader.loadAsync(`${A}${dir}/${n}.glb`).then((g) => { G[dir + '/' + n] = g; onProgress && onProgress(++done / total); }));
  }
  await Promise.all(jobs);
  for (const k of ['chars/Rig_Medium_General', 'chars/Rig_Medium_MovementBasic']) for (const c of G[k].animations) CLIPS[c.name] = c;
  for (const g of Object.values(G)) g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.map) o.material.map.anisotropy = 4; } });
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
    if (opt.tint) { mat = mat.clone(); mat.color.multiply(new THREE.Color(opt.tint)); }
    if (opt.emissive) { mat = mat.clone(); mat.emissive = new THREE.Color(opt.emissive); mat.emissiveIntensity = opt.ei || 0.6; }
    const im = new THREE.InstancedMesh(m.geometry, mat, items.length);
    items.forEach((it, i) => {
      _e.set(0, it.r || 0, 0); _q.setFromEuler(_e); _s.setScalar(it.s || 1); _p.set(it.x, it.y || 0, it.z);
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

function init(canvas) {
  glCanvas = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  makeTextures();
}
function resize(cssW, cssH, lw, lh) {
  LW = lw; LH = lh;
  if (!renderer) return;
  renderer.setSize(cssW, cssH, false);
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
const WALLS = { M: 1.7, '#': 2.4, Q: 2.4 };
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
    const i = y * (W + 1) + x, n = hash(x * 3 + 1, y * 5 + 2) * 0.08 - 0.04;
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
function buildWalls(m, def) {
  const P = [], C = [], col = new THREE.Color();
  const isWall = (x, y) => { if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true; return m.t[y][x] in WALLS; };
  const jit = (x, y, amp) => (hash(x * 7 + 3, y * 11 + 5) - 0.5) * amp;
  const quad = (a, b, c2, d, ca, cb) => { P.push(...a, ...b, ...c2, ...a, ...c2, ...d); C.push(...ca, ...ca, ...cb, ...ca, ...cb, ...cb); };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.t[y][x]; if (!(c in WALLS)) continue;
    const interior = c === 'Q', cave = c === '#';
    let Hh = WALLS[c]; if (interior && y === m.h - 1) Hh = 0.35;
    const amp = interior ? 0 : 0.35, xa = interior ? 0 : 0.12;
    const corner = (cx, cy) => [cx + jit(cx + 50, cy, xa), Hh + jit(cx, cy, amp), cy + jit(cx, cy + 50, xa)];
    const tl = corner(x, y), tr = corner(x + 1, y), bl = corner(x, y + 1), br = corner(x + 1, y + 1);
    const topC = cave ? [0.12, 0.1, 0.15] : interior ? [0.36, 0.24, 0.16] : (col.setHex(hash(x, y) < 0.5 ? 0x5e9a40 : 0x6aa646), [col.r, col.g, col.b]);
    quad(tl, tr, br, bl, topC, topC);
    const sideTop = cave ? [0.36, 0.32, 0.4] : interior ? [0.93, 0.88, 0.76] : [0.62, 0.52, 0.4];
    const sideBot = cave ? [0.16, 0.14, 0.2] : interior ? [0.55, 0.38, 0.24] : [0.38, 0.3, 0.24];
    const down = (p) => [p[0], -0.6, p[2]];
    if (!isWall(x, y + 1)) quad(bl, br, down(br), down(bl), sideTop, sideBot);
    if (!isWall(x, y - 1)) quad(tr, tl, down(tl), down(tr), sideTop, sideBot);
    if (!isWall(x - 1, y)) quad(tl, bl, down(bl), down(tl), sideTop, sideBot);
    if (!isWall(x + 1, y)) quad(br, tr, down(tr), down(br), sideTop, sideBot);
  }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, map: TEX.ground }));
  // uv for the noise texture: project top-down
  const uv = []; for (let i = 0; i < P.length; i += 3) uv.push((P[i] + P[i + 1] * 0.7) / 3, (P[i + 2] + P[i + 1] * 0.7) / 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.own = true;
  return mesh;
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
    const wm = new THREE.MeshStandardMaterial({ color: cave ? 0x2a5a8a : 0x5ab0e0, map: TEX.water, transparent: true, opacity: cave ? 0.9 : 0.82, roughness: 0.15, metalness: 0.1, emissive: cave ? 0x0a2040 : 0x000000 });
    water = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.h), wm); water.rotation.x = -Math.PI / 2; water.position.set(m.w / 2, -0.12, m.h / 2);
    water.material.map = TEX.water.clone(); water.material.map.repeat.set(m.w / 3, m.h / 3); water.material.map.needsUpdate = true;
    water.userData.own = true; water.receiveShadow = true; world.add(water);
  }
  const L = {}; const add = (k, it) => (L[k] = L[k] || []).push(it);
  const glows = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.t[y][x], cx = x + 0.5, cz = y + 0.5, h = hash(x, y), h2 = hash(y + 17, x + 3), r = h2 * TAU;
    if (c === 'T') {
      const deep = [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => { const t = m.t[y + dy] && m.t[y + dy][x + dx]; return !t || t === 'T'; });
      if (deep && (x + y) % 2) continue;
      const k = h < 0.62 ? 'nature/CommonTree_' + (1 + ((h * 100) | 0) % 5) : 'nature/Pine_' + (1 + ((h * 100) | 0) % 3);
      add(k, { x: cx + (h2 - 0.5) * 0.4, z: cz + (h - 0.5) * 0.4, r, s: (deep ? 1.35 : 1) * (0.85 + h2 * 0.3) });
    } else if (c === 't') add('nature/Bush_Common_Flowers', { x: cx, z: cz, r, s: 1.0 + h * 0.3 });
    else if (c === 'b') { add('nature/Flower_3_Group', { x: cx - 0.2, z: cz, r, s: 1.1 }); add('nature/Flower_4_Group', { x: cx + 0.2, z: cz + 0.15, r, s: 1.1 }); add('nature/Grass_Common_Short', { x: cx, z: cz - 0.2, r, s: 1 }); }
    else if (c === ',') { add('nature/Flower_' + (h < 0.5 ? 3 : 4) + '_Group', { x: cx - 0.2, z: cz - 0.1, r, s: 1 }); add('nature/Flower_' + (h < 0.5 ? 4 : 3) + '_Group', { x: cx + 0.22, z: cz + 0.2, r: r + 2, s: 0.8 }); }
    else if (c === '"') for (let i = 0; i < 5; i++) { const a = hash(x * 5 + i, y * 3 - i); add(i % 2 ? 'nature/Grass_Wispy_Tall' : 'nature/Grass_Common_Tall', { x: cx + (a - 0.5) * 0.85, z: cz + (hash(i, x + y) - 0.5) * 0.85, r: a * TAU, s: 0.8 + a * 0.5 }); }
    else if (c === 'r') add('nature/Rock_Medium_2', { x: cx, z: cz, r, s: 0.9 + h * 0.3 });
    else if (c === 'F') add('bld/fence_wood_straight', { x: cx, z: cz, r: (m.t[y][x - 1] === 'F' || m.t[y][x + 1] === 'F') ? Math.PI / 2 : 0, s: 1 });
    else if (c === 'u') add(interior ? 'props/Barrel' : 'props/Barrel_Apples', { x: cx, z: cz, r, s: 1 });
    else if (c === 'x') add('props/Crate_Wooden', { x: cx, z: cz, r: r * 0.1, s: 1 });
    else if (c === 'q') add('nature/Plant_7', { x: cx, z: cz, r, s: 1 });
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
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), new THREE.MeshBasicMaterial({ color: 0x05030a })); p.position.set(cx, 0.75, y + 0.02); p.userData.own = true; world.add(p);
    } else if (c === '~' && outdoor && y > 0 && (m.t[y - 1][x] === 'M' || y === 0)) {
      // waterfall where the river leaves the cliffs
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 2.2), new THREE.MeshStandardMaterial({ map: TEX.falls.clone(), transparent: true, opacity: 0.9, emissive: 0x335566, roughness: 0.2 }));
      f.material.map.needsUpdate = true; f.position.set(cx, 0.75, y + 0.05); f.userData.own = true; world.add(f); falls.push(f);
    }
    // grass detail on open ground
    if (outdoor && (c === '.' || c === ',')) {
      if (h < 0.45) add('nature/Grass_Common_Short', { x: cx + (h2 - 0.5) * 0.8, z: cz + (h - 0.5) * 0.8, r, s: 0.7 + h2 * 0.6 });
      else if (h < 0.53) add('nature/Clover_1', { x: cx, z: cz, r, s: 1 });
      else if (h < 0.56) add('nature/Pebble_Round_' + (h2 < 0.5 ? 1 : 3), { x: cx + 0.2, z: cz - 0.2, r, s: 1 });
      else if (h < 0.58) add('nature/Mushroom_Common', { x: cx, z: cz, r, s: 1 });
      else if (h < 0.62) add('nature/Fern_1', { x: cx, z: cz, r, s: 1 });
    }
    if (cave && c === '_' && h < 0.08) add('nature/Pebble_Round_' + (h2 < 0.5 ? 1 : 3), { x: cx, z: cz, r, s: 1 });
    if (outdoor && c === 'M') {
      const front = m.t[y + 1] && m.t[y + 1][x] !== 'M' && m.t[y + 1][x] !== 'v';
      if (front && h < 0.35) add('nature/Rock_Medium_' + (1 + ((h * 30) | 0) % 3), { x: cx, y: 0, z: cz + 0.45, r, s: 0.9 });
      if (!front && h < 0.3) add('nature/Pine_' + (1 + ((h * 30) | 0) % 3), { x: cx, y: 1.7, z: cz, r, s: 0.9 });
      else if (h > 0.75) add('nature/Bush_Common_Flowers', { x: cx, y: 1.7, z: cz, r, s: 0.9 });
    }
  }
  const SIZES = { CommonTree: [3.1, 'h'], Pine: [3.0, 'h'], Bush_Common: [1.0, 'w'], Bush_Common_Flowers: [0.95, 'w'], Flower_3_Group: [0.5, 'h'], Flower_4_Group: [0.5, 'h'],
    Grass_Wispy_Tall: [0.75, 'h'], Grass_Common_Tall: [0.7, 'h'], Grass_Common_Short: [0.28, 'h'], Clover_1: [0.35, 'w'], Pebble_Round: [0.25, 'w'], Mushroom_Common: [0.28, 'h'], Mushroom_Laetiporus: [0.45, 'h'],
    Fern_1: [0.6, 'w'], Rock_Medium: [0.75, 'w'], fence_wood_straight: [1.0, 'd'], Barrel: [0.75, 'h'], Barrel_Apples: [0.75, 'h'], Crate_Wooden: [0.6, 'h'], Plant_7: [0.8, 'h'],
    Bookcase_2: [1.9, 'h'], Table_Large: [1.1, 'w'], Stool: [0.45, 'h'], Bed_Twin1: [1.0, 'w'], Workbench: [1.0, 'w'] };
  const sizeOf = (k) => { const n = k.split('/')[1]; for (const [p, v] of Object.entries(SIZES)) if (n === p || n.startsWith(p + '_') || n.startsWith(p)) return v; return [1, 'h']; };
  for (const [k, items] of Object.entries(L)) { const [sz, mode] = sizeOf(k); instances(world, k, sz, mode, items, { cast: !k.includes('Grass') && !k.includes('Clover') && !k.includes('Pebble') && !k.includes('Flower') }); }
  for (const hs of def.houses || []) {
    const o = building(hs.kind, hs.w, hs.h); o.position.set(hs.x + hs.w / 2, 0, hs.y + hs.h / 2 + 0.1); world.add(o);
  }
  // atmosphere
  if (outdoor) { scene.background = new THREE.Color(0xa8d8f0); scene.fog = new THREE.Fog(0xa8d8f0, 20, 42); hemi.intensity = 1.25; sun.intensity = 2.4; hemi.color.set(0xd8ecff); hemi.groundColor.set(0x5a6a3a); }
  else if (interior) { scene.background = new THREE.Color(0x1a1410); scene.fog = null; hemi.intensity = 1.1; sun.intensity = 1.4; hemi.color.set(0xfff0d8); hemi.groundColor.set(0x6a4a30); }
  else { scene.background = new THREE.Color(0x07050c); scene.fog = new THREE.Fog(0x07050c, 9, 22); }
  mapInfo = { id: m.id, def, w: m.w, h: m.h, glows, outdoor, cave, interior };
  setCaveLight(st);
  rebuildDynamic(m, st);
}
function setCaveLight(st) {
  if (!mapInfo || !mapInfo.cave) { playerLight.intensity = 0; glowLights.forEach((l) => (l.intensity = 0)); return; }
  const lit = st && st.flags && st.flags.springSings;
  hemi.color.set(lit ? 0x9fb8ff : 0x6a5a9a); hemi.groundColor.set(0x1a1020); hemi.intensity = lit ? 0.9 : 0.28; sun.intensity = lit ? 0.6 : 0.08;
  playerLight.intensity = lit ? 4 : 14;
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
  pip: ['Ranger', 0xfff0c0, 0.72], ivy: ['Rogue_Hooded', 0xd0c8ff], marta: ['Barbarian', 0xffe0c8, 0.95], dorrit: ['Knight', 0xd8c8a8], odo: ['Rogue_Hooded', 0xc8d8ff],
};
function makeActor(model, tint, scale = 1) {
  const src = G['chars/' + model].scene, obj = skClone(src);
  const wrap = new THREE.Group(); wrap.add(obj);
  obj.scale.setScalar(0.46 * scale);
  if (tint) obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } });
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
    const c = CAST[who] || ['Rogue'];
    a = makeActor(c[0], c[1], c[2]); actors.set(id, a); scene.add(a.obj);
  }
  return a;
}
function monsterObj(shape, height) {
  const src = G['mon/' + shape].scene, obj = skClone(src), wrap = new THREE.Group(), inner = new THREE.Group();
  inner.add(obj); wrap.add(inner); obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3());
  const s = height / sz.y; obj.scale.multiplyScalar(s);
  obj.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s);
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.userData.baseEm = o.material.emissive ? o.material.emissive.clone() : null; } });
  const mixer = new THREE.AnimationMixer(obj), anims = G['mon/' + shape].animations, actions = {};
  const find = (k) => anims.find((c) => c.name.toLowerCase().includes(k));
  for (const [k, n] of [['idle', 'idle'], ['fly', 'flying'], ['attack', 'attack'], ['death', 'death'], ['hit', 'hit'], ['walk', 'walk']]) { const c = find(n); if (c) actions[k] = mixer.clipAction(c); }
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
    const a = actor('party_' + m.id, m.id); ids.add('party_' + m.id);
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
    a.rotTarget = DIR_ROT[dir];
    playAct(a, moving ? (S.running ? 'Running_A' : 'Walking_A') : 'Idle_A');
  });
  for (const n of cur.npcs) {
    const id = 'npc_' + cur.id + '_' + n.id; ids.add(id);
    const x = n.fx + (n.x - n.fx) * n.t + 0.5, z = n.fy + (n.y - n.fy) * n.t + 0.5;
    if (n.enemy) {
      let a = actors.get(id);
      if (!a) { const mo = monsterObj(ENEMY_MODEL[ENEMIES[n.enemy].shape] || 'Dragon', 2.4); a = { obj: mo.obj, mixer: mo.mixer, mon: mo }; actors.set(id, a); scene.add(a.obj); tintMonster(mo, ENEMIES[n.enemy].shape); }
      a.obj.position.set(x, 0.2 + Math.sin(T / 500) * 0.15, z); a.obj.rotation.y = 0;
      continue;
    }
    const a = actor(id, n.who);
    a.obj.position.set(x, 0, z); a.rotTarget = DIR_ROT[n.dir]; a.obj.visible = true;
    playAct(a, n.moving ? 'Walking_A' : 'Idle_A');
  }
  for (const [id, a] of actors) {
    if (!ids.has(id)) { a.obj.visible = false; continue; }
    if (a.rotTarget !== undefined) {
      let d = a.rotTarget - a.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      a.obj.rotation.y += d * Math.min(1, dt / 90);
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
  if (water) { water.material.map.offset.x = (T / 9000) % 1; water.material.map.offset.y = (T / 14000) % 1; }
  for (const f of falls) f.material.map.offset.y = (T / 700) % 1;
  // camera
  const interior = mapInfo.interior;
  const tx = interior ? mapInfo.w / 2 : px, tz = interior ? mapInfo.h / 2 + 0.6 : pz;
  const halfW = 4.2, halfTop = 3.5, halfBot = 4.5;
  const cx = interior ? tx : Math.max(halfW + 1, Math.min(mapInfo.w - halfW - 1, tx));
  const cz = interior ? tz : Math.max(halfTop + 1, Math.min(mapInfo.h - halfBot, tz));
  const goal = new THREE.Vector3(cx, 0, cz);
  if (!camInit) { camTarget.copy(goal); camInit = true; } else camTarget.lerp(goal, Math.min(1, dt / 160));
  const dist = interior ? 8.5 : 12.5;
  camera.position.set(camTarget.x, camTarget.y + dist * 0.82, camTarget.z + dist * 0.62);
  camera.lookAt(camTarget.x, 0, camTarget.z - 0.3);
  sun.position.set(camTarget.x - 6, 14, camTarget.z + 5); sun.target.position.copy(camTarget);
  // lights in caves / interiors
  playerLight.position.set(px, 1.6, pz + 0.3);
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
bSun.position.set(-5, 10, 6); bSun.castShadow = true; bSun.shadow.mapSize.set(1024, 1024); Object.assign(bSun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
battleScene.add(bHemi, bSun, bGlow);
let arena = null, arenaKind = '', bModels = [];
const ENEMY_MODEL = { slime: 'Slime', squirrel: 'Rat', wasp: 'Wasp', worm: 'Snake', mushroom: 'Frog', turtle: 'Spider', moth: 'Bat', ghost: 'Skeleton', wraith: 'Dragon' };
const ENEMY_H = { Slime: 1.0, Rat: 0.9, Wasp: 1.0, Snake: 1.25, Frog: 0.95, Spider: 0.95, Bat: 1.3, Skeleton: 1.7, Dragon: 3.2 };
const ENEMY_TINT = { wraith: 0x9a7ad8, ghost: 0xd8d0ff, moth: 0xc8b0ff };
function tintMonster(mo, shape) { const t = ENEMY_TINT[shape]; if (!t) return; mo.obj.traverse((o) => { if (o.isMesh) o.material.color.multiply(new THREE.Color(t)); }); }
function buildArena(kind) {
  if (arena && arenaKind === kind) return;
  dispose(arena); arena = new THREE.Group(); battleScene.add(arena); arenaKind = kind;
  const field = kind === 'field';
  const gm = new THREE.MeshStandardMaterial({ color: field ? 0x6fb04c : kind === 'boss' ? 0x3a3248 : 0x5a4e46, map: TEX.ground, roughness: 1 });
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(30, 48), gm); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; gnd.userData.own = true; arena.add(gnd);
  const trees = [], rocks = [], grass = [], flowers = [];
  for (let i = 0; i < 70; i++) {
    const a = hash(i, 3) * TAU, r = 7 + hash(i, 9) * 9, x = Math.cos(a) * r, z = Math.sin(a) * r - 5;
    if (z > 3) continue;
    (field ? trees : rocks).push({ x, z, r: hash(i, 5) * TAU, s: 0.9 + hash(i, 7) * 0.6 });
  }
  for (let i = 0; i < 160; i++) { const x = (hash(i, 11) - 0.5) * 22, z = (hash(i, 13) - 0.5) * 16 - 1; (i % 9 === 0 ? flowers : grass).push({ x, z, r: hash(i, 2) * TAU, s: 0.8 + hash(i, 4) * 0.6 }); }
  if (field) {
    const tk = ['nature/CommonTree_1', 'nature/CommonTree_2', 'nature/CommonTree_3', 'nature/Pine_2'];
    tk.forEach((k, j) => instances(arena, k, 3.4, 'h', trees.filter((_, i) => i % tk.length === j)));
    instances(arena, 'nature/Grass_Common_Short', 0.3, 'h', grass, { cast: false });
    instances(arena, 'nature/Flower_4_Group', 0.5, 'h', flowers, { cast: false });
    instances(arena, 'nature/Bush_Common_Flowers', 1.0, 'w', [{ x: -5.5, z: 1 }, { x: 6, z: 2.4 }, { x: -2, z: -4.5 }], {});
    battleScene.background = new THREE.Color(0xa8d8f0); battleScene.fog = new THREE.Fog(0xa8d8f0, 14, 32);
    bHemi.intensity = 1.2; bSun.intensity = 2.4; bGlow.intensity = 0;
  } else {
    instances(arena, 'nature/Rock_Medium_1', 2.4, 'w', rocks.filter((_, i) => i % 2), { tint: 0x8a80a0 });
    instances(arena, 'nature/Rock_Medium_3', 2.0, 'w', rocks.filter((_, i) => !(i % 2)), { tint: 0x8a80a0 });
    for (let i = 0; i < 6; i++) { const c = crystal(); c.position.set(-7 + i * 2.8, 0, -6 - hash(i, 1) * 3); c.scale.setScalar(1.6); arena.add(c); }
    battleScene.background = new THREE.Color(0x0a0812); battleScene.fog = new THREE.Fog(0x0a0812, 10, 24);
    bHemi.color.set(0x8a7ac8); bHemi.groundColor.set(0x1a1020); bHemi.intensity = 0.7; bSun.intensity = 1.0;
    bGlow.color.set(0x6af0ff); bGlow.position.set(-2, 3, -3); bGlow.intensity = 10;
    if (kind === 'boss') {
      const ring = new THREE.Group();
      for (let i = 0; i < 16; i++) { const s = place('nature/Pebble_Round_' + (i % 2 ? 1 : 3), 0.6, 'w'); s.position.set(Math.cos(i / 16 * TAU) * 1.9, 0, Math.sin(i / 16 * TAU) * 1.9); ring.add(s); }
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshStandardMaterial({ color: 0x5af0e0, emissive: 0x1aa890, emissiveIntensity: 1.1 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; pool.userData.own = true; ring.add(pool);
      ring.position.set(-2.4, 0, -1.6); arena.add(ring); bGlow.color.set(0x8affe8); bGlow.position.set(-2.4, 2, -1); bGlow.intensity = 16;
    }
  }
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function screenToGround(cam, sx, sy, out = new THREE.Vector3()) {
  ray.setFromCamera(new THREE.Vector2(sx / LW * 2 - 1, -(sy / LH * 2 - 1)), cam);
  ray.ray.intersectPlane(plane, out); return out;
}
function project(cam, x, y, z) { tmpV.set(x, y, z).project(cam); return { x: (tmpV.x + 1) / 2 * LW, y: (1 - tmpV.y) / 2 * LH, z: tmpV.z }; }
function battleStart(B, party, heroPos) {
  buildArena(B.bg);
  for (const m of bModels) m.obj.removeFromParent();
  bModels = [];
  for (const e of B.enemies) {
    const model = ENEMY_MODEL[e.d.shape] || 'Slime', hgt = ENEMY_H[model] * (e.d.boss ? 1 : 1);
    const mo = monsterObj(model, hgt); tintMonster(mo, e.d.shape);
    const p = screenToGround(battleCam, e.x, e.y); mo.obj.position.copy(p); mo.home = p.clone();
    mo.obj.rotation.y = Math.PI / 2 - 0.35;
    battleScene.add(mo.obj); e.m3 = mo; bModels.push(mo);
    // screen-space size for the 2D effects layer
    const top = project(battleCam, p.x, hgt, p.z), bot = project(battleCam, p.x, 0, p.z);
    const hpx = Math.max(10, bot.y - top.y);
    e.sz = { w: hpx * 0.9, h: hpx };
  }
  party.forEach((m, i) => {
    const c = CAST[m.id]; const a = makeActor(c[0], c[1], c[2]);
    const hp = heroPos(i), p = screenToGround(battleCam, hp.x, hp.y);
    a.obj.position.copy(p); a.home = p.clone(); a.obj.rotation.y = -Math.PI / 2 + 0.35; a.obj.scale.setScalar(1.05);
    battleScene.add(a.obj); m.__a3 = a; bModels.push(a);
  });
  const p0 = screenToGround(battleCam, heroPos(0).x, heroPos(0).y);
  const t = project(battleCam, p0.x, 1.12, p0.z), b = project(battleCam, p0.x, 0, p0.z);
  return { heroH: b.y - t.y };
}
function battleSync(dt, B, party, T) {
  for (const e of B.enemies) {
    const mo = e.m3; if (!mo) continue;
    const ox = (e.shake > 0 ? Math.sin(T / 14) * 0.06 : 0) + (e.lunge > 0 ? Math.sin((e.lunge / 300) * Math.PI) * 0.7 : 0);
    mo.obj.position.set(mo.home.x + ox, mo.home.y + (e.d.float ? 0.35 + Math.sin(T / 300 + mo.home.x) * 0.12 : 0), mo.home.z);
    if (e.lunge > 200 && mo.cur === 'idle') monPlay(mo, 'attack');
    if (e.flash > 0 && mo.cur === 'idle' && mo.actions.hit) monPlay(mo, 'hit');
    const fl = e.flash > 0 && Math.floor(e.flash / 60) % 2 === 0;
    mo.obj.traverse((o) => { if (o.isMesh && o.material.emissive) { o.material.emissive.setRGB(fl ? 0.9 : 0, fl ? 0.9 : 0, fl ? 0.9 : 0); } });
    if (!e.alive) {
      if (mo.cur !== 'death') monPlay(mo, 'death');
      mo.dieT = (mo.dieT || 0) + dt;
      if (mo.dieT > 700) { const k = Math.max(0, 1 - (mo.dieT - 700) / 400); mo.inner.scale.setScalar(k); }
    }
    mo.mixer.update(dt / 1000);
  }
  party.forEach((m, i) => {
    const a = m.__a3; if (!a) return;
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
function enemyScreen(e) { const p = e.m3 ? e.m3.obj.position : null; return p ? project(battleCam, p.x, 0, p.z) : null; }

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
  const c = CAST[who] || ['Rogue']; const a = makeActor(c[0], c[1], 1); a.mixer.update(0.4); s.add(a.obj); a.obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.obj), top = box.max.y;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 20); cam.position.set(0.25, top - 0.22, 1.35); cam.lookAt(0, top - 0.3, 0);
  pRenderer.render(s, cam);
  const out = document.createElement('canvas'); out.width = out.height = 76; out.getContext('2d').drawImage(pRenderer.domElement, 0, 0);
  const small = document.createElement('canvas'); small.width = small.height = 38; const sg = small.getContext('2d'); sg.imageSmoothingEnabled = true; sg.drawImage(out, 0, 0, 38, 38);
  small.big = out;
  portraitCache.set(who, small);
  return small;
}

// ------------------------------------------------------------------ public API
function render(kind) {
  if (!renderer) return;
  if (kind === 'battle') renderer.render(battleScene, battleCam);
  else renderer.render(scene, camera);
}
function pickTile(lx, ly) {
  const p = screenToGround(camera, lx, ly);
  if (!p || !mapInfo) return null;
  return { x: Math.floor(p.x), y: Math.floor(p.z) };
}
function toScreen(wx, wy, wz) { return project(camera, wx, wy, wz); }
function tileChanged(m, st) { if (mapInfo && m.id === mapInfo.id) { rebuildDynamic(m, st); setCaveLight(st); } }
function hideActors() { for (const a of actors.values()) a.obj.visible = false; }

window.W3D = { init, load, resize, buildMap, syncMap, render, pickTile, toScreen, tileChanged, resetCamera, battleStart, battleSync, battleEnd, enemyScreen, titleSync, portrait, hideActors, setCaveLight, ENEMY_MODEL };
window.__w3dReady && window.__w3dReady();
