#!/usr/bin/env python3
"""Build Rootwell's battle monsters from two free packs:
  - Pipoya Free RPG Monster Pack (https://pipoya.itch.io/free-rpg-monster-pack)
  - Creature Collector 64x64 by dadddydarko (https://dadddydarko.itch.io/creature-collector-64x64-2d-various-creatures-with-different-themes)
Pipoya's painted monsters are downscaled and pixelated (hard alpha, reduced palette, 1px outline)
so they sit next to the pixel-art creatures.

Usage: python3 tools/build_monsters.py <Pipoya "non shade" dir> <"Static Creatures" dir>
"""
import os, sys
from PIL import Image

PIP, CRE = sys.argv[1], sys.argv[2]
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'monsters')
os.makedirs(DST, exist_ok=True)
for f in os.listdir(DST): os.remove(os.path.join(DST, f))

OUTLINE = (42, 30, 36, 255)
def pixelate(im, height):
    im = im.convert('RGBA'); im = im.crop(im.getbbox())
    w = max(1, round(im.width * height / im.height))
    im = im.resize((w, height), Image.LANCZOS)
    a = im.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    rgb = im.convert('RGB').quantize(colors=40, method=Image.Quantize.MEDIANCUT).convert('RGB')
    out = rgb.convert('RGBA'); out.putalpha(a)
    pad = Image.new('RGBA', (out.width + 2, out.height + 2), (0, 0, 0, 0)); pad.alpha_composite(out, (1, 1))
    px = pad.load(); W, H = pad.size
    edge = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] == 0 and any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for p in edge: px[p] = OUTLINE
    return pad

PIPOYA = {'slime': ('pipo-enemy009.png', 34), 'mushroom': ('pipo-enemy008.png', 50), 'ghost': ('pipo-enemy010.png', 50), 'wraith': ('pipo-enemy017.png', 104)}
for k, (f, h) in PIPOYA.items(): pixelate(Image.open(os.path.join(PIP, f)), h).save(os.path.join(DST, k + '.png'))

CREATURES = {'turtle': 'Forrest Turtle.png', 'moth': 'Glittering Moth 2.png', 'squirrel': 'Squirrel.png', 'wasp': 'Guy.png', 'worm': 'Would you love me if I was a worm.png'}
for k, f in CREATURES.items():
    im = Image.open(os.path.join(CRE, f)).convert('RGBA'); im.crop(im.getbbox()).save(os.path.join(DST, k + '.png'))
print('built', sorted(os.listdir(DST)))
