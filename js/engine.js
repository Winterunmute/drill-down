DrillDown.Engine = (() => {
  const P = DrillDown.PARTS;

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

  function cloneGrid(grid) {
    const g = createGrid(grid.rows, grid.cols);
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      g.placed[pid] = { ...p };
      for (const [dr, dc] of P[p.id].shape) {
        g.cells[p.row + dr][p.col + dc] = pid;
      }
    }
    return g;
  }

  function canPlace(grid, partId, row, col, rotated) {
    const def = P[partId];
    if (!def) return false;
    const shape = rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    for (const [dr, dc] of shape) {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) return false;
      if (grid.cells[r][c] !== null) return false;
    }
    return true;
  }

  function placePart(grid, partId, row, col, rotated) {
    if (!canPlace(grid, partId, row, col, rotated)) return false;
    const pid = partId + '_' + Date.now() + Math.random().toString(36).slice(2,6);
    const def = P[partId];
    const shape = rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    grid.placed[pid] = { id: partId, row, col, rotated, pid };
    for (const [dr, dc] of shape) {
      grid.cells[row + dr][col + dc] = pid;
    }
    return pid;
  }

  function removePart(grid, pid) {
    const p = grid.placed[pid];
    if (!p) return null;
    const def = P[p.id];
    const shape = p.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    for (const [dr, dc] of shape) {
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
      const shape = p.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
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
      if (!def || def.type !== 'core') continue;
      const amp = def.amp || 0.25;
      const shape = p.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
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
      const shape = p.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
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
    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def || def.type !== 'core') continue;
      const shape = p.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
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
      if (amped > 0) bump(`Reactor Amp +${Math.round((def.amp || 0.25) * 100)}%`, `×${amped}`);
    }
    return { synergies: Object.values(counts), synergizedPids, ampedPids };
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
        if (policy.cargoFull && cargo.length >= cargoMax) {
          log.push({ depth, text: '📦 Cargo hold full — auto-returning to surface.', hp: Math.max(0, hp), heat: 0, cargo: cargo.length, cargoItems: cargo, cumItems: totalItems, cumGold: totalGold });
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
  const SAVE_VERSION = 2;
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

    // Drop anything referencing a part id that no longer exists in PARTS.
    data.inventory = data.inventory.filter(id => P[id]);
    data.shop = data.shop.filter(id => P[id]);
    for (const id of Object.keys(data.fragments)) if (!P[id]) delete data.fragments[id];
    for (const pid of Object.keys(data.grid.placed)) {
      const p = data.grid.placed[pid];
      if (!p || !P[p.id]) {
        delete data.grid.placed[pid];
        const cells = data.grid.cells;
        for (let r = 0; r < cells.length; r++)
          for (let c = 0; c < cells[r].length; c++)
            if (cells[r][c] === pid) cells[r][c] = null;
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
    createGrid, cloneGrid, canPlace, placePart, removePart, getPartAt, expandGrid,
    computeStats, rockHardness, getEvent, simulateRun,
    generateShop, shopCost, shopPlan, REROLL_COST,
    addFragment, recyclePart, RECYCLE_GOLD, RECYCLE_PROGRESS,
    upgradeCost, canUpgrade, upgradePart, planUpgrade,
    zoneFor, MILESTONES, gridSynergies,
    save, load, migrate, SAVE_VERSION,
    COMMODITIES, commodityForDepth, cargoValue
  };
})();
