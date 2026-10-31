# Dawnbeacon

A pocket-sized elemental adventure RPG that runs in your phone's browser and installs to your home screen like an app. It works offline once installed.

You play Kai, Lyra and Fen, three young adepts attuned to the elements. Together you travel from the village of Brindlewood, across Windmere Fields and into Whisper Grotto to relight the Dawnbeacon and drive back the Gloom.

## Features

- **Elemental field powers for puzzles.** Kai's *Shove* pushes boulders, even into pits. Lyra's *Kindle* burns away thorn thickets. Fen's *Chill* freezes rivers into ice bridges.
- **Turn-based battles.** Each turn you can Fight, cast Arts (elemental spells), use items, Defend or Flee. Enemies have elemental weaknesses and resistances.
- **Wisps.** Four hidden elemental spirits to collect. Each one boosts the stats of the hero carrying it. In battle you can unleash a Wisp for a powerful effect, but it then rests for a couple of turns.
- **RPG basics.** Levels, new Arts, a shop, an inn, gear, treasure chests, a boss fight and an ending.
- **Original music and sound effects**, all generated live in the browser.
- **Saving.** Save from the menu at any time. Staying at the inn also saves.

## Controls

| Touch            | Keyboard            | Action                                  |
|------------------|---------------------|-----------------------------------------|
| D-pad            | Arrows / WASD       | Move, choose menu options               |
| **A**            | Z / Enter / Space   | Talk, examine, confirm                  |
| **B**            | X / Esc / Shift     | Cancel; hold to run                     |
| **✦ Power**      | C / Q               | Use an elemental power on what you face |
| **☰ Menu**       | M / Tab             | Party, items, Arts, Wisps, save, sound  |

You can also tap menu items and enemies directly on the screen.

## Installing on your phone

1. Open the game's URL in your phone's browser. See "Hosting" below for the URL.
2. **iPhone (Safari):** tap Share, then **Add to Home Screen**.
   **Android (Chrome):** tap ⋮, then **Install app** (or **Add to Home screen**).
3. Launch Dawnbeacon from the new home-screen icon. It opens full screen and works offline.

## Hosting (GitHub Pages)

This repository includes a workflow (`.github/workflows/pages.yml`) that publishes the game whenever `main` is updated.

1. On GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push or merge to `main`. The game will appear at `https://<your-username>.github.io/<repo-name>/`.

## Running locally

The game is plain HTML and JavaScript, with no build step:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

- `index.html`: page layout and on-screen touch controls
- `game.js`: engine (rendering, input, maps, battles, menus, audio)
- `data.js`: heroes, Arts, Wisps, items, enemies, maps and story scripts
- `sw.js`, `manifest.webmanifest`, `icon-*.png`: installable, offline-capable app (PWA)
