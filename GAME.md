# Drill Down — Game Documentation

**Current version:** MVP (incremental, session 1)

---

## Concept

Text-based roguelite autobattler. Build a drilling robot by placing Tetris-shaped parts on a grid, launch it into the depths, read the combat log, and use earnings to upgrade. Each run starts at depth 1 — no checkpoint carryover. Deeper = better loot.

---

## How to Play

1. **BUILD** — Drag parts from inventory onto the rig grid. Fit shapes together. Double-click to rotate.
2. **LAUNCH** — Send the robot down. Watch the real-time log as it drills.
3. **REVIEW** — See stats and full log on the results screen. What killed it?
4. **UPGRADE** — Buy better parts from the shop. Expand the grid. Combine fragments. Try again.

---

## Screens

| Screen | Purpose |
|--------|---------|
| Title | New Run / Continue |
| Workshop | Build rig, view stats, open shop/help |
| Drill | Animated log replay during descent |
| Results | Side-by-side: stats left, full log right |
| Shop overlay | Buy parts (drag to grid or inventory) |
| Help overlay | Full mechanics explanation |

---

## All Parts (21 total)

### Common (7)
| ID | Name | Type | Shape | Stats | Cost |
|----|------|------|-------|-------|------|
| `basic_drill` | Basic Drill | drill | 1x2 | drill+4, heat+2 | 30g |
| `rotary_drill` | Rotary Drill | drill | 1x2 (vert) | drill+7, heat+4 | 50g |
| `small_fan` | Small Fan | cooling | 1x1 | cooling+3 | 20g |
| `radiator` | Radiator | cooling | 1x2 | cooling+5 | 40g |
| `light_plating` | Light Plating | defense | 1x1 | hp+10 | 15g |
| `heavy_plating` | Heavy Plating | defense | 1x2 | hp+18 | 35g |
| `cargo_pod` | Cargo Pod | utility | 2x2 | cargo+12 | 45g |

### Uncommon (5)
| ID | Name | Type | Shape | Stats | Cost |
|----|------|------|-------|-------|------|
| `impact_drill` | Impact Drill | drill | 1x3 | drill+11, heat+6 | 90g |
| `cryo_unit` | Cryo Unit | cooling | 1x2 (vert) | cooling+8 | 80g |
| `reinforced_armor` | Reinforced Armor | defense | 1x2 (vert) | hp+30 | 70g |
| `expanded_cargo` | Expanded Cargo | utility | 2x2 | cargo+20 | 100g |
| `treads` | Treads | utility | 1x1 | speed+0.4 | 60g |

### Rare (4) — shop OR 2 fragments
| ID | Name | Type | Shape | Stats | Cost |
|----|------|------|-------|-------|------|
| `laser_drill` | Laser Drill | drill | 2x2 | drill+18, heat+10 | 180g |
| `liquid_cooler` | Liquid Cooler | cooling | 2x2 | cooling+14 | 160g |
| `nano_shield` | Nano Shield | defense | 1x1 | armor+3, hp+5 | 130g |
| `deep_scanner` | Deep Scanner | utility | 1x2 (vert) | detect+20 | 140g |

### Unique (5) — craft-only, 3 fragments
| ID | Name | Type | Shape | Stats |
|----|------|------|-------|-------|
| `mega_drill` | Mega Drill | drill | 2x2 | drill+28, heat+14 |
| `cryo_chamber` | Cryo Chamber | cooling | 2x2 | cooling+22 |
| `titan_armor` | Titan Armor | defense | 2x2 | hp+50, armor+6 |
| `void_pack` | Void Pack | utility | 2x2 | cargo+35 |
| `warp_drive` | Warp Drive | utility | 1x2 | speed+1.5, detect+30 |

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

Computed from the grid. All additive.

| Stat | Base | Effect |
|------|------|--------|
| ⬇ Drill Power | 0 | Overcomes rock hardness (3 + depth×0.8). Low power → slow progress + extra heat. |
| 🌡 Heat Gen | 0 | Heat produced per depth step. Stacked with penalty from slow drilling. |
| ❄ Cooling | 0 | Reduces net heat per step. +2 bonus when placed next to a drill. |
| ❤ HP | 20 | Health. 0 = destroyed. +3 bonus per adjacent defense pair. |
| 🛡 Armor | 0 | Subtracted from enemy damage. |
| 📦 Cargo | 4 | Ore capacity per run. +1 bonus per utility adjacent to drill/cooling. |
| ⚡ Speed | 1.0 | Depth steps per tick. Fractional = floor for steps. |
| 📡 Detect | 0% | Bonus to loot/event find chance. |

---

## Simulation

The entire run is precomputed synchronously by `Engine.simulateRun`. The drill screen replays the log on a timer. "Skip to End" and "Surface Now" truncate the replay from the precomputed data.

**Per-step logic:**
1. Rock hardness = `3 + depth×0.8 + sin(depth×0.5)×2`
2. If drillPower < hardness, penalty heat added
3. Net heat = heatGen - cooling; accumulated
4. Heat > 40 → damage; > 25 → warning
5. Random event per step (loot/enemy/hazard/fragment/crystal/nothing)
6. Safety cap at 2000 depth steps

**Random events (ordered by priority):**

| Event | Base chance | Threshold | Effect |
|-------|-------------|-----------|--------|
| Void Crystal | 5% + depth×0.05 | — | Bonus gold |
| Ancient Cache | 10% + depth×0.1 | — | Fragment (rare 1/2 or unique 1/3) |
| Ore Vein | 15% + detect×0.15 | — | Ore (subject to cargo) |
| Enemy | 30% + depth×0.15 | — | Damage (minus armor) |
| Heat Vent | 40% + depth×0.1 | — | Heat spike |

---

## Economy

- **Starting gold:** 100g
- **Ore to gold:** ×1.5 on run completion
- **Void Crystals:** bonus gold (value×2)
- **Shop restock:** each trip to the workshop after a run
- **Shop slots:** 3 common + 2 uncommon + 1 rare (never unique)
- **Grid expansion:** 100g + 50g per row/col beyond 3×4, cap at 8×8

---

## Fragment System

- Ancient caches drop fragments of **rare** or **unique** parts
- **Rare:** 2 fragments → auto-combines into full part
- **Unique:** 3 fragments → auto-combines into full part
- Fragment progress shown in workshop inventory panel as `■□` bars
- Shop never sells unique parts — fragments are the only source

---

## Adjacency Bonuses

| Condition | Bonus |
|-----------|-------|
| Cooling next to Drill | +2 cooling (each) |
| Defense next to Defense | +3 HP (each) |
| Utility next to Drill/Cooling | +1 cargo (each) |

Each pair counts only once (undirected).

---

## Controls

- **Drag** — move parts: inventory→grid, grid→grid, shop→grid/inventory
- **Double-click** — rotate a placed part
- **Right-click / Escape** — cancel drag or close overlay
- **Skip to End** — show all log lines immediately
- **Surface Now** — abort run early, keep partial rewards
- **Relaunch Drone** — go straight to a new run
- **Workshop** — return to workshop between runs

---

## Tech Stack

- Vanilla HTML/CSS/JS — no build step, no dependencies, no backend
- Open `index.html` directly in a browser
- Single global namespace `DrillDown` with 4 modules:
  - `DrillDown.PARTS` — data (parts.js)
  - `DrillDown.Engine` — logic (engine.js)
  - `DrillDown.UI` — rendering (ui.js)
  - `DrillDown.Game` — controller (main.js)
- Save/load via `localStorage` key `drill_down_save`

---

## File Structure

```
drill-down/
├── index.html      # Shell with 4 screens + 2 overlays
├── style.css       # All styling (416 lines)
├── GAME.md         # This file
├── CLAUDE.md       # Dev instructions
├── js/
│   ├── parts.js    # 21 part definitions + rarity colors (246 lines)
│   ├── engine.js   # Grid, stats, simulation, shop, save/load (346 lines)
│   ├── ui.js       # All DOM rendering, drag-drop, tooltips (756 lines)
│   └── main.js     # State management, init, keyboard shortcuts (77 lines)
```

## Future / Intended

- Standalone executable (Electron or similar)
- More unique parts
- Persistent meta-progression between runs
- Visual graphics for the descent (vs pure text log)
