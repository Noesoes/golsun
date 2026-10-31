#!/usr/bin/env python3
"""Add the "Pixel Art Top Down - Basic" pack by Cainos (free for commercial use) to assets/tiles,
and recolour the Ninja Adventure water edges so their grass matches Cainos grass.

Usage: python3 tools/build_cainos.py "/path/to/Pixel Art Top Down - Basic/Texture"
(run after tools/build_assets.py)
"""
import os, sys
from PIL import Image

SRC = sys.argv[1]
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'tiles')
for name, f in {'c_grass': 'TX Tileset Grass.png', 'c_stone': 'TX Tileset Stone Ground.png', 'c_wall': 'TX Tileset Wall.png',
                'c_plant': 'Extra/TX Plant with Shadow.png', 'c_props': 'Extra/TX Props with Shadow.png'}.items():
    Image.open(os.path.join(SRC, f)).convert('RGBA').save(os.path.join(DST, name + '.png'))

# --- recolour grass pixels in the Ninja Adventure lake tiles (cols 0-3, rows 6-9)
water = Image.open(os.path.join(DST, 'water.png')).convert('RGBA')
floor = Image.open(os.path.join(DST, 'floor.png')).convert('RGBA')
cgrass = Image.open(os.path.join(DST, 'c_grass.png')).convert('RGBA')
lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
ninja = sorted({floor.getpixel((x, y))[:3] for x in range(0, 80) for y in range(192, 208)}, key=lum)   # grass row 12
cains = sorted({cgrass.getpixel((x, y))[:3] for x in range(0, 128) for y in range(0, 128)}, key=lum)
def nearest_cainos(c):
    # map by relative brightness inside each palette
    i = ninja.index(c) / max(1, len(ninja) - 1)
    return cains[round(i * (len(cains) - 1))]
px = water.load()
greenish = lambda c: c[1] > c[2] + 25 and c[1] >= c[0] - 10
for y in range(6 * 16, 10 * 16):
    for x in range(0, 4 * 16):
        r, g, b, a = px[x, y]
        if not a: continue
        c = (r, g, b)
        if c in ninja: px[x, y] = nearest_cainos(c) + (a,)
        elif greenish(c):
            l = lum(c); best = min(cains, key=lambda k: abs(lum(k) - l)); px[x, y] = best + (a,)
water.save(os.path.join(DST, 'water_c.png'))
print('cainos tiles added; ninja grass colours', len(ninja), 'cainos', len(cains))
