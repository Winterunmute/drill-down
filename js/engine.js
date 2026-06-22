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
      const craftIds = Object.keys(P).filter(id => P[id].rarity === 'rare' || P[id].rarity === 'unique');
      if (craftIds.length > 0) {
        const chosen = craftIds[Math.floor(Math.random() * craftIds.length)];
        const needed = P[chosen].rarity === 'unique' ? 3 : 2;
        return { type: 'fragment', text: `Ancient cache! ${P[chosen].name} fragment (1/${needed})`, partId: chosen };
      }
    }
    if (roll < 15 + lootChance * 0.3) {
      // Deeper veins are richer — the payoff for risking the descent.
      const ore = Math.floor(4 + depth * 0.35 + Math.random() * 4);
      return { type: 'loot', text: `Ore vein! +${ore} ore`, ore };
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
    policy = policy || { cargoFull: true, hpPct: 0 };
    const log = [];
    let depth = (maxDepth || 0) + 1;
    let hp = robotStats.hp;
    let heat = 0;
    let cargo = 0;
    let cargoMax = robotStats.cargo;
    let totalOre = 0;
    let foundParts = [];
    let totalGold = 0;
    let dead = false;

    const step = () => {
      if (dead) {
        log.push({ depth, text: '❌ SYSTEMS FAILED — drill lost.', hp, heat, cargo });
        return { depth, hp, cargo, log, ore: totalOre, foundParts, gold: totalGold, maxDepth: depth, surfaced: false };
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
            log.push({ depth, text: entry, hp: 0, heat, cargo });
            dead = true;
            return { depth, hp: 0, heat, cargo, log, ore: totalOre, foundParts, gold: totalGold, maxDepth: depth, surfaced: false };
          }
        } else if (heat > 25) {
          entry += `🌡 Heat ${heat.toFixed(0)}%. `;
        }

        if (cargo >= cargoMax) {
          entry += '📦 Cargo full. ';
        }

        const evt = getEvent(depth, robotStats.detect);
        if (evt.type === 'loot') {
          const space = cargoMax - cargo;
          const taken = Math.min(evt.ore, Math.max(0, space));
          cargo += taken;
          totalOre += taken;
          entry += evt.text;
          if (taken < evt.ore) entry += ' (some lost, cargo full)';
        } else if (evt.type === 'enemy') {
          const reduced = Math.max(0, evt.damage - robotStats.armor);
          hp -= reduced;
          entry += evt.text + (robotStats.armor > 0 ? ` (armor blocked ${evt.damage - reduced})` : '');
          if (hp <= 0) {
            entry += ' ❌ Destroyed!';
            log.push({ depth, text: entry, hp: 0, heat, cargo });
            dead = true;
            return { depth, hp: 0, heat, cargo, log, ore: totalOre, foundParts, gold: totalGold, maxDepth: depth, surfaced: false };
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

        log.push({ depth, text: entry, hp: Math.max(0, hp), heat, cargo, cumOre: totalOre, cumGold: totalGold });

        // -- Auto-return policy: surface deliberately instead of running to the cap --
        if (policy.cargoFull && cargo >= cargoMax) {
          log.push({ depth, text: '📦 Cargo hold full — auto-returning to surface.', hp: Math.max(0, hp), heat: 0, cargo, cumOre: totalOre, cumGold: totalGold });
          return { depth, hp, heat, cargo, log, ore: totalOre, foundParts, gold: totalGold, maxDepth: depth, surfaced: true };
        }
        if (policy.hpPct > 0 && hp <= robotStats.hp * policy.hpPct) {
          const pct = Math.round((hp / robotStats.hp) * 100);
          log.push({ depth, text: `⬆ Hull at ${pct}% — emergency ascent.`, hp: Math.max(0, hp), heat: 0, cargo, cumOre: totalOre, cumGold: totalGold });
          return { depth, hp, heat, cargo, log, ore: totalOre, foundParts, gold: totalGold, maxDepth: depth, surfaced: true };
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
      result = { depth, hp, cargo, log, ore: totalOre, foundParts, gold: totalGold, maxDepth: depth, surfaced: true };
      log.push({ depth, text: '🔄 Surface reached. Safe return.', hp, heat: 0, cargo });
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
    return Object.keys(P).filter(id => P[id].rarity === 'rare' || P[id].rarity === 'unique');
  }

  function randomCraftable() {
    const rares = [], uniques = [];
    for (const id of craftablePartIds()) (P[id].rarity === 'unique' ? uniques : rares).push(id);
    const pool = (uniques.length && Math.random() < 0.25) ? uniques : (rares.length ? rares : uniques);
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

  // -- Shop --
  function generateShop(runNumber) {
    const pool = { common: [], uncommon: [], rare: [] };
    for (const [id, def] of Object.entries(P)) {
      if (def.rarity !== 'unique') pool[def.rarity].push(id);
    }
    const shop = [];
    const counts = { common: 3, uncommon: 2, rare: 1 };
    for (const [rarity, count] of Object.entries(counts)) {
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
    return P[partId].cost;
  }

  // -- Save --
  function save(state) {
    try {
      const data = {
        gold: state.gold,
        grid: state.grid,
        inventory: state.inventory,
        fragments: state.fragments || {},
        recycleProgress: state.recycleProgress || 0,
        returnPolicy: state.returnPolicy || { cargoFull: true, hpPct: 0 },
        milestones: state.milestones || [],
        runNumber: state.runNumber,
        lastDepth: state.lastDepth,
        bestDepth: state.bestDepth,
        highScore: state.highScore,
        totalRuns: state.totalRuns
      };
      localStorage.setItem('drill_down_save', JSON.stringify(data));
    } catch(e) {
      console.warn('Save failed:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem('drill_down_save');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) {
      return null;
    }
  }

  return {
    createGrid, cloneGrid, canPlace, placePart, removePart, getPartAt, expandGrid,
    computeStats, rockHardness, getEvent, simulateRun,
    generateShop, shopCost,
    addFragment, recyclePart, RECYCLE_GOLD, RECYCLE_PROGRESS,
    zoneFor, MILESTONES, gridSynergies,
    save, load
  };
})();
