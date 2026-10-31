#!/usr/bin/env python3
"""Copy the subset of the Ninja Adventure asset pack (CC0, by Pixel-Boy & AAA) that
Rootwell uses into ./assets, and convert audio to MP3.

Usage: python3 tools/build_assets.py "/path/to/Ninja Adventure - Asset Pack"
"""
import os, sys, shutil, subprocess, json
from PIL import Image

SRC = sys.argv[1]
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')
T = 'Backgrounds/Tilesets/'

def cp(src, dst):
    d = os.path.join(DST, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    shutil.copyfile(os.path.join(SRC, src), d)

def mp3(src, dst, br='64k', mono=False):
    d = os.path.join(DST, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(SRC, src), '-b:a', br]
    if mono: cmd += ['-ac', '1']
    subprocess.run(cmd + [d], check=True)

if os.path.isdir(DST): shutil.rmtree(DST)
tiles = {'floor': T + 'TilesetFloor.png', 'nature': T + 'TilesetNature.png', 'water': T + 'TilesetWater.png',
         'house': T + 'TilesetHouse.png', 'element': T + 'TilesetElement.png', 'detail': T + 'TilesetFloorDetail.png',
         'hole': T + 'TilesetHole.png', 'relief': T + 'TilesetRelief.png', 'ifloor': T + 'Interior/TilesetInteriorFloor.png',
         'wall': T + 'Interior/TilesetWallSimple.png'}
for k, v in tiles.items(): cp(v, f'tiles/{k}.png')

chars = ['Woman', 'Hunter', 'Cavegirl', 'OldWoman', 'OldMan2', 'Princess', 'Boy', 'SorcererOrange', 'Villager4', 'OldMan', 'Inspector']
for c in chars:
    cp(f'Actor/Character/{c}/SpriteSheet.png', f'chars/{c}.png')
    cp(f'Actor/Character/{c}/Faceset.png', f'faces/{c}.png')

monsters = ['Slime3', 'Racoon', 'Butterfly', 'Mole', 'Mushroom2', 'Mollusc2', 'ButterflyBlue', 'Spirit']
for m in monsters:
    d = f'Actor/Monster/{m}/'
    sheet = [f for f in os.listdir(os.path.join(SRC, d)) if f.endswith('.png') and 'Faceset' not in f][0]
    cp(d + sheet, f'monsters/{m}.png')
cp('Actor/Boss/GiantSpirit/Idle.png', 'monsters/GiantSpirit.png')

icons = {'herb': 'Items/Resource/Grass.png', 'tonic': 'Items/Food/TeaLeaf.png', 'plume': 'Items/Potion/LifePot.png',
         'berry': 'Items/Potion/Heart.png', 'weapon': 'Items/Weapons/Sword/Sprite.png', 'armor': 'Items/Resource/BarIron.png',
         'trinket': 'Items/Resource/GemYellow.png', 'gold': 'Items/Treasure/GoldCoin.png'}
for k, v in icons.items(): cp(v, f'icons/{k}.png')
cp('Items/Treasure/LittleTreasureChest.png', 'misc/chest.png')

fx = {'ember': 'FX/Elemental/Flam/SpriteSheet.png', 'bloom': 'FX/Elemental/Plant/SpriteSheet.png', 'gale': 'FX/Elemental/Thunder/SpriteSheet.png',
      'hush': 'FX/Magic/Spirit/SpriteSheet.png', 'smoke': 'FX/Smoke/SmokeCircular/SpriteSheet.png', 'heal': 'FX/Magic/Circle/SpriteSheetWhite.png',
      'slash': 'FX/Slash/SpriteSheetSlash01.png'}
for k, v in fx.items(): cp(v, f'fx/{k}.png')
for p in ['Leaf.png', 'LeafPink.png']: cp('FX/Particle/' + p, 'fx/' + p.lower())

ui = {'dialog': 'Ui/Dialog/DialogBox.png', 'faceframe': 'Ui/Dialog/FacesetBox.png', 'panel': 'Ui/Theme/Theme Wood/nine_path_panel_3.png',
      'panel_dark': 'Ui/Theme/Theme Wood/nine_path_panel.png', 'arrow': 'Ui/Arrow.png'}
for k, v in ui.items(): cp(v, f'ui/{k}.png')

music = {'title': '38 - Intro.ogg', 'village': '33 - Calm Village.ogg', 'field': '35 - Adventure.ogg', 'cave': '2 - The Cave.ogg',
         'battle': '17 - Fight.ogg', 'boss': '24 - Final Area.ogg', 'ending': '8 - End Theme.ogg'}
for k, v in music.items(): mp3('Audio/Musics/' + v, f'music/{k}.mp3', '64k')
jingles = {'victory': 'Jingles/Success1.wav', 'level': 'Jingles/LevelUp1.wav', 'gameover': 'Jingles/GameOver.wav'}
for k, v in jingles.items(): mp3('Audio/' + v, f'music/{k}.mp3', '64k')

# frame widths of FX sheets (frames are laid out horizontally)
meta = {}
for k in fx:
    im = Image.open(os.path.join(DST, f'fx/{k}.png')).convert('RGBA'); w, h = im.size
    best = 1
    for n in range(2, 17):
        if w % n: continue
        fw = w // n
        if all(all(im.getpixel((x * fw, y))[3] == 0 for y in range(h)) for x in range(1, n)): best = n
    meta[k] = {'frames': best, 'w': w // best, 'h': h}
FRAMES = {'ember': 8, 'bloom': 8, 'gale': 8, 'smoke': 8}  # sheets whose frames touch each other
for k, n in FRAMES.items():
    im = Image.open(os.path.join(DST, f'fx/{k}.png')); meta[k] = {'frames': n, 'w': im.width // n, 'h': im.height}
im = Image.open(os.path.join(DST, 'monsters/GiantSpirit.png')); meta['boss'] = {'frames': im.width // im.height, 'w': im.height, 'h': im.height}
json.dump(meta, open(os.path.join(DST, 'meta.json'), 'w'), indent=1)
print(json.dumps(meta))
total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(DST) for f in fs)
print('assets size: %.1f MB' % (total / 1e6))
