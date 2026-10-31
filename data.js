'use strict';
// ===================== Dawnbeacon — game data =====================
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const ELEM_COL = { terra: '#e0b050', flame: '#ff7a3a', gale: '#a8f07a', tide: '#5ab8ff', gloom: '#b070ff' };
const ELEM_NAME = { terra: 'Terra', flame: 'Flame', gale: 'Gale', tide: 'Tide', gloom: 'Gloom' };

const HEROES = {
  kai: {
    name: 'Kai', elem: 'terra', field: 'shove',
    look: { skin: '#f1c493', hair: '#7a4520', tunic: '#3d7a3a', pants: '#5a4630', accent: '#e6c34a', style: 'spiky', scarf: true },
    base: { hp: 34, ep: 12, atk: 11, def: 7, agi: 7 }, grow: { hp: 6.5, ep: 2.5, atk: 2.4, def: 1.6, agi: 1.2 },
    arts: [['quake', 1], ['mend', 1], ['spire', 4], ['monolith', 7]],
  },
  lyra: {
    name: 'Lyra', elem: 'flame', field: 'kindle',
    look: { skin: '#f6d0a8', hair: '#c8402a', tunic: '#7a3a8a', pants: '#3a2a4a', accent: '#ffb040', style: 'long' },
    base: { hp: 28, ep: 18, atk: 9, def: 5, agi: 10 }, grow: { hp: 5.5, ep: 3.5, atk: 1.9, def: 1.3, agi: 1.6 },
    arts: [['flare', 1], ['rally', 2], ['blaze', 3], ['inferno', 6]],
  },
  fen: {
    name: 'Fen', elem: 'tide', field: 'chill',
    look: { skin: '#d9a878', hair: '#2a4a8a', tunic: '#2a8a9a', pants: '#2a3a5a', accent: '#e0f0ff', style: 'short' },
    base: { hp: 30, ep: 16, atk: 9, def: 6, agi: 8 }, grow: { hp: 6, ep: 3.2, atk: 2, def: 1.5, agi: 1.3 },
    arts: [['frost', 1], ['restore', 1], ['wellspring', 4], ['renewal', 5], ['glacier', 6]],
  },
};

const ARTS = {
  quake: { name: 'Quake', elem: 'terra', ep: 4, type: 'dmg', target: 'allEnemies', power: 14, desc: 'Terra: shake the earth under all foes.' },
  mend: { name: 'Mend', elem: 'terra', ep: 3, type: 'heal', target: 'ally', power: 32, desc: 'Restore about 32 HP to one ally.' },
  spire: { name: 'Stone Spire', elem: 'terra', ep: 6, type: 'dmg', target: 'enemy', power: 44, desc: 'Terra: impale one foe on a stone spike.' },
  monolith: { name: 'Monolith', elem: 'terra', ep: 11, type: 'dmg', target: 'allEnemies', power: 46, desc: 'Terra: crush all foes under falling stone.' },
  flare: { name: 'Flare', elem: 'flame', ep: 3, type: 'dmg', target: 'enemy', power: 20, desc: 'Flame: scorch a single foe.' },
  rally: { name: 'Rally', elem: 'flame', ep: 5, type: 'buff', stat: 'atk', target: 'allAllies', desc: "Raise all allies' attack for 3 turns." },
  blaze: { name: 'Blaze', elem: 'flame', ep: 6, type: 'dmg', target: 'allEnemies', power: 22, desc: 'Flame: engulf all foes in fire.' },
  inferno: { name: 'Inferno', elem: 'flame', ep: 11, type: 'dmg', target: 'allEnemies', power: 48, desc: 'Flame: a towering firestorm.' },
  frost: { name: 'Frost', elem: 'tide', ep: 3, type: 'dmg', target: 'enemy', power: 20, desc: 'Tide: pierce one foe with ice.' },
  restore: { name: 'Restore', elem: 'tide', ep: 3, type: 'heal', target: 'ally', power: 40, desc: 'Restore about 40 HP to one ally.' },
  wellspring: { name: 'Wellspring', elem: 'tide', ep: 8, type: 'heal', target: 'allAllies', power: 34, desc: 'Restore about 34 HP to all allies.' },
  renewal: { name: 'Renewal', elem: 'tide', ep: 10, type: 'revive', target: 'deadAlly', desc: 'Revive a fallen ally with half HP.' },
  glacier: { name: 'Glacier', elem: 'tide', ep: 11, type: 'dmg', target: 'allEnemies', power: 46, desc: 'Tide: bury all foes under a glacier.' },
};

// Wisps: elemental spirits. Set on a hero they boost stats; unleash them in battle
// for a big effect, after which they rest for 2 rounds (and their boost is lost meanwhile).
const WISPS = {
  pebble: { name: 'Pebble', elem: 'terra', bonus: { hp: 8, def: 2 }, un: { name: 'Landslide', type: 'dmg', target: 'enemy', power: 42 } },
  cinder: { name: 'Cinder', elem: 'flame', bonus: { atk: 3, ep: 3 }, un: { name: 'Ember Rain', type: 'dmg', target: 'allEnemies', power: 28 } },
  zephyr: { name: 'Zephyr', elem: 'gale', bonus: { agi: 4, hp: 5 }, un: { name: 'Tailwind Ward', type: 'buff', stat: 'def', target: 'allAllies' } },
  droplet: { name: 'Droplet', elem: 'tide', bonus: { ep: 4, hp: 6 }, un: { name: 'Soothing Rain', type: 'heal', target: 'allAllies', power: 40 } },
};

const ITEMS = {
  herb: { name: 'Herb', price: 10, use: 'heal', power: 40, target: 'ally', desc: 'Restores 40 HP to one ally.' },
  tonic: { name: 'Spirit Tonic', price: 20, use: 'ep', power: 15, target: 'ally', desc: 'Restores 15 EP to one ally.' },
  plume: { name: 'Phoenix Plume', price: 60, use: 'revive', target: 'deadAlly', desc: 'Revives a fallen ally with half HP.' },
  sunberry: { name: 'Sunberry', price: 80, use: 'healAll', power: 60, target: 'allAllies', desc: 'Restores 60 HP to every ally.' },
  shortsword: { name: 'Short Sword', price: 70, slot: 'weapon', atk: 4 },
  longsword: { name: 'Longsword', price: 200, slot: 'weapon', atk: 9 },
  runeblade: { name: 'Rune Blade', price: 450, slot: 'weapon', atk: 15 },
  padded: { name: 'Padded Tunic', price: 50, slot: 'armor', def: 3 },
  chain: { name: 'Chain Vest', price: 180, slot: 'armor', def: 7 },
  robe: { name: 'Mystic Mail', price: 420, slot: 'armor', def: 11 },
};
const SHOP_LIST = ['herb', 'tonic', 'plume', 'shortsword', 'padded', 'longsword', 'chain', 'runeblade', 'robe'];

const ENEMIES = {
  slime: { name: 'Dew Slime', shape: 'slime', color: '#5ac0e8', hp: 20, atk: 8, def: 3, agi: 5, xp: 8, gold: 4, weak: 'flame', resist: 'tide', h: 24 },
  bat: { name: 'Duskwing', shape: 'bat', color: '#7a5aa8', hp: 16, atk: 10, def: 2, agi: 13, xp: 9, gold: 5, weak: 'terra', resist: 'gale', h: 36, float: true },
  hopper: { name: 'Scythe Hopper', shape: 'bug', color: '#7ab040', hp: 30, atk: 12, def: 5, agi: 9, xp: 13, gold: 8, weak: 'flame', h: 30 },
  mole: { name: 'Burrow Mole', shape: 'mole', color: '#a07850', hp: 36, atk: 13, def: 8, agi: 4, xp: 16, gold: 10, weak: 'tide', resist: 'terra', h: 28,
    arts: [{ name: 'Mud Toss', elem: 'terra', power: 12, target: 'one', chance: 0.3 }] },
  cavebat: { name: 'Gloom Bat', shape: 'bat', color: '#4a3a6a', hp: 34, atk: 17, def: 6, agi: 15, xp: 20, gold: 12, weak: 'terra', h: 36, float: true,
    arts: [{ name: 'Screech', elem: 'gale', power: 10, target: 'all', chance: 0.2 }] },
  golem: { name: 'Clay Golem', shape: 'golem', color: '#b0785a', hp: 80, atk: 21, def: 15, agi: 3, xp: 36, gold: 24, weak: 'tide', resist: 'terra', h: 46,
    arts: [{ name: 'Rock Slam', elem: 'terra', power: 26, target: 'one', chance: 0.25 }] },
  lantern: { name: 'Wraith Lantern', shape: 'lantern', color: '#ffcf60', hp: 46, atk: 15, def: 9, agi: 11, xp: 26, gold: 18, weak: 'tide', resist: 'flame', h: 42, float: true,
    arts: [{ name: 'Wisp Fire', elem: 'flame', power: 14, target: 'all', chance: 0.35 }] },
  gloomwarden: { name: 'Gloomwarden', shape: 'boss', color: '#3a2350', hp: 500, atk: 26, def: 14, agi: 12, xp: 300, gold: 200, weak: 'flame', resist: 'tide', h: 72, boss: true, twice: true,
    arts: [{ name: 'Shadow Crush', elem: 'gloom', power: 34, target: 'one', chance: 0.3 }, { name: 'Umbral Wave', elem: 'gloom', power: 20, target: 'all', chance: 0.3 }] },
};

const ENCOUNTERS = {
  field: [['slime'], ['slime', 'slime'], ['bat'], ['bat', 'slime'], ['hopper'], ['hopper', 'slime'], ['mole'], ['slime', 'slime', 'bat'], ['bat', 'bat']],
  grotto: [['cavebat', 'cavebat'], ['golem'], ['lantern'], ['lantern', 'cavebat'], ['mole', 'cavebat'], ['golem', 'lantern'], ['cavebat', 'cavebat', 'cavebat'], ['lantern', 'lantern']],
};

// ---------- NPC looks ----------
const LOOKS = {
  elder: { skin: '#e8c09a', hair: '#e8e8e8', tunic: '#6a4a8a', pants: '#4a3a5a', accent: '#d0b060', style: 'long', beard: '#e8e8e8' },
  guard: { skin: '#e0b08a', hair: '#5a3a20', tunic: '#8a8a9a', pants: '#4a4a5a', accent: '#c03030', style: 'hat' },
  woman: { skin: '#f0c8a0', hair: '#a06030', tunic: '#c06080', pants: '#6a3050', accent: '#fff0c0', style: 'long' },
  kid: { skin: '#f4cca4', hair: '#e0a030', tunic: '#e05050', pants: '#3a4a8a', accent: '#ffffff', style: 'spiky' },
  oldman: { skin: '#e0b890', hair: '#c8c8c8', tunic: '#5a7a5a', pants: '#4a4030', accent: '#a08050', style: 'bald', beard: '#d8d8d8' },
  innkeeper: { skin: '#e8b890', hair: '#303030', tunic: '#c08040', pants: '#5a3a20', accent: '#ffffff', style: 'short' },
  shopkeeper: { skin: '#f0c49a', hair: '#704020', tunic: '#3060a0', pants: '#2a2a3a', accent: '#e0c040', style: 'hat' },
  traveler: { skin: '#d8a070', hair: '#402818', tunic: '#806040', pants: '#4a3a2a', accent: '#a03020', style: 'hat' },
};

// ---------- Maps ----------
// Tiles: . grass  f flowers  T tree  M cliff  ~ water  = path  | bridge  # cave wall  _ cave floor
// H wall  R roof  D door  W wood floor  K counter  b bed  Y shelf  X exit  v cave mouth
// B thornbush (Kindle)  O boulder (Shove)  P pit  p filled pit  o stepping stone  I ice (Chill)
// C chest  c open chest  S sign  r rock  L beacon
const MAPS = {
  village: {
    name: 'Brindlewood', ground: '.', music: 'village',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..f.......TT......f..TTT',
      'T..RRRRR..........RRRRR..T',
      'T..RRRRR....f.....RRRRR..T',
      'T..HHDHH..........HHDHH..T',
      'T....=..............=....T',
      'T....================....T',
      'T.f.........=............T',
      'T...........=............T',
      'T...........==============',
      'T..RRRRR....=......~~~S..T',
      'T..RRRRR....=......~~~...T',
      'T..HHDHH....=.f....~~~...T',
      'T....=......=............T',
      'T.f..=============....f..T',
      'T..f.........T.....f.....T',
      'TT.....TT........TTT...TTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 5, y: 4, to: 'elder', tx: 4, ty: 6, dir: 'up' },
      { x: 20, y: 4, to: 'inn', tx: 4, ty: 6, dir: 'up' },
      { x: 5, y: 12, to: 'shop', tx: 4, ty: 6, dir: 'up' },
      { x: 25, y: 9, to: 'field', tx: 1, ty: 11, dir: 'right' },
    ],
    signs: { '22,10': 'East: Windmere Fields.\nBeyond them, in the northern cliffs: Whisper Grotto.' },
    wisps: [{ id: 'pebble', x: 24, y: 15 }],
    npcs: [
      { id: 'guard1', x: 24, y: 9, look: 'guard', dir: 'left', cond: () => !state.flags.metElder,
        talk: async () => { await say("Sorry, Kai. Elder Maren asked to see you two before anyone leaves the village. Her house is in the northwest.", 'Guard'); } },
      { id: 'guard2', x: 24, y: 8, look: 'guard', dir: 'down', cond: () => state.flags.metElder,
        talk: async () => {
          if (state.flags.bossDead) await say("The Beacon shines again! I can finally get some sleep on watch.", 'Guard');
          else await say("Monsters lurk in the tall grass out there. If you get hurt, rest at the inn. And don't forget the shop!", 'Guard');
        } },
      { id: 'woman', x: 17, y: 11, look: 'woman', wander: true,
        talk: async () => {
          if (state.flags.bossDead) await say("The pond glows again at night! Just like when I was a girl.", 'Villager');
          else await say("The pond used to shimmer with light from the Beacon every night. Now it's just... dark.", 'Villager');
        } },
      { id: 'kid', x: 15, y: 15, look: 'kid', wander: true,
        talk: async () => {
          if (state.wisps.pebble) await say("You found the glowy critter! Lucky!", 'Pip');
          else await say("I saw a glowing little critter hiding by the trees in the southeast corner! It hummed like a rock. Go look!", 'Pip');
        } },
      { id: 'oldman', x: 10, y: 7, look: 'oldman',
        talk: async () => {
          await say("Wisps are tiny spirits of the elements. Set on a hero, a Wisp lends its strength.", 'Old Tobin');
          await say("In battle you can unleash a Wisp for a mighty effect! It needs a couple of turns to recover afterward, though.", 'Old Tobin');
          await say("Use the Wisps page of the menu to choose who each Wisp travels with.", 'Old Tobin');
        } },
    ],
    onEnter: async () => {
      if (!state.flags.intro) {
        state.flags.intro = true;
        await say("Kai! There you are. Elder Maren sent for us. She said it's urgent!", 'Lyra');
        await say("Her house is the one in the northwest, with the red roof. Let's hurry!", 'Lyra');
        await say("(Move with the D-pad. Press A to talk and examine. Hold B to run.)");
      }
    },
  },

  elder: {
    name: "Elder's House", ground: 'W', music: 'village', interior: true,
    rows: ['HHHHHHHHHH', 'HYYWWWWWbH', 'HWWWWWWWWH', 'HWWWWWWWWH', 'HWKKWWWWWH', 'HWWWWWWWWH', 'HWWWWWWWWH', 'HHHHXHHHHH'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 5, ty: 5, dir: 'down' }],
    npcs: [
      { id: 'elder', x: 6, y: 2, look: 'elder', dir: 'down',
        talk: async () => {
          const E = 'Elder Maren';
          if (!state.flags.metElder) {
            await say("Ah, Kai, Lyra. Thank you for coming so quickly.", E);
            await say("Three nights ago, the Dawnbeacon in Whisper Grotto went dark. For a hundred years its light has held back the Gloom.", E);
            await say("Without it, monsters roam the Windmere Fields. Our farmers dare not leave the village.", E);
            await say("You two are Attuned. Kai, Terra flows through you. You can Shove great boulders with a thought.", E);
            await say("Lyra, your Flame can Kindle even the thorniest brambles into ash.", E);
            await say("Please, journey northeast past the fields to the Grotto, and rekindle the Beacon.", E);
            await say("Take this. It isn't much, but it should help you prepare.", E);
            state.gold += 60; addItem('herb', 2); sfx('chest');
            await say("Received 60 gold and 2 Herbs!");
            await say("(Tip: press ✦ to use an Attunement power on whatever you're facing. Press ☰ for the menu, where you can also save.)");
            state.flags.metElder = true; syncNpcs();
          } else if (!state.flags.bossDead) {
            await say("The Grotto lies northeast, past the fields. Rest at the inn if you are weary. May the light guide you.", E);
          } else {
            await say("The Beacon shines again! Brindlewood owes you everything, children.", E);
          }
        } },
    ],
  },

  inn: {
    name: 'Mossy Kettle Inn', ground: 'W', music: 'village', interior: true,
    rows: ['HHHHHHHHHH', 'HbWWYYWWbH', 'HWWWWWWWWH', 'HWWKKKKWWH', 'HWWWWWWWWH', 'HWWWWWWWWH', 'HWWWWWWWWH', 'HHHHXHHHHH'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 20, ty: 5, dir: 'down' }],
    npcs: [{ id: 'inn', x: 4, y: 2, look: 'innkeeper', dir: 'down', talk: async () => innScript() }],
  },

  shop: {
    name: 'Tinker & Thyme', ground: 'W', music: 'village', interior: true,
    rows: ['HHHHHHHHHH', 'HYYYYYYYYH', 'HWWWWWWWWH', 'HWWKKKKWWH', 'HWWWWWWWWH', 'HWWWWWWWWH', 'HWWWWWWWWH', 'HHHHXHHHHH'],
    warps: [{ x: 4, y: 7, to: 'village', tx: 5, ty: 13, dir: 'down' }],
    npcs: [{ id: 'shopkeep', x: 4, y: 2, look: 'shopkeeper', dir: 'down',
      talk: async () => { await say("Welcome to Tinker & Thyme! Herbs, tonics, blades and armor. Have a look!", 'Shopkeeper'); await shopScript(); } }],
  },

  field: {
    name: 'Windmere Fields', ground: '.', music: 'field', enc: 'field', bg: 'field',
    rows: [
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'MMMMMMMMMMMMMMMM~~MMMMMMMMvMMMMM',
      'T.......T.......~~........=...TT',
      'T...f...........~~........=..f.T',
      'T..T............~~..T.....=..C.T',
      'T.......T.......~~........=....T',
      'T...............~~...T....=....T',
      'T....T..........~~........=..T.T',
      'T...............~~........=....T',
      'T.S.............~~........=....T',
      '================||===========..T',
      'T...............~~.......S.....T',
      'T.....T.........~~.............T',
      'T...............~~.............T',
      'T..TTTBTTT......~~.....TTTTBTT.T',
      'T..T.....T......~~.....T.....T.T',
      'T..T.....T......~~.....T.....T.T',
      'T..T.C...T......~~.....T..C..T.T',
      'T..T.....T......~~.....T.....T.T',
      'T..TTTTTTT......~~.....TTTTTTT.T',
      'TTTTTTTTTTTTTTTT~~TTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, y: 11, to: 'village', tx: 24, ty: 9, dir: 'left' },
      { x: 26, y: 2, to: 'grotto', tx: 11, ty: 24, dir: 'up' },
    ],
    signs: {
      '2,10': 'West: Brindlewood.\nNortheast: Whisper Grotto.',
      '25,12': 'Whisper Grotto: straight north.\nBeware, the Gloom stirs within.',
    },
    chests: { '29,5': { item: 'herb', n: 2 }, '5,18': { item: 'tonic', n: 2 }, '26,18': { item: 'plume', n: 1 } },
    wisps: [{ id: 'cinder', x: 7, y: 17 }],
    npcs: [
      { id: 'traveler', x: 19, y: 10, look: 'traveler', dir: 'left',
        talk: async () => {
          await say("This river used to freeze solid every winter. Folk say a Tide adept could freeze it at will.", 'Traveler');
          await say("See those thorny thickets to the south? Something's glinting behind them. Too bad nobody can get through...", 'Traveler');
        } },
    ],
    onEnter: async () => {
      if (!state.flags.fieldIntro) {
        state.flags.fieldIntro = true;
        await say("Windmere Fields... Watch the tall grass, Kai. Monsters could jump out anywhere.", 'Lyra');
        await say("And see those thorny thickets? My Kindle could burn right through them. Just face one and press ✦.", 'Lyra');
      }
    },
  },

  grotto: {
    name: 'Whisper Grotto', ground: '_', music: 'cave', enc: 'grotto', bg: 'cave', dark: true,
    rows: [
      '########################',
      '#######____L_____#######',
      '#######__________#######',
      '#######__________#######',
      '#######__________#######',
      '#~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~_~~~~~~~~~~~~~~~~~~~#',
      '#~~~~~~~~~~~~~~~~~~~~~~#',
      '#______________________#',
      '#######__________#######',
      '#____#___________#######',
      '#____O____________O_P__#',
      '#____#___________#######',
      '#######_________C#######',
      '###########_############',
      '###########_############',
      '###########P############',
      '###########_############',
      '###########O############',
      '#####______________#####',
      '####__C_____________####',
      '####__r_____________####',
      '####________________####',
      '#####______________#####',
      '##########____##########',
      '###########X############',
    ],
    warps: [{ x: 11, y: 25, to: 'field', tx: 26, ty: 3, dir: 'down' }],
    chests: { '6,20': { item: 'herb', n: 2 }, '16,13': { item: 'sunberry', n: 1 } },
    wisps: [{ id: 'zephyr', x: 3, y: 6 }, { id: 'droplet', x: 22, y: 11 }],
    npcs: [
      { id: 'fen', x: 2, y: 11, look: 'hero:fen', dir: 'right', cond: () => !state.flags.fenJoined, talk: async () => fenScript() },
      { id: 'boss', x: 11, y: 2, enemy: 'gloomwarden', dir: 'down', cond: () => !state.flags.bossDead,
        talk: async () => bossScript() },
    ],
    onEnter: async () => {
      if (!state.flags.grottoIntro) {
        state.flags.grottoIntro = true;
        await say("It's so dark in here... The Beacon must be at the very top.", 'Lyra');
        await say("Kai, that boulder up ahead is blocking the tunnel. Can you Shove it?", 'Lyra');
      }
    },
    onStep: (x, y) => (!state.flags.bossDead && y <= 4 ? bossScript : null),
    beacon: async () => {
      if (!state.flags.bossDead) { await say('The crystal is cold and dark.'); return; }
      if (state.flags.beaconLit) { await say('The Dawnbeacon blazes with warm, steady light.'); return; }
      await say("This is it, the Dawnbeacon. Together, everyone. Pour your Attunement into the crystal!", 'Lyra');
      sfx('magic'); state.flags.beaconLit = true;
      UI.flash = 1; await sleep(900); sfx('level');
      await say('The Dawnbeacon roars back to life!');
      await endingScene();
    },
  },
};
