# Drill Down

A browser-based incremental/roguelite game. You build a drilling robot by placing Tetris-shaped parts on a grid, then launch it to drill into the depths. Each run earns gold and loot used to upgrade the rig and drill deeper. No build step, no dependencies, no backend — pure vanilla HTML/CSS/JS that runs by opening `index.html`.

## Running

Open `index.html` directly in a browser, or serve the folder with any static server (e.g. `python -m http.server`). There is no build, bundler, package manager, or test suite.

## Architecture

Everything hangs off a single global namespace, `DrillDown`, defined in `js/parts.js`. Scripts load in a fixed order in `index.html` and each attaches one module to that namespace via an IIFE:

1. `js/parts.js` — `DrillDown` root object + `DrillDown.PARTS` (all part definitions), `RARITY_COLORS`, `PART_TYPES`. Pure data, no logic.
2. `js/engine.js` — `DrillDown.Engine`. Pure game logic, no DOM. Grid ops, stat computation, run simulation, adjacency synergies, shop generation, and localStorage save/load.
3. `js/audio.js` — `DrillDown.Audio`. Synthesized sound effects via Web Audio API. No DOM. Lazily creates audio context on first user gesture.
4. `js/ui.js` — `DrillDown.UI`. All DOM rendering, drag-and-drop, tooltips, screen switching. Reads/writes game state via `DrillDown.Game.state`.
5. `js/main.js` — `DrillDown.Game`. Top-level controller holding the single `state` object; wires UI to Engine, owns `newRun`/`continueRun`/`startRun`.

Load order: `parts.js` → `engine.js` → `audio.js` → `ui.js` → `main.js`.
Dependency direction: `main` → `UI` → `Engine` → `Audio` → `PARTS`. UI never contains game math; Engine never touches the DOM. Keep that separation when editing.

### Screens
The UI is a set of `.screen` divs in `index.html` (`screen-title`, `screen-workshop`, `screen-drill`) plus two overlays (`shop-overlay`, `help-overlay`). There is no separate results screen — results are rendered inline on the drill screen after the run completes. `UI.showScreen(id)` toggles the `active` class. Each screen is (re)rendered imperatively by a `render*` function that rewrites `innerHTML` and re-attaches event handlers — there is no virtual DOM or framework.

### Game state
A single plain object (see `defaultState()` in `js/main.js`): `gold`, `grid`, `inventory` (array of part IDs, duplicates allowed), `fragments` (partId → count toward crafting), `recycleProgress` (0–100 salvage meter), `shop` (array of part IDs for sale), and run stats (`runNumber`, `bestDepth`, etc.). It's persisted to `localStorage` under the key `drill_down_save` on nearly every mutation via `Eng.save(state)`. Saves are versioned (`Engine.SAVE_VERSION`): `Eng.load()` runs `Eng.migrate()`, which fills any missing/invalid fields with defaults and prunes references to parts that no longer exist — so adding a state field or removing a part never breaks an existing save. Keep `migrate`'s field defaults in sync with `defaultState()`. `state` lives only in `Game`; access it elsewhere through `DrillDown.Game.state`.

## Core systems

### Grid & parts
The grid (`Engine.createGrid`) stores a 2D `cells` array (each cell holds the placed-part instance id or `null`) plus a `placed` map of `pid → {id, row, col, rotated}`. Parts are defined by a `shape`: an array of `[dr, dc]` offsets (e.g. `[[0,0],[0,1]]` is a 1×2). Rotation swaps offsets via `([r,c]) => [c,r]`. Use `canPlace`/`placePart`/`removePart` rather than mutating `cells` directly. `pid` instance ids are generated as `partId + '_' + Date.now() + random`.

### Stats & adjacency
`Engine.computeStats(grid)` sums each placed part's `stats` into a robot stat block (`drillPower`, `heatGen`, `cooling`, `hp`, `armor`, `cargo`, `speed`, `detect`), then applies adjacency synergies (cooling-next-to-drill, drill-next-to-drill, defense-next-to-defense, defense-next-to-drill, utility-next-to-drill/cooling, utility-next-to-utility) and core amplification (`def.amp` fraction of adjacent parts' primary stat). This block is recomputed fresh whenever needed; it is not stored in state.

### The run (simulation is precomputed)
`Engine.simulateRun(robotStats, maxDepth, policy)` runs the **entire** descent synchronously up front and returns a `result` with a full `log` array. The drill screen (`UI.renderDrill`) then *replays* that precomputed log line by line on a timer for effect — "Skip to End" and "Surface Now" just stop the animation and finish from the already-computed data. The sim models depth steps, rock hardness (`rockHardness(depth)`), heat accumulation/overheat damage, cargo limits, random events (`getEvent`: loot, enemy, hazard, fragment, rare ore), and return-policy checks (cargo-full / low-HP auto-surface). A `safety` counter caps the loop; surfacing is implied when the robot survives to the cap.

### Economy & progression
Ore converts to gold on run completion (×2, and only if the drone surfaces). Shop restocks via `Engine.generateShop` (weighted by rarity: 3 common / 2 uncommon / 1 rare; `unique` parts never appear in shop). Grid expansion costs scale with current size, capped at 8×8. Fragments from "ancient caches" accumulate until enough to craft a full part (2 for rare, 3 for unique) — this is the only way to obtain `unique` parts. `Engine.addFragment(state, partId)` centralizes fragment accrual + auto-craft. Recycling a part (`Engine.recyclePart`) grants a little gold and fills `recycleProgress`; at 100% it awards a fragment of a random rare/unique part via `addFragment`.

## Conventions
- Pure vanilla JS, no modules/imports — everything via the `DrillDown` global. New code should attach to it the same way.
- Adding a part = add one entry to `DrillDown.PARTS` in `js/parts.js`. Fields: `id`, `name`, `type` (`drill`/`cooling`/`defense`/`utility`/`core`), `shape`, `stats`, `rarity` (`common`/`uncommon`/`rare`/`unique`), `cost`, `color`, `emoji`. The shop, tooltips, stat summaries, and shape rendering all read from this automatically. `core`-type parts also need an `amp` field (e.g. `0.25`) and a `desc` field; their `stats` can be empty.
- Stat display order and help text live in `UI.renderWorkshop` (`statHelp`); the per-stat parsing in `computeStats` and `showTooltip` must stay in sync when adding a new stat. (Cards show only name/rarity/cost — full stats are in the hover/hold tooltip.)
- Run-log lines are styled by substring matching on their text (e.g. `OVERHEAT`, `Void Crystal`, `Ore vein`) in `renderDrill`/`showComplete` — if you change log wording, update those matches.
