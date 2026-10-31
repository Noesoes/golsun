# Rootwell: Song of Mossbell Vale

A cozy pixel-art adventure RPG that runs in your phone's browser and installs to your home screen like an app. It works offline once installed.

**Play it:** https://noesoes.github.io/golsun/

## The story

Mossbell Vale has always bloomed. Beneath the old hill, the **Rootwell** spring hums a quiet song, and wherever its water flows, flowers follow. Three days ago the humming stopped, and the petals began to turn gray.

You play as three friends:

- **Wren**, a young cartographer carrying her mother's gale gauntlet.
- **Bram**, a gentle blacksmith with a forge lantern.
- **Tamsin**, a botanist from Larkspur College who studies the spring.

Together they travel through Windmere Fields and into Whisper Grotto to find out what silenced the spring.

## Features

- **Hand-drawn pixel art and music** from the free Ninja Adventure pack: animated characters with portraits, monsters, a boss, auto-tiled terrain, houses, cave lighting and effects, plus a real soundtrack.
- **Tool puzzles.** Wren's *Gust* blows boulders across the floor, even into pits. Bram's *Kindle* burns away brambles. Tamsin's *Lilypad* seeds grow pads you can walk across water on.
- **Side-view turn-based battles.** Use skills, items and Guard, and exploit Gale, Ember and Bloom weaknesses. Your party shares a **Harmony** gauge; when it's full, unleash a hero's **Burst** move.
- **Trinkets.** Four hidden charms with passive bonuses. Each hero can wear one.
- **Phone-friendly controls.** Tap anywhere to walk there, and tap people or objects to interact. You can also use the D-pad and buttons. Prompts show what you can interact with, and the A button's label changes to match (Talk, Open, Use...).
- **Quality of life.** A goal tracker, autosave whenever you change areas, "Try again" after losing a battle, an Auto-battle command, and settings for music, sound and text speed.

## Controls

| Touch       | Keyboard          | Action                                       |
|-------------|-------------------|----------------------------------------------|
| Tap screen  | –                 | Walk somewhere; tap people or things to interact |
| D-pad       | Arrows / WASD     | Move, choose menu options                    |
| **A**       | Z / Enter / Space | Talk, open, use a tool, confirm              |
| **B**       | X / Esc / Shift   | Back; hold to run                            |
| **✦ Tool**  | C / Q             | Use the right tool on what you're facing     |
| **☰ Menu**  | M / Tab           | Status, items, skills, Trinkets, settings, save |

## Installing on your phone

1. Open https://noesoes.github.io/golsun/ on your phone.
2. **iPhone:** in Safari, tap Share, then **Add to Home Screen**.
   **Android:** in Chrome, tap ⋮, then **Install app** (or **Add to Home screen**).
3. Launch Rootwell from the new icon. It opens full screen and works offline.

## Running locally

The game is plain HTML and JavaScript, with no build step:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

- `index.html`: page layout and touch controls
- `art.js`: loads the sprite sheets and slices them into tiles, props, characters, portraits, enemies and effects
- `assets/`: the art and music used by the game (see credits below)
- `tools/build_assets.py`: copies the needed pieces out of the asset pack and converts the music
- `tools/build_monsters.py`: builds the battle monsters from the two monster packs
- `game.js`: engine (rendering, input, maps, battles, menus, audio)
- `data.js`: heroes, skills, Trinkets, items, enemies, maps and the story
- `sw.js`, `manifest.webmanifest`, `icon-*.png`: installable, offline-capable app (PWA)
- `fonts/`: [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans), licensed under the SIL Open Font License (see `fonts/OFL.txt`)

## Credits

- Art, music and jingles: [Ninja Adventure asset pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by Pixel-Boy and AAA, released under CC0.
- Battle monsters: [Pipoya Free RPG Monster Pack](https://pipoya.itch.io/free-rpg-monster-pack) and [Creature Collector 64x64](https://dadddydarko.itch.io/creature-collector-64x64-2d-various-creatures-with-different-themes) by dadddydarko.
- Font: Pixelify Sans, licensed under the SIL Open Font License.

Rootwell's world, characters, story and mechanics are original to this project.
