#!/usr/bin/env bash
# Build assets/3d/*.glb from the free CC0 3D packs used by Rootwell 3D.
# Needs: npm i @gltf-transform/cli fbx2gltf  (in $TOOLS), packs extracted under $SRC:
#   nature/  = Quaternius Stylized Nature MegaKit      https://quaternius.itch.io/stylized-nature-megakit
#   props/   = Quaternius Fantasy Props MegaKit        https://quaternius.itch.io/fantasy-props-megakit
#   adv/     = KayKit Character Pack: Adventurers      https://kaylousberg.itch.io/kaykit-adventurers
#   hex/     = KayKit Medieval Hexagon Pack            https://kaylousberg.itch.io/kaykit-medieval-hexagon
#   easy/, monsters/ = Quaternius Easy Enemies + LowPoly Animated Monsters (FBX, converted with FBX2glTF)
set -e
SRC=${SRC:-/tmp/3d}; TOOLS=${TOOLS:-/tmp/tools}
GT=$TOOLS/node_modules/.bin/gltf-transform
F2G=$TOOLS/node_modules/fbx2gltf/bin/Linux/FBX2glTF
OUT=$(cd "$(dirname "$0")/.." && pwd)/assets/3d
rm -rf "$OUT"; mkdir -p "$OUT"/{nature,props,chars,bld,mon}
opt() { $GT optimize "$1" "$2" --texture-compress webp --texture-size ${3:-512} --simplify false --join false --instance false --palette false >/dev/null 2>&1 || $GT copy "$1" "$2" >/dev/null; }
N=$SRC/nature/glTF
for m in CommonTree_1 CommonTree_2 CommonTree_3 CommonTree_4 CommonTree_5 Pine_1 Pine_2 Pine_3 Bush_Common Bush_Common_Flowers \
  Rock_Medium_1 Rock_Medium_2 Rock_Medium_3 Grass_Common_Short Grass_Common_Tall Grass_Wispy_Tall Flower_3_Group Flower_4_Group \
  Mushroom_Common Mushroom_Laetiporus Fern_1 Plant_1 Plant_7 Clover_1 Pebble_Round_1 Pebble_Round_3 RockPath_Round_Small_1 RockPath_Round_Wide DeadTree_2 TwistedTree_1; do
  opt "$N/$m.gltf" "$OUT/nature/$m.glb" 512; done
P=$(find "$SRC/props" -type d -path "*Exports/glTF" | head -1)
for m in Chest_Wood Bed_Twin1 Bookcase_2 Table_Large Chair_1 Stool Barrel Barrel_Apples Lantern_Wall Torch_Metal Anvil Cauldron Stall_Empty \
  Workbench Potion_1 Coin_Pile Shelf_Simple Banner_1 Crate_Wooden FarmCrate_Apple CandleStick_Stand Bench Vase_2 Pot_1; do
  opt "$P/$m.gltf" "$OUT/props/$m.glb" 256; done
A=$SRC/adv/KayKit_Adventurers_2.0_FREE
for m in Ranger Barbarian Mage Knight Rogue Rogue_Hooded; do $GT copy "$A/Characters/gltf/$m.glb" "$OUT/chars/$m.glb" >/dev/null; done
for m in Rig_Medium_General Rig_Medium_MovementBasic; do $GT copy "$A/Animations/gltf/Rig_Medium/$m.glb" "$OUT/chars/$m.glb" >/dev/null; done
H=$SRC/hex/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf
for m in home_A_red home_B_yellow tavern_blue market_green blacksmith_red well_blue windmill_yellow church_blue; do
  f=$(find "$H/buildings" -name "building_$m.gltf" | head -1); opt "$f" "$OUT/bld/$m.glb" 256; done
for m in barrel crate_A_big sack bucket_water flag_red tent wheelbarrow resource_lumber; do opt "$H/decoration/props/$m.gltf" "$OUT/bld/$m.glb" 256; done
for m in fence_wood_straight; do opt "$H/buildings/neutral/$m.gltf" "$OUT/bld/$m.glb" 256; done
for m in waterlily_A waterlily_B cloud_big; do opt "$H/decoration/nature/$m.gltf" "$OUT/bld/$m.glb" 256; done
mkdir -p /tmp/fbxconv
for f in "$SRC"/easy/*/FBX/*.fbx "$SRC"/monsters/FBX/*.fbx; do n=$(basename "$f" .fbx); $F2G -b -i "$f" -o /tmp/fbxconv/$n >/dev/null 2>&1; opt /tmp/fbxconv/$n.glb "$OUT/mon/$n.glb" 256; done
du -sh "$OUT"; find "$OUT" -name "*.glb" | wc -l
