# Drill Down — TODO

Ideas gathered from reading the full codebase. No priority implied by order — pick what's fun.

## 🎯 Requested

Ideas you specifically asked to add:

- ✅ **Rig shop / chassis system (DONE)** — the grid expand button is replaced by the **🏗 Rig Bay**: 10 chassis (`DrillDown.CHASSIS` in `parts.js`), each a *sidegrade* with its own footprint, innate stats (some with trade-offs), and **zone cells** (`DrillDown.CELL_MODS`) that modify whatever part covers them per cell — vented (+2 cooling), conductive (+2 drill), reinforced (+1 armor), cargo bay (+3 cargo), sensor (+4 detect), amplified (+12% primary stat), unstable (−15% primary stat). Chassis are persistent purchases (`Engine.buyChassis`), some depth-gated (75/150/300); owned frames swap freely between runs (`Engine.swapChassis`, placed parts return to inventory). Legacy expanded grids survive migration. Still open from this idea:
  - ✅ **Irregular part shapes (DONE)** — T / S / Z / L / J / I4 pieces plus a U-shaped Claw Shell, a W-pentomino Scorpion Tail, and a plus-shaped Nexus Core; rotation is now true 4-way (`rot` 0–3, `Engine.rotateShape`), and parts render per-cell everywhere (grid, drag ghost, inventory silhouettes). Irregular *hulls* too: chassis can carve voids via a `mask` (Hammerhead T-hull, cut-corner Star Fort, Scorpion). Follow-up also DONE: **mega parts** — 3×3 Titan Excavator / Glacier Block / Colossus Vault and the 2×4 Citadel Block (rare, huge stats, −speed trade-offs), plus **directional megas** where facing matters (`dirEffects`): the Blast Furnace boosts parts on its feed side ▲ and scorches its exhaust side ▼, the Cryo Cascade pours +25% off its lower edge — sides rotate with the part and the UI shows green/red edge arrows. The unique hollow **Crucible Ring** (`nestAmp`) amplifies the part nested in its heart by +50%. True 4×4/5×5 blocks remain unadded (they'd consume an entire mid-tier rig; viable once bigger chassis exist).

- ✅ **Part upgrade system (Mk II/III/IV tiers — DONE)** — combining two copies of a tier + gold forges the next tier, chaining base → Mk II → Mk III → Mk IV. Auto-generated for every non-unique part in `parts.js` (`generateUpgrades`); engine API in `Engine.upgradePart`; `⬆ Mk II/III/IV` button on stacked inventory cards. Other approaches below remain open ideas:
  - **Stat infusion** — pay escalating gold to add +1 to a chosen stat on a specific part instance. Tracked in state as `upgrades: { partId: { drillPower: 2, cooling: 1 } }`, applied in `computeStats`.
  - **Mk II / tier upgrade** — combine 2 copies of the same base part + gold to produce a strictly better version (e.g. Basic Drill → Reinforced Drill). Could use a new `upgradeOf` field in `parts.js` pointing to the next tier, or auto-scale stats by a multiplier.
  - **Gem sockets** — rare depth-only drops that slot into a part and add a secondary stat (e.g. "Heat Sink Gem: +2 cooling, +1 cargo"). Stored on the grid's `placed` metadata.
  - Each approach adds a meaningful gold sink between runs and makes common parts stay relevant late-game instead of being recycled the moment you find a rare.

- ✅ **Shop scales with progress (DONE)** — `Engine.shopPlan(bestDepth)` now shifts the rarity mix from commons toward rares as your best depth grows, and opens a premium unique slot at depth ≥ 300 (`SHOP_UNIQUE_PRICE`). The shop header shows the current stock tier. Remaining ideas below are still open:
  - ~~Shop slots scale with best depth: deeper = higher chance to spawn rare parts, eventually 1–2 unique slots at extreme depths.~~ (done)
  - Introduce "enhanced" shop variants — a part already in your inventory can appear at a discount or with a pre-applied upgrade (see part upgrade system above).
  - Rare/unique parts in the shop cost a premium but save you the fragment grind.
  - A secondary "black market" tab that unlocks after depth 100, selling rare parts for ore (not gold), or trading excess fragments for gold.

- **Cargo rework: slot-based inventory, not a capacity cap** — currently cargo is a hard cap that once reached, you stop collecting ore entirely. This makes cargo the main run-ending bottleneck (more than HP or heat) once you have a decent build. Instead:
  - Cargo becomes a **pool of slots** (e.g. 4 base + bonuses from parts).
  - Each vein drops a specific **commodity** (iron ore, gold nugget, diamond, void shard) that takes 1 slot.
  - When cargo is full and a new vein is found, the **cheapest item is auto-discarded** to make room. The log says: "Ore vein! +3 ore (discarded 2 iron to make room)."
  - At surface, each commodity has a different sell price (iron = 1g, gold = 3g, diamond = 8g, void shard = 15g).
  - This makes cargo still valuable (more slots = can hoard high-value items without constantly discarding cheap ones) but never a hard stop. The run ends when you surface or die, not when your cargo fills up at depth 80.
  - Adds a passive mini-game: deeper = better commodities, so the optimal play is to survive long enough to replace cheap slots with expensive ones, then surface.
  - Commodity quality scales with depth — iron is common everywhere, gold appears below 50m, diamonds below 150m, void shards below 300m. This gives a natural reason to push deeper: shallow runs still pay, but the real money is in the deep zones.

## Gameplay & Content

- ✅ **More core-type parts (DONE)** — added Flux Node (uncommon core, +15% amp) bridging the rare Reactor (+25%) and unique Singularity (+50%); auto-generates Mk tiers like any non-unique part.
- **Part trade-offs (negative stats)** — the code has clamp floors (`stats.speed = Math.max(0.3, stats.speed)`) and the help screen mentions trade-offs, but no part currently has negative stats. A "Heavy Chassis" with +HP/−speed or "Overclocked Drill" with +drill/+heatGen would make choices more interesting.
- **More random events** — the event pool (crystal, cache, ore, enemy, vent, nothing) feels thin at depth. Geyser (forced ascent?), magma current (bonus speed for a few steps?), abandoned rig (free part?) would add variety.
- **Depth-unique encounters** — boss enemies at zone boundaries (e.g. at depth 25, 75, 150, 300). Could award a guaranteed fragment or unique loot.
- **Starting loadout selection** — let the player pick from a few starter rig configs or spend starting gold on initial parts.
- **Part selling (direct)** — recycle gives small gold + salvage progress; there's no way to just sell for raw gold. A "sell" button on parts would help early game when you need cash fast.
- ✅ **Shop reroll (DONE)** — "🔄 Reroll (25g)" button in the shop restocks on demand (`Engine.REROLL_COST`).
- **Cargo overflow mechanic** — once cargo is full, excess ore could be stashed at a penalty (e.g. 50% conversion to gold directly) so it never feels wasted.
- **Speed as a risk/reward slider** — currently it's a stat you build; could invert some parts to give +detect or +cargo at the cost of −speed.
- **Zone biomes / environmental modifiers** — each zone (Crust, Mantle, Outer Core…) could apply a unique rule to the simulation, so reaching a new depth tier feels like a real shift, not just bigger numbers:
  - Mantle: magma pockets — heat vents twice as frequent.
  - Lower Mantle: crushing pressure — cargo capacity reduced 20%.
  - Outer Core: magnetic storms — detect halved.
  - Inner Core: extreme density — drill power penalty doubled.
  - Singularity: unstable space — random teleport ±10 depth each step.
- **Part set bonuses** — equipping certain combinations (e.g. "Cryo Set: Cryo Unit + Cryo Chamber" or "Deep Set: Deep Scanner + Core Borer") grants an extra bonus on top of adjacency. Tracked in `computeStats` by checking which part IDs are on the grid.
- **Event choices** — occasional branching decisions in the log that you click to resolve: "Collapsed tunnel ahead. [B]last through (+30 heat) or [D]rill around (+10 depth steps)." Adds interactive tension during the run.
- **Unearthed relics** — one-run-only items found at depth (not permanent parts). "Ancient Power Cell: +15 drill power for 50 steps." Applied as a temporary stat modifier in `simulateRun`.
- **Drone naming + graveyard** — name your rig before launch. Fallen drones get recorded on a memorial screen with name, depth, and cause of death. Builds attachment and makes losses sting (in a good way).
- **Run seeds** — a seed string at the top of the run, sharable so you can replay or share the exact same event sequence.
- **Depth-specific parts** — parts that only activate or appear below a certain depth threshold (e.g. "Magma Turbine: huge stats, only works below 150m"), encouraging mid-game inventory swaps.
- **Enemy types with different mechanics** — beyond just damage numbers, enemies could have unique effects: poison (tick damage over time), shred (reduce armor for the zone), leech (steal cargo). Adds tactical build consideration.
- **Negative synergies** — some type combos could debuff rather than buff (e.g. utility next to core slightly reduces amp). Makes placement more interesting than always cramming everything together.
- **Repair stations / camps** — at milestone depths (25, 50, 75…), a brief optional stop where you can spend gold to repair HP, vent heat, or reorganize cargo. A breather and a tactical choice.
- **Heat as a weapon** — a part that converts stored heat into damage against the next enemy. Risk/replay: you want high heat for the payoff, but high heat also hurts you.
- **Run modifiers / mutators** — before launch, opt into a debuff for bonus rewards: "Broken Coolant (all cooling halved, but loot ×1.5)" or "Thin Crust (+50% enemy spawns, +50% ore)." Roguelite-style variety.
- **Frenzy / momentum** — consecutive event types chain into bonuses: 3 loot events in a row → "Rich Vein!" bonus gold. 3 enemies in a row → "Swarm!" warning. Rewards consistency and adds emergent narrative.
- **Workshop upgrades (non-grid)** — persistent upgrades that sit outside the rig: a "Sharpening Rig" that adds +1 to all drill power, or a "Smelter" that improves ore→gold conversion by 10%. New gold sink.
- **Blueprint discovery** — a parallel resource track: finding 5 "blueprint fragments" (rare event) unlocks a new permanent recipe to craft a specific part from basic materials. Gives long-term goals beyond depth.
- **Part durability** — parts accumulate wear over runs (tracked in state). They need gold to repair between runs, or they break mid-run. Makes common parts valuable as cheap replacements and creates an ongoing gold sink.
- **Cascading grid damage** — when the drone takes heavy damage, a random placed part is destroyed and removed from the grid, potentially creating a chain reaction if it breaks a synergy or exposes a core.
- **Legendary boss fights** — at major zone boundaries (depth 75, 150, 300, 500) a guaranteed unique enemy with a named attack and special loot table. Defeating it could award a one-time relic or a permanent upgrade.
- **Trading post** — between runs, trade resources at unfavorable rates: 10 ore → 1 fragment, 50g → 1 blueprint fragment, 3 fragments → 1 random part. Lets you pivot resources you don't need.

## UI / Presentation

- **Pause during drill replay** — pause/resume button so you can read a log line before it scrolls away.
- **Run history** — a log of last N runs with depth, zone, gold earned, cause of death. Stored in state.
- ✅ **Part-count badge on stacked cards (DONE)** — stacked cards now show a ×N badge.
- **Animation for fragment craft** — when fragments auto-combine, a brief celebration toast or card-flip would feel satisfying.
- **Inline grid coordinates** — tiny row/col markers on the grid edges would help when planning complex layouts.
- **Drag preview shows synergy highlights** — when hovering a part over the grid, temporarily highlight which placed parts would gain synergy.
- **Keyboard shortcuts during drill** — Space to pause, S to surface, A to auto-skip.
- ✅ **Filter/sort inventory (DONE)** — inventory is grouped into labeled type sections, families ordered by rarity (a text filter could still be added).
- ✅ **Quick-start (DONE)** — boot jumps straight into the workshop when a save exists; "⌂ Title Menu" button returns.
- **Log filters on drill screen** — filter the replay/enriched log by event type (enemies only, loot only) for post-run analysis.
- ✅ **Status bar during drill (DONE)** — the drill screen has a depth/zone/HP/heat/cargo status bar; the workshop also has a compact rig HUD on mobile.
- ✅ **Confirmation on New Run (DONE)** — `UI.confirmModal` warns before wiping a save.
- **Dark mode toggle** — it's already dark, but a high-contrast / colorblind-friendly mode option.

## Simulation & Balance

- **Boss / elite enemies** — at milestone depths (25, 50, 75, 100…), a guaranteed tough enemy that can't be avoided but rewards extra gold or a fragment.
- **Adaptive difficulty** — deeper runs could scale enemy damage faster but also increase ore values to keep the risk/reward curve tight.
- **Part rebalance pass** — some parts (e.g. Treads vs Gyro, Deflector vs Nano Shield) are very close in cost/stat. A balance pass would make each feel more distinct.
- **Faster rock-hardness scaling** — the current formula (`3 + depth×0.8 + sin×2`) means drills eventually outpace hardness. A steeper curve or step increases at zone boundaries would keep drill power relevant longer.
- **Endless / void mode** — past 500m (The Singularity), an endless descent with no return policy, just accumulating score. Surfacing is impossible — the run ends when the drone dies. Leaderboard potential.
- **Fragments lost on death should hurt more** — currently fragments are lost if the drone is destroyed, but the fragment display in the workshop shows only uncrafted fragments. Could show a "lost in the deep" counter to rub it in.

## Meta-Progression

- **Persistent rig upgrades** — spend gold on permanent starting grid size, extra starting inventory slots, or a "workshop upgrade" that boosts a stat floor.
- **Prestige system** — reset gold and parts but earn a permanent bonus (starting detect, cargo multiplier, etc.) based on lifetime best depth.
- **Milestone rewards beyond gold** — unlock cosmetics (color theme), starting part choices, or small passive bonuses.
- **Lore fragments** — text snippets found at depth that piece together the story (why are we drilling? what's down there?). Purely cosmetic but gives the descent meaning.
- **Bounty system** — optional objectives per run ("reach depth 75 with cargo ≤ 10" or "defeat 3 enemies without cooling"). Rewards bonus gold or fragments. Gives each run a mini-goal beyond "go deeper."
- ✅ **Run streak bonus (DONE)** — consecutive safe returns stack a haul-gold multiplier (+10% each, capped +100%); a destroyed drone resets it. `streak` save field; shown in workshop stats + run-complete summary.

## Technical

- **requestAnimationFrame for log replay** — the current `setTimeout(appendLine, 80 + Math.random() * 120)` can drift. `rAF` with a delta accumulator would be smoother and more accurate.
- **Part-def validation on load** — the `migrate()` function already prunes missing part IDs; could also validate that grid cells match `placed` entries and repair inconsistencies.
- **Touch improvements** — the hold-to-rotate is clever but the 450ms delay can feel slow. A dedicated rotate button on the drag ghost would be more discoverable.
- **Accessibility** — screen-reader labels on drag targets, focus outlines, aria-live regions for log updates.
- **Modular part data** — parts.js could be split into per-type files or a single data block that's easier to contribute to.
- **Offline / PWA support** — minimal service worker to cache the assets so it works without a server at all (not just via `file://`).
- **Undo for grid placement** — a brief undo window after placing a part on the grid (before the workshop re-renders) to avoid misclicks.
- **Save slot support** — allow multiple save files so you can experiment with different builds without losing your main progress.

## Polish

- **CRT scanline toggle** — the overlay is hardcoded; a settings toggle would let players disable the retro effect.
- ✅ **Better mobile layout (DONE)** — workshop flows as a scrollable column (rig first), parts as a horizontal swipe-strip, compact rig HUD, slim recycle, tap-to-place, and a fixed run-complete controls bar. (Shrinking grid cells for expanded rigs on narrow screens is still open.)
- **Sound effect variety** — tick, loot, overheat, destroyed, milestone, launch, surface. Could add distinct sounds for enemies, fragment craft, shop purchase.
- **Title screen animation** — animated drill-bit or strata crawl behind the title to set the mood.
- **Surface sequence animation** — when the drone surfaces, a brief animated sequence of it rising through the strata before the results show.
- **Results soundscape** — different audio sting for milestone achievements vs. normal surface vs. destruction. Small but satisfying.

---

## 🧠 SYSTEM BALANCE + ENDGAME PRESSURE UPDATE

We are addressing two core issues in the current progression system:

1. **Power scaling caps too early**
2. **Unique parts lose rarity impact too quickly**

The goal is not to reduce player power, but to introduce **soft limits, trade-offs, and long-term build pressure** so that progression stays meaningful into late game.

---

### ⚙️ CORE SYSTEM CHANGE: SOFT POWER LIMITING

Current issue:
* Stats scale linearly or additively
* Synergies stack too cleanly
* Players reach "solved builds" too early

#### 🔻 Option A — Diminishing Returns (Recommended baseline)

All major stats (Drill, Cooling, Amp, etc.) should follow a curve instead of linear scaling:
* Replace raw stacking with soft-cap formula:
  * `effective = raw / (1 + raw / k)`
  * or `sqrt(raw)` scaling for simpler implementation
* Effect: early game feels strong, mid game spikes feel rewarding, late game stops trivial scaling

#### 🔻 Option B — Global Instability / Efficiency Pressure

Introduce a global constraint system:
* Powerful parts generate "instability / heat load / strain"
* Too much total power reduces efficiency of all systems
* Builds must balance strength vs stability
* Effect: prevents "max everything" builds, encourages hybrid design and trade-offs

#### 🔻 Option C — Structural / Grid Efficiency Pressure

Add indirect penalties for overloading builds:
* Too many high-tier parts reduce synergy efficiency
* Core or structural parts limit amplification
* Certain placements introduce "efficiency loss zones"
* Effect: grid design becomes a constraint puzzle, not just stacking optimization

---

### 💎 UNIQUE PART SYSTEM REWORK (RARITY + IMPACT FIX)

Current issue:
* Unique parts appear too frequently
* They feel like guaranteed upgrades instead of rare discoveries

#### 🔻 Option A — Discovery-Based Unlocking (Recommended)

Unique parts do NOT enter normal loot pool immediately. Instead they are unlocked via bosses, fragments, or biome milestones. Only after discovery can they appear in shop or loot pool.
* Effect: creates anticipation + progression gating, prevents early saturation of powerful items

#### 🔻 Option B — Depth-Based Loot Dilution

As depth increases, the loot pool expands faster than acquisition rate, making specific uniques statistically rarer over time.
* Effect: maintains rarity pressure into late game

#### 🔻 Option C — Unique Trade-off Design (VERY IMPORTANT)

Unique parts should NOT always be optimal. Give them drawbacks, conditional activation, adjacency penalties, instability generation, or structural incompatibility.
* Example: high power but reduces nearby synergy efficiency; extreme stats but increases instability load; strong effect only in specific depth ranges
* Effect: uniques become **build-defining decisions, not auto-upgrades**

---

### 🎯 DESIGN GOAL SUMMARY

These changes aim to ensure:
* Power progression does NOT flatten mid/late game
* Builds never become fully solved
* Unique items stay exciting across entire run
* Every strong decision introduces a new problem to manage

### ⚡ IMPLEMENTATION PRIORITY

1. ✅ **Diminishing returns (DONE)** — `Engine.computeStats` applies a logarithmic soft cap (`SOFT_CAPS`/`softCap`) to drillPower/hp/armor; cooling stays linear so it can offset uncapped heat. Mk heat scaling raised (`HEAT_MULT` 1.3→1.5) so tiers stay bigger, not free-er.
2. ✅ **Unique drop rarity (DONE)** — cache fragments use a depth-scaled unique chance (~0 surface → capped 18% deep); recycle awards at 12% (`UNIQUE_FRAGMENT_CHANCE`).
3. ✅ **Unique trade-offs (DONE, first pass)** — Mega Drill / Warp Drive / Singularity Core now generate heat; Cryo Chamber / Void Pack carry a speed penalty. Deeper conditional/adjacency-based drawbacks (Option C) remain a future enhancement.
   - Global instability (Option B) and grid-efficiency pressure (Option C) remain open as alternative/additional levers.
