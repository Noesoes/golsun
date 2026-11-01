'use strict';
// ===================== Rootwell — game data & story =====================
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const ELEM_COL = { gale: '#8ff0c8', ember: '#ff9040', bloom: '#9ae86a', hush: '#c0a8f0' };
const ELEM_NAME = { gale: 'Gale', ember: 'Ember', bloom: 'Bloom', hush: 'Hush' };

// ---------- characters & classes ----------
// The four heroes keep their personality and field tool; their class decides stats, skills, Burst, passive and look.
const CHARS = {
  wren: { name: 'Wren', field: 'gust', bio: 'A young cartographer from Mossbell, carrying an heirloom gale gauntlet.', tint: 0xfff6ee },
  bram: { name: 'Bram', field: 'kindle', bio: 'The village blacksmith\'s apprentice, never without his forge lantern.', tint: 0xffe4cc },
  corin: { name: 'Corin', field: 'pick', bio: 'A courier for the Larkspur post, with a ring of skeleton keys.', tint: 0xe4ecff },
  tamsin: { name: 'Tamsin', field: 'bloom', bio: 'A botanist from Larkspur College who studies the Rootwell.', tint: 0xeaffea },
};
const CLASSES = {
  warden: { name: 'Warden', model: 'Knight', elem: 'bloom', blurb: 'A shield-bearer who draws enemy attacks and keeps friends standing.',
    passive: { name: 'Stalwart', desc: 'Takes 15% less damage.' },
    base: { hp: 42, fp: 11, atk: 10, def: 11, agi: 6 }, grow: { hp: 8, fp: 2.2, atk: 2.1, def: 2.3, agi: 0.9 },
    skills: [['shieldbash', 1], ['bulwark', 1], ['rally', 3], ['ironhide', 5], ['thornwall', 7]], burst: 'aegis' },
  berserker: { name: 'Berserker', model: 'Barbarian', elem: 'ember', blurb: 'Trades safety for raw power, and hits even harder when hurt.',
    passive: { name: 'Fury', desc: 'Deals 30% more damage while below half HP.' },
    base: { hp: 44, fp: 9, atk: 13, def: 7, agi: 7 }, grow: { hp: 8, fp: 1.7, atk: 2.8, def: 1.4, agi: 1.1 },
    skills: [['recklessblow', 1], ['cleave', 1], ['warcry', 3], ['bloodaxe', 5], ['inferno', 7]], burst: 'ragnarok' },
  mage: { name: 'Mage', model: 'Mage', elem: 'ember', blurb: 'Commands both fire and wind. Fragile, but devastating.',
    passive: { name: 'Arcane Flow', desc: 'Regains 2 FP at the end of every round.' },
    base: { hp: 26, fp: 22, atk: 8, def: 4, agi: 9 }, grow: { hp: 4.8, fp: 4.2, atk: 1.6, def: 1, agi: 1.4 },
    skills: [['firebolt', 1], ['galeblade', 1], ['flamewall', 3], ['cyclone', 5], ['meteor', 7]], burst: 'starfall' },
  rogue: { name: 'Rogue', model: 'Rogue', elem: 'gale', blurb: 'Quick and sly. Lands critical hits and steals from foes.',
    passive: { name: 'Opportunist', desc: 'Normal attacks are critical hits 25% of the time.' },
    base: { hp: 30, fp: 12, atk: 11, def: 6, agi: 14 }, grow: { hp: 5.5, fp: 2.4, atk: 2.3, def: 1.2, agi: 2.2 },
    skills: [['twinfang', 1], ['pilfer', 1], ['smokeveil', 3], ['shadowstrike', 5], ['galefan', 7]], burst: 'thousandcuts' },
  ranger: { name: 'Ranger', model: 'Ranger', elem: 'gale', blurb: 'A sharp-eyed archer who marks targets and patches wounds.',
    passive: { name: 'Keen Eye', desc: 'Sees every foe\'s weakness, and hits marked foes 25% harder.' },
    base: { hp: 32, fp: 14, atk: 11, def: 6, agi: 11 }, grow: { hp: 6, fp: 2.8, atk: 2.3, def: 1.3, agi: 1.7 },
    skills: [['aimedshot', 1], ['huntersmark', 1], ['dressing', 2], ['volley', 4], ['stormarrow', 7]], burst: 'skyfall' },
  druid: { name: 'Druid', model: 'Rogue_Hooded', elem: 'bloom', blurb: 'A healer who speaks with roots and petals.',
    passive: { name: 'Green Thumb', desc: 'Healing skills restore 25% more.' },
    base: { hp: 30, fp: 20, atk: 8, def: 6, agi: 9 }, grow: { hp: 5.4, fp: 4, atk: 1.7, def: 1.3, agi: 1.4 },
    skills: [['mendpetal', 1], ['thornsnare', 1], ['blossomrain', 3], ['regrowth', 4], ['reviveseed', 5], ['briarstorm', 7]], burst: 'verdant' },
};
const CLASS_ORDER = ['warden', 'berserker', 'mage', 'rogue', 'ranger', 'druid'];
const CLASS_ELEMS = { warden: ['bloom'], berserker: ['ember'], mage: ['ember', 'gale'], rogue: ['gale'], ranger: ['gale'], druid: ['bloom'] };
const CLASS_HEALS = { warden: 1, ranger: 1, druid: 2 };
// which classes suit each companion best (they never share a class with Wren or each other)
const CLASS_PREF = {
  bram: ['warden', 'berserker', 'ranger', 'rogue', 'mage', 'druid'],
  corin: ['rogue', 'ranger', 'berserker', 'mage', 'warden', 'druid'],
  tamsin: ['druid', 'mage', 'ranger', 'warden', 'rogue', 'berserker'],
};
function assignClasses(playerCls) {
  const pool = CLASS_ORDER.filter((c) => c !== playerCls), ids = ['bram', 'corin', 'tamsin'];
  let best = null, bestScore = -1;
  for (const a of pool) for (const b of pool) for (const c of pool) {
    if (a === b || b === c || a === c) continue;
    const pick = [a, b, c], all = [playerCls, ...pick];
    const els = new Set(all.flatMap((k) => CLASS_ELEMS[k]));
    const heal = all.reduce((n, k) => n + (CLASS_HEALS[k] || 0), 0);
    if (!(els.has('ember') && els.has('gale') && els.has('bloom')) || heal < 1) continue; // every party can exploit every weakness and heal
    const score = pick.reduce((n, k, i) => n + (6 - CLASS_PREF[ids[i]].indexOf(k)) * (i === 2 ? 1.1 : 1), 0) + heal;
    if (score > bestScore) { bestScore = score; best = pick; }
  }
  return { wren: playerCls, bram: best[0], corin: best[1], tamsin: best[2] };
}
// character creation: the hero's name and outfit colours
const OUTFITS = [{ name: 'Classic', tint: null }, { name: 'Ember', tint: 0xff8070 }, { name: 'Moss', tint: 0x90e070 }, { name: 'Tide', tint: 0x80a8ff }, { name: 'Dusk', tint: 0xc090ff }, { name: 'Honey', tint: 0xffd060 }];
let HERO = { name: 'Wren', outfit: 0 };
const HEROES = {};
function applyClasses(classes, hero) {
  if (hero) HERO = hero;
  for (const id in CHARS) {
    const k = classes[id], c = CLASSES[k], ch = CHARS[id], me = id === 'wren';
    HEROES[id] = { ...c, name: me ? HERO.name : ch.name, field: ch.field, bio: ch.bio, cls: k, role: c.name, look: { sheet: k + ':' + id + (me ? ':' + (HERO.outfit || 0) : '') } };
  }
}
applyClasses({ wren: 'ranger', bram: 'warden', corin: 'rogue', tamsin: 'druid' });

const SKILLS = {
  // Warden
  shieldbash: { name: 'Shield Bash', fp: 2, type: 'dmg', phys: true, target: 'enemy', power: 16, desc: 'Slam one foe with your shield.' },
  bulwark: { name: 'Bulwark', fp: 4, type: 'taunt', target: 'self', desc: 'Raise your shield: foes target you for 3 turns, and your defense rises.' },
  rally: { name: 'Rally', elem: 'bloom', fp: 6, type: 'heal', target: 'allAllies', power: 18, desc: 'Steady the party: heal everyone a little.' },
  ironhide: { name: 'Ironhide', elem: 'bloom', fp: 5, type: 'buff', stat: 'def', target: 'allAllies', desc: "Raise the whole party's defense for 3 turns." },
  thornwall: { name: 'Thornwall', elem: 'bloom', fp: 10, type: 'dmg', target: 'allEnemies', power: 40, desc: 'Bloom: a wall of thorns erupts under every foe.' },
  // Berserker
  recklessblow: { name: 'Reckless Blow', fp: 0, hpCost: 0.12, type: 'dmg', phys: true, target: 'enemy', power: 34, desc: 'A huge swing that costs 12% of your HP instead of FP.' },
  cleave: { name: 'Cleave', fp: 4, type: 'dmg', phys: true, target: 'allEnemies', power: 10, desc: 'One wide swing that hits every foe.' },
  warcry: { name: 'War Cry', elem: 'ember', fp: 5, type: 'buff', stat: 'atk', target: 'allAllies', desc: "Raise the whole party's attack for 3 turns." },
  bloodaxe: { name: 'Blood Axe', elem: 'ember', fp: 6, type: 'dmg', drain: true, target: 'enemy', power: 34, desc: 'Ember: a burning axe that heals you for half the damage.' },
  inferno: { name: 'Inferno', elem: 'ember', fp: 10, type: 'dmg', target: 'allEnemies', power: 44, desc: 'Ember: set the whole battlefield ablaze.' },
  // Mage
  firebolt: { name: 'Firebolt', elem: 'ember', fp: 3, type: 'dmg', target: 'enemy', power: 25, desc: 'Ember: hurl a bolt of fire at one foe.' },
  galeblade: { name: 'Gale Blade', elem: 'gale', fp: 3, type: 'dmg', target: 'enemy', power: 23, desc: 'Gale: slice one foe with a blade of wind.' },
  flamewall: { name: 'Flame Wall', elem: 'ember', fp: 6, type: 'dmg', target: 'allEnemies', power: 25, desc: 'Ember: a wall of fire sweeps all foes.' },
  cyclone: { name: 'Cyclone', elem: 'gale', fp: 6, type: 'dmg', target: 'allEnemies', power: 25, desc: 'Gale: a whirlwind strikes every foe.' },
  meteor: { name: 'Meteor', elem: 'ember', fp: 12, type: 'dmg', target: 'allEnemies', power: 54, desc: 'Ember: call down a falling star on every foe.' },
  // Rogue
  twinfang: { name: 'Twin Fang', fp: 3, type: 'dmg', phys: true, hits: 2, target: 'enemy', power: 10, desc: 'Strike one foe twice in a blink.' },
  pilfer: { name: 'Pilfer', fp: 2, type: 'dmg', phys: true, steal: true, target: 'enemy', power: 8, desc: 'Strike and swipe coins, or sometimes an item.' },
  smokeveil: { name: 'Smoke Veil', elem: 'gale', fp: 5, type: 'buff', stat: 'eva', target: 'allAllies', desc: 'Foes often miss the party for 3 turns.' },
  shadowstrike: { name: 'Shadowstrike', fp: 6, type: 'dmg', phys: true, crit: true, target: 'enemy', power: 30, desc: 'A strike from the shadows that always lands a critical hit.' },
  galefan: { name: 'Gale Fan', elem: 'gale', fp: 9, type: 'dmg', target: 'allEnemies', power: 40, desc: 'Gale: fling a fan of wind-blades at every foe.' },
  // Ranger
  aimedshot: { name: 'Aimed Shot', elem: 'gale', fp: 3, type: 'dmg', target: 'enemy', power: 26, desc: 'Gale: a carefully aimed, wind-guided arrow.' },
  huntersmark: { name: "Hunter's Mark", fp: 2, type: 'debuff', target: 'enemy', desc: 'Mark one foe: its defense drops for 3 turns.' },
  dressing: { name: 'Field Dressing', elem: 'bloom', fp: 4, type: 'heal', target: 'ally', power: 30, desc: 'Bandage one ally for about 30 HP.' },
  volley: { name: 'Volley', elem: 'gale', fp: 6, type: 'dmg', hits: 4, target: 'allEnemies', power: 15, desc: 'Gale: loose four arrows at random foes.' },
  stormarrow: { name: 'Storm Arrow', elem: 'gale', fp: 10, type: 'dmg', target: 'allEnemies', power: 44, desc: 'Gale: an arrow that bursts into a storm over all foes.' },
  // Druid
  mendpetal: { name: 'Mend Petal', elem: 'bloom', fp: 3, type: 'heal', target: 'ally', power: 36, desc: 'Heal one ally for about 36 HP.' },
  thornsnare: { name: 'Thornsnare', elem: 'bloom', fp: 3, type: 'dmg', target: 'enemy', power: 20, desc: 'Bloom: lash one foe with thorny vines.' },
  blossomrain: { name: 'Blossom Rain', elem: 'bloom', fp: 8, type: 'heal', target: 'allAllies', power: 30, desc: 'Heal every ally for about 30 HP.' },
  regrowth: { name: 'Regrowth', elem: 'bloom', fp: 7, type: 'regen', target: 'allAllies', desc: 'Every ally recovers 10% HP each round for 3 rounds.' },
  reviveseed: { name: 'Revive Seed', elem: 'bloom', fp: 10, type: 'revive', target: 'deadAlly', desc: 'Revive a fallen ally with half HP.' },
  briarstorm: { name: 'Briar Storm', elem: 'bloom', fp: 11, type: 'dmg', target: 'allEnemies', power: 44, desc: 'Bloom: a storm of briars hits all foes.' },
};
// Bursts: powerful moves that spend the party's full Harmony gauge.
const BURSTS = {
  aegis: { name: 'Aegis', elem: 'bloom', type: 'aegis', target: 'allAllies', desc: 'Heal every ally 40% and raise their defense for 3 turns.' },
  ragnarok: { name: 'Ragnarok', elem: 'ember', type: 'dmg', phys: true, target: 'allEnemies', power: 80, desc: 'A world-splitting blow of fire on every foe.' },
  starfall: { name: 'Starfall', elem: 'ember', type: 'dmg', target: 'allEnemies', power: 86, desc: 'Rain burning stars down on every foe.' },
  thousandcuts: { name: 'Thousand Cuts', elem: 'gale', type: 'dmg', phys: true, hits: 8, target: 'allEnemies', power: 20, desc: 'Eight lightning-fast strikes at random foes.' },
  skyfall: { name: 'Skyfall', elem: 'gale', type: 'dmg', target: 'allEnemies', power: 80, desc: 'A storm of arrows falls on every foe.' },
  verdant: { name: 'Verdant Chorus', elem: 'bloom', type: 'fullheal', target: 'allAllies', desc: 'Fully heal and revive the whole party.' },
};
// Trinkets: hidden charms. Each hero can wear one.
const TRINKETS = {
  foxbell: { name: 'Fox Bell', desc: 'AGI +6. Its jingle puts a spring in your step.', bonus: { agi: 6 } },
  thimble: { name: 'Ember Thimble', desc: 'Skills deal 20% more damage.', skillMul: 1.2 },
  owlquill: { name: 'Owl Quill', desc: 'Restores 2 FP at the end of each round.', fpRegen: 2 },
  mosslocket: { name: 'Moss Locket', desc: 'Restores 8% HP at the end of each round.', regen: 0.08 },
};

const ITEMS = {
  herb: { name: 'Herb', icon: 'herb', price: 10, use: 'heal', power: 40, target: 'ally', desc: 'Restores 40 HP to one ally.' },
  tea: { name: 'Focus Tea', icon: 'tonic', price: 20, use: 'fp', power: 15, target: 'ally', desc: 'Restores 15 FP to one ally.' },
  salts: { name: 'Smelling Salts', icon: 'plume', price: 60, use: 'revive', target: 'deadAlly', desc: 'Revives a fallen ally with half HP.' },
  sunberry: { name: 'Sunberry', icon: 'berry', price: 80, use: 'healAll', power: 60, target: 'allAllies', desc: 'Restores 60 HP to every ally.' },
  // weapons: six types, three tiers. Each class can wield certain types (see CLASS_WEAPONS).
  tinblade: { name: 'Tin Blade', icon: 'weapon', price: 70, slot: 'weapon', type: 'sword', tier: 1, atk: 4 },
  steelblade: { name: 'Steel Blade', icon: 'weapon', price: 200, slot: 'weapon', type: 'sword', tier: 2, atk: 9 },
  starsteel: { name: 'Starsteel Edge', icon: 'weapon', price: 450, slot: 'weapon', type: 'sword', tier: 3, atk: 15 },
  hatchet: { name: 'Hatchet', icon: 'weapon', price: 80, slot: 'weapon', type: 'axe', tier: 1, atk: 5 },
  waraxe: { name: 'War Axe', icon: 'weapon', price: 210, slot: 'weapon', type: 'axe', tier: 2, atk: 10 },
  emberaxe: { name: 'Emberbite Axe', icon: 'weapon', price: 470, slot: 'weapon', type: 'axe', tier: 3, atk: 16 },
  oakstaff: { name: 'Oak Staff', icon: 'weapon', price: 70, slot: 'weapon', type: 'staff', tier: 1, atk: 3, bonus: { fp: 4 }, note: 'FP +4' },
  willowstaff: { name: 'Willow Staff', icon: 'weapon', price: 200, slot: 'weapon', type: 'staff', tier: 2, atk: 7, bonus: { fp: 8 }, note: 'FP +8' },
  moonstaff: { name: 'Moonwood Staff', icon: 'weapon', price: 450, slot: 'weapon', type: 'staff', tier: 3, atk: 11, bonus: { fp: 14 }, note: 'FP +14' },
  irondagger: { name: 'Iron Dagger', icon: 'weapon', price: 70, slot: 'weapon', type: 'dagger', tier: 1, atk: 4, bonus: { agi: 2 }, note: 'AGI +2' },
  twindirks: { name: 'Twin Dirks', icon: 'weapon', price: 200, slot: 'weapon', type: 'dagger', tier: 2, atk: 8, bonus: { agi: 4 }, note: 'AGI +4' },
  shadowfang: { name: 'Shadowfang', icon: 'weapon', price: 450, slot: 'weapon', type: 'dagger', tier: 3, atk: 13, bonus: { agi: 6 }, note: 'AGI +6' },
  shortbow: { name: 'Shortbow', icon: 'weapon', price: 70, slot: 'weapon', type: 'bow', tier: 1, atk: 4 },
  yewbow: { name: 'Yew Bow', icon: 'weapon', price: 200, slot: 'weapon', type: 'bow', tier: 2, atk: 9 },
  galebow: { name: 'Galestring Bow', icon: 'weapon', price: 450, slot: 'weapon', type: 'bow', tier: 3, atk: 14, bonus: { agi: 2 }, note: 'AGI +2' },
  cudgel: { name: 'Ash Cudgel', icon: 'weapon', price: 70, slot: 'weapon', type: 'mace', tier: 1, atk: 4, bonus: { def: 1 }, note: 'DEF +1' },
  ironmace: { name: 'Iron Mace', icon: 'weapon', price: 200, slot: 'weapon', type: 'mace', tier: 2, atk: 9, bonus: { def: 2 }, note: 'DEF +2' },
  sunhammer: { name: 'Sunhammer', icon: 'weapon', price: 450, slot: 'weapon', type: 'mace', tier: 3, atk: 14, bonus: { def: 3 }, note: 'DEF +3' },
  // armor: anyone can wear it
  quilted: { name: 'Quilted Vest', icon: 'armor', price: 50, slot: 'armor', tier: 1, def: 3 },
  leather: { name: 'Leather Jerkin', icon: 'armor', price: 110, slot: 'armor', tier: 1, def: 5, bonus: { agi: 2 }, note: 'AGI +2' },
  chain: { name: 'Chain Vest', icon: 'armor', price: 180, slot: 'armor', tier: 2, def: 7 },
  mossmail: { name: 'Mossmail', icon: 'armor', price: 260, slot: 'armor', tier: 2, def: 8, bonus: { hp: 10 }, note: 'HP +10' },
  moonweave: { name: 'Moonweave Coat', icon: 'armor', price: 420, slot: 'armor', tier: 3, def: 11, bonus: { fp: 6 }, note: 'FP +6' },
  wardplate: { name: 'Wardplate', icon: 'armor', price: 480, slot: 'armor', tier: 3, def: 14 },
};
// Hollis's signature weapons: one per class, each with a little extra
const SIGNATURE = { warden: 'bastion', berserker: 'cleaver', mage: 'emberstaff', rogue: 'galedaggers', ranger: 'longbow', druid: 'briarstaff' };
Object.assign(ITEMS, {
  bastion: { name: 'Bastion Mace', icon: 'weapon', price: 300, slot: 'weapon', type: 'mace', tier: 4, atk: 10, cls: 'warden', bonus: { def: 4 }, note: 'DEF +4' },
  cleaver: { name: 'Cinder Cleaver', icon: 'weapon', price: 300, slot: 'weapon', type: 'axe', tier: 4, atk: 16, cls: 'berserker', note: 'the heaviest blade in the Vale' },
  emberstaff: { name: 'Emberwood Staff', icon: 'weapon', price: 300, slot: 'weapon', type: 'staff', tier: 4, atk: 8, cls: 'mage', bonus: { fp: 10 }, note: 'FP +10' },
  galedaggers: { name: 'Galewhisper Daggers', icon: 'weapon', price: 300, slot: 'weapon', type: 'dagger', tier: 4, atk: 12, cls: 'rogue', bonus: { agi: 5 }, note: 'AGI +5' },
  longbow: { name: 'Hawkeye Longbow', icon: 'weapon', price: 300, slot: 'weapon', type: 'bow', tier: 4, atk: 13, cls: 'ranger', bonus: { agi: 3 }, note: 'AGI +3' },
  briarstaff: { name: 'Briarheart Staff', icon: 'weapon', price: 300, slot: 'weapon', type: 'staff', tier: 4, atk: 9, cls: 'druid', bonus: { hp: 16 }, note: 'HP +16' },
});
const HONE_COST = [60, 140, 260], REINFORCE_COST = [50, 120, 220];
const WEAPON_TYPES = { sword: 'Sword', axe: 'Axe', staff: 'Staff', dagger: 'Dagger', bow: 'Bow', mace: 'Mace' };
const CLASS_WEAPONS = { warden: ['sword', 'mace'], berserker: ['axe', 'sword'], mage: ['staff'], rogue: ['dagger', 'sword'], ranger: ['bow', 'dagger'], druid: ['staff', 'mace'] };
const SHOP_STOCK = {
  supplies: ['herb', 'tea', 'salts'],
  weapons: ['tinblade', 'hatchet', 'oakstaff', 'irondagger', 'shortbow', 'cudgel', 'steelblade', 'waraxe', 'willowstaff', 'twindirks', 'yewbow', 'ironmace'],
  armor: ['quilted', 'leather', 'chain', 'mossmail'],
  late: ['starsteel', 'emberaxe', 'moonstaff', 'shadowfang', 'galebow', 'sunhammer', 'moonweave', 'wardplate'],
};

const ENEMIES = {
  puddle: { name: 'Puddlejelly', shape: 'slime', hp: 20, atk: 8, def: 3, agi: 5, xp: 8, gold: 4, weak: 'bloom', resist: 'ember' },
  burrbun: { name: 'Nutsnatcher', shape: 'squirrel', hp: 24, atk: 10, def: 4, agi: 9, xp: 10, gold: 6, weak: 'ember' },
  wasp: { name: 'Thistle Wasp', shape: 'wasp', hp: 18, atk: 11, def: 2, agi: 14, xp: 10, gold: 6, weak: 'gale', float: true },
  mudsnout: { name: 'Mud Adder', shape: 'worm', hp: 36, atk: 13, def: 8, agi: 4, xp: 16, gold: 10, weak: 'bloom', resist: 'gale',
    arts: [{ name: 'Mud Toss', elem: 'bloom', power: 12, target: 'one', chance: 0.3 }] },
  glowcap: { name: 'Glowtoad', shape: 'mushroom', hp: 44, atk: 15, def: 8, agi: 8, xp: 24, gold: 16, weak: 'ember', resist: 'bloom',
    arts: [{ name: 'Spore Puff', elem: 'bloom', power: 13, target: 'all', chance: 0.35 }] },
  shellback: { name: 'Cave Creeper', shape: 'turtle', hp: 78, atk: 20, def: 15, agi: 3, xp: 34, gold: 22, weak: 'bloom', resist: 'gale',
    arts: [{ name: 'Venom Bite', elem: 'hush', power: 26, target: 'one', chance: 0.25 }] },
  hushmoth: { name: 'Hushbat', shape: 'moth', hp: 34, atk: 16, def: 6, agi: 15, xp: 20, gold: 12, weak: 'gale', float: true,
    arts: [{ name: 'Silent Shriek', elem: 'hush', power: 10, target: 'all', chance: 0.25 }] },
  hushling: { name: 'Hushbones', shape: 'ghost', hp: 38, atk: 17, def: 7, agi: 12, xp: 24, gold: 14, weak: 'ember', resist: 'bloom', float: true,
    arts: [{ name: 'Chill Whisper', elem: 'hush', power: 14, target: 'one', chance: 0.3 }] },
  queen: { name: 'Hush Wyrm', shape: 'wraith', hp: 640, atk: 26, def: 14, agi: 12, xp: 300, gold: 200, weak: 'ember', resist: 'gale', boss: true, twice: true, float: true,
    arts: [{ name: 'Mournful Wail', elem: 'hush', power: 20, target: 'all', chance: 0.3 }, { name: 'Hush Drain', elem: 'hush', power: 32, target: 'one', chance: 0.3, drain: true }] },
};
const ENCOUNTERS = {
  field: [['puddle'], ['puddle', 'puddle'], ['burrbun'], ['wasp'], ['wasp', 'puddle'], ['burrbun', 'puddle'], ['mudsnout'], ['burrbun', 'burrbun'], ['wasp', 'wasp']],
  grotto: [['hushmoth', 'hushmoth'], ['shellback'], ['glowcap'], ['glowcap', 'hushmoth'], ['mudsnout', 'hushmoth'], ['shellback', 'glowcap'], ['hushmoth', 'hushmoth', 'hushmoth'], ['glowcap', 'glowcap'], ['hushling', 'hushmoth'], ['hushling']],
};

// ---------- people (dialog speakers & NPC looks) ----------
const PEOPLE = {
  wren: { get name() { return HEROES.wren.name; }, get look() { return HEROES.wren.look; } },
  bram: { name: 'Bram', get look() { return HEROES.bram.look; } },
  corin: { name: 'Corin', get look() { return HEROES.corin.look; } },
  tamsin: { name: 'Tamsin', get look() { return HEROES.tamsin.look; } },
  gran: { name: 'Gran Hesper', look: { sheet: 'gran' } },
  pell: { name: 'Pell', look: { sheet: 'pell' } },
  rosa: { name: 'Rosa', look: { sheet: 'rosa' } },
  pip: { name: 'Pip', look: { sheet: 'pip' } },
  ivy: { name: 'Ivy', look: { sheet: 'ivy' } },
  marta: { name: 'Marta', look: { sheet: 'marta' } },
  dorrit: { name: 'Dorrit', look: { sheet: 'dorrit' } },
  odo: { name: 'Odo', look: { sheet: 'odo' } },
  hollis: { name: 'Hollis', look: { sheet: 'hollis' } },
};

// ---------- maps ----------
// . grass  , flowers  " tall grass (encounters)  = path  ~ water  % lily pad  o stepping stone  | bridge
// T tree  t bush  M cliff  v cave mouth  R roof  H house wall  D door  F fence  b flower bed  l lamp
// u barrel  x crate  w well  S sign  Q interior wall  W wood floor  g rug  K counter  Y shelf  e bed  k table  q plant
// # cave wall  _ cave floor  z crystal  m mushrooms  r rock  P pit  p filled pit  O boulder  B bramble  C chest  c open chest
// L the Rootwell spring  X exit
const MAPS = {
  village: {
    name: 'Mossbell Village', ground: '.', music: 'village', ambient: 'leaves', outdoor: true,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..........................TT',
      'TT.HHHHH...........HHHHH....TT',
      'TTbHHHHH.FFF......bHHHHH.b..TT',
      'TT.HHHHH..,.t...,..HHHHH..t.TT',
      'TT.HHDHH.FFF.......HHHHH....TT',
      'TT...=...........b.HHDHH....TT',
      'TT...=..~~~..........=..HHHHTT',
      'TT..,=..~~~.l====l.t.=..HHHHTT',
      'TT...=..~~~..=w==....=..HHHHTT',
      'TT..,=....,..====....=.....STT',
      'TT============================',
      'TT.....=l.....=..,......,.l.TT',
      'TT.b...=.,.t..=.....t.......TT',
      'TT..HHH=......=....xu.....u.TT',
      'TT..HHH=b...HHHHHHH..HHHHH..TT',
      'TT..HHH=....HHHHHHH..HHHHH.tTT',
      'TT..HDH=...uHHHHHHH..HHHHH..TT',
      'TT...===.t.xHHHHHHH..HHHHH..TT',
      'TT...................HHHHH..TT',
      'TT....,....b.......b......b.TT',
      'TT.t..........,.......,.....TT',
      'TT..........................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 5, y: 6, to: 'gran', tx: 4, ty: 6, dir: 'up' },
      { x: 21, y: 7, to: 'inn', tx: 4, ty: 6, dir: 'up' },
      { x: 5, y: 18, to: 'shop', tx: 4, ty: 6, dir: 'up' },
      { x: 29, y: 12, to: 'field', tx: 1, ty: 11, dir: 'right' },
    ],
    houses: [{ x: 3, y: 3, w: 5, h: 4, kind: 'cottage', door: 5 }, { x: 19, y: 3, w: 5, h: 5, kind: 'inn', door: 21 }, { x: 4, y: 15, w: 3, h: 4, kind: 'shop', door: 5 }, { x: 12, y: 16, w: 7, h: 4, kind: 'market' },
      { x: 21, y: 16, w: 5, h: 5, kind: 'forge', door: 22, locked: "The forge door is shut to keep the heat in. Hollis the smith is out by the anvil." },
      { x: 24, y: 8, w: 4, h: 3, kind: 'mill', door: 26, locked: "The mill door is shut tight. A note on it reads: 'Gone to look at the gray flowers. Back soon! — Dorrit'" }],
    signs: { '27,11': 'East: Windmere Fields.\nBeyond them, in the cliffs: Whisper Grotto.' },
    trinkets: [{ id: 'foxbell', x: 26, y: 22 }],
    npcs: [
      { id: 'bram_v', x: 13, y: 13, who: 'bram', dir: 'left', cond: () => !state.flags.metGran && !state.flags.bramJoined,
        talk: async () => { await say("Gran's cottage is the red-roofed one up the path to the northwest. I'll meet you there!", 'bram'); } },
      { id: 'hollis', x: 24, y: 21, who: 'hollis', dir: 'down', talk: async () => smithScript() },
      { id: 'pell1', x: 28, y: 12, who: 'pell', dir: 'left', cond: () => !state.flags.metGran,
        talk: async () => { await say("Morning, Wren! Your gran was asking after you. Best go see her before you wander off. Her cottage is the red-roofed one to the northwest.", 'pell'); } },
      { id: 'pell2', x: 27, y: 13, who: 'pell', dir: 'left', cond: () => !!state.flags.metGran,
        talk: async () => {
          if (state.flags.bossDead) await say("The flowers are back! Never thought I'd be so happy to sneeze.", 'pell');
          else await say("The fields are crawling with critters lately. They hide in the tall grass, so stick to the path if you'd rather not fight.", 'pell');
        } },
      { id: 'rosa', x: 16, y: 13, who: 'rosa', wander: true,
        talk: async () => {
          if (state.flags.bossDead) await say("Look at my roses! Redder than they've ever been!", 'rosa');
          else await say("My roses went gray overnight. I keep watering them, but it's like the color just... drained away.", 'rosa');
        } },
      { id: 'pip', x: 9, y: 22, who: 'pip', wander: true,
        talk: async () => {
          if (state.trinkets.foxbell !== undefined) await say("You found the jingly bell! Does it make you faster? It makes ME faster just looking at it!", 'pip');
          else await say("I heard jingling in the southeast corner, past the forge! Like a little bell! Go look, go look!", 'pip');
        } },
      { id: 'ivy', x: 12, y: 14, who: 'ivy', dir: 'down',
        talk: async () => {
          await say("When friends fight side by side, their hearts fall into rhythm. In battle you'll feel it as Harmony.", 'ivy');
          await say("When the Harmony gauge is full, one of you can unleash a Burst. It's strong enough to turn any battle.", 'ivy');
          await say("And keep an eye out for Trinkets. They're little charms with a bit of magic in them. Each of you can wear one; check the menu.", 'ivy');
        } },
    ],
    onEnter: async () => {
      if (!state.flags.intro) {
        state.flags.intro = true;
        await say("Wren! There you are. Your gran's been looking for you all morning.", 'bram');
        await say("Something's wrong with the flowers. Even the bees won't leave their hives. Come on, her cottage is just up the path to the northwest!", 'bram');
        await say("(Move with the analog stick, or tap where you want to go. Press A, or tap people and things, to interact.)");
      }
    },
  },

  gran: {
    name: "Gran's Cottage", ground: 'W', music: 'village', interior: true,
    rows: ['QQQQQQQQQQ', 'QYYWWWWeWQ', 'QWWWggWWWQ', 'QqWkggWWWQ', 'QWWWggWWqQ', 'QWWWWWWWWQ', 'QWWWWWWWWQ', 'QQQQXQQQQQ'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 5, ty: 7, dir: 'down' }],
    npcs: [{ id: 'gran', x: 6, y: 3, who: 'gran', dir: 'down', talk: async () => granScript() },
      { id: 'bram_g', x: 3, y: 4, who: 'bram', dir: 'right', cond: () => !state.flags.bramJoined, talk: async () => granScript() }],
  },
  inn: {
    name: 'The Sleepy Kettle', ground: 'W', music: 'village', interior: true,
    rows: ['QQQQQQQQQQ', 'QYWWWWWWYQ', 'QWWWWWWWWQ', 'QWWKKKKWWQ', 'QWWWggWWWQ', 'QqWWggWWqQ', 'QWWWWWWWWQ', 'QQQQXQQQQQ'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 21, ty: 8, dir: 'down' }],
    npcs: [{ id: 'marta', x: 4, y: 2, who: 'marta', dir: 'down', talk: async () => innScript() }],
  },
  shop: {
    name: 'Tinker & Thyme', ground: 'W', music: 'village', interior: true,
    rows: ['QQQQQQQQQQ', 'QYYWWWWYYQ', 'QWWWWWWWWQ', 'QWWKKKKWWQ', 'QWWWggWWWQ', 'QuWWggWWxQ', 'QWWWWWWWWQ', 'QQQQXQQQQQ'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 5, ty: 19, dir: 'down' }],
    npcs: [{ id: 'dorrit', x: 4, y: 2, who: 'dorrit', dir: 'down',
      talk: async () => { await say("Welcome to Tinker & Thyme! Herbs, teas, blades and armor. Have a look!", 'dorrit'); await shopScript(); } }],
  },

  field: {
    name: 'Windmere Fields', ground: '.', music: 'field', enc: 'field', encTall: true, bg: 'field', ambient: 'petals', outdoor: true,
    rows: [
      'TMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMTT',
      'TMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMTT',
      'TMMMMMMMMMMMMMMM~~MMMMMMMMMvMMMMTT',
      'TT.T.J..T.....,.~~.........=....TT',
      'TT."""""""..T...~~r.""""...=...TTT',
      'T.."""""""......~~..""""."""""..TT',
      'T..""""""".r....~~.."""".""""".CTT',
      'T.."""""""....T.~~.T""""."""""..TT',
      'T...............~~..""""...=..T.TT',
      'T...r..""""..T..~~....T....=....TT',
      'T.S...."""".....~~..,......=..r.TT',
      '=======""""=====||==========....TT',
      'T......"""".....~~......T.S.....TT',
      'T....T."""".,...~~."""""""..."""TT',
      'T........."""""t~~."""""""..."""TT',
      'T..TTTBTTT""""".~~."""""""..,"""TT',
      'T..T.....T""""".~~."""""""..."""TT',
      'T..T.....T""""".~~t"""""""..."""TT',
      'T..T.C...T"""""t~~.....TTTBTTT""TT',
      'T..T.....T""""".~~...T.T.....T""TT',
      'T.TTTTTTTT......~~.....T...C.T""TT',
      'T...........T...~~.T..,T.....T..TT',
      'T.....,.......T.~~.....TTTTTTT..TT',
      'TTTTTTTTTTTTTTTT~~TTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, y: 11, to: 'village', tx: 28, ty: 12, dir: 'left' },
      { x: 27, y: 2, to: 'grotto', tx: 11, ty: 24, dir: 'up' },
    ],
    signs: {
      '2,10': 'West: Mossbell Village.\nNortheast: Whisper Grotto.',
      '26,12': 'Whisper Grotto: straight north.\nThe Rootwell spring rises within.',
    },
    chests: { '31,6': { item: 'gear:1' }, '5,18': { item: 'tea', n: 2 }, '27,20': { item: 'salts', n: 1 }, '5,3': { item: 'gear:3', locked: true } },
    trinkets: [{ id: 'thimble', x: 7, y: 17 }],
    onStep: (x, y) => (!state.flags.corinJoined && x >= 24 && y <= 10 ? corinScript : null),
    npcs: [
      { id: 'corin', x: 29, y: 9, who: 'corin', dir: 'left', cond: () => !state.flags.corinJoined, talk: async () => corinScript() },
      { id: 'odo', x: 21, y: 10, who: 'odo', dir: 'left',
        talk: async () => {
          await say("The river's too wide to wade and too cold to swim. I hear the botanists at Larkspur grow lily pads big enough to walk on. Wouldn't that be something?", 'odo');
          await say("Oh, and something shiny is hidden behind those thorny thickets down south. I'd need a torch to get through.", 'odo');
        } },
    ],
    onEnter: async () => {
      if (!state.flags.fieldIntro) {
        state.flags.fieldIntro = true;
        await say("Windmere Fields. Careful in the tall grass, Wren. That's where the critters hide.", 'bram');
        await say("And look, brambles over there. Your lantern could burn right through those.", 'wren');
        await say("Just point me at 'em. (Walk up to brambles and press A. Bram will Kindle them.)", 'bram');
      }
    },
  },

  grotto: {
    name: 'Whisper Grotto', ground: '_', music: 'cave', enc: 'grotto', bg: 'cave', dark: true, ambient: 'motes',
    rows: [
      '########################',
      '#######z___L____z#######',
      '#######__________#######',
      '#######__________#######',
      '#######m_________#######',
      '#~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~_~~~~~~~~~~~~~~~~~~~#',
      '#~~~~~~~~~~~~~~~~~~~~~~#',
      '#z____________________z#',
      '#######__________#######',
      '#____#___________#######',
      '#____O____________O_P__#',
      '#____#___________#######',
      '#######z________C#######',
      '###########_############',
      '###########_############',
      '###########P############',
      '###########_############',
      '###########O############',
      '#####z___________J_#####',
      '####__C_____________####',
      '####__r____________m####',
      '####________________####',
      '#####______________#####',
      '##########____##########',
      '###########X############',
    ],
    warps: [{ x: 11, y: 25, to: 'field', tx: 27, ty: 3, dir: 'down' }],
    chests: { '6,20': { item: 'gear:2' }, '16,13': { item: 'sunberry', n: 1 }, '17,19': { item: 'gear:3', locked: true } },
    trinkets: [{ id: 'owlquill', x: 3, y: 6 }, { id: 'mosslocket', x: 22, y: 11 }],
    npcs: [
      { id: 'tamsin', x: 2, y: 11, who: 'tamsin', dir: 'right', cond: () => !state.flags.tamsinJoined, talk: async () => tamsinScript() },
      { id: 'queen', x: 11, y: 2, enemy: 'queen', dir: 'down', cond: () => !state.flags.bossDead, talk: async () => bossScript() },
    ],
    onEnter: async () => {
      if (!state.flags.grottoIntro) {
        state.flags.grottoIntro = true;
        await say("It's so quiet down here. Usually you can hear the Rootwell humming from the entrance.", 'wren');
        await say("There's a boulder blocking the tunnel up ahead. Give it a Gust, Wren!", 'bram');
      }
    },
    onStep: (x, y) => (!state.flags.bossDead && y <= 4 ? bossScript : null),
    spring: async () => {
      if (!state.flags.bossDead) { await say('The spring is still and gray. Not a ripple.'); return; }
      if (state.flags.springSings) { await say('The Rootwell bubbles and hums, bright as morning.'); return; }
      await say('Rootwell... please wake up.', 'wren');
      await say('Wren cups both hands into the water. A single clear note rises, then another, and another...');
      sfx('heal'); state.flags.springSings = true;
      UI.flash = 1; UI.flashCol = '#c8fff0'; await sleep(900); sfx('level');
      await endingScene();
    },
  },
};

// ---------- story scripts ----------
async function granScript() {
  if (!state.flags.metGran) {
    await say("Oh, Wren. And Bram, too. Come in, both of you.", 'gran');
    await say("You've seen the flowers. Gray as ash, every one. In sixty years I've never known the Rootwell to fall silent.", 'gran');
    await say("Something is wrong down in Whisper Grotto, where the spring rises. Someone needs to go and look.", 'gran');
    await say("We'll go, Gran.", 'wren');
    await say("I thought you might say that. Then take this. It's your mother's old gale gauntlet. One good gust from it will push a boulder like a pebble.", 'gran');
    sfx('chest');
    await say("Wren received the Gale Gauntlet! (Face a boulder and press A, or ✦, to Gust it.)");
    await say("And I've got my forge lantern. Brambles, meet fire. You're not going alone, Wren.", 'bram');
    await joinParty('bram');
    await say("(Bram can Kindle brambles with his lantern. Each hero's class gives them their own skills in battle; check them in the menu.)");
    await say("Here's a little coin and some herbs for the road. The grotto is east, past Windmere Fields. Come home safe, you two.", 'gran');
    state.gold += 60; addItem('herb', 2); sfx('chest');
    await say('Received 60 coins and 2 Herbs!');
    state.flags.metGran = true; syncNpcs(); goalChanged();
  } else if (!state.flags.bossDead) {
    await say("The grotto is east, past the fields. If you get hurt, Marta at the inn will look after you.", 'gran');
  } else {
    await say("Listen... can you hear it? The Rootwell is singing again. Oh, my brave ones.", 'gran');
  }
}
async function tamsinScript() {
  await say("Hello? Is someone there? Oh, thank goodness, light! And people!", 'tamsin', '???');
  await say("I'm Tamsin, a botanist from Larkspur College. I came to take samples from the Rootwell, but a rockslide boxed me in.", 'tamsin');
  await say("Strange gray bats have been swarming toward the spring for days, and the air down here has gone so cold. Something is feeding on the spring's song.", 'tamsin');
  await say("We're heading there now. Come with us?", 'wren');
  await say("Gladly! And I can help: my lilypad seeds grow pads big enough to walk on. That underground river won't stop us!", 'tamsin');
  await joinParty('tamsin');
  await say('(Face the river and press A to plant lily pads across it.)');
}
async function joinParty(id) {
  const lv = Math.max(...state.party.map((m) => m.lv));
  state.party.push(makeMember(id, lv));
  state.flags[id + 'Joined'] = true;
  syncNpcs(); sfx('level'); goalChanged();
  const h = HEROES[id];
  await say(`${h.name} joined the party! ${h.name} is a ${h.role}. ${h.blurb}`);
}
async function corinScript() {
  if (state.flags.corinJoined) return;
  P.path = []; await sleep(200);
  await say('Hey! You there! A little help?!', 'corin', '???');
  await say("These wasps have been chasing me since the bridge, and they are NOT interested in negotiating!", 'corin', '???');
  const r = await fight(['wasp', 'wasp']);
  if (r !== 'win') return;
  await say("Phew. Thank you! I owe you one. Two, actually. Possibly three.", 'corin');
  await say("Corin Ashdown, courier for the Larkspur post. I was carrying letters to the college, but every road out of the Vale has gone gray and strange.", 'corin');
  await say("You're heading for Whisper Grotto? Then I'm coming. Couriers go where the trouble is. That's where the interesting letters come from.", 'corin');
  await joinParty('corin');
  await say("And these might come in handy: skeleton keys. There isn't a lock in the Vale I can't open. (Face a locked chest and press A.)", 'corin');
}
async function bossScript() {
  if (state.flags.bossDead) return;
  P.path = []; P.dir = 'up';
  await sleep(250);
  await say('A cold mist gathers over the spring, and slowly takes shape...');
  await say("A Hush Wyrm! That's what the bats were drawn to. It's drinking the spring's song!", 'tamsin');
  await say("Then let's give her something louder.", 'bram');
  const r = await fight(['queen'], { boss: true, bg: 'boss' });
  if (r === 'lose') return;
  state.flags.bossDead = true;
  syncNpcs(); goalChanged();
  await say('The Hush Wyrm unravels into thin gray mist.');
  await say("Look, a silver band, lying right where it vanished. Someone bound that creature here...", 'tamsin');
  await say("We can worry about that later. The spring!", 'wren');
}
function goalText() {
  const f = state.flags;
  if (!f.metGran) return "Visit Gran's cottage (northwest)";
  if (!f.grottoIntro) return f.corinJoined ? 'Head north to Whisper Grotto' : 'Go east through Windmere Fields to Whisper Grotto';
  if (!f.tamsinJoined) return 'Explore Whisper Grotto';
  if (!f.bossDead) return 'Cross the river and reach the Rootwell';
  if (!f.springSings) return 'Wake the Rootwell spring';
  const n = Object.keys(state.trinkets).length;
  return n < 4 ? `Free roam: find all Trinkets (${n}/4)` : 'You found everything. Thanks for playing!';
}
