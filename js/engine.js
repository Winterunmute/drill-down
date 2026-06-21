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
    // adjacency bonuses
    const adjacencyBonus = { cooling: 0, hp: 0, cargo: 0 };
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
          const np = grid.placed[nid];
          const ndef = P[np.id];
          if (ndef.type === 'cooling' && def.type === 'drill') adjacencyBonus.cooling += 2;
          if (ndef.type === 'drill' && def.type === 'cooling') adjacencyBonus.cooling += 2;
          if (ndef.type === 'defense' && def.type === 'defense') adjacencyBonus.hp += 3;
          if (ndef.type === 'utility' && (def.type === 'drill' || def.type === 'cooling')) adjacencyBonus.cargo += 1;
        }
      }
    }
    stats.cooling += adjacencyBonus.cooling;
    stats.hp += adjacencyBonus.hp;
    stats.cargo += adjacencyBonus.cargo;
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
      const ore = Math.floor(4 + depth * 0.2 + Math.random() * 4);
      return { type: 'loot', text: `Ore vein! +${ore} ore`, ore };
    }
    if (roll < 30 + depth * 0.15) {
      const enemy = depth < 20 ? 'Rock Worm' : depth < 50 ? 'Crystal Spider' : 'Magma Drake';
      const damage = Math.floor(3 + depth * 0.15 + Math.random() * 4);
      return { type: 'enemy', text: `${enemy} attacks! -${damage} HP`, damage };
    }
    if (roll < 40 + depth * 0.1) {
      const spike = Math.floor(5 + depth * 0.2);
      return { type: 'hazard', text: `Heat vent! +${spike} heat`, heatSpike: spike };
    }
    return { type: 'nothing', text: 'Nothing unusual.' };
  }

  // -- Simulation --
  function simulateRun(robotStats, maxDepth) {
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
    save, load
  };
})();
