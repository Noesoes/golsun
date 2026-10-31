'use strict';
// ===================== Rootwell — game data & story =====================
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const ELEM_COL = { gale: '#8ff0c8', ember: '#ff9040', bloom: '#9ae86a', hush: '#c0a8f0' };
const ELEM_NAME = { gale: 'Gale', ember: 'Ember', bloom: 'Bloom', hush: 'Hush' };

const HEROES = {
  wren: {
    name: 'Wren', elem: 'gale', field: 'gust', role: 'Cartographer',
    look: { sheet: 'Woman' },
    base: { hp: 32, fp: 14, atk: 10, def: 6, agi: 10 }, grow: { hp: 6, fp: 3, atk: 2.2, def: 1.4, agi: 1.6 },
    skills: [['gustedge', 1], ['tailwind', 2], ['cyclone', 3], ['galelance', 5], ['tempest', 7]], burst: 'skyrend',
  },
  bram: {
    name: 'Bram', elem: 'ember', field: 'kindle', role: 'Blacksmith',
    look: { sheet: 'Hunter' },
    base: { hp: 40, fp: 10, atk: 12, def: 8, agi: 6 }, grow: { hp: 7.5, fp: 2.2, atk: 2.6, def: 1.8, agi: 1 },
    skills: [['cinder', 1], ['firstaid', 1], ['ironhide', 2], ['flamewall', 3], ['forgeburst', 5]], burst: 'starforge',
  },
  tamsin: {
    name: 'Tamsin', elem: 'bloom', field: 'bloom', role: 'Botanist',
    look: { sheet: 'Cavegirl' },
    base: { hp: 28, fp: 18, atk: 8, def: 5, agi: 9 }, grow: { hp: 5.2, fp: 3.6, atk: 1.8, def: 1.2, agi: 1.4 },
    skills: [['mendpetal', 1], ['thornsnare', 1], ['blossomrain', 3], ['reviveseed', 4], ['briarstorm', 6]], burst: 'verdant',
  },
};

const SKILLS = {
  gustedge: { name: 'Gust Edge', elem: 'gale', fp: 3, type: 'dmg', target: 'enemy', power: 20, desc: 'Gale: slice one foe with a blade of wind.' },
  tailwind: { name: 'Tailwind', elem: 'gale', fp: 5, type: 'buff', stat: 'atk', target: 'allAllies', desc: "Raise the whole party's attack for 3 turns." },
  cyclone: { name: 'Cyclone', elem: 'gale', fp: 6, type: 'dmg', target: 'allEnemies', power: 22, desc: 'Gale: a whirlwind strikes every foe.' },
  galelance: { name: 'Gale Lance', elem: 'gale', fp: 7, type: 'dmg', target: 'enemy', power: 50, desc: 'Gale: a piercing spear of wind.' },
  tempest: { name: 'Tempest', elem: 'gale', fp: 11, type: 'dmg', target: 'allEnemies', power: 46, desc: 'Gale: summon a roaring storm on all foes.' },
  cinder: { name: 'Cinder Strike', elem: 'ember', fp: 3, type: 'dmg', target: 'enemy', power: 24, desc: 'Ember: a red-hot hammer blow.' },
  firstaid: { name: 'First Aid', elem: 'ember', fp: 3, type: 'heal', target: 'ally', power: 28, desc: 'Patch up one ally for about 28 HP.' },
  ironhide: { name: 'Ironhide', elem: 'ember', fp: 5, type: 'buff', stat: 'def', target: 'allAllies', desc: "Raise the whole party's defense for 3 turns." },
  flamewall: { name: 'Flame Wall', elem: 'ember', fp: 6, type: 'dmg', target: 'allEnemies', power: 22, desc: 'Ember: a wall of fire sweeps all foes.' },
  forgeburst: { name: 'Forge Burst', elem: 'ember', fp: 7, type: 'dmg', target: 'enemy', power: 56, desc: 'Ember: an explosive strike on one foe.' },
  mendpetal: { name: 'Mend Petal', elem: 'bloom', fp: 3, type: 'heal', target: 'ally', power: 38, desc: 'Heal one ally for about 38 HP.' },
  thornsnare: { name: 'Thornsnare', elem: 'bloom', fp: 3, type: 'dmg', target: 'enemy', power: 18, desc: 'Bloom: lash one foe with thorny vines.' },
  blossomrain: { name: 'Blossom Rain', elem: 'bloom', fp: 8, type: 'heal', target: 'allAllies', power: 32, desc: 'Heal every ally for about 32 HP.' },
  reviveseed: { name: 'Revive Seed', elem: 'bloom', fp: 10, type: 'revive', target: 'deadAlly', desc: 'Revive a fallen ally with half HP.' },
  briarstorm: { name: 'Briar Storm', elem: 'bloom', fp: 11, type: 'dmg', target: 'allEnemies', power: 44, desc: 'Bloom: a storm of briars hits all foes.' },
};
// Bursts: powerful moves that spend the party's full Harmony gauge.
const BURSTS = {
  skyrend: { name: 'Skyrend', elem: 'gale', type: 'dmg', target: 'allEnemies', power: 78, desc: 'Wren tears the sky open over every foe.' },
  starforge: { name: 'Starforge Hammer', elem: 'ember', type: 'dmg', target: 'enemy', power: 135, desc: 'Bram brings down a hammer of white-hot starmetal.' },
  verdant: { name: 'Verdant Chorus', elem: 'bloom', type: 'fullheal', target: 'allAllies', desc: 'Tamsin fully heals and revives the whole party.' },
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
  tinblade: { name: 'Tin Blade', icon: 'weapon', price: 70, slot: 'weapon', atk: 4 },
  steelblade: { name: 'Steel Blade', icon: 'weapon', price: 200, slot: 'weapon', atk: 9 },
  starsteel: { name: 'Starsteel Edge', icon: 'weapon', price: 450, slot: 'weapon', atk: 15 },
  quilted: { name: 'Quilted Vest', icon: 'armor', price: 50, slot: 'armor', def: 3 },
  chain: { name: 'Chain Vest', icon: 'armor', price: 180, slot: 'armor', def: 7 },
  moonweave: { name: 'Moonweave Coat', icon: 'armor', price: 420, slot: 'armor', def: 11 },
};
const SHOP_LIST = ['herb', 'tea', 'salts', 'tinblade', 'quilted', 'steelblade', 'chain', 'starsteel', 'moonweave'];

const ENEMIES = {
  puddle: { name: 'Puddlejelly', shape: 'slime', hp: 20, atk: 8, def: 3, agi: 5, xp: 8, gold: 4, weak: 'bloom', resist: 'ember' },
  burrbun: { name: 'Nutsnatcher', shape: 'squirrel', hp: 24, atk: 10, def: 4, agi: 9, xp: 10, gold: 6, weak: 'ember' },
  wasp: { name: 'Thistle Wasp', shape: 'wasp', hp: 18, atk: 11, def: 2, agi: 14, xp: 10, gold: 6, weak: 'gale', float: true },
  mudsnout: { name: 'Mudworm', shape: 'worm', hp: 36, atk: 13, def: 8, agi: 4, xp: 16, gold: 10, weak: 'bloom', resist: 'gale',
    arts: [{ name: 'Mud Toss', elem: 'bloom', power: 12, target: 'one', chance: 0.3 }] },
  glowcap: { name: 'Glowcap', shape: 'mushroom', hp: 44, atk: 15, def: 8, agi: 8, xp: 24, gold: 16, weak: 'ember', resist: 'bloom',
    arts: [{ name: 'Spore Puff', elem: 'bloom', power: 13, target: 'all', chance: 0.35 }] },
  shellback: { name: 'Shellback', shape: 'turtle', hp: 78, atk: 20, def: 15, agi: 3, xp: 34, gold: 22, weak: 'bloom', resist: 'gale',
    arts: [{ name: 'Shell Slam', elem: 'hush', power: 26, target: 'one', chance: 0.25 }] },
  hushmoth: { name: 'Hushmoth', shape: 'moth', hp: 34, atk: 16, def: 6, agi: 15, xp: 20, gold: 12, weak: 'gale', float: true,
    arts: [{ name: 'Silent Dust', elem: 'hush', power: 10, target: 'all', chance: 0.25 }] },
  hushling: { name: 'Hushling', shape: 'ghost', hp: 38, atk: 17, def: 7, agi: 12, xp: 24, gold: 14, weak: 'ember', resist: 'bloom', float: true,
    arts: [{ name: 'Chill Whisper', elem: 'hush', power: 14, target: 'one', chance: 0.3 }] },
  queen: { name: 'Hush Wraith', shape: 'wraith', hp: 520, atk: 26, def: 14, agi: 12, xp: 300, gold: 200, weak: 'ember', resist: 'gale', boss: true, twice: true, float: true,
    arts: [{ name: 'Mournful Wail', elem: 'hush', power: 20, target: 'all', chance: 0.3 }, { name: 'Hush Drain', elem: 'hush', power: 32, target: 'one', chance: 0.3, drain: true }] },
};
const ENCOUNTERS = {
  field: [['puddle'], ['puddle', 'puddle'], ['burrbun'], ['wasp'], ['wasp', 'puddle'], ['burrbun', 'puddle'], ['mudsnout'], ['burrbun', 'burrbun'], ['wasp', 'wasp']],
  grotto: [['hushmoth', 'hushmoth'], ['shellback'], ['glowcap'], ['glowcap', 'hushmoth'], ['mudsnout', 'hushmoth'], ['shellback', 'glowcap'], ['hushmoth', 'hushmoth', 'hushmoth'], ['glowcap', 'glowcap'], ['hushling', 'hushmoth'], ['hushling']],
};

// ---------- people (dialog speakers & NPC looks) ----------
const PEOPLE = {
  wren: { name: 'Wren', look: HEROES.wren.look },
  bram: { name: 'Bram', look: HEROES.bram.look },
  tamsin: { name: 'Tamsin', look: HEROES.tamsin.look },
  gran: { name: 'Gran Hesper', look: { sheet: 'OldWoman' } },
  pell: { name: 'Pell', look: { sheet: 'OldMan2' } },
  rosa: { name: 'Rosa', look: { sheet: 'Princess' } },
  pip: { name: 'Pip', look: { sheet: 'Boy' } },
  ivy: { name: 'Ivy', look: { sheet: 'SorcererOrange' } },
  marta: { name: 'Marta', look: { sheet: 'Villager4' } },
  dorrit: { name: 'Dorrit', look: { sheet: 'OldMan' } },
  odo: { name: 'Odo', look: { sheet: 'Inspector' } },
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
      'TTT.....T...TT..T.........TTTT',
      'TT.RRRR..FFF.......RRRR.....TT',
      'T..RRRR..F,F....,..RRRR.....TT',
      'T.bHDDHb.FFF......bHDDHb....TT',
      'T...==..............==.l....TT',
      'T...==================.....,TT',
      'T..,...l......=...........t.TT',
      'T.......~~~~.l=.w..,........TT',
      'TT..,...~~~~..=..........lS.TT',
      'TT......~~~~..================',
      'T.............=.............TT',
      'T..RRR...,..t.=l.,........,.TT',
      'T..RRR........=....RRR.RRR..TT',
      'T.bHDHbu......=....RRR.RRR..TT',
      'T...=..xu.....=...xHHHuHHHx.TT',
      'T.,.===========.............TT',
      'T..,........................TT',
      'T.....,.....,.....,.....,...TT',
      'TT..t..............t.......TTT',
      'TTT.......TT.....T........T.TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 4, y: 4, to: 'gran', tx: 4, ty: 6, dir: 'up' },
      { x: 5, y: 4, to: 'gran', tx: 4, ty: 6, dir: 'up' },
      { x: 20, y: 4, to: 'inn', tx: 4, ty: 6, dir: 'up' },
      { x: 21, y: 4, to: 'inn', tx: 4, ty: 6, dir: 'up' },
      { x: 4, y: 14, to: 'shop', tx: 4, ty: 6, dir: 'up' },
      { x: 29, y: 10, to: 'field', tx: 1, ty: 11, dir: 'right' },
    ],
    houses: [{ x: 3, y: 2, kind: 'cottage' }, { x: 19, y: 2, kind: 'inn' }, { x: 3, y: 12, kind: 'shop' }, { x: 19, y: 13, kind: 'forge' }, { x: 23, y: 13, kind: 'hut' }],
    signs: { '26,9': 'East: Windmere Fields.\nBeyond them, in the cliffs: Whisper Grotto.' },
    trinkets: [{ id: 'foxbell', x: 27, y: 18 }],
    npcs: [
      { id: 'pell1', x: 28, y: 10, who: 'pell', dir: 'left', cond: () => !state.flags.metGran,
        talk: async () => { await say("Morning, Wren! Your gran was asking after you. Best go see her before you wander off. Her cottage is up the path, northwest.", 'pell'); } },
      { id: 'pell2', x: 27, y: 11, who: 'pell', dir: 'left', cond: () => !!state.flags.metGran,
        talk: async () => {
          if (state.flags.bossDead) await say("The flowers are back! Never thought I'd be so happy to sneeze.", 'pell');
          else await say("The fields are crawling with critters lately. They hide in the tall grass, so stick to the path if you'd rather not fight.", 'pell');
        } },
      { id: 'rosa', x: 12, y: 11, who: 'rosa', wander: true,
        talk: async () => {
          if (state.flags.bossDead) await say("Look at my roses! Redder than they've ever been!", 'rosa');
          else await say("My roses went gray overnight. I keep watering them, but it's like the color just... drained away.", 'rosa');
        } },
      { id: 'pip', x: 18, y: 17, who: 'pip', wander: true,
        talk: async () => {
          if (state.trinkets.foxbell !== undefined) await say("You found the jingly bell! Does it make you faster? It makes ME faster just looking at it!", 'pip');
          else await say("I heard jingling by the big trees in the southeast corner! Like a little bell! Go look, go look!", 'pip');
        } },
      { id: 'ivy', x: 10, y: 7, who: 'ivy', dir: 'down',
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
        await say("(Move with the D-pad, or tap where you want to go. Press A, or tap people and things, to interact.)");
      }
    },
  },

  gran: {
    name: "Gran's Cottage", ground: 'W', music: 'village', interior: true,
    rows: ['QQQQQQQQQQ', 'QYYWWWWWYQ', 'QWWWggWWWQ', 'QqWkggWWWQ', 'QWWWggWWqQ', 'QWWWWWWWWQ', 'QWWWWWWWWQ', 'QQQQXQQQQQ'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 4, ty: 5, dir: 'down' }],
    npcs: [{ id: 'gran', x: 6, y: 3, who: 'gran', dir: 'down', talk: async () => granScript() }],
  },
  inn: {
    name: 'The Sleepy Kettle', ground: 'W', music: 'village', interior: true,
    rows: ['QQQQQQQQQQ', 'QYWWWWWWYQ', 'QWWWWWWWWQ', 'QWWKKKKWWQ', 'QWWWggWWWQ', 'QqWWggWWqQ', 'QWWWWWWWWQ', 'QQQQXQQQQQ'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 20, ty: 5, dir: 'down' }],
    npcs: [{ id: 'marta', x: 4, y: 2, who: 'marta', dir: 'down', talk: async () => innScript() }],
  },
  shop: {
    name: 'Tinker & Thyme', ground: 'W', music: 'village', interior: true,
    rows: ['QQQQQQQQQQ', 'QYYWWWWYYQ', 'QWWWWWWWWQ', 'QWWKKKKWWQ', 'QWWWggWWWQ', 'QuWWggWWxQ', 'QWWWWWWWWQ', 'QQQQXQQQQQ'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 4, ty: 15, dir: 'down' }],
    npcs: [{ id: 'dorrit', x: 4, y: 2, who: 'dorrit', dir: 'down',
      talk: async () => { await say("Welcome to Tinker & Thyme! Herbs, teas, blades and armor. Have a look!", 'dorrit'); await shopScript(); } }],
  },

  field: {
    name: 'Windmere Fields', ground: '.', music: 'field', enc: 'field', encTall: true, bg: 'field', ambient: 'petals', outdoor: true,
    rows: [
      'TMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMTT',
      'TMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMTT',
      'TMMMMMMMMMMMMMMM~~MMMMMMMMMvMMMMTT',
      'TT.T....T.....,.~~.........=....TT',
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
      { x: 0, y: 11, to: 'village', tx: 28, ty: 10, dir: 'left' },
      { x: 27, y: 2, to: 'grotto', tx: 11, ty: 24, dir: 'up' },
    ],
    signs: {
      '2,10': 'West: Mossbell Village.\nNortheast: Whisper Grotto.',
      '26,12': 'Whisper Grotto: straight north.\nThe Rootwell spring rises within.',
    },
    chests: { '31,6': { item: 'herb', n: 2 }, '5,18': { item: 'tea', n: 2 }, '27,20': { item: 'salts', n: 1 } },
    trinkets: [{ id: 'thimble', x: 7, y: 17 }],
    npcs: [
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
      '#####z_____________#####',
      '####__C_____________####',
      '####__r____________m####',
      '####________________####',
      '#####______________#####',
      '##########____##########',
      '###########X############',
    ],
    warps: [{ x: 11, y: 25, to: 'field', tx: 27, ty: 3, dir: 'down' }],
    chests: { '6,20': { item: 'herb', n: 2 }, '16,13': { item: 'sunberry', n: 1 } },
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
      await say('Wren cups her hands into the water. A single clear note rises, then another, and another...');
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
    await say("And I've got my forge lantern. Brambles, meet fire.", 'bram');
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
  await say("Strange gray moths have been swarming toward the spring for days, and the air down here has gone so cold. Something is feeding on the spring's song.", 'tamsin');
  await say("We're heading there now. Come with us?", 'wren');
  await say("Gladly! And I can help: my lilypad seeds grow pads big enough to walk on. That underground river won't stop us!", 'tamsin');
  const lv = Math.max(...state.party.map((m) => m.lv));
  state.party.push(makeMember('tamsin', lv));
  state.flags.tamsinJoined = true;
  syncNpcs(); sfx('level'); goalChanged();
  await say('Tamsin joined the party!');
  await say('(Face the river and press A to plant lily pads across it.)');
}
async function bossScript() {
  if (state.flags.bossDead) return;
  P.path = []; P.dir = 'up';
  await sleep(250);
  await say('A cold mist gathers over the spring, and slowly takes shape...');
  await say("A Hush Wraith! That's what the moths were drawn to. It's drinking the spring's song!", 'tamsin');
  await say("Then let's give her something louder.", 'bram');
  const r = await fight(['queen'], { boss: true, bg: 'boss' });
  if (r === 'lose') return;
  state.flags.bossDead = true;
  syncNpcs(); goalChanged();
  await say('The Hush Wraith unravels into thin gray mist.');
  await say("Look, a silver band, lying right where it vanished. Someone bound that creature here...", 'tamsin');
  await say("We can worry about that later. The spring!", 'wren');
}
function goalText() {
  const f = state.flags;
  if (!f.metGran) return "Visit Gran's cottage (northwest)";
  if (!f.grottoIntro) return 'Go east through Windmere Fields to Whisper Grotto';
  if (!f.tamsinJoined) return 'Explore Whisper Grotto';
  if (!f.bossDead) return 'Cross the river and reach the Rootwell';
  if (!f.springSings) return 'Wake the Rootwell spring';
  const n = Object.keys(state.trinkets).length;
  return n < 4 ? `Free roam: find all Trinkets (${n}/4)` : 'You found everything. Thanks for playing!';
}
