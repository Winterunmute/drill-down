# ⬇ Drill Down

A browser-based incremental / roguelite game. Build a drilling robot by placing
Tetris-shaped parts on a grid, then launch it into the depths. Each run earns
gold and loot you spend on better parts and a bigger rig — so you can drill
deeper, hit richer ore veins, and survive tougher foes.

No build step, no dependencies, no backend. Pure vanilla HTML/CSS/JS.

## Play

Open `index.html` directly in a browser, or serve the folder with any static
server:

```bash
python -m http.server
# then visit http://localhost:8000
```

Your progress is saved automatically to `localStorage` (key `drill_down_save`),
so closing the tab won't lose your run.

## Core loop

1. **Build** — Drag parts from your inventory onto the rig grid. Fit shapes
   together like Tetris. Press **R** to rotate — while dragging, or while hovering
   a part in the inventory/shop (or hold your finger still on touch while dragging).
2. **Launch** — Send the robot down and watch the drill log replay its descent.
3. **Review** — See how deep it got and what happened — the full log stays on screen.
4. **Upgrade** — Buy parts from the shop, expand the grid, combine fragments,
   recycle parts you don't need for gold + salvage, and try again.

Hover any part to see a tooltip explaining each of its stats and the best place
to put it for adjacency bonuses. The in-game **How to Play** screen covers the
full mechanics.

### Watch your heat — and surface in time

Drills generate heat every step; cooling bleeds it off. Let heat climb too high
and it eats your HP. And you only **keep your haul if you surface** — if the
drone is destroyed, all the ore and fragments it was carrying are lost. Set a
**Return Policy** (auto-surface when cargo is full or HP gets low) in the
workshop to bank your loot before it's too late.

## Project structure

Everything hangs off a single global namespace, `DrillDown`. Scripts load in a
fixed order, each attaching one module:

```
drill-down/
├── index.html      # Shell: 3 screens + 2 overlays
├── style.css       # All styling
├── js/
│   ├── parts.js    # DrillDown.PARTS — all part data + rarity colors
│   ├── engine.js   # DrillDown.Engine — pure game logic (no DOM)
│   ├── audio.js    # DrillDown.Audio — sound effects (Web Audio API)
│   ├── ui.js       # DrillDown.UI — rendering, drag-and-drop, tooltips
│   └── main.js     # DrillDown.Game — top-level controller + state
├── GAME.md         # Full game design / mechanics reference
└── CLAUDE.md       # Architecture notes & conventions for contributors
```

Script load order: `parts.js → engine.js → audio.js → ui.js → main.js`.
Dependency direction is one-way: `main` → `UI` → `Engine` → `Audio` → `PARTS`. The UI
never contains game math; the Engine never touches the DOM.

## Contributing

- Pure vanilla JS — no modules/imports, no package manager, no test suite.
- **Adding a part** = add one entry to `DrillDown.PARTS` in `js/parts.js`. The
  shop, tooltips, stat summaries, and shape rendering all read from it
  automatically.
- `core`-type parts use an `amp` field (e.g. `0.25`) to amplify adjacent parts'
  primary stats; they have empty `stats` and a `desc` field.
- See [`CLAUDE.md`](CLAUDE.md) for architecture and conventions, and
  [`GAME.md`](GAME.md) for the full mechanics reference (parts table, economy,
  simulation, adjacency bonuses, zones, milestones).

## Tech

Vanilla HTML, CSS, and JavaScript. Runs anywhere a modern browser does.
