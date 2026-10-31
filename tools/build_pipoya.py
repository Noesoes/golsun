#!/usr/bin/env python3
"""Copy the Pipoya art Rootwell uses into assets/pipoya.
Packs (free for personal and commercial use; no redistribution as standalone assets):
  - FREE RPG Tileset 32x32 by Pipoya:          https://pipoya.itch.io/pipoya-rpg-tileset-32x32
  - FREE RPG Character Sprites 32x32 by Pipoya: https://pipoya.itch.io/pipoya-free-rpg-character-sprites-32x32
Buildings are cut out of the tileset's own sample map.

Usage: python3 tools/build_pipoya.py <"Pipoya RPG Tileset 32x32" dir> <"PIPOYA FREE RPG Character Sprites 32x32" dir>
"""
import os, sys, shutil
from PIL import Image

TS_DIR, CH_DIR = sys.argv[1], sys.argv[2]
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'pipoya')
if os.path.isdir(DST): shutil.rmtree(DST)
os.makedirs(DST + '/chars'); os.makedirs(DST + '/houses')

A = os.path.join(TS_DIR, '[A]_type2')
for name, f in {'grass': '[A]Grass1_pipo.png', 'path': '[A]Grass1-Dirt1_pipo.png', 'water': '[A]Water2_pipo.png', 'cavewater': '[A]Water1_pipo.png',
                'tallgrass': '[A]LongGrass_pipo.png', 'wallup': '[A]Wall-Up1_pipo.png', 'wallup2': '[A]Wall-Up2_pipo.png', 'dirt': '[A]Dirt1_pipo.png'}.items():
    Image.open(os.path.join(A, f)).convert('RGBA').save(f'{DST}/{name}.png')
Image.open(os.path.join(TS_DIR, '[Base]BaseChip_pipo.png')).convert('RGBA').save(f'{DST}/base.png', optimize=True)

world = Image.open(os.path.join(TS_DIR, 'SampleMap', 'samplemap.png')).convert('RGBA')
base = Image.open(f'{DST}/base.png')
HOUSES = {'cottage': (896, 544, 1152, 832), 'shop': (1152, 480, 1312, 832), 'forge': (256, 96, 480, 320),
          'inn': (1760, 1184, 1920, 1472), 'stone': (1408, 1248, 1600, 1472), 'stall': (32, 704, 192, 864)}
for k, b in HOUSES.items():
    im = world.crop(b)
    if k == 'inn':  # add the tileset's INN sign beside the door
        im.alpha_composite(base.crop((0, 83 * 32, 32, 84 * 32)), (0, 6 * 32 + 4))
    im.save(f'{DST}/houses/{k}.png')

CHARS = {'wren': 'Female/Female 08-2', 'bram': 'Male/Male 01-1', 'tamsin': 'Female/Female 13-3', 'gran': 'Female/Female 25-1',
         'pell': 'Male/Male 17-1', 'rosa': 'Female/Female 21-1', 'pip': 'Male/Male 13-2', 'ivy': 'Female/Female 22-1',
         'marta': 'Female/Female 14-1', 'dorrit': 'Male/Male 12-1', 'odo': 'Male/Male 04-1'}
for k, f in CHARS.items(): shutil.copyfile(os.path.join(CH_DIR, f + '.png'), f'{DST}/chars/{k}.png')
total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(DST) for f in fs)
print('pipoya assets: %.2f MB' % (total / 1e6))
