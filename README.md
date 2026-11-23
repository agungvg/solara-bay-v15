# Solara Bay — an open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/agungvg/solara-bay-v15/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/agungvg/solara-bay-v15/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game built for make.fun's **Make GTA 6** bounty
([gta6-01](https://make.fun/c/gta6-01)): a sun-soaked coastal city, eight
staged missions, a six-unit police wanted system, six weapons, a three-person
crew, a workshop economy, and a full map/stats meta screen — all running from
static files in desktop Chrome, no network requests.

## Play

```sh
node serve.ts        # then open http://localhost:8080 in desktop Chrome
```

- **W A S D** move / drive · **SHIFT** run · **SPACE** jump / handbrake
- **E** enter / exit car · **F** shoot · **R** reload · **1–6** weapons
- **Z X C V B** crew abilities · **TAB** / **M** map & stats · **L** day / sunset / night · **P** pause

## The city

Solara Bay has eight districts — Kumala Strand, Pasaru Market, Marina del Sol,
Downtown, Brisa Sound, Puerto Viejo, Malecon Celeste, Alto Vista — a beachfront
boulevard with palms, a marina yacht, Kumala Pier and its Ferris wheel, a night
market, traffic, scooters, a tank, a police helicopter with a searchlight, and
a jointed pedestrian crowd.

## Structure

- `game/index.html` — page shell + HUD + meta screen
- `game/js/main.js` — bootstrap, loop, shot staging, playtest autopilot
- `game/js/sky.js` — sky dome, sun, Tier-2 billboard clouds, day presets
- `game/js/textures.js` — procedural canvas textures (facades, road, signs)
- `game/js/city.js` — city, beach, pier, Ferris wheel, yacht, market
- `game/js/vehicles.js` — hero car, police, traffic, scooter, tank, heli
- `game/js/peds.js` — jointed pedestrians + crowd
- `game/js/gameplay.js` — missions, wanted system, weapons, crew, traffic AI
- `game/js/player.js` — input, on-foot + driving, camera
- `game/js/hud.js` — HUD + circular minimap
- `game/js/meta.js` — MAP / STATS / workshop / saves screen
- `game/js/audio.js` — synthesised sound (no audio files)
- `game/js/save.js` — 3 save slots in localStorage
- `game/three.module.min.js` — vendored Three.js r160 (minified)
- `tools/` — pure-Node CDP shot driver, playtest harness, PNG compressor

Screenshots are taken by `node tools/shots.mjs` (4 PNGs, 1280×720, ≤256 KiB);
mission 1 is playtested end-to-end by `node tools/playtest.mjs`.

## License

MIT — see [LICENSE](LICENSE). An original work: no Rockstar / GTA names,
characters, art, music or map.
