DrillDown.UI = (() => {
  const Eng = DrillDown.Engine;
  const P = DrillDown.PARTS;
  const CELL = 76;
  const GAP = 2;

  let dragState = null;
  let tooltipEl = null;

  function initTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'part-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
  }

  function showTooltip(partId, e) {
    const def = P[partId];
    if (!def) return;
    const lines = [];
    lines.push(`<div class="tt-header" style="color:${DrillDown.RARITY_COLORS[def.rarity]}">${def.emoji} ${def.name}</div>`);
    lines.push(`<div class="tt-rarity">${def.rarity.toUpperCase()}</div>`);
    if (def.stats.drillPower) lines.push(`⬇ Drill Power: <b>${def.stats.drillPower}</b> <span class="tt-desc">overcomes rock</span>`);
    if (def.stats.heatGen) lines.push(`🌡 Heat Gen: <b>+${def.stats.heatGen}/step</b> <span class="tt-desc">generated while drilling</span>`);
    if (def.stats.cooling) lines.push(`❄ Cooling: <b>${def.stats.cooling}</b> <span class="tt-desc">reduces heat per tick</span>`);
    if (def.stats.hp) lines.push(`❤ HP: <b>+${def.stats.hp}</b> <span class="tt-desc">max health bonus</span>`);
    if (def.stats.armor) lines.push(`🛡 Armor: <b>${def.stats.armor}</b> <span class="tt-desc">reduces incoming damage</span>`);
    if (def.stats.cargo) lines.push(`📦 Cargo: <b>+${def.stats.cargo}</b> <span class="tt-desc">ore capacity</span>`);
    if (def.stats.speed) lines.push(`⚡ Speed: <b>+${def.stats.speed}</b> <span class="tt-desc">ticks per step</span>`);
    if (def.stats.detect) lines.push(`📡 Detect: <b>+${def.stats.detect}%</b> <span class="tt-desc">loot chance bonus</span>`);
    if (def.cost) lines.push(`<div class="tt-cost">💰 ${def.cost}g</div>`);

    tooltipEl.innerHTML = lines.join('<br>');
    tooltipEl.style.display = 'block';
    positionTooltip(e);
  }

  function positionTooltip(e) {
    if (!tooltipEl) return;
    let x = e.clientX + 16;
    let y = e.clientY + 12;
    const rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 10) x = e.clientX - rect.width - 16;
    if (y + rect.height > window.innerHeight - 10) y = e.clientY - rect.height - 12;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
  }

  function renderTitle() {
    const cont = document.getElementById('screen-title');
    cont.innerHTML = `
      <div class="title-content">
        <h1 class="title-logo">⬇ DRILL DOWN ⬇</h1>
        <p class="title-sub">Build. Drill. Deeper.</p>
        <div class="title-buttons">
          <button class="btn btn-primary" id="btn-new-run">New Run</button>
          <button class="btn btn-secondary" id="btn-continue" style="${Eng.load() ? '' : 'display:none'}">Continue</button>
        </div>
        <div class="title-hint">Drag parts onto your rig. Launch to drill into the depths.<br>Deeper = better loot. Don't overheat.</div>
      </div>
    `;
    document.getElementById('btn-new-run').onclick = () => DrillDown.Game.newRun();
    const contBtn = document.getElementById('btn-continue');
    if (contBtn) contBtn.onclick = () => DrillDown.Game.continueRun();
  }

  function createPartElement(partId, opts = {}) {
    const def = P[partId];
    if (!def) return null;
    const el = document.createElement('div');
    el.className = 'part-card';
    el.dataset.partId = partId;

    const canAfford = opts.fromShop ? (DrillDown.Game.state.gold >= def.cost) : true;
    if (!canAfford) el.classList.add('part-cant-afford');
    el.style.borderColor = canAfford ? (DrillDown.RARITY_COLORS[def.rarity] || '#fff') : '#444';

    const displayShape = opts.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    const w = Math.max(...displayShape.map(([r,c]) => c)) + 1;
    const h = Math.max(...displayShape.map(([r,c]) => r)) + 1;
    el.style.width = (w * 52) + 'px';
    el.style.height = (h * 52) + 'px';

    const statsLine = statSummary(def);
    el.innerHTML = `
      <div class="part-card-bg" style="background:${def.color}22; border-color:${def.color}"></div>
      <div class="part-card-icon">${def.emoji}</div>
      <div class="part-card-name">${def.name}</div>
      <div class="part-card-rarity ${def.rarity}">${def.rarity}</div>
      <div class="part-card-cost">${opts.showCost ? def.cost + 'g' : ''}</div>
      <div class="part-card-stats">${statsLine}</div>
    `;

    if (opts.onSell) {
      const sellBtn = document.createElement('button');
      sellBtn.className = 'sell-btn';
      sellBtn.textContent = 'Sell ' + Math.floor(def.cost * 0.5) + 'g';
      sellBtn.onclick = (e) => { e.stopPropagation(); opts.onSell(partId); };
      el.appendChild(sellBtn);
    }

    // Hover tooltip
    el.addEventListener('mouseenter', (e) => { showTooltip(partId, e); });
    el.addEventListener('mousemove', (e) => { positionTooltip(e); });
    el.addEventListener('mouseleave', hideTooltip);

    // Mousedown: drag from inventory, or shop
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.sell-btn')) return;
      if (opts.fromShop) {
        const gs = DrillDown.Game.state;
        if (gs.gold < def.cost) return;
        document.getElementById('shop-overlay')?.classList.remove('active');
        startDrag(partId, false, null, e, true);
        return;
      }
      startDrag(partId, false, null, e, false);
    });

    return el;
  }

  function statSummary(def) {
    const parts = [];
    if (def.stats.drillPower) parts.push(`⬇${def.stats.drillPower}`);
    if (def.stats.cooling) parts.push(`❄${def.stats.cooling}`);
    if (def.stats.hp) parts.push(`❤${def.stats.hp}`);
    if (def.stats.armor) parts.push(`🛡${def.stats.armor}`);
    if (def.stats.cargo) parts.push(`📦${def.stats.cargo}`);
    if (def.stats.speed) parts.push(`⚡${def.stats.speed}`);
    if (def.stats.detect) parts.push(`📡${def.stats.detect}%`);
    if (def.stats.heatGen) parts.push(`🌡+${def.stats.heatGen}`);
    return parts.join(' ');
  }

  function startDrag(partId, rotated, pid, e, fromShop) {
    if (dragState) endDrag(null);
    const def = P[partId];
    if (!def) return;
    const shape = rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    const w = Math.max(...shape.map(([r,c]) => c)) + 1;
    const h = Math.max(...shape.map(([r,c]) => r)) + 1;

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.width = (w * CELL + (w - 1) * GAP) + 'px';
    ghost.style.height = (h * CELL + (h - 1) * GAP) + 'px';
    ghost.style.background = def.color + '88';
    ghost.style.borderColor = DrillDown.RARITY_COLORS[def.rarity];
    ghost.innerHTML = `<span>${def.emoji} ${def.name}</span>`;
    ghost.style.left = (e.clientX - 30) + 'px';
    ghost.style.top = (e.clientY - 30) + 'px';
    document.body.appendChild(ghost);

    dragState = { partId, rotated, ghost, fromGrid: !!pid, pid, partDef: def, fromShop: !!fromShop };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragState) return;
    dragState.ghost.style.left = (e.clientX - 30) + 'px';
    dragState.ghost.style.top = (e.clientY - 30) + 'px';

    const gridEl = document.getElementById('grid-container');
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / (CELL + GAP));
    const row = Math.floor((e.clientY - rect.top) / (CELL + GAP));
    const def = dragState.partDef;
    const shape = dragState.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    const valid = row >= 0 && col >= 0 && Eng.canPlace(DrillDown.Game.state.grid, dragState.partId, row, col, dragState.rotated);

    document.querySelectorAll('.grid-cell').forEach(el => el.classList.remove('grid-hover-ok', 'grid-hover-bad'));
    if (valid) {
      for (const [dr, dc] of shape) {
        const idx = (row + dr) * parseInt(gridEl.dataset.cols) + (col + dc);
        const cell = gridEl.querySelector(`.grid-cell[data-index="${idx}"]`);
        if (cell) cell.classList.add('grid-hover-ok');
      }
    }
  }

  function endDrag(e) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    if (!dragState) return;
    const gs = DrillDown.Game.state;
    const gridEl = document.getElementById('grid-container');
    let placed = false;
    let purchased = false;

    const doPurchase = () => {
      if (!dragState.fromShop || purchased) return;
      const def = P[dragState.partId];
      if (!def || gs.gold < def.cost) return;
      gs.gold -= def.cost;
      const sidx = gs.shop.indexOf(dragState.partId);
      if (sidx >= 0) gs.shop.splice(sidx, 1);
      purchased = true;
    };

    if (gridEl && e) {
      const rect = gridEl.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / (CELL + GAP));
      const row = Math.floor((e.clientY - rect.top) / (CELL + GAP));

      // Dropped on valid grid cell
      if (row >= 0 && col >= 0 && Eng.canPlace(gs.grid, dragState.partId, row, col, dragState.rotated)) {
        if (dragState.fromShop) {
          doPurchase();
          if (purchased) {
            if (Eng.placePart(gs.grid, dragState.partId, row, col, dragState.rotated)) {
              placed = true;
            } else {
              // refund
              gs.gold += P[dragState.partId].cost;
              gs.shop.push(dragState.partId);
              purchased = false;
            }
          }
        } else if (dragState.fromGrid) {
          if (Eng.placePart(gs.grid, dragState.partId, row, col, dragState.rotated)) {
            placed = true;
          } else {
            gs.inventory.push(dragState.partId);
          }
        } else {
          const idx = gs.inventory.indexOf(dragState.partId);
          if (idx >= 0) gs.inventory.splice(idx, 1);
          if (Eng.placePart(gs.grid, dragState.partId, row, col, dragState.rotated)) {
            placed = true;
          } else {
            gs.inventory.push(dragState.partId);
          }
        }
      } else {
        // Dropped outside grid — check inventory panel
        const invPanel = document.getElementById('workshop-left');
        if (invPanel && dragState.fromShop) {
          const ir = invPanel.getBoundingClientRect();
          if (e.clientX >= ir.left && e.clientX <= ir.right && e.clientY >= ir.top && e.clientY <= ir.bottom) {
            doPurchase();
            if (purchased) {
              gs.inventory.push(dragState.partId);
              placed = true;
            }
          }
        }
        if (!placed && dragState.fromGrid) {
          gs.inventory.push(dragState.partId);
        }
      }
    } else if (dragState.fromGrid) {
      gs.inventory.push(dragState.partId);
    }

    document.querySelectorAll('.grid-hover-ok, .grid-hover-bad').forEach(el => el.classList.remove('grid-hover-ok', 'grid-hover-bad'));
    dragState.ghost.remove();
    dragState = null;
    Eng.save(gs);
    if (purchased) renderShop();
    DrillDown.Game.updateWorkshop();
  }

  function onDragEnd(e) { endDrag(e); }

  function renderWorkshop() {
    const gs = DrillDown.Game.state;
    showScreen('workshop');
    const left = document.getElementById('workshop-left');
    const center = document.getElementById('workshop-center');
    const right = document.getElementById('workshop-right');

    let fragHtml = '';
    if (gs.fragments) {
      const frags = Object.entries(gs.fragments).filter(([id, n]) => n > 0);
      if (frags.length > 0) {
        fragHtml = '<div class="fragments-section"><div class="frag-label">🔧 Fragments (combine for full part)</div>';
        for (const [id, n] of frags) {
          const def = P[id];
          if (def) {
            const needed = def.rarity === 'unique' ? 3 : 2;
            const bars = '■'.repeat(n) + '□'.repeat(needed - n);
            fragHtml += `<div class="frag-row" style="color:${DrillDown.RARITY_COLORS[def.rarity]}">${def.emoji} ${def.name}: ${bars} ${n}/${needed}</div>`;
          }
        }
        fragHtml += '</div>';
      }
    }

    left.innerHTML = '<h3>Parts</h3><div class="inventory-grid"></div>';
    const invGrid = left.querySelector('.inventory-grid');
    const invCounts = {};
    gs.inventory.forEach(id => { invCounts[id] = (invCounts[id] || 0) + 1; });
    for (const [id, count] of Object.entries(invCounts)) {
      const el = createPartElement(id);
      if (el) {
        const countEl = document.createElement('div');
        countEl.className = 'part-count';
        countEl.textContent = 'x' + count;
        el.appendChild(countEl);
        invGrid.appendChild(el);
      }
    }
    if (gs.inventory.length === 0) {
      invGrid.innerHTML = '<div class="empty-hint">No parts. Buy from shop!</div>';
    }
    if (fragHtml) left.insertAdjacentHTML('beforeend', fragHtml);

    const grid = gs.grid;
    const totalW = grid.cols * (CELL + GAP) - GAP;
    const totalH = grid.rows * (CELL + GAP) - GAP;
    const expandCost = 100 + (grid.rows - 3) * 50 + (grid.cols - 4) * 50;
    const maxSize = grid.rows >= 8 && grid.cols >= 8;

    center.innerHTML = `
      <div class="grid-header">
        <span>Rig — ${grid.rows}x${grid.cols}</span>
        ${maxSize ? '' : `<button class="btn btn-small btn-secondary" id="btn-expand">+ Expand (${expandCost}g)</button>`}
      </div>
      <div id="grid-container" style="width:${totalW}px;height:${totalH}px;position:relative;" data-rows="${grid.rows}" data-cols="${grid.cols}">
      </div>
      <button class="btn btn-primary launch-btn" id="btn-launch">⬇ LAUNCH DRILL</button>
    `;
    const gridCont = document.getElementById('grid-container');

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = r * grid.cols + c;
        cell.style.left = c * (CELL + GAP) + 'px';
        cell.style.top = r * (CELL + GAP) + 'px';
        cell.style.width = CELL + 'px';
        cell.style.height = CELL + 'px';
        gridCont.appendChild(cell);
      }
    }

    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def) continue;
      const shape = p.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
      const w = Math.max(...shape.map(([r,c]) => c)) + 1;
      const h = Math.max(...shape.map(([r,c]) => r)) + 1;
      const minC = Math.min(...shape.map(([r,c]) => c));
      const minR = Math.min(...shape.map(([r,c]) => r));

      const el = document.createElement('div');
      el.className = 'placed-part';
      el.style.left = ((p.col + minC) * (CELL + GAP)) + 'px';
      el.style.top = ((p.row + minR) * (CELL + GAP)) + 'px';
      el.style.width = (w * CELL + (w - 1) * GAP) + 'px';
      el.style.height = (h * CELL + (h - 1) * GAP) + 'px';
      el.style.background = def.color + '44';
      el.style.borderColor = DrillDown.RARITY_COLORS[def.rarity];
      el.dataset.pid = pid;
      el.innerHTML = `<span>${def.emoji}</span><span class="placed-name">${def.name}</span>`;

      // Tooltip on placed parts
      el.addEventListener('mouseenter', (e) => { showTooltip(p.id, e); });
      el.addEventListener('mousemove', (e) => { positionTooltip(e); });
      el.addEventListener('mouseleave', hideTooltip);

      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        Eng.removePart(grid, pid);
        startDrag(p.id, p.rotated, pid, e);
      });

      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        Eng.removePart(grid, pid);
        p.rotated = !p.rotated;
        const shape2 = p.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
        let reOk = true;
        for (const [dr, dc] of shape2) {
          const rr = p.row + dr, cc = p.col + dc;
          if (rr < 0 || rr >= grid.rows || cc < 0 || cc >= grid.cols || grid.cells[rr][cc] !== null) {
            reOk = false; break;
          }
        }
        if (reOk) {
          Eng.placePart(grid, p.id, p.row, p.col, p.rotated);
        } else {
          p.rotated = !p.rotated;
          const shapeOrig = def.shape;
          grid.placed[pid] = p;
          for (const [dr, dc] of shapeOrig) {
            grid.cells[p.row + dr][p.col + dc] = pid;
          }
        }
        DrillDown.Game.updateWorkshop();
      });

      gridCont.appendChild(el);

      for (const [dr, dc] of shape) {
        const idx = (p.row + dr) * grid.cols + (p.col + dc);
        const cell = gridCont.querySelector(`.grid-cell[data-index="${idx}"]`);
        if (cell) cell.classList.add('occupied');
      }
    }

    const expandBtn = document.getElementById('btn-expand');
    if (expandBtn) {
      expandBtn.onclick = () => {
        if (gs.gold >= expandCost) {
          gs.gold -= expandCost;
          if (grid.rows <= grid.cols) Eng.expandGrid(grid, 1, 0);
          else Eng.expandGrid(grid, 0, 1);
          DrillDown.Game.updateWorkshop();
        }
      };
    }

    document.getElementById('btn-launch').onclick = () => DrillDown.Game.startRun();

    const stats = Eng.computeStats(grid);
    const statHelp = {
      '⬇ Drill': 'Overcomes rock hardness. Higher = less heat penalty from dense rock.',
      '🌡 Heat Gen': 'Heat produced each depth step. Adds up fast — keep it cool!',
      '❄ Cooling': 'Reduces heat each step. +2 bonus when placed next to a drill.',
      '❤ HP': 'Health points. Run ends at 0. Armor reduces incoming damage.',
      '🛡 Armor': 'Subtracted from enemy damage. Stacks from multiple sources.',
      '📦 Cargo': 'How much ore you can carry per run. More = more profit.',
      '⚡ Speed': 'Depth steps per tick. Faster = more loot per second.',
      '📡 Detect': 'Bonus to find rare loot and events. Stacks additively.'
    };
    right.innerHTML = `
      <h3>Robot Stats <span class="help-icon" id="btn-help">?</span></h3>
      ${Object.entries(statHelp).map(([label, help]) => `
        <div class="stat-row" title="${help}">
          <span class="stat-label">${label}</span>
          <span class="stat-val">${{
            '⬇ Drill': stats.drillPower,
            '🌡 Heat Gen': stats.heatGen,
            '❄ Cooling': stats.cooling,
            '❤ HP': stats.hp,
            '🛡 Armor': stats.armor,
            '📦 Cargo': stats.cargo,
            '⚡ Speed': stats.speed.toFixed(1),
            '📡 Detect': stats.detect + '%'
          }[label]}</span>
        </div>`).join('')}
      <div class="stat-divider"></div>
      <div class="stat-row gold-row"><span class="stat-label">💰 Gold</span><span class="stat-val">${gs.gold}</span></div>
      <div class="stat-row"><span class="stat-label">🏆 Best Depth</span><span class="stat-val">${gs.bestDepth || 0}</span></div>
      <div class="stat-row"><span class="stat-label">🎯 Run</span><span class="stat-val">#${gs.runNumber}</span></div>
      <button class="btn btn-secondary shop-btn" id="btn-open-shop">🏪 Shop</button>
      <button class="btn btn-secondary shop-btn" id="btn-help-open" style="margin-top:4px;font-size:12px;">📖 How to Play</button>
    `;
    document.getElementById('btn-open-shop').onclick = () => renderShop();
    document.getElementById('btn-help-open').onclick = () => renderHelp();
    document.getElementById('btn-help').onclick = () => renderHelp();
  }

  function renderShop() {
    const gs = DrillDown.Game.state;
    const overlay = document.getElementById('shop-overlay');
    overlay.classList.add('active');
    const cont = overlay.querySelector('.shop-content');
    cont.innerHTML = `<h2>🏪 Parts Shop</h2>
      <div style="margin-bottom:12px;color:#888;font-size:13px;">💰 Gold: <strong style="color:#f5a623">${gs.gold}g</strong> — Drag a part to buy it</div>
      <div class="shop-items"></div>
      <div style="margin-top:14px;">
        <button class="btn btn-secondary" id="btn-shop-close">Close</button>
      </div>
    `;

    const itemsDiv = cont.querySelector('.shop-items');
    if (gs.shop.length === 0) {
      itemsDiv.innerHTML = '<div class="empty-hint">Shop is empty. Complete a run to restock.</div>';
    } else {
      gs.shop.forEach((partId) => {
        const def = P[partId];
        if (!def) return;
        const el = createPartElement(partId, { showCost: true, fromShop: true });
        if (el) itemsDiv.appendChild(el);
      });
    }

    document.getElementById('btn-shop-close').onclick = () => {
      overlay.classList.remove('active');
      DrillDown.Game.updateWorkshop();
    };
  }

  function renderDrill() {
    showScreen('drill');
    const gs = DrillDown.Game.state;
    const cont = document.getElementById('screen-drill');
    cont.innerHTML = `
      <div class="drill-status" id="drill-status">
        <span>Depth: <strong id="drill-depth">0</strong></span>
        <span>❤ HP: <strong id="drill-hp">0</strong>/<strong id="drill-hp-max">0</strong></span>
        <span>🌡 Heat: <strong id="drill-heat">0</strong></span>
        <span>📦 <strong id="drill-cargo">0</strong>/<strong id="drill-cargo-max">0</strong></span>
      </div>
      <div class="drill-log" id="drill-log"></div>
      <div class="drill-controls">
        <button class="btn btn-primary" id="btn-auto">▶ Skip to End</button>
        <button class="btn btn-secondary" id="btn-surface">⬆ Surface Now</button>
      </div>
    `;

    const stats = Eng.computeStats(gs.grid);
    const result = Eng.simulateRun(stats, 0);

    const logDiv = document.getElementById('drill-log');
    let idx = 0;
    let cancelled = false;

    function appendLine() {
      if (cancelled || idx >= result.log.length) {
        if (!cancelled) finishRun(result, stats);
        return;
      }
      const entry = result.log[idx];
      const lineEl = document.createElement('div');
      lineEl.className = 'log-entry';
      if (entry.text.includes('OVERHEAT') || entry.text.includes('FAILED')) lineEl.classList.add('log-danger');
      else if (entry.text.includes('Heat vent') || entry.text.includes('attacks')) lineEl.classList.add('log-warn');
      else if (entry.text.includes('Void Crystal') || entry.text.includes('cache')) lineEl.classList.add('log-rare');
      else if (entry.text.includes('Ore vein')) lineEl.classList.add('log-loot');
      lineEl.textContent = entry.text;
      logDiv.appendChild(lineEl);
      logDiv.scrollTop = logDiv.scrollHeight;

      document.getElementById('drill-depth').textContent = entry.depth || idx + 1;
      document.getElementById('drill-hp').textContent = Math.max(0, entry.hp || 0);
      document.getElementById('drill-hp-max').textContent = stats.hp;
      document.getElementById('drill-heat').textContent = Math.floor(entry.heat || 0) + '%';
      document.getElementById('drill-cargo').textContent = entry.cargo || 0;
      document.getElementById('drill-cargo-max').textContent = Math.floor(stats.cargo);

      idx++;
      setTimeout(appendLine, 80 + Math.random() * 120);
    }

    function finishRun(runResult, robotStats) {
      gs.lastDepth = runResult.maxDepth;
      gs.gold += runResult.gold;
      // Process fragments — 2 for rare, 3 for unique
      if (!gs.fragments) gs.fragments = {};
      for (const partId of runResult.foundParts) {
        const def = P[partId];
        const needed = def && def.rarity === 'unique' ? 3 : 2;
        gs.fragments[partId] = (gs.fragments[partId] || 0) + 1;
        if (gs.fragments[partId] >= needed) {
          gs.fragments[partId] = 0;
          gs.inventory.push(partId);
        }
      }
      const oreGold = Math.floor(runResult.ore * 1.5);
      gs.gold += oreGold;
      gs.totalRuns = (gs.totalRuns || 0) + 1;
      if (runResult.maxDepth > (gs.bestDepth || 0)) gs.bestDepth = runResult.maxDepth;
      Eng.save(gs);
      setTimeout(() => renderResults(runResult, oreGold), 500);
    }

    document.getElementById('btn-auto').onclick = () => {
      cancelled = true;
      logDiv.innerHTML = '';
      result.log.forEach((entry) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'log-entry';
        if (entry.text.includes('OVERHEAT') || entry.text.includes('FAILED')) lineEl.classList.add('log-danger');
        else if (entry.text.includes('Heat vent') || entry.text.includes('attacks')) lineEl.classList.add('log-warn');
        else if (entry.text.includes('Void Crystal') || entry.text.includes('cache')) lineEl.classList.add('log-rare');
        else if (entry.text.includes('Ore vein')) lineEl.classList.add('log-loot');
        lineEl.textContent = entry.text;
        logDiv.appendChild(lineEl);
      });
      logDiv.scrollTop = logDiv.scrollHeight;
      const last = result.log[result.log.length - 1];
      if (last) {
        document.getElementById('drill-depth').textContent = last.depth || result.maxDepth;
        document.getElementById('drill-hp').textContent = Math.max(0, last.hp || 0);
        document.getElementById('drill-heat').textContent = Math.floor(last.heat || 0) + '%';
        document.getElementById('drill-cargo').textContent = last.cargo || 0;
      }
      finishRun(result, stats);
    };

    document.getElementById('btn-surface').onclick = () => {
      cancelled = true;
      const at = Math.max(0, idx - 1);
      const entry = result.log[at];
      if (entry) {
        const pct = result.log.length > 0 ? (at + 1) / result.log.length : 1;
        const truncated = {
          maxDepth: entry.depth,
          ore: entry.cumOre || Math.floor(result.ore * pct),
          gold: entry.cumGold || Math.floor(result.gold * pct),
          foundParts: result.foundParts.slice(0, Math.max(1, Math.floor(result.foundParts.length * pct))),
          hp: entry.hp,
          cargo: entry.cargo,
          log: result.log.slice(0, idx),
          surfaced: true
        };
        truncated.log.push({ depth: entry.depth, text: '⬆ Manual surface ordered. Returning to base.', hp: entry.hp, heat: 0, cargo: entry.cargo, cumOre: truncated.ore, cumGold: truncated.gold });
        const lineEl = document.createElement('div');
        lineEl.className = 'log-entry';
        lineEl.textContent = truncated.log[truncated.log.length - 1].text;
        logDiv.appendChild(lineEl);
        logDiv.scrollTop = logDiv.scrollHeight;
        finishRun(truncated, stats);
      } else {
        finishRun(result, stats);
      }
    };

    if (!cancelled) appendLine();
  }

  function renderResults(result, oreGold) {
    const gs = DrillDown.Game.state;
    showScreen('results');
    const cont = document.getElementById('screen-results');

      const logHtml = result.log && result.log.length > 0 ? result.log.map(e => {
      let cls = 'log-entry';
      if (e.text.includes('OVERHEAT') || e.text.includes('FAILED') || e.text.includes('Destroyed')) cls += ' log-danger';
      else if (e.text.includes('Heat vent') || e.text.includes('attacks')) cls += ' log-warn';
      else if (e.text.includes('Void Crystal') || e.text.includes('cache')) cls += ' log-rare';
      else if (e.text.includes('Ore vein')) cls += ' log-loot';
      else if (e.text.includes('fragment')) cls += ' log-rare';
      return `<div class="${cls}">${e.text}</div>`;
    }).join('') : '<div class="log-entry">No log data</div>';

    cont.innerHTML = `
      <div class="results-left">
        <h2>⛰ Run Complete</h2>
        <div class="results-grid">
          <div class="result-item"><span>Max Depth</span><strong>${result.maxDepth}</strong></div>
          <div class="result-item"><span>Best Ever</span><strong>${gs.bestDepth}</strong></div>
          <div class="result-item"><span>Status</span><strong class="${result.surfaced ? 'text-ok' : 'text-fail'}">${result.surfaced ? '⬆ Surfaced' : '❌ Destroyed'}</strong></div>
          <div class="result-item"><span>Ore Mined</span><strong>${result.ore} (${oreGold}g)</strong></div>
          <div class="result-item"><span>Fragments</span><strong>${result.foundParts.length}</strong></div>
          <div class="result-item"><span>Gold Earned</span><strong>${result.gold + oreGold}g</strong></div>
        </div>
        <div class="results-buttons">
          <button class="btn btn-primary" id="btn-relaunch">⬇ Relaunch Drone</button>
          <button class="btn btn-secondary" id="btn-back-workshop">⬆ Workshop</button>
        </div>
      </div>
      <div class="results-right">
        <div class="results-right-label">📋 Drill Log (${result.log.length} entries)</div>
        <div class="results-log">${logHtml}</div>
      </div>
    `;
    document.getElementById('btn-back-workshop').onclick = () => {
      gs.shop = Eng.generateShop(gs.runNumber);
      gs.runNumber++;
      DrillDown.Game.updateWorkshop();
    };
    document.getElementById('btn-relaunch').onclick = () => {
      DrillDown.Game.startRun();
    };
  }

  function renderHelp() {
    const overlay = document.getElementById('help-overlay');
    overlay.classList.add('active');
    const cont = overlay.querySelector('.help-content');
    cont.innerHTML = `
      <h2>📖 How to Play</h2>
      <div class="help-body">
        <div class="help-section">
          <h3>🎯 Goal</h3>
          <p>Build a drilling robot, send it into the depths, and bring back resources. Each run lets you upgrade your rig to go <strong>deeper</strong>. Deeper = better loot.</p>
        </div>
        <div class="help-section">
          <h3>🔄 Core Loop</h3>
          <p><b>1. BUILD</b> — Drag parts from your inventory onto the rig grid.<br>
          <b>2. LAUNCH</b> — Send the robot down. Watch the log as it drills.<br>
          <b>3. REVIEW</b> — See how it performed. What killed it? Overheat? Enemies?<br>
          <b>4. UPGRADE</b> — Buy better parts from the shop. Expand the grid. Try again.</p>
        </div>
        <div class="help-section">
          <h3>⚙️ Stats Explained</h3>
          <p><b>⬇ Drill Power</b> — Overcomes rock hardness. Weak drill = slow progress + extra heat.</p>
          <p><b>🌡 Heat</b> — Builds each step. Over 40 = damage. Over 25 = warning. Coolant keeps it down.</p>
          <p><b>❄ Cooling</b> — Reduces heat per step. Place <b>next to a drill</b> for +2 bonus cooling!</p>
          <p><b>❤ HP</b> — Health. Hits 0 = robot destroyed. Armor reduces each hit.</p>
          <p><b>🛡 Armor</b> — Subtracted from enemy damage. Place armor next to armor for +3 HP each.</p>
          <p><b>📦 Cargo</b> — Ore capacity. Full cargo = missed loot opportunities.</p>
          <p><b>⚡ Speed</b> — Multiple depth ticks per step. Faster = more progress, more events.</p>
          <p><b>📡 Detect</b> — Higher chance to find ore veins, rare crystals, and ancient caches.</p>
        </div>
        <div class="help-section">
          <h3>🗺️ Grid & Placement</h3>
          <p>Parts have shapes (1×1, 1×2, 2×2, L-shape). Fit them together like Tetris.</p>
          <p><b>Drag</b> from inventory to place. <b>Double-click</b> a placed part to rotate it.<br>
          <b>Right-click or Escape</b> to cancel a drag. <b>Expand</b> the grid for more room.</p>
        </div>
        <div class="help-section">
          <h3>🏪 Shop & Economy</h3>
          <p>Open the shop between runs. <b>Drag a part</b> to buy it — drop on the grid to place, or on your inventory to store.</p>
          <p>Ore converts to gold automatically. Find rare <b>Void Crystals</b> for bonus gold.</p>
        </div>
        <div class="help-section">
          <h3>🔧 Crafting & Fragments</h3>
          <p>Ancient caches drop <b>fragments</b> — collect enough to craft a full part:<br>
          <span style="color:#74b9ff">■ Rare</span> — <b>2 fragments</b> to combine (also available in shop)<br>
          <span style="color:#ff6b6b">■ Unique</span> — <b>3 fragments</b> to combine (craft-only, strongest tier)</p>
        </div>
        <div class="help-section">
          <h3>🚀 Pro Tips</h3>
          <p>• Balance drill power with cooling — a hot drill breaks fast.<br>
          • Speed is a double-edged sword: more ticks = more heat and enemy rolls.<br>
          • Don't neglect cargo — bringing back ore is how you afford upgrades.<br>
          • Grid space is precious. Plan your layout for adjacency bonuses.</p>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-help-close">Got it!</button>
    `;
    document.getElementById('btn-help-close').onclick = () => {
      overlay.classList.remove('active');
    };
  }

  function cancelDrag() {
    if (!dragState) return;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.querySelectorAll('.grid-hover-ok, .grid-hover-bad').forEach(el => el.classList.remove('grid-hover-ok', 'grid-hover-bad'));
    if (dragState.ghost) dragState.ghost.remove();
    if (dragState.fromGrid) {
      DrillDown.Game.state.inventory.push(dragState.partId);
    }
    dragState = null;
    DrillDown.Game.updateWorkshop();
  }

  return {
    showScreen, renderTitle, renderWorkshop, renderShop, renderDrill, renderResults,
    createPartElement, initTooltip, cancelDrag
  };
})();
