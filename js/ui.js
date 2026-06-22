DrillDown.UI = (() => {
  const Eng = DrillDown.Engine;
  const A = DrillDown.Audio;
  const P = DrillDown.PARTS;
  const CELL = 76;
  const GAP = 2;

  function shake() {
    const el = document.getElementById('screen-drill');
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // restart the animation
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
  }

  let dragState = null;
  let tooltipEl = null;
  let hoveredCard = null;

  // Lightweight transient notification (recycle results, etc.)
  function toast(msg, kind) {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    const line = document.createElement('div');
    line.className = 'toast-line' + (kind ? ' toast-' + kind : '');
    line.innerHTML = msg;
    host.appendChild(line);
    setTimeout(() => line.classList.add('toast-out'), 2400);
    setTimeout(() => line.remove(), 3000);
  }

  // Themed confirm dialog (replaces native confirm). opts: { title, body, confirmLabel,
  // cancelLabel, danger, onConfirm }. Resolves by calling onConfirm; dismisses otherwise.
  function confirmModal(opts) {
    opts = opts || {};
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay active';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-title">${opts.title || 'Are you sure?'}</div>
        ${opts.body ? `<div class="confirm-body">${opts.body}</div>` : ''}
        <div class="confirm-actions">
          <button class="btn btn-secondary" data-act="cancel">${opts.cancelLabel || 'Cancel'}</button>
          <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${opts.confirmLabel || 'Confirm'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-act="cancel"]').onclick = close;
    overlay.querySelector('[data-act="ok"]').onclick = () => { close(); opts.onConfirm && opts.onConfirm(); };
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  }

  // Normalize mouse + touch events to a single {clientX, clientY} point.
  function evtPoint(e) {
    if (e.touches && e.touches.length) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length) return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    return { clientX: e.clientX, clientY: e.clientY };
  }

  function isDragging() { return !!dragState; }

  function pointInEl(pt, el) {
    if (!pt || !el) return false;
    const r = el.getBoundingClientRect();
    return pt.clientX >= r.left && pt.clientX <= r.right && pt.clientY >= r.top && pt.clientY <= r.bottom;
  }

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
    lines.push(`<div class="tt-header" style="color:${DrillDown.RARITY_COLORS[def.rarity]}">${def.name}</div>`);
    lines.push(`<div class="tt-rarity">${def.rarity.toUpperCase()} · ${(def.type || '').toUpperCase()}</div>`);
    if (def.stats.drillPower) lines.push(`⬇ Drill Power: <b>${def.stats.drillPower}</b><div class="tt-desc">Cuts through rock. More power means faster descent and far less heat penalty when the rock gets dense.</div>`);
    if (def.stats.heatGen) lines.push(`🌡 Heat Gen: <b>+${def.stats.heatGen}/step</b><div class="tt-desc">Heat added every step while drilling. Above 40% it burns your HP — pair drills with enough cooling to stay safe.</div>`);
    if (def.stats.cooling) lines.push(`❄ Cooling: <b>${def.stats.cooling}</b><div class="tt-desc">Bleeds off heat each step. Gains +2 when placed next to a drill (Cooled Drill synergy).</div>`);
    if (def.stats.hp) lines.push(`❤ HP: <b>+${def.stats.hp}</b><div class="tt-desc">Raises max health. The run ends instantly when HP reaches 0 and the haul is lost.</div>`);
    if (def.stats.armor) lines.push(`🛡 Armor: <b>${def.stats.armor}</b><div class="tt-desc">Flat damage reduction subtracted from every enemy hit. Stacks across all your defense parts.</div>`);
    if (def.stats.cargo) lines.push(`📦 Cargo: <b>+${def.stats.cargo}</b><div class="tt-desc">Max ore you can haul per run. Once cargo is full you stop collecting — more cargo = more gold.</div>`);
    if (def.stats.speed) lines.push(`⚡ Speed: <b>${def.stats.speed > 0 ? '+' : ''}${def.stats.speed}</b><div class="tt-desc">Extra depth steps per tick — heavy parts can reduce it. Faster = more loot, but more heat and enemy rolls each step.</div>`);
    if (def.stats.detect) lines.push(`📡 Detect: <b>+${def.stats.detect}%</b><div class="tt-desc">Boosts the odds of finding ore veins, rare Void Crystals, and ancient caches as you drill.</div>`);
    const tip = synergyTip(def);
    if (tip) lines.push(`<div class="tt-tip">🔗 ${tip}</div>`);
    if (def.desc) lines.push(`<span class="tt-amp">◆ ${def.desc}</span>`);
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
    document.getElementById('btn-new-run').onclick = () => {
      if (Eng.load()) {
        confirmModal({
          title: '⚠ Start a New Run?',
          body: 'This erases your current saved progress — parts, gold, grid, and depth records. This cannot be undone.',
          confirmLabel: 'Erase & Start',
          danger: true,
          onConfirm: () => DrillDown.Game.newRun()
        });
      } else {
        DrillDown.Game.newRun();
      }
    };
    const contBtn = document.getElementById('btn-continue');
    if (contBtn) contBtn.onclick = () => DrillDown.Game.continueRun();
  }

  function createPartElement(partId, opts = {}) {
    const def = P[partId];
    if (!def) return null;
    const el = document.createElement('div');
    el.className = 'part-card';
    el.dataset.partId = partId;

    const price = opts.fromShop ? Eng.shopCost(partId) : def.cost;
    const canAfford = opts.fromShop ? (DrillDown.Game.state.gold >= price) : true;
    if (!canAfford) el.classList.add('part-cant-afford');
    el.style.borderColor = canAfford ? (DrillDown.RARITY_COLORS[def.rarity] || '#fff') : '#444';

    el.dataset.rotated = opts.rotated ? '1' : '0';
    sizeCard(el, def, !!opts.rotated);

    // Stats are intentionally not shown on the card — hover/hold for the full tooltip.
    el.innerHTML = `
      <div class="part-card-bg" style="background:${def.color}22; border-color:${def.color}"></div>
      <div class="part-card-name">${def.name}</div>
      <div class="part-card-rarity ${def.rarity}">${def.rarity}</div>
      <div class="part-card-cost">${opts.showCost ? price + 'g' : ''}</div>
    `;

    // Hover tooltip + track the hovered card so R can pre-rotate it before pickup
    el.addEventListener('mouseenter', (e) => { hoveredCard = { el, partId }; showTooltip(partId, e); });
    el.addEventListener('mousemove', (e) => { positionTooltip(e); });
    el.addEventListener('mouseleave', () => { if (hoveredCard && hoveredCard.el === el) hoveredCard = null; hideTooltip(); });

    // Pointer down (mouse or touch): drag from inventory, or shop — preserving any pre-rotation
    const onDown = (e) => {
      if (e.type === 'mousedown' && e.button !== 0) return;
      if (e.target.closest('.sell-btn') || e.target.closest('.upgrade-btn')) return;
      if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
      const rotated = el.dataset.rotated === '1';
      if (opts.fromShop) {
        const gs = DrillDown.Game.state;
        if (gs.gold < Eng.shopCost(partId)) return;
        document.getElementById('shop-overlay')?.classList.remove('active');
        startDrag(partId, rotated, null, e, true);
        return;
      }
      startDrag(partId, rotated, null, e, false);
    };
    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: false });

    return el;
  }

  // Size a part card (the inventory/shop preview rectangle) to its shape's bounding box.
  function sizeCard(el, def, rotated) {
    const shape = rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    const w = Math.max(...shape.map(([r,c]) => c)) + 1;
    const h = Math.max(...shape.map(([r,c]) => r)) + 1;
    el.style.width = (w * 52) + 'px';
    el.style.height = (h * 52) + 'px';
  }

  // Rotate the part card currently under the cursor (R when not dragging). Returns
  // true if something was rotated so the caller can swallow the key.
  function rotateHovered() {
    if (!hoveredCard || !hoveredCard.el || !document.body.contains(hoveredCard.el)) { hoveredCard = null; return false; }
    const def = P[hoveredCard.partId];
    if (!def) return false;
    const rotated = hoveredCard.el.dataset.rotated !== '1';
    hoveredCard.el.dataset.rotated = rotated ? '1' : '0';
    sizeCard(hoveredCard.el, def, rotated);
    A?.tick?.();
    return true;
  }

  // Placement advice shown in the tooltip, keyed off the part's type. Mirrors the
  // adjacency rules in Engine.gridSynergies / the help screen — keep them in sync.
  function synergyTip(def) {
    switch (def.type) {
      case 'drill': return 'Place beside cooling for the Cooled Drill bonus (+2 cooling, +1 drill), or beside another drill for +2 drill each.';
      case 'cooling': return 'Place beside a drill for +2 cooling, or beside other cooling for +1 cooling each.';
      case 'defense': return 'Place beside other defense for +3 HP each, or beside a drill to add +1 armor to the drill.';
      case 'utility': return 'Place beside a drill or cooling for +1 cargo, or beside other utility for +3 detect each.';
      case 'core': return 'Surround it with your strongest drill / cooling / defense parts to amplify them.';
      default: return '';
    }
  }

  const LONG_PRESS_MS = 450;   // hold-to-rotate delay on touch
  const MOVE_TOLERANCE = 14;   // px of drift allowed before a hold counts as a drag

  function startDrag(partId, rotated, pid, e, fromShop) {
    if (dragState) endDrag(null);
    const def = P[partId];
    if (!def) return;

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.background = def.color + '88';
    ghost.style.borderColor = DrillDown.RARITY_COLORS[def.rarity];
    ghost.innerHTML = `<span>${def.name}</span><span class="ghost-hint">R / hold ⟳</span>`;
    const pt = evtPoint(e);
    ghost.style.left = (pt.clientX - 30) + 'px';
    ghost.style.top = (pt.clientY - 30) + 'px';
    document.body.appendChild(ghost);

    const isTouch = e.type === 'touchstart' || e.type === 'touchmove';
    dragState = { partId, rotated, ghost, fromGrid: !!pid, pid, partDef: def, fromShop: !!fromShop, isTouch, lastPt: pt };
    sizeGhost();
    if (isTouch) armLongPress(pt);

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }

  // Resize the drag ghost to match the current (possibly rotated) shape.
  function sizeGhost() {
    if (!dragState) return;
    const def = dragState.partDef;
    const shape = dragState.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
    const w = Math.max(...shape.map(([r,c]) => c)) + 1;
    const h = Math.max(...shape.map(([r,c]) => r)) + 1;
    dragState.ghost.style.width = (w * CELL + (w - 1) * GAP) + 'px';
    dragState.ghost.style.height = (h * CELL + (h - 1) * GAP) + 'px';
  }

  // Rotate the part currently being dragged (R key on desktop, long-press on touch).
  function rotateDrag() {
    if (!dragState) return;
    dragState.rotated = !dragState.rotated;
    sizeGhost();
    A?.tick?.();
    refreshHover(dragState.lastPt);
  }

  // (Re)start the hold-to-rotate timer for touch. Continuous movement keeps
  // re-arming it from the new anchor, so it only fires once the finger holds still.
  function armLongPress(pt) {
    if (!dragState) return;
    if (dragState.longPressTimer) clearTimeout(dragState.longPressTimer);
    dragState.lpAnchor = pt;
    dragState.longPressTimer = setTimeout(() => {
      dragState.longPressTimer = null;
      rotateDrag();
    }, LONG_PRESS_MS);
  }

  // Repaint the grid placement preview + recycle-bin highlight for a pointer position.
  function refreshHover(pt) {
    if (!dragState || !pt) return;
    const gridEl = document.getElementById('grid-container');
    document.querySelectorAll('.grid-cell').forEach(el => el.classList.remove('grid-hover-ok', 'grid-hover-bad'));
    // Only preview placement while actually over the grid (not the inventory / recycle bin).
    if (gridEl && pointInEl(pt, gridEl)) {
      const rect = gridEl.getBoundingClientRect();
      const cols = parseInt(gridEl.dataset.cols);
      const rows = parseInt(gridEl.dataset.rows);
      const col = Math.floor((pt.clientX - rect.left) / (CELL + GAP));
      const row = Math.floor((pt.clientY - rect.top) / (CELL + GAP));
      const def = dragState.partDef;
      const shape = dragState.rotated ? def.shape.map(([r,c]) => [c,r]) : def.shape;
      // Green when it would drop here, red otherwise (overlap or off-grid).
      const valid = Eng.canPlace(DrillDown.Game.state.grid, dragState.partId, row, col, dragState.rotated);
      const cls = valid ? 'grid-hover-ok' : 'grid-hover-bad';
      for (const [dr, dc] of shape) {
        const rr = row + dr, cc = col + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue; // skip overhang so it can't wrap to another row
        const cell = gridEl.querySelector(`.grid-cell[data-index="${rr * cols + cc}"]`);
        if (cell) cell.classList.add(cls);
      }
    }
    const recycleBin = document.getElementById('recycle-bin');
    if (recycleBin) recycleBin.classList.toggle('bin-hover', !dragState.fromShop && pointInEl(pt, recycleBin));
  }

  function onDragMove(e) {
    if (!dragState) return;
    if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
    const pt = evtPoint(e);
    dragState.lastPt = pt;
    dragState.ghost.style.left = (pt.clientX - 30) + 'px';
    dragState.ghost.style.top = (pt.clientY - 30) + 'px';

    // On touch, drifting away from the anchor means this is a drag, not a hold —
    // re-arm the rotate timer so it only fires after the finger settles again.
    if (dragState.isTouch && dragState.lpAnchor) {
      const moved = Math.hypot(pt.clientX - dragState.lpAnchor.clientX, pt.clientY - dragState.lpAnchor.clientY);
      if (moved > MOVE_TOLERANCE) armLongPress(pt);
    }

    refreshHover(pt);
  }

  function endDrag(e) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
    if (!dragState) return;
    if (dragState.longPressTimer) clearTimeout(dragState.longPressTimer);
    const gs = DrillDown.Game.state;
    const gridEl = document.getElementById('grid-container');
    const pt = e ? evtPoint(e) : null;
    let placed = false;
    let purchased = false;

    const doPurchase = () => {
      if (!dragState.fromShop || purchased) return;
      const def = P[dragState.partId];
      const price = Eng.shopCost(dragState.partId);
      if (!def || gs.gold < price) return;
      gs.gold -= price;
      const sidx = gs.shop.indexOf(dragState.partId);
      if (sidx >= 0) gs.shop.splice(sidx, 1);
      purchased = true;
    };

    if (gridEl && pt) {
      const rect = gridEl.getBoundingClientRect();
      const col = Math.floor((pt.clientX - rect.left) / (CELL + GAP));
      const row = Math.floor((pt.clientY - rect.top) / (CELL + GAP));

      // Dropped on valid grid cell
      if (row >= 0 && col >= 0 && Eng.canPlace(gs.grid, dragState.partId, row, col, dragState.rotated)) {
        if (dragState.fromShop) {
          doPurchase();
          if (purchased) {
            if (Eng.placePart(gs.grid, dragState.partId, row, col, dragState.rotated)) {
              placed = true;
            } else {
              // refund
              gs.gold += Eng.shopCost(dragState.partId);
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
        const recycleBin = document.getElementById('recycle-bin');
        const overBin = pointInEl(pt, recycleBin);
        if (overBin && !dragState.fromShop) {
          // Recycle: small gold + salvage-meter progress. Grid parts were already
          // removed at drag start; inventory parts must be removed here first.
          let doRecycle = false;
          if (dragState.fromGrid) {
            doRecycle = true;
          } else {
            const idx = gs.inventory.indexOf(dragState.partId);
            if (idx >= 0) { gs.inventory.splice(idx, 1); doRecycle = true; }
          }
          if (doRecycle) {
            placed = true;
            const recycledId = dragState.partId;
            const r = Eng.recyclePart(gs, recycledId);
            toast(`♻ Recycled <b>${P[recycledId]?.name || 'part'}</b> · <span class="gold">+${r.gold}g</span> · salvage ${Math.round(r.progress)}%`, 'loot');
            if (r.awardedPartId) {
              const awName = P[r.awardedPartId]?.name || 'part';
              if (r.crafted) toast(`✦ Salvage complete — crafted <b>${awName}</b>!`, 'rare');
              else toast(`✦ Salvage complete — <b>${awName}</b> fragment (${r.fragNow}/${r.fragNeeded})`, 'rare');
              A?.loot?.();
            }
          }
        } else if (!overBin) {
          // Dropped outside grid — check inventory panel (buy from shop into storage)
          const invPanel = document.getElementById('workshop-left');
          if (invPanel && dragState.fromShop) {
            const ir = invPanel.getBoundingClientRect();
            if (pt.clientX >= ir.left && pt.clientX <= ir.right && pt.clientY >= ir.top && pt.clientY <= ir.bottom) {
              doPurchase();
              if (purchased) {
                gs.inventory.push(dragState.partId);
                placed = true;
              }
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
    document.getElementById('recycle-bin')?.classList.remove('bin-hover');
    dragState.ghost.remove();
    dragState = null;
    Eng.save(gs);
    if (purchased) renderShop();
    DrillDown.Game.updateWorkshop();
  }

  function onDragEnd(e) { endDrag(e); }

  function renderWorkshop() {
    const gs = DrillDown.Game.state;
    if (!gs.returnPolicy) gs.returnPolicy = { cargoFull: true, hpPct: 0.25 };
    if (gs.recycleProgress == null) gs.recycleProgress = 0;
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
            fragHtml += `<div class="frag-row" style="color:${DrillDown.RARITY_COLORS[def.rarity]}">${def.name}: ${bars} ${n}/${needed}</div>`;
          }
        }
        fragHtml += '</div>';
      }
    }

    left.innerHTML = '<h3>Parts</h3><div class="left-scroll"><div class="inventory-grid"></div></div>';
    const leftScroll = left.querySelector('.left-scroll');
    const invGrid = left.querySelector('.inventory-grid');
    const invCounts = {};
    gs.inventory.forEach(id => { invCounts[id] = (invCounts[id] || 0) + 1; });

    // Build one inventory card: stacked-pile look + ×N badge for duplicates, plus the
    // Mk II/III/IV combine button on any stack of 2+ whose part has an upgrade path.
    const buildInvCard = (id, count) => {
      const el = createPartElement(id);
      if (!el) return null;
      if (count > 1) {
        el.classList.add('stacked');
        const badge = document.createElement('div');
        badge.className = 'count-badge';
        badge.textContent = '×' + count;
        el.appendChild(badge);
      }
      if (count >= 2 && P[id].upgradeTo) {
        // Cascade preview: the result tier + total gold for merging this whole stack up.
        const plan = Eng.planUpgrade(gs, id);
        const resultDef = P[(plan && plan.affordable) ? plan.resultId : P[id].upgradeTo];
        const cost = (plan && plan.affordable) ? plan.totalCost : Eng.upgradeCost(id);
        const afford = !!(plan && plan.affordable);
        const btn = document.createElement('button');
        btn.className = 'upgrade-btn' + (afford ? '' : ' disabled');
        btn.innerHTML = `⬆ ${resultDef.tier || 'Upgrade'} <span class="up-cost">${cost}g</span>`;
        btn.title = afford && plan.merges > 1
          ? `Merge your ${P[id].name} stack up into ${resultDef.name} — ${plan.merges} combines, ${cost}g`
          : `Combine 2× ${P[id].name} + ${cost}g → ${resultDef.name}`;
        btn.onclick = (e) => {
          e.stopPropagation();
          const res = Eng.upgradePart(gs, id);
          if (res.ok) {
            A?.loot?.();
            const msg = res.merges > 1
              ? `⬆ Merged into <b>${P[res.upgradedId].name}</b> · ${res.merges} combines · <span class="gold">-${res.cost}g</span>`
              : `⬆ Upgraded to <b>${P[res.upgradedId].name}</b> · <span class="gold">-${res.cost}g</span>`;
            toast(msg, 'rare');
            DrillDown.Game.updateWorkshop();
          } else {
            toast(`Need 2× ${P[id].name} and ${Eng.upgradeCost(id)}g to upgrade.`, 'warn');
          }
        };
        el.appendChild(btn);
      }
      return el;
    };

    // Group the inventory into labeled type sections. Within a section, parts are ordered
    // by family (a base part and its Mk tiers stay together), families sorted by base
    // rarity then name, and tiers listed base → Mk II → Mk III → Mk IV.
    const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, unique: 3 };
    const familyRoot = (id) => { let cur = id; while (P[cur] && P[cur].upgradeOf) cur = P[cur].upgradeOf; return cur; };
    const tierRank = (id) => { let n = 0, cur = id; while (P[cur] && P[cur].upgradeOf) { n++; cur = P[cur].upgradeOf; } return n; };
    const TYPE_SECTIONS = [
      { type: 'drill',   label: '⚙ Drills' },
      { type: 'cooling', label: '❄ Cooling' },
      { type: 'defense', label: '🛡 Defense' },
      { type: 'utility', label: '🔧 Utility' },
      { type: 'core',    label: '🔆 Cores' }
    ];
    const distinctIds = Object.keys(invCounts);
    for (const sec of TYPE_SECTIONS) {
      const ids = distinctIds.filter(id => P[id] && P[id].type === sec.type);
      if (!ids.length) continue;
      ids.sort((a, b) => {
        const ra = familyRoot(a), rb = familyRoot(b);
        if (ra !== rb) {
          const d = (RARITY_ORDER[P[ra].rarity] || 0) - (RARITY_ORDER[P[rb].rarity] || 0);
          return d !== 0 ? d : P[ra].name.localeCompare(P[rb].name);
        }
        return tierRank(a) - tierRank(b);
      });
      const head = document.createElement('div');
      head.className = 'inv-type-head';
      head.textContent = sec.label;
      invGrid.appendChild(head);
      for (const id of ids) {
        const el = buildInvCard(id, invCounts[id]);
        if (el) invGrid.appendChild(el);
      }
    }
    if (gs.inventory.length === 0) {
      invGrid.innerHTML = '<div class="empty-hint">No parts. Buy from shop!</div>';
    }
    if (fragHtml) leftScroll.insertAdjacentHTML('beforeend', fragHtml);
    // Recycle bin is pinned to the bottom of the left bar (outside the scroll area).
    const recPct = Math.max(0, Math.min(100, Math.round(gs.recycleProgress)));
    left.insertAdjacentHTML('beforeend',
      `<div id="recycle-bin" title="Recycle parts for gold. Rarer parts fill the salvage meter faster — at 100% you craft a fragment of a random rare/unique part.">
        <div class="recycle-bin-title">♻ RECYCLE</div>
        <div class="recycle-bin-hint">drag a part here for gold + salvage</div>
        <div class="recycle-meter"><div class="recycle-meter-fill" style="width:${recPct}%"></div></div>
        <div class="recycle-meter-label">Salvage ${recPct}% → rare/unique fragment</div>
      </div>`);

    const grid = gs.grid;
    const totalW = grid.cols * (CELL + GAP) - GAP;
    const totalH = grid.rows * (CELL + GAP) - GAP;
    const expandCost = 100 + (grid.rows - 3) * 50 + (grid.cols - 4) * 50;
    const maxSize = grid.rows >= 8 && grid.cols >= 8;

    const hasPlaced = Object.keys(grid.placed).length > 0;
    center.innerHTML = `
      <div class="grid-header">
        <span>Rig — ${grid.rows}x${grid.cols}</span>
        <span class="grid-header-actions">
          ${hasPlaced ? `<button class="btn btn-small btn-secondary" id="btn-clear-grid" title="Return all placed parts to your inventory">↩ Clear Grid</button>` : ''}
          ${maxSize ? '' : `<button class="btn btn-small btn-secondary" id="btn-expand">+ Expand (${expandCost}g)</button>`}
        </span>
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
      el.innerHTML = `<span class="placed-name">${def.name}</span>`;

      // Tooltip on placed parts
      el.addEventListener('mouseenter', (e) => { showTooltip(p.id, e); });
      el.addEventListener('mousemove', (e) => { positionTooltip(e); });
      el.addEventListener('mouseleave', hideTooltip);

      const onPartDown = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        e.stopPropagation();
        if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
        Eng.removePart(grid, pid);
        startDrag(p.id, p.rotated, pid, e);
      };
      el.addEventListener('mousedown', onPartDown);
      el.addEventListener('touchstart', onPartDown, { passive: false });

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

    // Highlight parts taking part in a synergy / amped by a core
    const syn = Eng.gridSynergies(grid);
    syn.synergizedPids.forEach(pid => gridCont.querySelector(`.placed-part[data-pid="${pid}"]`)?.classList.add('synergy-active'));
    syn.ampedPids.forEach(pid => gridCont.querySelector(`.placed-part[data-pid="${pid}"]`)?.classList.add('amped'));

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

    const clearBtn = document.getElementById('btn-clear-grid');
    if (clearBtn) {
      clearBtn.onclick = () => {
        let n = 0;
        for (const pid of Object.keys(grid.placed)) {
          const p = Eng.removePart(grid, pid);
          if (p) { gs.inventory.push(p.id); n++; }
        }
        if (n) { A?.tick?.(); toast(`↩ Cleared <b>${n}</b> part${n > 1 ? 's' : ''} back to inventory`, 'loot'); }
        DrillDown.Game.updateWorkshop();
      };
    }

    document.getElementById('btn-launch').onclick = () => DrillDown.Game.startRun();

    const stats = Eng.computeStats(grid);
    const statHelp = {
      '⬇ Drill': 'Overcomes rock hardness. Higher = less heat penalty from dense rock. Diminishing returns once very high — stacking more drill keeps helping, but less each time.',
      '🌡 Heat Gen': 'Heat produced each depth step. Adds up fast — keep it cool! (Not capped — big drills really do run hot.)',
      '❄ Cooling': 'Reduces heat each step. +2 bonus when placed next to a drill. Not capped, so it can always offset heat.',
      '❤ HP': 'Health points. Run ends at 0. Armor reduces incoming damage. Diminishing returns at very high totals.',
      '🛡 Armor': 'Subtracted from enemy damage. Stacks from multiple sources, with diminishing returns when stacked very high.',
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
      ${syn.synergies.length ? `
      <div class="stat-divider"></div>
      <div class="synergy-section">
        <div class="frag-label">🔗 Active Synergies</div>
        ${syn.synergies.map(s => `<div class="syn-row"><span>${s.label}${s.count > 1 ? ` ×${s.count}` : ''}</span><span class="syn-bonus">${s.bonus}</span></div>`).join('')}
      </div>` : ''}
      <div class="stat-divider"></div>
      <div class="policy-section">
        <div class="frag-label" title="Decide when the drone heads home — instead of drilling until it dies.">⬆ Return Policy</div>
        <label class="policy-row"><input type="checkbox" id="pol-cargo" ${gs.returnPolicy.cargoFull ? 'checked' : ''}> Return when cargo full</label>
        <div class="policy-row">
          <span>Emergency ascent</span>
          <select id="pol-hp">
            <option value="0" ${gs.returnPolicy.hpPct === 0 ? 'selected' : ''}>Off</option>
            <option value="0.1" ${gs.returnPolicy.hpPct === 0.1 ? 'selected' : ''}>10% HP</option>
            <option value="0.25" ${gs.returnPolicy.hpPct === 0.25 ? 'selected' : ''}>25% HP</option>
            <option value="0.5" ${gs.returnPolicy.hpPct === 0.5 ? 'selected' : ''}>50% HP</option>
          </select>
        </div>
      </div>
      <button class="btn btn-secondary shop-btn" id="btn-open-shop">🏪 Shop</button>
      <button class="btn btn-secondary shop-btn" id="btn-help-open" style="margin-top:4px;font-size:12px;">📖 How to Play</button>
      <button class="btn btn-secondary shop-btn" id="btn-mute" style="margin-top:4px;font-size:12px;">${A?.isMuted() ? '🔇 Sound: Off' : '🔊 Sound: On'}</button>
      <button class="btn btn-secondary shop-btn" id="btn-menu" style="margin-top:4px;font-size:12px;">⌂ Title Menu</button>
    `;
    document.getElementById('btn-menu').onclick = () => { renderTitle(); showScreen('title'); };
    document.getElementById('btn-open-shop').onclick = () => renderShop();
    document.getElementById('btn-help-open').onclick = () => renderHelp();
    document.getElementById('btn-help').onclick = () => renderHelp();
    document.getElementById('btn-mute').onclick = (e) => {
      const m = A?.toggle();
      e.target.textContent = m ? '🔇 Sound: Off' : '🔊 Sound: On';
      if (!m) A?.resume();
    };

    const polCargo = document.getElementById('pol-cargo');
    if (polCargo) polCargo.onchange = (e) => { gs.returnPolicy.cargoFull = e.target.checked; Eng.save(gs); };
    const polHp = document.getElementById('pol-hp');
    if (polHp) polHp.onchange = (e) => { gs.returnPolicy.hpPct = parseFloat(e.target.value); Eng.save(gs); };
  }

  function renderShop() {
    const gs = DrillDown.Game.state;
    const overlay = document.getElementById('shop-overlay');
    overlay.classList.add('active');
    const cont = overlay.querySelector('.shop-content');
    const plan = Eng.shopPlan(gs.bestDepth);
    const stockNote = plan.unique
      ? `Stock tier: <strong style="color:#74b9ff">${plan.name}</strong> — premium uniques in stock`
      : `Stock tier: <strong style="color:#74b9ff">${plan.name}</strong> — drill deeper for rarer stock`;
    cont.innerHTML = `<h2>🏪 Parts Shop</h2>
      <div style="margin-bottom:6px;color:#888;font-size:13px;">💰 Gold: <strong style="color:#f5a623">${gs.gold}g</strong> — Drag a part to buy it</div>
      <div style="margin-bottom:12px;color:#666;font-size:12px;">${stockNote}</div>
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
    A?.resume();
    A?.launch();
    A?.humStart();
    const gs = DrillDown.Game.state;
    const cont = document.getElementById('screen-drill');
    cont.innerHTML = `
      <div class="drill-status" id="drill-status">
        <span>Depth: <strong id="drill-depth">0</strong></span>
        <span>Zone: <strong id="drill-zone">The Crust</strong></span>
        <span>❤ HP: <strong id="drill-hp">0</strong>/<strong id="drill-hp-max">0</strong></span>
        <span>🌡 Heat: <strong id="drill-heat">0</strong></span>
        <span>📦 <strong id="drill-cargo">0</strong>/<strong id="drill-cargo-max">0</strong></span>
      </div>
      <div id="dig-view" class="digging">
        <div class="dig-strata"></div>
        <div class="dig-glow"></div>
        <div class="dig-drone"><div class="dig-body"></div><div class="dig-bit"></div></div>
        <div class="dig-depth" id="dig-depth">0m</div>
      </div>
      <div class="drill-log" id="drill-log"></div>
      <div class="drill-controls">
        <button class="btn btn-primary" id="btn-auto">▶ Skip to End</button>
        <button class="btn btn-secondary" id="btn-surface">⬆ Surface Now</button>
      </div>
    `;

    const stats = Eng.computeStats(gs.grid);
    const policy = gs.returnPolicy || { cargoFull: true, hpPct: 0.25 };
    const result = Eng.simulateRun(stats, 0, policy);

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
      // Sound cues
      if (entry.text.includes('OVERHEAT') || entry.text.includes('Destroyed')) { A?.overheat(); shake(); }
      else if (entry.text.includes('Void Crystal') || entry.text.includes('cache') || entry.text.includes('Ore vein')) A?.loot();
      else if (Math.random() < 0.6) A?.tick();
      lineEl.textContent = entry.text;
      logDiv.appendChild(lineEl);
      logDiv.scrollTop = logDiv.scrollHeight;

      document.getElementById('drill-depth').textContent = entry.depth || idx + 1;
      const digDepth = document.getElementById('dig-depth');
      if (digDepth) digDepth.textContent = (entry.depth || idx + 1) + 'm';
      document.getElementById('drill-zone').textContent = Eng.zoneFor(entry.depth || 0).name;
      document.getElementById('drill-hp').textContent = Math.max(0, entry.hp || 0);
      document.getElementById('drill-hp-max').textContent = stats.hp;
      document.getElementById('drill-heat').textContent = Math.floor(entry.heat || 0) + '%';
      document.getElementById('drill-cargo').textContent = entry.cargo || 0;
      document.getElementById('drill-cargo-max').textContent = Math.floor(stats.cargo);

      idx++;
      setTimeout(appendLine, 80 + Math.random() * 120);
    }

    function finishRun(runResult, robotStats) {
      A?.humStop();
      document.getElementById('dig-view')?.classList.remove('digging');
      const dd = document.getElementById('dig-depth');
      if (dd) dd.textContent = runResult.maxDepth + 'm';
      gs.lastDepth = runResult.maxDepth;
      const survived = runResult.surfaced;
      // The haul only banks if the drone makes it back. Destroyed = everything carried is lost.
      const cargoArr = runResult.cargo || [];
      const oreGold = survived ? Eng.cargoValue(cargoArr) : 0;
      const bonusGold = survived ? runResult.gold : 0;
      gs.gold += bonusGold + oreGold;
      if (!gs.fragments) gs.fragments = {};
      if (survived) {
        // Process fragments — auto-crafts at 2 (rare) / 3 (unique)
        for (const partId of runResult.foundParts) Eng.addFragment(gs, partId);
      }
      gs.totalRuns = (gs.totalRuns || 0) + 1;
      if (runResult.maxDepth > (gs.bestDepth || 0)) gs.bestDepth = runResult.maxDepth;

      // Depth milestones — one-time achievement rewards, granted even on death (you reached it).
      if (!gs.milestones) gs.milestones = [];
      const newMilestones = [];
      for (const m of Eng.MILESTONES) {
        if (runResult.maxDepth >= m.depth && !gs.milestones.includes(m.depth)) {
          gs.milestones.push(m.depth);
          gs.gold += m.reward;
          newMilestones.push(m);
        }
      }

      Eng.save(gs);
      setTimeout(() => showComplete(runResult, oreGold, bonusGold, newMilestones), 400);
    }

    // Render the run summary in place — keeps the full log on screen (no separate results page)
    function showComplete(runResult, oreGold, bonusGold, newMilestones) {
      const survived = runResult.surfaced;
      const milestoneGold = (newMilestones || []).reduce((s, m) => s + m.reward, 0);
      const totalGold = bonusGold + oreGold + milestoneGold;
      const newBest = runResult.maxDepth >= (gs.bestDepth || 0);
      const zone = Eng.zoneFor(runResult.maxDepth);
      const cargoArr = runResult.cargo || [];
      // Build cargo breakdown from commodities
      const comMap = {};
      Eng.COMMODITIES.forEach(c => comMap[c.id] = c);
      const cargoCounts = {};
      cargoArr.forEach(id => { cargoCounts[id] = (cargoCounts[id] || 0) + 1; });
      const cargoHtml = Object.keys(cargoCounts).length
        ? Object.entries(cargoCounts).map(([id, n]) => {
            const c = comMap[id];
            return c ? `${c.emoji} ${n}× ${c.name}` : `${n}× ${id}`;
          }).join(' · ')
        : 'none';
      const statusBar = document.getElementById('drill-status');
      if (statusBar) {
        statusBar.classList.add('run-complete-bar');
        const mileHtml = (newMilestones && newMilestones.length)
          ? `<div class="rc-milestones">🏅 ${newMilestones.map(m => `${m.name} <span class="gold">+${m.reward}g</span>`).join(' · ')}</div>`
          : '';
        statusBar.innerHTML = `
          <div class="rc-title ${survived ? '' : 'rc-fail'}">${survived ? '⛰ RUN COMPLETE' : '❌ DRILL LOST — HAUL FORFEIT'}</div>
          <div class="rc-chips">
            <span class="rc-chip"><label>Max Depth</label><b>${runResult.maxDepth}${newBest ? ' ★' : ''}</b></span>
            <span class="rc-chip"><label>Zone</label><b>${zone.name}</b></span>
            <span class="rc-chip"><label>Best Ever</label><b>${gs.bestDepth}</b></span>
            <span class="rc-chip"><label>Status</label><b class="${survived ? 'text-ok' : 'text-fail'}">${survived ? 'Surfaced' : 'Destroyed'}</b></span>
            <span class="rc-chip"><label>Cargo (${cargoArr.length} slots)</label><b class="${survived ? '' : 'text-fail'}" style="font-size:14px">${survived ? cargoHtml : 'lost'}</b></span>
            <span class="rc-chip"><label>Haul Value</label><b class="${survived ? 'gold' : 'text-fail'}">${survived ? `+${oreGold}g` : 'lost'}</b></span>
            <span class="rc-chip"><label>Fragments</label><b class="${survived ? '' : 'text-fail'}">${runResult.foundParts.length}${survived ? '' : ' (lost)'}</b></span>
            <span class="rc-chip"><label>Gold Earned</label><b class="gold">+${totalGold}g</b></span>
          </div>
          ${mileHtml}`;
      }
      if (survived) A?.surface(); else A?.destroyed();
      if (newMilestones && newMilestones.length) setTimeout(() => A?.milestone(), 550);
      const controls = document.querySelector('#screen-drill .drill-controls');
      if (controls) {
        controls.innerHTML = `
          <button class="btn btn-primary" id="btn-relaunch">⬇ Relaunch Drone</button>
          <button class="btn btn-secondary" id="btn-back-workshop">⬆ Workshop</button>`;
        document.getElementById('btn-relaunch').onclick = () => DrillDown.Game.startRun();
        document.getElementById('btn-back-workshop').onclick = () => {
          gs.shop = Eng.generateShop(gs.runNumber, gs.bestDepth);
          gs.runNumber++;
          DrillDown.Game.updateWorkshop();
        };
      }
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
        document.getElementById('drill-zone').textContent = Eng.zoneFor(last.depth || result.maxDepth || 0).name;
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
        const truncatedCargo = entry.cargoItems || [];
        const truncated = {
          maxDepth: entry.depth,
          gold: entry.cumGold || Math.floor(result.gold * pct),
          foundParts: result.foundParts.slice(0, Math.max(1, Math.floor(result.foundParts.length * pct))),
          hp: entry.hp,
          cargo: truncatedCargo,
          log: result.log.slice(0, idx),
          surfaced: true
        };
        truncated.log.push({ depth: entry.depth, text: '⬆ Manual surface ordered. Returning to base.', hp: entry.hp, heat: 0, cargo: truncatedCargo.length, cargoItems: truncatedCargo, cumGold: truncated.gold });
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

  function renderHelp() {
    const overlay = document.getElementById('help-overlay');
    overlay.classList.add('active');
    const cont = overlay.querySelector('.help-content');
    cont.innerHTML = `
      <h2>📖 How to Play</h2>
      <div class="help-body">
        <div class="help-section">
          <h3>🎯 Goal</h3>
          <p>Build a drilling robot, send it into the depths, and bring back resources. Each run lets you upgrade your rig to go <strong>deeper</strong>. Deeper = richer ore veins and tougher foes. Descend through zones — the Crust, Mantle, Outer/Inner Core — and hit <strong>depth milestones</strong> for one-time gold bonuses, all the way to the Singularity at 500.</p>
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
          <p><b>⚡ Speed</b> — Depth steps per tick. Faster = more progress, but more heat and more events per second.</p>
          <p><b>📡 Detect</b> — Higher chance to find ore veins, rare crystals, and ancient caches.</p>
          <p><b>⚖ Trade-offs</b> — Some parts have a downside: heavy armor lowers speed, and the Overclocked Drill runs very hot. Weigh the cost against the gain.</p>
        </div>
        <div class="help-section">
          <h3>🗺️ Grid & Placement</h3>
          <p>Parts have shapes (1×1, 1×2, 2×2, L-shape). Fit them together like Tetris.</p>
          <p><b>Drag</b> from inventory to place. Press <b>R</b> to <b>rotate</b> — while dragging, or while just hovering a part in your inventory/shop (or <b>hold</b> your finger still on touch while dragging).<br>
          <b>Right-click or Escape</b> to cancel a drag. <b>Expand</b> the grid for more room.</p>
        </div>
        <div class="help-section">
          <h3>🏪 Shop & Economy</h3>
          <p>Open the shop between runs. <b>Drag a part</b> to buy it — drop on the grid to place, or on your inventory to store.</p>
          <p>Ore converts to gold automatically. Find rare <b>Void Crystals</b> for bonus gold.</p>
          <p><b>♻ Recycle Bin</b> — drag any part you don't want here. You get a little gold <em>and</em> fill a salvage meter; rarer parts fill it faster. At 100% you craft a fragment toward a random rare/unique part — a second way to build toward the best gear.</p>
          <p><b>⚠ You only keep your haul if you surface.</b> If the drone is destroyed, all ore and fragments it was carrying are lost. Set a <b>Return Policy</b> (return when cargo full / emergency ascent at low HP) to bank your loot before it's too late.</p>
        </div>
        <div class="help-section">
          <h3>🔧 Crafting & Fragments</h3>
          <p>Ancient caches drop <b>fragments</b> — collect enough to craft a full part:<br>
          <span style="color:#74b9ff">■ Rare</span> — <b>2 fragments</b> to combine (also available in shop)<br>
          <span style="color:#ff6b6b">■ Unique</span> — <b>3 fragments</b> to combine (craft-only, strongest tier)</p>
        </div>
        <div class="help-section">
          <h3>🔗 Synergies (place parts side-by-side)</h3>
          <p><b>Cooled Drill</b> — drill next to cooling: <b>+2 cooling, +1 drill</b> each.<br>
          <b>Drill Gang</b> — drill next to drill: <b>+2 drill</b> each.<br>
          <b>Radiator Bank</b> — cooling next to cooling: <b>+1 cooling</b> each.<br>
          <b>Plating Wall</b> — defense next to defense: <b>+3 HP</b> each.<br>
          <b>Armored Head</b> — defense next to drill: <b>+1 armor</b> each.<br>
          <b>Conveyor Feed</b> — utility next to drill/cooling: <b>+1 cargo</b> each.<br>
          <b>Sensor Array</b> — utility next to utility: <b>+3 detect</b> each.<br>
          <b>◆ Reactor Core</b> — amplifies every adjacent drill/cooling/defense part's main stat (+25%, or +50% for the Singularity Core). Surround it with your best parts.</p>
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
    if (dragState.longPressTimer) clearTimeout(dragState.longPressTimer);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
    document.querySelectorAll('.grid-hover-ok, .grid-hover-bad').forEach(el => el.classList.remove('grid-hover-ok', 'grid-hover-bad'));
    document.getElementById('recycle-bin')?.classList.remove('bin-hover');
    if (dragState.ghost) dragState.ghost.remove();
    if (dragState.fromGrid) {
      DrillDown.Game.state.inventory.push(dragState.partId);
    }
    dragState = null;
    DrillDown.Game.updateWorkshop();
  }

  return {
    showScreen, renderTitle, renderWorkshop, renderShop, renderDrill,
    createPartElement, initTooltip, cancelDrag, isDragging, rotateDrag, rotateHovered
  };
})();
