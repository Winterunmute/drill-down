# Drill Down — Game Documentation

**Current version:** v1.0

---

## Concept

Text-based roguelite autobattler. Build a drilling robot by placing Tetris-shaped parts on a grid, launch it into the depths, read the combat log, and use earnings to upgrade. Each run starts at depth 1 — no checkpoint carryover. Deeper = better loot.

---

## How to Play

1. **BUILD** — Drag parts from inventory onto the rig grid. Fit shapes together. Press **R** (or hold on touch) while dragging to rotate.
2. **LAUNCH** — Send the robot down. Watch the real-time log as it drills.
3. **REVIEW** — See stats and full log inline after the run ends. What killed it?
4. **UPGRADE** — Buy better parts from the shop. Expand the grid. Combine fragments. Try again.

---

## Screens

| Screen | Purpose |
|--------|---------|
| Title | New Run / Continue |
| Workshop | Build rig, set return policy, view fragments & synergies, open shop/help |
| Drill | Animated log replay during descent; results shown inline after completion |
| Shop overlay | Buy parts (drag to grid or inventory) |
| Help overlay | Full mechanics explanation |

There is no separate results screen — results are rendered in place on the drill screen when the run ends.

---

## All Parts (36 total)

Some parts carry **trade-offs** (a negative stat) for build identity — e.g. heavy armor reduces speed, and the Overclocked Drill runs dangerously hot.

### Common (8)
| ID | Name | Type | Shape | Stats | Cost |
|----|------|------|-------|-------|------|
| `basic_drill` | Basic Drill | drill | 1×2 | drill+4, heat+2 | 30g |
| `rotary_drill` | Rotary Drill | drill | 2×1 | drill+7, heat+4 | 50g |
| `thermal_paste` | Thermal Paste | cooling | 1×1 | cooling+2 | 12g |
| `small_fan` | Small Fan | cooling | 1×1 | cooling+3 | 20g |
| `radiator` | Radiator | cooling | 1×2 | cooling+5 | 40g |
| `light_plating` | Light Plating | defense | 1×1 | hp+10 | 15g |
| `heavy_plating` | Heavy Plating | defense | 1×2 | hp+18, spd−0.1 | 35g |
| `cargo_pod` | Cargo Pod | utility | 2×2 | cargo+12 | 45g |

### Uncommon (13)
| ID | Name | Type | Shape | Stats | Cost |
|----|------|------|-------|-------|------|
| `twin_bore` | Twin Bore | drill | 2×1 | drill+9, heat+5 | 65g |
| `impact_drill` | Impact Drill | drill | 1×3 | drill+11, heat+6 | 90g |
| `plasma_cutter` | Plasma Cutter | drill | L-shape | drill+15, heat+9 | 115g |
| `overclocked_drill` | Overclocked Drill | drill | 1×2 | drill+17, heat+18 | 120g |
| `heat_sink` | Heat Sink | cooling | 1×1 | cooling+6 | 70g |
| `cryo_unit` | Cryo Unit | cooling | 2×1 | cooling+8 | 80g |
| `bulwark` | Bulwark | defense | 1×2 | hp+16, armor+2 | 75g |
| `reinforced_armor` | Reinforced Armor | defense | 2×1 | hp+30, spd−0.2 | 70g |
| `deflector` | Deflector | defense | 1×1 | armor+5 | 90g |
| `treads` | Treads | utility | 1×1 | speed+0.4 | 60g |
| `gyro` | Gyro | utility | 1×1 | speed+0.5 | 70g |
| `ore_magnet` | Ore Magnet | utility | 2×1 | detect+14, cargo+4 | 85g |
| `expanded_cargo` | Expanded Cargo | utility | 2×2 | cargo+20 | 100g |

### Rare (9) — shop OR 2 fragments
| ID | Name | Type | Shape | Stats | Cost |
|----|------|------|-------|-------|------|
| `core_borer` | Core Borer | drill | 3×1 | drill+22, heat+13 | 200g |
| `laser_drill` | Laser Drill | drill | 2×2 | drill+18, heat+10 | 180g |
| `vent_array` | Vent Array | cooling | 1×3 | cooling+13 | 170g |
| `liquid_cooler` | Liquid Cooler | cooling | 2×2 | cooling+14 | 160g |
| `aegis_field` | Aegis Field | defense | 2×1 | hp+20, armor+3, spd−0.2 | 150g |
| `nano_shield` | Nano Shield | defense | 1×1 | armor+3, hp+5 | 130g |
| `survey_drone` | Survey Drone | utility | 1×2 | detect+25, speed+0.2 | 150g |
| `deep_scanner` | Deep Scanner | utility | 2×1 | detect+20 | 140g |
| `reactor_core` | Reactor Core | **core** | 1×1 | amplifies adjacent parts +25% | 190g |

### Unique (6) — craft-only, 3 fragments
| ID | Name | Type | Shape | Stats |
|----|------|------|-------|-------|
| `singularity_core` | Singularity Core | **core** | 2×2 | amplifies adjacent parts +50% |
| `mega_drill` | Mega Drill | drill | 2×2 | drill+28, heat+14 |
| `cryo_chamber` | Cryo Chamber | cooling | 2×2 | cooling+22 |
| `titan_armor` | Titan Armor | defense | 2×2 | hp+50, armor+6, spd−0.4 |
| `void_pack` | Void Pack | utility | 2×2 | cargo+35 |
| `warp_drive` | Warp Drive | utility | 1×2 | speed+1.5, detect+30 |

Shape notation: `1×2` = 1 row, 2 cols (horizontal). `2×1` = 2 rows, 1 col (vertical). `L-shape` = `[[0,0],[1,0],[1,1]]`. Cores use their `amp` field to boost the primary stat of orthogonally adjacent parts (drill → drillPower, cooling → cooling, defense → hp).

---

## Rarity Colors

| Rarity | Color | Source |
|--------|-------|--------|
| common | `#ffffff` | Shop only |
| uncommon | `#55efc4` | Shop only |
| rare | `#74b9ff` | Shop + 2 fragments |
| unique | `#ff6b6b` | 3 fragments only |

---

## Robot Stats

Computed from the grid. All additive. Base values before any parts.

| Stat | Base | Effect |
|------|------|--------|
| ⬇ Drill Power | 0 | Overcomes rock hardness (`3 + depth×0.8 + sin(depth×0.5)×2`). Low power → slow progress + extra heat. |
| 🌡 Heat Gen | 0 | Heat produced per depth step. Stacked with penalty from slow drilling. |
| ❄ Cooling | 0 | Reduces net heat per step. |
| ❤ HP | 20 | Health. 0 = destroyed. |
| 🛡 Armor | 0 | Subtracted from enemy damage. |
| 📦 Cargo | 4 | Ore capacity per run. |
| ⚡ Speed | 1.0 | Depth steps per tick. Fractional = floor for actual steps. |
| 📡 Detect | 0 | Flat bonus added to loot/event find chance (adds to % chance). |

After summing parts, synergies, and core amplification, `computeStats` clamps to sane floors so part **trade-offs** (e.g. heavy armor's −speed) can't break a run: speed ≥ 0.3, cargo ≥ 1, HP ≥ 1, and drill/cooling/armor/detect ≥ 0.

---

## Simulation

The entire run is precomputed synchronously by `Engine.simulateRun(robotStats, maxDepth, policy)`. The drill screen replays the log on a timer. "Skip to End" and "Surface Now" truncate the replay from the precomputed data.

**Per-step logic:**
1. Rock hardness = `3 + depth×0.8 + sin(depth×0.5)×2`
2. If drillPower < hardness, penalty heat added (`hardness - drillPower`)
3. Net heat = heatGen - cooling + penalty; accumulated
4. Heat > 40 → damage each step; > 25 → warning
5. Random event per step (roll priority-ordered)
6. Return policy checked each step: if cargo full or HP below threshold, auto-surface
7. Safety cap at 2000 simulation iterations (steps, not depth — speed affects depth per step)

**Random events (rolled as cascading thresholds):**

| Event | Chance threshold | Effect |
|-------|------------------|--------|
| Void Crystal | `roll < 5 + depth×0.05` | Bonus gold (value×2) |
| Ancient Cache | `roll < 10 + depth×0.1` | Fragment (rare in 2, unique in 3) |
| Ore Vein | `roll < 15 + (20 + detect/2)×0.3` | Ore (subject to cargo cap) |
| Enemy | `roll < 30 + depth×0.2` | Damage (minus armor); name changes with depth zone |
| Heat Vent | `roll < 40 + depth×0.1` | Heat spike |
| *(default)* | — | Nothing unusual |

Enemy names by depth: Rock Worm (<25m), Crystal Spider (<75m), Magma Drake (<150m), Core Wraith (<300m), Void Leviathan (300+).

---

## Economy

- **Starting gold:** 100g
- **Ore to gold:** ×2 on run completion (only if the drone surfaces)
- **Void Crystals:** bonus gold (value×2)
- **Shop restock:** each trip to the workshop after a run
- **Shop slots:** 3 common + 2 uncommon + 1 rare (never unique)
- **Grid expansion:** 100g + 50g per row/col beyond 3×4, cap at 8×8
- **Recycling:** drag a part to the Recycle Bin for gold (common 5g / uncommon 10g / rare 20g / unique 35g) **and** salvage-meter progress (common 10% / uncommon 20% / rare 40% / unique 70%). At 100% the meter awards a fragment toward a random rare/unique part (25% chance unique) and resets.

### Depth Milestones

One-time achievement rewards, granted on reaching a depth (even if the drone is destroyed that run):

| Depth | Name | Reward |
|-------|------|--------|
| 25 | Broke the Crust | 50g |
| 50 | Into the Mantle | 120g |
| 75 | Deep Mantle | 200g |
| 100 | Triple Digits | 350g |
| 150 | Outer Core | 600g |
| 200 | Pressure Cooker | 900g |
| 300 | Inner Core | 1500g |
| 500 | Reached the Singularity | 3000g |

### Zones

| Depth range | Zone |
|-------------|------|
| 0–24 | The Crust |
| 25–74 | The Mantle |
| 75–149 | The Lower Mantle |
| 150–299 | The Outer Core |
| 300–499 | The Inner Core |
| 500+ | The Singularity |

Enemy names and event rewards scale with the current zone.

---

## Return Policy

Configured in the workshop. Checked every step during the simulation to decide whether to auto-surface:

| Option | Effect |
|--------|--------|
| Return when cargo full | Surfaces once ore = cargo capacity |
| HP threshold (Off / 10% / 25% / 50%) | Surfaces when HP drops below that % of max |

Defaults for a new run: **return when cargo full** on, **emergency ascent at 25% HP**. Setting a return policy is the only way to bank loot mid-run — if the drone is destroyed, carried ore and fragments are lost.

## Fragment System

- Ancient caches drop fragments of **rare** or **unique** parts; filling the **Recycle salvage meter** awards one too
- **Rare:** 2 fragments → auto-combines into full part
- **Unique:** 3 fragments → auto-combines into full part
- Fragment progress shown in workshop as `■□` progress bars
- Shop never sells unique parts — fragments (from caches or recycling) are the only source

---

## Adjacency Bonuses

Each unique touching pair is scored once (undirected). In addition to these, **core**-type parts amplify the primary stat of each orthogonally adjacent part by their `amp` multiplier (e.g. +25%).

| Pair | Bonus | Label |
|------|-------|-------|
| Drill + Cooling | +2❄ +1⬇ | Cooled Drill |
| Drill + Drill | +2⬇ | Drill Gang |
| Cooling + Cooling | +1❄ | Radiator Bank |
| Defense + Defense | +3❤ | Plating Wall |
| Defense + Drill | +1🛡 | Armored Head |
| Drill/Cooling + Utility | +1📦 | Conveyor Feed |
| Utility + Utility | +3📡 | Sensor Array |
| Core + adjacent part | amp× primary stat | Reactor Amp |

---

## Controls

- **Drag** — move parts: inventory→grid, grid→grid, shop→grid/inventory
- **Placement preview** — while dragging over the grid, the footprint glows **green** where it would drop and **red** when it can't (overlap or off-grid)
- **Inventory stacking** — identical parts group into one card, shown as a stacked "pile" when you own more than one (no number)
- **R key** — rotate the part while dragging, or rotate a part card you're hovering in the inventory/shop (pre-orient before pickup)
- **Long-press (touch)** — rotate the part while dragging (hold finger still)
- **Double-click** — rotate a placed part (desktop)
- **Right-click** — cancel in-progress drag (suppresses browser menu)
- **Escape** — cancel drag or close shop/help overlay
- **Skip to End** — show all log lines immediately
- **Surface Now** — abort run early, keep partial rewards
- **Relaunch Drone** — go straight to a new run
- **Workshop** — return to workshop between runs
- **Audio toggle (mute button)** — toggle sound effects on/off (persisted to `localStorage`)

---

## Tech Stack

- Vanilla HTML/CSS/JS — no build step, no dependencies, no backend
- Open `index.html` directly in a browser
- Single global namespace `DrillDown` with 5 modules:
  - `DrillDown.PARTS` — data (parts.js)
  - `DrillDown.Engine` — logic (engine.js)
  - `DrillDown.Audio` — sound effects via Web Audio API (audio.js)
  - `DrillDown.UI` — rendering (ui.js)
  - `DrillDown.Game` — controller (main.js)
- Load order: `parts.js → engine.js → audio.js → ui.js → main.js`
- Save/load via `localStorage` key `drill_down_save`; mute state via `drill_down_muted`
- Saves are **versioned** (`SAVE_VERSION`): `Engine.load` runs `Engine.migrate` to fill missing fields with defaults and drop references to removed parts, so older saves keep working as the game evolves

---

## File Structure

```
drill-down/
├── index.html      # Shell with 3 screens + 2 overlays
├── style.css       # All styling (722 lines)
├── README.md       # Player & contributor overview
├── GAME.md         # This file
├── CLAUDE.md       # Dev instructions
├── js/
│   ├── parts.js    # 36 part definitions + rarity colors (430 lines)
│   ├── engine.js   # Grid, stats, simulation, synergies, recycling, shop, save/migrate (597 lines)
│   ├── audio.js    # Web Audio API synthesized SFX (94 lines)
│   ├── ui.js       # All DOM rendering, drag-drop, tooltips, recycle bin (998 lines)
│   └── main.js     # State management, init, keyboard shortcuts (95 lines)
```
