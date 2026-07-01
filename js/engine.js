DrillDown.Engine = (() => {
  const P = DrillDown.PARTS;

  // -- Shapes & rotation --
  // rot counts quarter-turns clockwise (0–3). Offsets are re-normalized after rotating
  // so the shape's bounding box always starts at (0,0) — placement anchors stay stable.
  // A boolean `rot` from an old save coerces to 0/1, which matches the legacy transpose
  // for every rectangular shape.
  function rotateShape(shape, rot) {
    rot = ((rot % 4) + 4) % 4;
    let pts = shape;
    for (let i = 0; i < rot; i++) pts = pts.map(([r, c]) => [c, -r]);
    if (rot === 0) return pts;
    const minR = Math.min(...pts.map(p => p[0]));
    const minC = Math.min(...pts.map(p => p[1]));
    return pts.map(([r, c]) => [r - minR, c - minC]);
  }

  // Resolve a part's shape at a rotation. Accepts a part id or a part def.
  function shapeFor(part, rot) {
    const def = typeof part === 'string' ? P[part] : part;
    if (!def) return [];
    return rotateShape(def.shape, +rot || 0);
  }

  // -- Grid --
  function createGrid(rows, cols) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      cells[r] = [];
      for (let c = 0; c < cols; c++) {
        cells[r][c] = null;
      }
    }
    return { rows, cols, cells, placed: {} };
  }

  // Build a fresh grid from a chassis definition (footprint + zone-cell mods). The
  // grid carries its chassis id and a copy of the mod map so saves stay self-contained.
  function createChassisGrid(chassisId) {
    const def = DrillDown.CHASSIS[chassisId] || DrillDown.CHASSIS.scrap_frame;
    const grid = createGrid(def.rows, def.cols);
    grid.chassis = def.id;
    grid.mods = { ...(def.mods || {}) };
    // Irregular hull: any non-'X' mask cell is a structural void — unusable, unplaceable.
    grid.voids = {};
    if (def.mask) {
      def.mask.forEach((rowStr, r) => {
        for (let c = 0; c < rowStr.length; c++) {
          if (rowStr[c] !== 'X') grid.voids[r + ',' + c] = true;
        }
      });
    }
    return grid;
  }

  function cloneGrid(grid) {
    const g = createGrid(grid.rows, grid.cols);
    g.chassis = grid.chassis;
    g.mods = { ...(grid.mods || {}) };
    g.voids = { ...(grid.voids || {}) };
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      g.placed[pid] = { ...p };
      for (const [dr, dc] of shapeFor(p.id, p.rot)) {
        g.cells[p.row + dr][p.col + dc] = pid;
      }
    }
    return g;
  }

  function canPlace(grid, partId, row, col, rot) {
    const def = P[partId];
    if (!def) return false;
    for (const [dr, dc] of shapeFor(def, rot)) {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) return false;
      if (grid.voids && grid.voids[r + ',' + c]) return false;
      if (grid.cells[r][c] !== null) return false;
    }
    return true;
  }

  // `forcePid` restores a part under its existing instance id (used when a click on a
  // placed part turns out not to be a drag — the part goes back exactly as it was).
  function placePart(grid, partId, row, col, rot, forcePid) {
    if (!canPlace(grid, partId, row, col, rot)) return false;
    const pid = forcePid || partId + '_' + Date.now() + Math.random().toString(36).slice(2,6);
    grid.placed[pid] = { id: partId, row, col, rot: (+rot || 0) % 4, pid };
    for (const [dr, dc] of shapeFor(partId, rot)) {
      grid.cells[row + dr][col + dc] = pid;
    }
    return pid;
  }

  function removePart(grid, pid) {
    const p = grid.placed[pid];
    if (!p) return null;
    for (const [dr, dc] of shapeFor(p.id, p.rot)) {
      grid.cells[p.row + dr][p.col + dc] = null;
    }
    delete grid.placed[pid];
    return p;
  }

  function getPartAt(grid, row, col) {
    const pid = grid.cells[row][col];
    return pid ? grid.placed[pid] : null;
  }

  function expandGrid(grid, addRows, addCols) {
    grid.rows += addRows || 0;
    grid.cols += addCols || 0;
    for (let r = 0; r < grid.rows; r++) {
      if (!grid.cells[r]) grid.cells[r] = [];
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[r][c] === undefined) grid.cells[r][c] = null;
      }
    }
  }

  function getNeighbors(grid, row, col) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const result = [];
    for (const [dr, dc] of dirs) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols && grid.cells[r][c]) {
        result.push(grid.cells[r][c]);
      }
    }
    return [...new Set(result)];
  }

  // -- Robot Stats --
  // Diminishing returns / soft power limiting. Each capped stat keeps its full value up
  // to a threshold, then extra points are worth progressively less (sqrt falloff) — so
  // early/mid upgrades feel strong while late-game stacking flattens instead of trivially
  // scaling depth. Unbounded (no hard ceiling): any value is reachable, just with effort.
  // NOTE: cooling is intentionally NOT capped — it must stay able to offset the
  // (uncapped) heatGen of big builds, or heat management inverts and more investment
  // makes runs worse. We cap the stats that otherwise trivialize content directly.
  // Logarithmic falloff above the threshold `t`: value is unchanged up to t, then each
  // extra point is worth less. Smooth at t (slope 1) and always ≤ raw — a cap never
  // boosts — yet unbounded, so any value is reachable with enough investment. Larger `k`
  // = gentler diminishing.
  const SOFT_CAPS = {
    drillPower: { t: 45,  k: 60 },
    hp:         { t: 200, k: 300 },
    armor:      { t: 12,  k: 14 }
  };
  function softCap(raw, cap) {
    if (!cap || raw <= cap.t) return raw;
    return Math.round(cap.t + cap.k * Math.log(1 + (raw - cap.t) / cap.k));
  }

  // -- Directional & hollow-part helpers --
  const SIDE_VECS = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
  const SIDE_ORDER = ['up', 'right', 'down', 'left'];
  // A side declared in the part's unrotated frame, turned by `rot` quarter-turns CW —
  // matches rotateShape, so a Blast Furnace's feed side follows the part around.
  function rotateSide(side, rot) {
    const i = SIDE_ORDER.indexOf(side);
    if (i < 0) return side;
    return SIDE_ORDER[(i + ((+rot || 0) % 4) + 4) % 4];
  }
  // Cells inside a shape's bounding box that the shape does NOT occupy — the hollow of
  // a ring part. Offsets are in the same rotated frame as shapeFor.
  function shapeHoles(def, rot) {
    const shape = shapeFor(def, rot);
    const occupied = new Set(shape.map(([r, c]) => r + ',' + c));
    const w = Math.max(...shape.map(([r, c]) => c)) + 1;
    const h = Math.max(...shape.map(([r, c]) => r)) + 1;
    const holes = [];
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++)
        if (!occupied.has(r + ',' + c)) holes.push([r, c]);
    return holes;
  }

  // A part's primary stat: its largest positive stat, ignoring heatGen (a cost, not a
  // benefit). Used by amplified/unstable zone cells. Cores (empty stats) return null —
  // their amp field isn't a stat, so zone cells can't scale them.
  function partPrimary(def) {
    let best = null, bestV = 0;
    for (const k in def.stats) {
      if (k === 'heatGen') continue;
      if (def.stats[k] > bestV) { bestV = def.stats[k]; best = k; }
    }
    return best;
  }

  function computeStats(grid) {
    const stats = { drillPower: 0, heatGen: 0, cooling: 0, hp: 20, armor: 0, cargo: 4, speed: 1.0, detect: 0 };
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def) continue;
      if (def.stats.drillPower) stats.drillPower += def.stats.drillPower;
      if (def.stats.heatGen) stats.heatGen += def.stats.heatGen;
      if (def.stats.cooling) stats.cooling += def.stats.cooling;
      if (def.stats.hp) stats.hp += def.stats.hp;
      if (def.stats.armor) stats.armor += def.stats.armor;
      if (def.stats.cargo) stats.cargo += def.stats.cargo;
      if (def.stats.speed) stats.speed += def.stats.speed;
      if (def.stats.detect) stats.detect += def.stats.detect;
    }
    // -- Adjacency synergies (each unique touching pair scored once) --
    const adjacencyBonus = { cooling: 0, hp: 0, cargo: 0, drillPower: 0, armor: 0, detect: 0 };
    const visited = new Set();
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      const shape = shapeFor(def, p.rot);
      for (const [dr, dc] of shape) {
        const r = p.row + dr, c = p.col + dc;
        const neighbors = getNeighbors(grid, r, c);
        for (const nid of neighbors) {
          if (nid === pid) continue;
          if (visited.has(pid + '|' + nid) || visited.has(nid + '|' + pid)) continue;
          visited.add(pid + '|' + nid);
          const ndef = P[grid.placed[nid].id];
          if (!ndef) continue;
          const pair = (a, b) => (def.type === a && ndef.type === b) || (def.type === b && ndef.type === a);
          if (pair('drill', 'cooling')) { adjacencyBonus.cooling += 2; adjacencyBonus.drillPower += 1; } // cooled bit cuts better
          if (pair('drill', 'drill')) adjacencyBonus.drillPower += 2;                                    // ganged drills
          if (pair('cooling', 'cooling')) adjacencyBonus.cooling += 1;                                   // radiator bank
          if (pair('defense', 'defense')) adjacencyBonus.hp += 3;                                        // plating wall
          if (pair('defense', 'drill')) adjacencyBonus.armor += 1;                                       // armored drill head
          if (pair('utility', 'drill') || pair('utility', 'cooling')) adjacencyBonus.cargo += 1;         // conveyor feed
          if (pair('utility', 'utility')) adjacencyBonus.detect += 3;                                    // sensor array
        }
      }
    }
    for (const k in adjacencyBonus) stats[k] += adjacencyBonus[k];

    // -- Reactor cores: amplify the primary stat of each orthogonally-adjacent part --
    // (clamps applied at the end so part downsides like -speed can't push stats below sane floors)
    const primaryStat = { drill: 'drillPower', cooling: 'cooling', defense: 'hp' };
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      // Only amp-cores radiate omnidirectionally; cores without `amp` (e.g. the
      // nest-amp Crucible Ring) have their own mechanics below.
      if (!def || def.type !== 'core' || !def.amp) continue;
      const amp = def.amp;
      const shape = shapeFor(def, p.rot);
      const seen = new Set();
      for (const [dr, dc] of shape) {
        for (const nid of getNeighbors(grid, p.row + dr, p.col + dc)) {
          if (nid === pid || seen.has(nid)) continue;
          seen.add(nid);
          const ndef = P[grid.placed[nid].id];
          if (!ndef) continue;
          const key = primaryStat[ndef.type];
          if (key && ndef.stats[key]) stats[key] += Math.round(ndef.stats[key] * amp);
        }
      }
    }

    // -- Directional parts: affect only neighbors touching a specific side --
    // Sides are declared in the part's unrotated frame and rotate with it, so facing is
    // a placement decision. Positive amp boosts the neighbor's primary stat, negative
    // scorches it; like zone cells, an effect never rounds to nothing.
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def || !def.dirEffects) continue;
      const shape = shapeFor(def, p.rot);
      for (const eff of def.dirEffects) {
        const [vr, vc] = SIDE_VECS[rotateSide(eff.side, p.rot)];
        const seen = new Set();
        for (const [dr, dc] of shape) {
          const r = p.row + dr + vr, c = p.col + dc + vc;
          if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue;
          const nid = grid.cells[r][c];
          if (!nid || nid === pid || seen.has(nid)) continue;
          seen.add(nid);
          const ndef = P[grid.placed[nid].id];
          if (!ndef) continue;
          const key = partPrimary(ndef);
          if (key && ndef.stats[key] > 0) {
            let delta = ndef.stats[key] * eff.amp;
            if (key === 'speed') delta = Math.round(delta * 10) / 10 || (eff.amp > 0 ? 0.1 : -0.1);
            else delta = Math.round(delta) || (eff.amp > 0 ? 1 : -1);
            stats[key] += delta;
          }
        }
      }
    }

    // -- Nest amp (hollow parts): amplify whatever sits inside the shape's holes --
    // e.g. the Crucible Ring's 3×3 ring boosts the part occupying its center cell.
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def || !def.nestAmp) continue;
      const seen = new Set();
      for (const [hr, hc] of shapeHoles(def, p.rot)) {
        const r = p.row + hr, c = p.col + hc;
        if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue;
        const nid = grid.cells[r][c];
        if (!nid || nid === pid || seen.has(nid)) continue;
        seen.add(nid);
        const ndef = P[grid.placed[nid].id];
        if (!ndef) continue;
        const key = partPrimary(ndef);
        if (key && ndef.stats[key] > 0) {
          const delta = ndef.stats[key] * def.nestAmp;
          stats[key] += key === 'speed' ? Math.max(0.1, Math.round(delta * 10) / 10) : Math.max(1, Math.round(delta));
        }
      }
    }

    // -- Chassis: innate stats + zone-cell modifiers --
    // Innate stats stack on top of parts (may include trade-offs like -speed or heatGen).
    // Zone cells affect only the part covering them, per covered cell: flat mods add to a
    // stat; amp mods (amplified/unstable) scale the part's primary stat from its base value.
    const chassisDef = grid.chassis && DrillDown.CHASSIS[grid.chassis];
    if (chassisDef && chassisDef.stats) {
      for (const k in chassisDef.stats) {
        if (stats[k] !== undefined) stats[k] += chassisDef.stats[k];
      }
    }
    const cellMods = grid.mods || {};
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def) continue;
      const shape = shapeFor(def, p.rot);
      for (const [dr, dc] of shape) {
        const mod = DrillDown.CELL_MODS[cellMods[(p.row + dr) + ',' + (p.col + dc)]];
        if (!mod) continue;
        if (mod.stat) {
          stats[mod.stat] += mod.amount;
        } else if (mod.amp) {
          const key = partPrimary(def);
          if (key && def.stats[key] > 0) {
            // Never round to nothing: a zone cell always moves the stat at least one notch.
            let delta = def.stats[key] * mod.amp;
            if (key === 'speed') delta = Math.round(delta * 10) / 10 || (mod.amp > 0 ? 0.1 : -0.1);
            else delta = Math.round(delta) || (mod.amp > 0 ? 1 : -1);
            stats[key] += delta;
          }
        }
      }
    }

    // Soft power limiting: flatten the big offensive/defensive stats so over-stacking
    // (esp. high Mk tiers) yields diminishing depth rather than trivial scaling.
    for (const k in SOFT_CAPS) stats[k] = softCap(stats[k], SOFT_CAPS[k]);

    // Floors: part trade-offs (e.g. heavy armor's -speed) can subtract, but the
    // robot still needs to move, carry, and survive.
    stats.speed = Math.max(0.3, stats.speed);
    stats.cargo = Math.max(1, stats.cargo);
    stats.hp = Math.max(1, stats.hp);
    stats.drillPower = Math.max(0, stats.drillPower);
    stats.cooling = Math.max(0, stats.cooling);
    stats.armor = Math.max(0, stats.armor);
    stats.detect = Math.max(0, stats.detect);

    return stats;
  }

  // -- Commodities (slot-based cargo) --
  // Each commodity has a base value (gold at surface), emoji, and minimum depth
  // where it starts appearing. Deeper = better.
  const COMMODITIES = [
    { id: 'iron',       name: 'Iron Ore',    baseValue: 1,  emoji: '🪨', minDepth: 0   },
    { id: 'gold',       name: 'Gold Nugget', baseValue: 3,  emoji: '✨', minDepth: 50  },
    { id: 'diamond',    name: 'Diamond',     baseValue: 8,  emoji: '💎', minDepth: 150 },
    { id: 'void_shard', name: 'Void Shard',  baseValue: 15, emoji: '🔮', minDepth: 300 },
  ];

  // Pick a random commodity for the given depth. Deeper depths unlock pricier goods,
  // but the cheap commodities stay the most common — raising the random to a power
  // biases the pick toward the earlier (cheaper) entries, so expensive drops (diamond,
  // void shard) remain an occasional treat. The slot-based cargo (which discards the
  // cheapest when full) is what lets a long run accumulate the rare expensive finds.
  function commodityForDepth(depth) {
    const available = COMMODITIES.filter(c => depth >= c.minDepth);
    // Exponent > 1 biases toward the cheaper (earlier) entries; lower = richer deep
    // runs. 1.8 keeps iron the most common while letting pricey goods show up often
    // enough that pushing deep feels rewarding.
    const idx = Math.floor(Math.pow(Math.random(), 1.8) * available.length);
    return available[Math.min(idx, available.length - 1)];
  }

  // Compute total gold value from an array of commodity IDs.
  function cargoValue(cargo) {
    if (!cargo || !cargo.length) return 0;
    const map = {};
    COMMODITIES.forEach(c => map[c.id] = c.baseValue);
    return cargo.reduce((sum, id) => sum + (map[id] || 0), 0);
  }

  // -- Events --
  function rockHardness(depth) {
    return 3 + depth * 0.8 + Math.sin(depth * 0.5) * 2;
  }

  function getEvent(depth, detect) {
    const roll = Math.random() * 100;
    const lootChance = 20 + detect / 2;
    if (roll < 5 + depth * 0.05) {
      const oreValue = Math.floor(5 + depth * 0.3 + Math.random() * 5);
      return { type: 'rare_ore', text: `Void Crystal found! +${oreValue}g value`, gold: oreValue * 2 };
    }
    if (roll < 10 + depth * 0.1) {
      // Caches mostly yield rare fragments; uniques are a deep-run prize whose odds ramp
      // with depth (≈0 near the surface, capped at 18% in the deep core).
      const uniqueChance = Math.min(0.18, depth / 1800);
      const chosen = randomCraftable(uniqueChance);
      if (chosen) {
        const needed = P[chosen].rarity === 'unique' ? 3 : 2;
        return { type: 'fragment', text: `Ancient cache! ${P[chosen].name} fragment (1/${needed})`, partId: chosen };
      }
    }
    if (roll < 15 + lootChance * 0.3) {
      // Deeper veins are richer — the payoff for risking the descent.
      const qty = Math.floor(1 + depth * 0.12 + Math.random() * 2);
      const com = commodityForDepth(depth);
      return { type: 'loot', text: `Ore vein! +${qty} ${com.name}`, items: Array(qty).fill(com.id), comId: com.id };
    }
    if (roll < 30 + depth * 0.2) {
      const enemy = depth < 25 ? 'Rock Worm' : depth < 75 ? 'Crystal Spider'
        : depth < 150 ? 'Magma Drake' : depth < 300 ? 'Core Wraith' : 'Void Leviathan';
      const damage = Math.floor(3 + depth * 0.22 + Math.random() * 4);
      return { type: 'enemy', text: `${enemy} attacks! -${damage} HP`, damage };
    }
    if (roll < 40 + depth * 0.1) {
      const spike = Math.floor(5 + depth * 0.22);
      return { type: 'hazard', text: `Heat vent! +${spike} heat`, heatSpike: spike };
    }
    return { type: 'nothing', text: 'Nothing unusual.' };
  }

  // -- Zones & milestones (progression) --
  const ZONES = [
    { min: 0,   name: 'The Crust' },
    { min: 25,  name: 'The Mantle' },
    { min: 75,  name: 'The Lower Mantle' },
    { min: 150, name: 'The Outer Core' },
    { min: 300, name: 'The Inner Core' },
    { min: 500, name: 'The Singularity' }
  ];
  function zoneFor(depth) {
    let z = ZONES[0];
    for (const zone of ZONES) if (depth >= zone.min) z = zone;
    return z;
  }
  const MILESTONES = [
    { depth: 25,  reward: 50,   name: 'Broke the Crust' },
    { depth: 50,  reward: 120,  name: 'Into the Mantle' },
    { depth: 75,  reward: 200,  name: 'Deep Mantle' },
    { depth: 100, reward: 350,  name: 'Triple Digits' },
    { depth: 150, reward: 600,  name: 'Outer Core' },
    { depth: 200, reward: 900,  name: 'Pressure Cooker' },
    { depth: 300, reward: 1500, name: 'Inner Core' },
    { depth: 500, reward: 3000, name: 'Reached the Singularity' }
  ];

  // -- Synergy analysis for the workshop (mirrors the bonuses in computeStats) --
  const SYNERGY_DEFS = {
    'cooling|drill':    { label: 'Cooled Drill',  bonus: '+2❄ +1⬇' },
    'drill|drill':      { label: 'Drill Gang',    bonus: '+2⬇' },
    'cooling|cooling':  { label: 'Radiator Bank', bonus: '+1❄' },
    'defense|defense':  { label: 'Plating Wall',  bonus: '+3❤' },
    'defense|drill':    { label: 'Armored Head',  bonus: '+1🛡' },
    'drill|utility':    { label: 'Conveyor Feed', bonus: '+1📦' },
    'cooling|utility':  { label: 'Conveyor Feed', bonus: '+1📦' },
    'utility|utility':  { label: 'Sensor Array',  bonus: '+3📡' }
  };
  function gridSynergies(grid) {
    const counts = {};
    const synergizedPids = new Set();
    const ampedPids = new Set();
    const visited = new Set();
    const bump = (label, bonus) => {
      if (!counts[label]) counts[label] = { label, bonus, count: 0 };
      counts[label].count++;
    };
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def) continue;
      const shape = shapeFor(def, p.rot);
      for (const [dr, dc] of shape) {
        for (const nid of getNeighbors(grid, p.row + dr, p.col + dc)) {
          if (nid === pid) continue;
          if (visited.has(pid + '|' + nid) || visited.has(nid + '|' + pid)) continue;
          visited.add(pid + '|' + nid);
          const ndef = P[grid.placed[nid].id];
          if (!ndef) continue;
          const sd = SYNERGY_DEFS[[def.type, ndef.type].sort().join('|')];
          if (sd) { bump(sd.label, sd.bonus); synergizedPids.add(pid); synergizedPids.add(nid); }
        }
      }
    }
    const primaryStat = { drill: 'drillPower', cooling: 'cooling', defense: 'hp' };
    const dampedPids = new Set();
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def || def.type !== 'core' || !def.amp) continue;
      const shape = shapeFor(def, p.rot);
      const seen = new Set();
      let amped = 0;
      for (const [dr, dc] of shape) {
        for (const nid of getNeighbors(grid, p.row + dr, p.col + dc)) {
          if (nid === pid || seen.has(nid)) continue;
          seen.add(nid);
          const ndef = P[grid.placed[nid].id];
          if (!ndef) continue;
          const key = primaryStat[ndef.type];
          if (key && ndef.stats[key]) { ampedPids.add(nid); synergizedPids.add(pid); amped++; }
        }
      }
      if (amped > 0) bump(`Reactor Amp +${Math.round(def.amp * 100)}%`, `×${amped}`);
    }
    // Directional parts (Blast Furnace, Cryo Cascade...): tally boosted / scorched
    // neighbors per side so the panel and highlights match computeStats exactly.
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def || !def.dirEffects) continue;
      const shape = shapeFor(def, p.rot);
      for (const eff of def.dirEffects) {
        const [vr, vc] = SIDE_VECS[rotateSide(eff.side, p.rot)];
        const seen = new Set();
        let hit = 0;
        for (const [dr, dc] of shape) {
          const r = p.row + dr + vr, c = p.col + dc + vc;
          if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue;
          const nid = grid.cells[r][c];
          if (!nid || nid === pid || seen.has(nid)) continue;
          seen.add(nid);
          const ndef = P[grid.placed[nid].id];
          if (!ndef || !partPrimary(ndef)) continue;
          (eff.amp > 0 ? ampedPids : dampedPids).add(nid);
          synergizedPids.add(pid);
          hit++;
        }
        if (hit > 0) {
          const pct = Math.round(Math.abs(eff.amp) * 100);
          bump(eff.amp > 0 ? `Directional Feed +${pct}%` : `Exhaust Scorch −${pct}%`, `×${hit}`);
        }
      }
    }
    // Nest amps (Crucible Ring): the part cradled in the hollow.
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def || !def.nestAmp) continue;
      const seen = new Set();
      let nested = 0;
      for (const [hr, hc] of shapeHoles(def, p.rot)) {
        const r = p.row + hr, c = p.col + hc;
        if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue;
        const nid = grid.cells[r][c];
        if (!nid || nid === pid || seen.has(nid)) continue;
        seen.add(nid);
        const ndef = P[grid.placed[nid].id];
        if (!ndef || !partPrimary(ndef)) continue;
        ampedPids.add(nid);
        synergizedPids.add(pid);
        nested++;
      }
      if (nested > 0) bump(`Nested Amp +${Math.round(def.nestAmp * 100)}%`, `×${nested}`);
    }
    return { synergies: Object.values(counts), synergizedPids, ampedPids, dampedPids };
  }

  // -- Simulation --
  function simulateRun(robotStats, maxDepth, policy) {
    policy = policy || { cargoFull: true, hpPct: 0.25 };
    const log = [];
    let depth = (maxDepth || 0) + 1;
    let hp = robotStats.hp;
    let heat = 0;
    let cargo = [];
    let cargoMax = Math.floor(robotStats.cargo);
    let totalItems = 0;
    let foundParts = [];
    let totalGold = 0;
    let dead = false;

    // Price lookup for discarding cheapest item.
    const commodityPrice = {};
    COMMODITIES.forEach(c => commodityPrice[c.id] = c.baseValue);
    const minCommodityValue = Math.min(...COMMODITIES.map(c => c.baseValue)); // the cheapest tier (iron)

    // Add items to cargo; if over limit, discard the cheapest until within limit.
    function addToCargo(items) {
      for (const id of items) cargo.push(id);
      while (cargo.length > cargoMax) {
        // Find cheapest item(s) — pick the first one at the lowest price.
        let cheapestIdx = 0;
        let cheapestPrice = commodityPrice[cargo[0]] || 0;
        for (let i = 1; i < cargo.length; i++) {
          const p = commodityPrice[cargo[i]] || 0;
          if (p < cheapestPrice) { cheapestPrice = p; cheapestIdx = i; }
        }
        cargo.splice(cheapestIdx, 1);
      }
    }

    const step = () => {
      if (dead) {
        log.push({ depth, text: '❌ SYSTEMS FAILED — drill lost.', hp, heat, cargo: cargo.length, cargoItems: cargo });
        return { depth, hp, cargo, log, foundParts, gold: totalGold, maxDepth: depth, surfaced: false };
      }

      const speed = robotStats.speed;
      const steps = Math.max(1, Math.floor(speed));
      for (let s = 0; s < steps; s++) {
        depth++;
        const hardness = rockHardness(depth);
        const drillEff = robotStats.drillPower - hardness;
        let entry = '';
        let heatChange = robotStats.heatGen;

        if (drillEff >= 0) {
          entry = `D:${depth} | Progress OK. `;
        } else {
          const penalty = Math.abs(drillEff);
          entry = `D:${depth} | Slow progress (-${penalty} eff). `;
          heatChange += penalty;
        }

        const netHeat = heatChange - robotStats.cooling;
        heat += Math.max(0, netHeat);

        if (heat > 40) {
          const dmg = Math.floor((heat - 40) * 0.5);
          hp -= dmg;
          entry += `⚠ OVERHEAT -${dmg} HP. `;
          heat = Math.max(0, heat - 10);
          if (hp <= 0) {
            entry += '❌ Drill destroyed!';
            log.push({ depth, text: entry, hp: 0, heat, cargo: cargo.length, cargoItems: cargo });
            dead = true;
            return { depth, hp: 0, heat, cargo, log, foundParts, gold: totalGold, maxDepth: depth, surfaced: false };
          }
        } else if (heat > 25) {
          entry += `🌡 Heat ${heat.toFixed(0)}/40. `;
        }

        if (cargo.length >= cargoMax) {
          entry += '📦 Cargo full. ';
        }

        const evt = getEvent(depth, robotStats.detect);
        if (evt.type === 'loot') {
          const before = cargo.length;
          addToCargo(evt.items);
          totalItems += evt.items.length;
          const discarded = evt.items.length - (cargo.length - before);
          entry += evt.text;
          if (discarded > 0) {
            const map = {}; COMMODITIES.forEach(c => map[c.id] = c);
            entry += ` (discarded ${discarded} ${map[evt.comId]?.name || 'ore'} — cargo full)`;
          }
        } else if (evt.type === 'enemy') {
          const reduced = Math.max(0, evt.damage - robotStats.armor);
          hp -= reduced;
          entry += evt.text + (robotStats.armor > 0 ? ` (armor blocked ${evt.damage - reduced})` : '');
          if (hp <= 0) {
            entry += ' ❌ Destroyed!';
            log.push({ depth, text: entry, hp: 0, heat, cargo: cargo.length, cargoItems: cargo });
            dead = true;
            return { depth, hp: 0, heat, cargo, log, foundParts, gold: totalGold, maxDepth: depth, surfaced: false };
          }
        } else if (evt.type === 'hazard') {
          heat += evt.heatSpike;
          entry += evt.text;
        } else if (evt.type === 'fragment') {
          foundParts.push(evt.partId);
          entry += evt.text;
        } else if (evt.type === 'rare_ore') {
          totalGold += evt.gold;
          entry += evt.text;
        } else if (depth % 3 === 0) {
          entry += `Drilling steady...`;
        } else {
          entry += evt.text;
        }

        log.push({ depth, text: entry, hp: Math.max(0, hp), heat, cargo: cargo.length, cargoItems: cargo, cumItems: totalItems, cumGold: totalGold });

        // -- Auto-return policy: surface deliberately instead of running to the cap --
        // Smart cargo return: only bank once the hold is FULL of *valuable* goods — no
        // cheapest-tier (iron) items left to upgrade. While cheap items remain, staying
        // down keeps improving the haul (each new vein discards the cheapest), so the
        // drone holds on rather than surfacing the instant it fills.
        if (policy.cargoFull && cargo.length >= cargoMax &&
            Math.min(...cargo.map(id => commodityPrice[id] || 0)) > minCommodityValue) {
          log.push({ depth, text: '💎 Hold full of valuable goods — banking the haul.', hp: Math.max(0, hp), heat: 0, cargo: cargo.length, cargoItems: cargo, cumItems: totalItems, cumGold: totalGold });
          return { depth, hp, heat, cargo, log, foundParts, gold: totalGold, maxDepth: depth, surfaced: true };
        }
        if (policy.hpPct > 0 && hp <= robotStats.hp * policy.hpPct) {
          const pct = Math.round((hp / robotStats.hp) * 100);
          log.push({ depth, text: `⬆ Hull at ${pct}% — emergency ascent.`, hp: Math.max(0, hp), heat: 0, cargo: cargo.length, cargoItems: cargo, cumItems: totalItems, cumGold: totalGold });
          return { depth, hp, heat, cargo, log, foundParts, gold: totalGold, maxDepth: depth, surfaced: true };
        }
      }

      return null;
    };

    let result;
    let safety = 2000;
    while (!result && safety > 0) {
      result = step();
      safety--;
    }

    if (!result) {
      result = { depth, hp, cargo, log, foundParts, gold: totalGold, maxDepth: depth, surfaced: true };
      log.push({ depth, text: '🔄 Surface reached. Safe return.', hp, heat: 0, cargo: cargo.length, cargoItems: cargo });
    }

    result.surfaced = result.hp > 0;
    if (!result.maxDepth) result.maxDepth = depth;
    return result;
  }

  // -- Fragments & recycling --
  // Add one fragment toward partId; auto-craft a full part into inventory once the
  // rarity threshold (2 rare / 3 unique) is reached. Returns crafting outcome.
  function addFragment(state, partId) {
    if (!state.fragments) state.fragments = {};
    const def = P[partId];
    const needed = def && def.rarity === 'unique' ? 3 : 2;
    state.fragments[partId] = (state.fragments[partId] || 0) + 1;
    let crafted = false;
    if (state.fragments[partId] >= needed) {
      state.fragments[partId] = 0;
      state.inventory.push(partId);
      crafted = true;
    }
    return { crafted, now: state.fragments[partId], needed };
  }

  // Recycling a part yields a little gold and fills a salvage meter (0–100); rarer
  // parts contribute more. When the meter fills it awards a fragment toward a random
  // rare/unique part (which auto-crafts at its threshold). Caller must already have
  // removed the part from the grid/inventory.
  const RECYCLE_GOLD = { common: 5, uncommon: 10, rare: 20, unique: 35 };
  const RECYCLE_PROGRESS = { common: 10, uncommon: 20, rare: 40, unique: 70 };

  function craftablePartIds() {
    return Object.keys(P).filter(id => (P[id].rarity === 'rare' || P[id].rarity === 'unique') && !P[id].upgradeOf);
  }

  // Baseline odds that an awarded craft fragment is for a unique (vs a rare). Kept low
  // so uniques stay rare prizes; callers (e.g. deep caches) may pass a higher chance.
  const UNIQUE_FRAGMENT_CHANCE = 0.12;
  function randomCraftable(uniqueChance) {
    if (uniqueChance == null) uniqueChance = UNIQUE_FRAGMENT_CHANCE;
    const rares = [], uniques = [];
    for (const id of craftablePartIds()) (P[id].rarity === 'unique' ? uniques : rares).push(id);
    const pool = (uniques.length && Math.random() < uniqueChance) ? uniques : (rares.length ? rares : uniques);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  function recyclePart(state, partId) {
    const def = P[partId];
    const rarity = def ? def.rarity : 'common';
    const gold = RECYCLE_GOLD[rarity] || 5;
    state.gold += gold;
    state.recycleProgress = (state.recycleProgress || 0) + (RECYCLE_PROGRESS[rarity] || 10);
    const out = { gold, filled: false, awardedPartId: null, crafted: false };
    if (state.recycleProgress >= 100) {
      state.recycleProgress -= 100;
      const awardId = randomCraftable();
      if (awardId) {
        const res = addFragment(state, awardId);
        out.filled = true;
        out.awardedPartId = awardId;
        out.crafted = res.crafted;
        out.fragNow = res.now;
        out.fragNeeded = res.needed;
      }
    }
    out.progress = state.recycleProgress;
    return out;
  }

  // -- Mk II upgrades (combine 2 of a part + gold → its next tier) --
  // Gold cost to combine two copies of `partId` into one Mk II.
  function upgradeCost(partId) {
    const def = P[partId];
    if (!def || !def.upgradeTo) return 0;
    return Math.round(def.cost * 1.5);
  }

  // Whether the player currently holds enough copies (and the part has an upgrade).
  // Gold is checked by upgradePart so the UI can still show the button when short.
  function canUpgrade(state, partId) {
    const def = P[partId];
    if (!def || !def.upgradeTo) return false;
    return state.inventory.filter(id => id === partId).length >= 2;
  }

  // Plan a cascading merge starting at `partId`: greedily combine pairs tier by tier,
  // carrying produced parts up into the next tier (and into any copies already held
  // there), as far as the player's copies and gold allow. Pure — mutates nothing.
  // Returns { steps:[{id,cost}], resultId, merges, totalCost, affordable }.
  function planUpgrade(state, partId) {
    const def = P[partId];
    if (!def || !def.upgradeTo) return null;
    // Tally current copies for the family from partId upward (higher tiers feed carries).
    const counts = {};
    for (let id = partId; id; id = P[id] && P[id].upgradeTo) {
      counts[id] = state.inventory.filter(x => x === id).length;
    }
    let gold = state.gold, totalCost = 0;
    const steps = [];
    for (let cur = partId; P[cur] && P[cur].upgradeTo; cur = P[cur].upgradeTo) {
      const cost = upgradeCost(cur);
      while (counts[cur] >= 2 && gold >= cost) {
        counts[cur] -= 2;
        const up = P[cur].upgradeTo;
        counts[up] = (counts[up] || 0) + 1;
        gold -= cost; totalCost += cost;
        steps.push({ id: cur, cost });
      }
    }
    if (!steps.length) {
      return { steps, resultId: def.upgradeTo, merges: 0, totalCost: upgradeCost(partId), affordable: false };
    }
    const resultId = P[steps[steps.length - 1].id].upgradeTo;
    return { steps, resultId, merges: steps.length, totalCost, affordable: true };
  }

  // Execute the cascading merge (see planUpgrade). Steps are applied low → high, so each
  // higher-tier combine finds the parts the earlier steps produced. Returns
  // { ok, upgradedId, merges, cost }.
  function upgradePart(state, partId) {
    const plan = planUpgrade(state, partId);
    if (!plan || !plan.merges) return { ok: false };
    for (const step of plan.steps) {
      let removed = 0;
      for (let i = state.inventory.length - 1; i >= 0 && removed < 2; i--) {
        if (state.inventory[i] === step.id) { state.inventory.splice(i, 1); removed++; }
      }
      state.gold -= step.cost;
      state.inventory.push(P[step.id].upgradeTo);
    }
    return { ok: true, upgradedId: plan.resultId, merges: plan.merges, cost: plan.totalCost };
  }

  // -- Chassis (Rig Bay) --
  // Chassis are persistent purchases: buy once (gold + best-depth gate), own forever,
  // swap freely between runs. Swapping replaces the grid with a fresh one for the new
  // frame and returns every placed part to inventory.
  function buyChassis(state, chassisId) {
    const def = DrillDown.CHASSIS[chassisId];
    if (!def) return { ok: false, reason: 'unknown' };
    if (!state.ownedChassis) state.ownedChassis = ['scrap_frame'];
    if (state.ownedChassis.includes(chassisId)) return { ok: false, reason: 'owned' };
    if ((def.requires || 0) > (state.bestDepth || 0)) return { ok: false, reason: 'depth' };
    if (state.gold < def.cost) return { ok: false, reason: 'gold' };
    state.gold -= def.cost;
    state.ownedChassis.push(chassisId);
    return { ok: true };
  }

  function swapChassis(state, chassisId) {
    if (!DrillDown.CHASSIS[chassisId]) return { ok: false };
    if (!(state.ownedChassis || []).includes(chassisId)) return { ok: false };
    let returned = 0;
    for (const pid of Object.keys(state.grid.placed)) {
      const p = removePart(state.grid, pid);
      if (p) { state.inventory.push(p.id); returned++; }
    }
    state.grid = createChassisGrid(chassisId);
    return { ok: true, returned };
  }

  // -- Shop --
  // Flat premium charged for the (otherwise craft-only) unique parts that appear in
  // the shop at extreme depths — a gold shortcut around the fragment grind.
  const SHOP_UNIQUE_PRICE = 600;

  // Cost to reroll (restock) the shop without doing a run.
  const REROLL_COST = 25;

  // Shop stock scales with how deep you've reached: the deeper your best run, the more
  // the mix shifts from commons toward rares, and at extreme depths a single premium
  // unique slot opens up. Returns the slot counts per rarity for a given best depth.
  function shopPlan(bestDepth) {
    bestDepth = bestDepth || 0;
    if (bestDepth >= 300) return { name: 'Inner Core', common: 1, uncommon: 1, rare: 3, unique: 1 };
    if (bestDepth >= 150) return { name: 'Outer Core', common: 1, uncommon: 2, rare: 3, unique: 0 };
    if (bestDepth >= 75)  return { name: 'Deep Mantle', common: 2, uncommon: 2, rare: 2, unique: 0 };
    if (bestDepth >= 25)  return { name: 'Mantle', common: 2, uncommon: 3, rare: 1, unique: 0 };
    return { name: 'Surface', common: 3, uncommon: 2, rare: 1, unique: 0 };
  }

  function generateShop(runNumber, bestDepth) {
    const pool = { common: [], uncommon: [], rare: [], unique: [] };
    for (const [id, def] of Object.entries(P)) {
      if (def.upgradeOf) continue;               // Mk II upgrades are combine-only, never sold
      if (pool[def.rarity]) pool[def.rarity].push(id);
    }
    const shop = [];
    const counts = shopPlan(bestDepth);
    for (const rarity of ['common', 'uncommon', 'rare', 'unique']) {
      const count = counts[rarity] || 0;
      const available = pool[rarity].filter(id => !shop.includes(id));
      for (let i = 0; i < count && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        shop.push(available[idx]);
        available.splice(idx, 1);
      }
    }
    return shop;
  }

  function shopCost(partId) {
    const def = P[partId];
    if (!def) return 0;
    return def.rarity === 'unique' ? SHOP_UNIQUE_PRICE : def.cost;
  }

  // -- Save / load / migration --
  // Bump SAVE_VERSION whenever the persisted state shape changes. `migrate` then
  // normalizes any older (or current) save up to this shape, so adding a new field
  // never breaks an existing player's save. Keep the field defaults below in sync
  // with defaultState() in main.js.
  const SAVE_VERSION = 4;
  const SAVE_KEY = 'drill_down_save';

  function save(state) {
    try {
      const data = {
        version: SAVE_VERSION,
        gold: state.gold,
        grid: state.grid,
        inventory: state.inventory,
        fragments: state.fragments || {},
        recycleProgress: state.recycleProgress || 0,
        returnPolicy: state.returnPolicy || { cargoFull: true, hpPct: 0.25 },
        milestones: state.milestones || [],
        shop: state.shop || [],
        ownedChassis: state.ownedChassis || ['scrap_frame'],
        runNumber: state.runNumber,
        lastDepth: state.lastDepth,
        bestDepth: state.bestDepth,
        highScore: state.highScore,
        totalRuns: state.totalRuns,
        streak: state.streak
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch(e) {
      console.warn('Save failed:', e);
    }
  }

  // Fill missing/invalid fields with safe defaults and stamp the current version.
  // Idempotent: running it on an already-current save is a no-op beyond the stamp.
  function migrate(data) {
    if (!data || typeof data !== 'object') return null;

    if (!data.grid || !Array.isArray(data.grid.cells) || !data.grid.placed) data.grid = createGrid(3, 4);
    if (!Array.isArray(data.inventory)) data.inventory = [];
    if (!data.fragments || typeof data.fragments !== 'object') data.fragments = {};
    if (typeof data.recycleProgress !== 'number' || isNaN(data.recycleProgress)) data.recycleProgress = 0;
    if (!data.returnPolicy || typeof data.returnPolicy !== 'object') {
      data.returnPolicy = { cargoFull: true, hpPct: 0.25 };
    } else {
      if (typeof data.returnPolicy.cargoFull !== 'boolean') data.returnPolicy.cargoFull = true;
      if (typeof data.returnPolicy.hpPct !== 'number') data.returnPolicy.hpPct = 0.25;
    }
    if (!Array.isArray(data.milestones)) data.milestones = [];
    if (typeof data.gold !== 'number' || isNaN(data.gold)) data.gold = 0;
    if (typeof data.runNumber !== 'number') data.runNumber = 1;
    if (typeof data.lastDepth !== 'number') data.lastDepth = 0;
    if (typeof data.bestDepth !== 'number') data.bestDepth = 0;
    if (typeof data.totalRuns !== 'number') data.totalRuns = 0;
    if (typeof data.streak !== 'number' || isNaN(data.streak)) data.streak = 0;
    if (typeof data.highScore !== 'number') data.highScore = 0;
    // Shop wasn't persisted before v2 — generate one so the shop never opens empty/undefined.
    if (!Array.isArray(data.shop)) data.shop = generateShop(data.runNumber, data.bestDepth);

    // Chassis (v3): pre-chassis saves keep their grid as-is (including any old paid
    // expansions) but get the starter chassis identity and no zone cells. Owned list
    // always contains the starter and whatever is currently equipped.
    if (!Array.isArray(data.ownedChassis)) data.ownedChassis = [];
    data.ownedChassis = data.ownedChassis.filter(id => DrillDown.CHASSIS[id]);
    if (!data.ownedChassis.includes('scrap_frame')) data.ownedChassis.unshift('scrap_frame');
    if (!data.grid.chassis || !DrillDown.CHASSIS[data.grid.chassis]) {
      data.grid.chassis = 'scrap_frame';
      data.grid.mods = {};
    }
    if (!data.grid.mods || typeof data.grid.mods !== 'object') data.grid.mods = {};
    for (const key of Object.keys(data.grid.mods)) {
      const [r, c] = key.split(',').map(Number);
      if (!DrillDown.CELL_MODS[data.grid.mods[key]] ||
          isNaN(r) || isNaN(c) || r < 0 || r >= data.grid.rows || c < 0 || c >= data.grid.cols) {
        delete data.grid.mods[key];
      }
    }
    if (!data.ownedChassis.includes(data.grid.chassis)) data.ownedChassis.push(data.grid.chassis);

    // Drop anything referencing a part id that no longer exists in PARTS.
    data.inventory = data.inventory.filter(id => P[id]);
    data.shop = data.shop.filter(id => P[id]);
    for (const id of Object.keys(data.fragments)) if (!P[id]) delete data.fragments[id];
    for (const pid of Object.keys(data.grid.placed)) {
      const p = data.grid.placed[pid];
      if (!p || !P[p.id]) delete data.grid.placed[pid];
    }

    // Rotation & voids (v4): placed parts store `rot` (0–3 quarter-turns) instead of the
    // old `rotated` transpose boolean, and grids may carry structural voids. Rebuild the
    // cells array from `placed` under the new shape math; any part that no longer fits
    // (footprint changed, or now over a void) returns to inventory instead of corrupting
    // the grid.
    if (!data.grid.voids || typeof data.grid.voids !== 'object') data.grid.voids = {};
    for (const key of Object.keys(data.grid.voids)) {
      const [r, c] = key.split(',').map(Number);
      if (isNaN(r) || isNaN(c) || r < 0 || r >= data.grid.rows || c < 0 || c >= data.grid.cols) {
        delete data.grid.voids[key];
      }
    }
    data.grid.cells = [];
    for (let r = 0; r < data.grid.rows; r++) data.grid.cells.push(new Array(data.grid.cols).fill(null));
    for (const pid of Object.keys(data.grid.placed)) {
      const p = data.grid.placed[pid];
      p.rot = typeof p.rot === 'number' ? ((p.rot % 4) + 4) % 4 : (p.rotated ? 1 : 0);
      delete p.rotated;
      const shape = shapeFor(p.id, p.rot);
      const fits = shape.every(([dr, dc]) => {
        const r = p.row + dr, c = p.col + dc;
        return r >= 0 && r < data.grid.rows && c >= 0 && c < data.grid.cols &&
               !data.grid.voids[r + ',' + c] && data.grid.cells[r][c] === null;
      });
      if (fits) {
        for (const [dr, dc] of shape) data.grid.cells[p.row + dr][p.col + dc] = pid;
      } else {
        delete data.grid.placed[pid];
        data.inventory.push(p.id);
      }
    }

    data.version = SAVE_VERSION;
    return data;
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch(e) {
      console.warn('Load failed:', e);
      return null;
    }
  }

  return {
    createGrid, createChassisGrid, cloneGrid, canPlace, placePart, removePart, getPartAt, expandGrid,
    rotateShape, shapeFor, rotateSide, shapeHoles,
    buyChassis, swapChassis,
    computeStats, rockHardness, getEvent, simulateRun,
    generateShop, shopCost, shopPlan, REROLL_COST,
    addFragment, recyclePart, RECYCLE_GOLD, RECYCLE_PROGRESS,
    upgradeCost, canUpgrade, upgradePart, planUpgrade,
    zoneFor, MILESTONES, gridSynergies,
    save, load, migrate, SAVE_VERSION,
    COMMODITIES, commodityForDepth, cargoValue
  };
})();
