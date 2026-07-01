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
  let lastGridTap = null;       // { pid, t } — detects double-tap on a placed part (native
                                // dblclick is unreliable: each tap re-renders the grid)
  let selected = null;          // tap-to-place: { partId, rot } currently armed for placement

  const TAP_TIME = 250;         // ms — a press shorter than this with no drift counts as a tap
  const TAP_MOVE = 10;          // px of drift allowed before a press becomes a drag (not a tap)

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

  // Per-cell blocks for a shape, so irregular parts (T / S / L / U / W...) only paint
  // the cells they actually occupy instead of their bounding rectangle. Returns
  // absolutely-positioned divs; the caller styles them via the inline css string.
  function shapeCellsHtml(shape, cellPx, gapPx, css) {
    return shape.map(([r, c]) =>
      `<div class="shape-cell" style="left:${c * (cellPx + gapPx)}px;top:${r * (cellPx + gapPx)}px;width:${cellPx}px;height:${cellPx}px;${css || ''}"></div>`
    ).join('');
  }

  function shapeBounds(shape) {
    return {
      w: Math.max(...shape.map(([r, c]) => c)) + 1,
      h: Math.max(...shape.map(([r, c]) => r)) + 1
    };
  }

  // Edge arrows for directional parts (Blast Furnace, Cryo Cascade...): one arrow per
  // effect on the matching bounding-box edge, green for boost / red for scorch. Sides
  // rotate with the part, so the arrows always show the live facing.
  const DIR_ARROWS = { up: '▲', right: '▶', down: '▼', left: '◀' };
  function dirArrowsHtml(def, rot) {
    if (!def.dirEffects) return '';
    return def.dirEffects.map(eff => {
      const side = Eng.rotateSide(eff.side, rot);
      return `<span class="dir-arrow dir-${side} ${eff.amp > 0 ? 'dir-boost' : 'dir-scorch'}" title="${eff.amp > 0 ? 'Boosts' : 'Scorches'} parts on this side (${eff.amp > 0 ? '+' : ''}${Math.round(eff.amp * 100)}%)">${DIR_ARROWS[side]}</span>`;
    }).join('');
  }

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

    el.dataset.rot = String(opts.rot || 0);

    // Stats are intentionally not shown on the card — hover/hold for the full tooltip.
    el.innerHTML = `
      <div class="part-card-bg"></div>
      <div class="part-card-name">${def.name}</div>
      <div class="part-card-rarity ${def.rarity}">${def.rarity}</div>
      <div class="part-card-cost">${opts.showCost ? price + 'g' : ''}</div>
    `;
    sizeCard(el, def, opts.rot || 0);

    // Hover tooltip + track the hovered card so R can pre-rotate it before pickup
    el.addEventListener('mouseenter', (e) => { hoveredCard = { el, partId }; showTooltip(partId, e); });
    el.addEventListener('mousemove', (e) => { positionTooltip(e); });
    el.addEventListener('mouseleave', () => { if (hoveredCard && hoveredCard.el === el) hoveredCard = null; hideTooltip(); });

    // Pointer down (mouse or touch): drag from inventory, or shop — preserving any pre-rotation
    const onDown = (e) => {
      if (e.type === 'mousedown' && e.button !== 0) return;
      if (e.target.closest('.sell-btn') || e.target.closest('.upgrade-btn')) return;
      if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
      const rot = parseInt(el.dataset.rot || '0');
      if (opts.fromShop) {
        const gs = DrillDown.Game.state;
        if (gs.gold < Eng.shopCost(partId)) return;
        document.getElementById('shop-overlay')?.classList.remove('active');
        startDrag(partId, rot, null, e, true);
        return;
      }
      startDrag(partId, rot, null, e, false);
    };
    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: false });

    return el;
  }

  // Size a part card to its shape's bounding box and draw the shape silhouette in the
  // card background, so irregular parts read at a glance instead of as plain rectangles.
  const CARD_CELL = 50, CARD_GAP = 2;
  function sizeCard(el, def, rot) {
    const shape = Eng.shapeFor(def, rot);
    const { w, h } = shapeBounds(shape);
    el.style.width = (w * (CARD_CELL + CARD_GAP)) + 'px';
    el.style.height = (h * (CARD_CELL + CARD_GAP)) + 'px';
    const bg = el.querySelector('.part-card-bg');
    if (bg) bg.innerHTML = shapeCellsHtml(shape, CARD_CELL, CARD_GAP, `background:${def.color}26;border-color:${def.color}55;`) + dirArrowsHtml(def, rot);
  }

  // Rotate the part card currently under the cursor (R when not dragging). Returns
  // true if something was rotated so the caller can swallow the key.
  function rotateHovered() {
    if (!hoveredCard || !hoveredCard.el || !document.body.contains(hoveredCard.el)) { hoveredCard = null; return false; }
    const def = P[hoveredCard.partId];
    if (!def) return false;
    const rot = (parseInt(hoveredCard.el.dataset.rot || '0') + 1) % 4;
    hoveredCard.el.dataset.rot = String(rot);
    sizeCard(hoveredCard.el, def, rot);
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

  function startDrag(partId, rot, pid, e, fromShop) {
    if (dragState) endDrag(null);
    const def = P[partId];
    if (!def) return;

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const pt = evtPoint(e);
    ghost.style.left = (pt.clientX - 30) + 'px';
    ghost.style.top = (pt.clientY - 30) + 'px';
    document.body.appendChild(ghost);

    const isTouch = e.type === 'touchstart' || e.type === 'touchmove';
    dragState = { partId, rot: (+rot || 0) % 4, ghost, fromGrid: !!pid, pid, partDef: def, fromShop: !!fromShop, isTouch, lastPt: pt, startPt: pt, startTime: Date.now(), moved: false };
    sizeGhost();
    if (isTouch) armLongPress(pt);

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }

  // Resize + redraw the drag ghost for the current rotation. Per-cell blocks so an
  // irregular shape's ghost matches its real footprint.
  function sizeGhost() {
    if (!dragState) return;
    const def = dragState.partDef;
    const shape = Eng.shapeFor(def, dragState.rot);
    const { w, h } = shapeBounds(shape);
    dragState.ghost.style.width = (w * CELL + (w - 1) * GAP) + 'px';
    dragState.ghost.style.height = (h * CELL + (h - 1) * GAP) + 'px';
    dragState.ghost.innerHTML =
      shapeCellsHtml(shape, CELL, GAP, `background:${def.color}88;border-color:${DrillDown.RARITY_COLORS[def.rarity]};`) +
      dirArrowsHtml(def, dragState.rot) +
      `<div class="ghost-label"><span>${def.name}</span><span class="ghost-hint">R / hold ⟳</span></div>`;
  }

  // Rotate the part currently being dragged (R key on desktop, long-press on touch).
  // Cycles through all 4 quarter-turns — irregular shapes have 4 distinct footprints.
  function rotateDrag() {
    if (!dragState) return;
    dragState.rot = (dragState.rot + 1) % 4;
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
      const shape = Eng.shapeFor(def, dragState.rot);
      // Green when it would drop here, red otherwise (overlap, off-grid, or hull void).
      const valid = Eng.canPlace(DrillDown.Game.state.grid, dragState.partId, row, col, dragState.rot);
      const cls = valid ? 'grid-hover-ok' : 'grid-hover-bad';
      for (const [dr, dc] of shape) {
        const rr = row + dr, cc = col + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue; // skip overhang so it can't wrap to another row
        const cell = gridEl.querySelector(`.grid-cell[data-index="${rr * cols + cc}"]`);
        if (cell && !cell.classList.contains('cell-void')) cell.classList.add(cls);
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

    // Drift past the tap tolerance means the user is dragging, not tapping-to-select.
    if (!dragState.moved && dragState.startPt) {
      const d = Math.hypot(pt.clientX - dragState.startPt.clientX, pt.clientY - dragState.startPt.clientY);
      if (d > TAP_MOVE) dragState.moved = true;
    }

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

    // Quick tap (no drift) on an inventory part → arm it for tap-to-place instead of
    // dragging. Far more reliable than drag on a touchscreen. (Grid/shop parts keep drag.)
    if (!dragState.moved && (Date.now() - dragState.startTime) < TAP_TIME && !dragState.fromGrid && !dragState.fromShop) {
      const tappedId = dragState.partId, tappedRot = dragState.rot;
      dragState.ghost.remove();
      document.querySelectorAll('.grid-hover-ok, .grid-hover-bad').forEach(el => el.classList.remove('grid-hover-ok', 'grid-hover-bad'));
      document.getElementById('recycle-bin')?.classList.remove('bin-hover');
      dragState = null;
      selectPart(tappedId, tappedRot);
      return;
    }
    // Any real drag cancels a pending tap-to-place selection.
    if (selected) clearSelection();

    const gs = DrillDown.Game.state;

    // Quick tap (no drift) on a placed part: put it back exactly where it was, under its
    // original pid — a click must never displace the part. A second quick tap on the
    // same part rotates it in place, cycling to the next of the 4 orientations that fits.
    if (!dragState.moved && (Date.now() - dragState.startTime) < TAP_TIME && dragState.fromGrid && dragState.origPos) {
      const o = dragState.origPos;
      const now = Date.now();
      let rot = o.rot;
      if (lastGridTap && lastGridTap.pid === dragState.pid && now - lastGridTap.t < 400) {
        for (let i = 1; i <= 3; i++) {
          const tryRot = (o.rot + i) % 4;
          if (Eng.canPlace(gs.grid, dragState.partId, o.row, o.col, tryRot)) { rot = tryRot; break; }
        }
        if (rot !== o.rot) A?.tick?.();
      }
      Eng.placePart(gs.grid, dragState.partId, o.row, o.col, rot, dragState.pid);
      lastGridTap = { pid: dragState.pid, t: now };
      document.querySelectorAll('.grid-hover-ok, .grid-hover-bad').forEach(el => el.classList.remove('grid-hover-ok', 'grid-hover-bad'));
      document.getElementById('recycle-bin')?.classList.remove('bin-hover');
      dragState.ghost.remove();
      dragState = null;
      Eng.save(gs);
      DrillDown.Game.updateWorkshop();
      return;
    }
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
      if (row >= 0 && col >= 0 && Eng.canPlace(gs.grid, dragState.partId, row, col, dragState.rot)) {
        if (dragState.fromShop) {
          doPurchase();
          if (purchased) {
            if (Eng.placePart(gs.grid, dragState.partId, row, col, dragState.rot)) {
              placed = true;
            } else {
              // refund
              gs.gold += Eng.shopCost(dragState.partId);
              gs.shop.push(dragState.partId);
              purchased = false;
            }
          }
        } else if (dragState.fromGrid) {
          if (Eng.placePart(gs.grid, dragState.partId, row, col, dragState.rot)) {
            placed = true;
          } else {
            gs.inventory.push(dragState.partId);
          }
        } else {
          const idx = gs.inventory.indexOf(dragState.partId);
          if (idx >= 0) gs.inventory.splice(idx, 1);
          if (Eng.placePart(gs.grid, dragState.partId, row, col, dragState.rot)) {
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

  // -- Tap-to-place (touch-friendly placement) --
  // Tap a part to arm it, then tap a grid cell to drop it (or the recycle bin to scrap
  // it). A floating banner offers rotate / cancel. Coexists with drag — a drag clears it.
  function selectPart(partId, rot) {
    if (!DrillDown.Game.state.inventory.includes(partId)) return;
    if (selected && selected.partId === partId) { clearSelection(); return; }  // re-tap toggles off
    selected = { partId, rot: (+rot || 0) % 4 };
    A?.tick?.();
    showPlacementUI();
  }

  function clearSelection() {
    selected = null;
    document.getElementById('place-banner')?.remove();
    document.querySelectorAll('.part-card.tap-selected').forEach(el => el.classList.remove('tap-selected'));
  }

  function showPlacementUI() {
    document.querySelectorAll('.part-card.tap-selected').forEach(el => el.classList.remove('tap-selected'));
    if (!selected) return;
    document.querySelectorAll(`.part-card[data-part-id="${selected.partId}"]`).forEach(el => el.classList.add('tap-selected'));
    let b = document.getElementById('place-banner');
    if (!b) { b = document.createElement('div'); b.id = 'place-banner'; document.body.appendChild(b); }
    const def = P[selected.partId];
    b.innerHTML = `<span class="pb-text">Placing <b>${def.name}</b>${selected.rot ? ` ⟳${selected.rot * 90}°` : ''} — tap a cell</span>
      <button class="btn btn-small btn-secondary" id="pb-rotate">⟳</button>
      <button class="btn btn-small btn-secondary" id="pb-cancel">✕</button>`;
    b.querySelector('#pb-rotate').onclick = () => { selected.rot = (selected.rot + 1) % 4; A?.tick?.(); showPlacementUI(); };
    b.querySelector('#pb-cancel').onclick = () => clearSelection();
  }

  // Attempt to drop the armed part at (row,col). Returns true on success.
  function tryPlaceSelected(row, col) {
    if (!selected) return false;
    const gs = DrillDown.Game.state;
    if (!Eng.canPlace(gs.grid, selected.partId, row, col, selected.rot)) { A?.tick?.(); return false; }
    const idx = gs.inventory.indexOf(selected.partId);
    if (idx < 0) { clearSelection(); return false; }
    gs.inventory.splice(idx, 1);
    Eng.placePart(gs.grid, selected.partId, row, col, selected.rot);
    A?.tick?.();
    clearSelection();
    Eng.save(gs);
    DrillDown.Game.updateWorkshop();
    return true;
  }

  // Recycle the armed part (tap the recycle bin while a part is selected).
  function recycleSelected() {
    if (!selected) return;
    const gs = DrillDown.Game.state;
    const id = selected.partId;
    const idx = gs.inventory.indexOf(id);
    if (idx < 0) { clearSelection(); return; }
    gs.inventory.splice(idx, 1);
    clearSelection();
    const r = Eng.recyclePart(gs, id);
    toast(`♻ Recycled <b>${P[id]?.name || 'part'}</b> · <span class="gold">+${r.gold}g</span> · salvage ${Math.round(r.progress)}%`, 'loot');
    if (r.awardedPartId) {
      const awName = P[r.awardedPartId]?.name || 'part';
      if (r.crafted) toast(`✦ Salvage complete — crafted <b>${awName}</b>!`, 'rare');
      else toast(`✦ Salvage complete — <b>${awName}</b> fragment (${r.fragNow}/${r.fragNeeded})`, 'rare');
      A?.loot?.();
    }
    DrillDown.Game.updateWorkshop();
  }

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
    // Tap-to-place: tapping the bin scraps the armed part (parallels drag-to-recycle).
    document.getElementById('recycle-bin')?.addEventListener('click', () => { if (selected) recycleSelected(); });

    const grid = gs.grid;
    const stats = Eng.computeStats(grid);
    const totalW = grid.cols * (CELL + GAP) - GAP;
    const totalH = grid.rows * (CELL + GAP) - GAP;
    const chassisDef = DrillDown.CHASSIS[grid.chassis];

    const hasPlaced = Object.keys(grid.placed).length > 0;
    // Compact glanceable HUD shown under the rig on mobile (hidden on desktop via CSS).
    const hud = `<div class="rig-hud">
        <span title="Drill">⛏ ${stats.drillPower}</span>
        <span title="Heat/step">🌡 ${stats.heatGen}</span>
        <span title="Cooling">❄ ${stats.cooling}</span>
        <span title="HP">❤ ${stats.hp}</span>
        <span title="Armor">🛡 ${stats.armor}</span>
        <span title="Cargo">📦 ${stats.cargo}</span>
        <span title="Speed">⚡ ${stats.speed.toFixed(1)}</span>
        <span title="Detect">📡 ${stats.detect}</span>
      </div>`;
    center.innerHTML = `
      <div class="grid-header">
        <span>${chassisDef ? chassisDef.name : 'Rig'} — ${grid.rows}x${grid.cols}</span>
        <span class="grid-header-actions">
          ${hasPlaced ? `<button class="btn btn-small btn-secondary" id="btn-clear-grid" title="Return all placed parts to your inventory">↩ Clear Grid</button>` : ''}
          <button class="btn btn-small btn-secondary" id="btn-rig-bay" title="Buy and swap chassis — different frames for different builds">🏗 Rig Bay</button>
        </span>
      </div>
      <div id="grid-container" style="width:${totalW}px;height:${totalH}px;position:relative;" data-rows="${grid.rows}" data-cols="${grid.cols}">
      </div>
      ${hud}
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
        if (grid.voids && grid.voids[r + ',' + c]) {
          // Structural void — part of the hull outline, not a usable slot.
          cell.classList.add('cell-void');
          cell.title = 'Structural void — nothing can be placed here';
          gridCont.appendChild(cell);
          continue;
        }
        // Zone cell: tint it, badge it with the modifier icon, explain on hover.
        const mod = DrillDown.CELL_MODS[(grid.mods || {})[r + ',' + c]];
        if (mod) {
          cell.classList.add('cell-mod');
          cell.style.borderColor = mod.color + '66';
          cell.style.boxShadow = `inset 0 0 12px ${mod.color}2e`;
          cell.title = `${mod.name} cell — ${mod.desc}`;
          cell.innerHTML = `<span class="cell-mod-icon" style="color:${mod.color}">${mod.icon}</span>`;
        }
        // Tap-to-place drop target (no-op unless a part is armed).
        cell.addEventListener('click', () => { if (selected) tryPlaceSelected(r, c); });
        gridCont.appendChild(cell);
      }
    }

    for (const pid in grid.placed) {
      const p = grid.placed[pid];
      const def = P[p.id];
      if (!def) continue;
      const shape = Eng.shapeFor(def, p.rot);   // normalized: min row/col offsets are 0
      const { w, h } = shapeBounds(shape);

      const el = document.createElement('div');
      el.className = 'placed-part';
      el.style.left = (p.col * (CELL + GAP)) + 'px';
      el.style.top = (p.row * (CELL + GAP)) + 'px';
      el.style.width = (w * CELL + (w - 1) * GAP) + 'px';
      el.style.height = (h * CELL + (h - 1) * GAP) + 'px';
      el.dataset.pid = pid;
      // Per-cell blocks so irregular shapes don't paint over cells they don't occupy;
      // the name label centers across the bounding box.
      el.innerHTML =
        shapeCellsHtml(shape, CELL, GAP, `background:${def.color}44;border-color:${DrillDown.RARITY_COLORS[def.rarity]};`) +
        dirArrowsHtml(def, p.rot) +
        `<span class="placed-name">${def.name}</span>`;

      // Zone-cell feedback: glow parts sitting on amplified cells, warn on unstable ones.
      for (const [dr, dc] of shape) {
        const m = (grid.mods || {})[(p.row + dr) + ',' + (p.col + dc)];
        if (m === 'amplified') el.classList.add('amped');
        else if (m === 'unstable') el.classList.add('destabilized');
      }

      // Tooltip on placed parts
      el.addEventListener('mouseenter', (e) => { showTooltip(p.id, e); });
      el.addEventListener('mousemove', (e) => { positionTooltip(e); });
      el.addEventListener('mouseleave', hideTooltip);

      const onPartDown = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        e.stopPropagation();
        if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
        Eng.removePart(grid, pid);
        startDrag(p.id, p.rot, pid, e);
        // Remember where it came from so a mere click (no drag) restores it in place.
        if (dragState) dragState.origPos = { row: p.row, col: p.col, rot: p.rot };
      };
      el.addEventListener('mousedown', onPartDown);
      el.addEventListener('touchstart', onPartDown, { passive: false });

      // (In-place rotation is handled by the double-tap detection in endDrag — a native
      // dblclick listener would be lost in the re-render between the two clicks.)

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
    syn.dampedPids?.forEach(pid => gridCont.querySelector(`.placed-part[data-pid="${pid}"]`)?.classList.add('destabilized'));

    document.getElementById('btn-rig-bay').onclick = () => renderRigBay();

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
      <div class="stat-row" title="Consecutive safe returns. Each stacks +10% haul gold (max +100%); a destroyed drone resets it."><span class="stat-label">🔥 Streak</span><span class="stat-val">${gs.streak || 0}${(gs.streak || 0) > 0 ? ` · ×${(1 + Math.min(gs.streak, 10) * 0.1).toFixed(1)}` : ''}</span></div>
      ${syn.synergies.length ? `
      <div class="stat-divider"></div>
      <div class="synergy-section">
        <div class="frag-label">🔗 Active Synergies</div>
        ${syn.synergies.map(s => `<div class="syn-row"><span>${s.label}${s.count > 1 ? ` ×${s.count}` : ''}</span><span class="syn-bonus">${s.bonus}</span></div>`).join('')}
      </div>` : ''}
      <div class="stat-divider"></div>
      <div class="policy-section">
        <div class="frag-label" title="Decide when the drone heads home — instead of drilling until it dies.">⬆ Return Policy</div>
        <label class="policy-row" title="Auto-surface once the hold is full AND holds no cheapest-tier (iron) items left to upgrade — so you bank a hold of valuable goods instead of risking it. While cheap items remain, diving deeper keeps improving the haul, so it won't bail early."><input type="checkbox" id="pol-cargo" ${gs.returnPolicy.cargoFull ? 'checked' : ''}> Bank a full hold of valuables</label>
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

    // Re-apply the tap-to-place highlight/banner if a part is still armed after a re-render.
    if (selected) {
      if (DrillDown.Game.state.inventory.includes(selected.partId)) showPlacementUI();
      else clearSelection();
    }
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
    const rerollCost = Eng.REROLL_COST;
    cont.innerHTML = `<h2>🏪 Parts Shop</h2>
      <div style="margin-bottom:6px;color:#888;font-size:13px;">💰 Gold: <strong style="color:#f5a623">${gs.gold}g</strong> — Drag a part to buy it</div>
      <div style="margin-bottom:12px;color:#666;font-size:12px;">${stockNote}</div>
      <div class="shop-items"></div>
      <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-secondary" id="btn-shop-reroll" title="Restock the shop with a fresh selection"${gs.gold < rerollCost ? ' disabled' : ''}>🔄 Reroll (${rerollCost}g)</button>
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

    const rerollBtn = document.getElementById('btn-shop-reroll');
    if (rerollBtn) rerollBtn.onclick = () => {
      if (gs.gold < rerollCost) return;
      gs.gold -= rerollCost;
      gs.shop = Eng.generateShop(gs.runNumber, gs.bestDepth);
      A?.tick?.();
      Eng.save(gs);
      renderShop();
    };

    document.getElementById('btn-shop-close').onclick = () => {
      overlay.classList.remove('active');
      DrillDown.Game.updateWorkshop();
    };
  }

  // -- Rig Bay: buy & swap chassis --
  // Chassis are sidegrades, not upgrades: each frame suits a different build (hot
  // drills, hauling, tanking, amp stacking...). Owned frames swap freely; swapping
  // returns all placed parts to inventory.
  function renderRigBay() {
    const gs = DrillDown.Game.state;
    if (!gs.ownedChassis) gs.ownedChassis = ['scrap_frame'];
    const overlay = document.getElementById('rig-overlay');
    overlay.classList.add('active');
    const cont = overlay.querySelector('.rig-content');

    const STAT_ICONS = { drillPower: '⛏', heatGen: '🌡', cooling: '❄', hp: '❤', armor: '🛡', cargo: '📦', speed: '⚡', detect: '📡' };
    const fmtStats = (st) => {
      const parts = Object.entries(st || {}).map(([k, v]) => {
        const bad = v < 0 || k === 'heatGen';
        return `<span class="${bad ? 'rig-stat-bad' : 'rig-stat-good'}">${STAT_ICONS[k] || k} ${v > 0 ? '+' : ''}${v}</span>`;
      });
      return parts.length ? parts.join(' ') : '<span class="rig-stat-none">no innate stats</span>';
    };
    const miniGrid = (def) => {
      let cells = '';
      for (let r = 0; r < def.rows; r++) {
        for (let c = 0; c < def.cols; c++) {
          if (def.mask && (!def.mask[r] || def.mask[r][c] !== 'X')) {
            cells += '<span class="rig-mini-cell rig-mini-void"></span>';   // hull void
            continue;
          }
          const m = DrillDown.CELL_MODS[(def.mods || {})[r + ',' + c]];
          cells += m
            ? `<span class="rig-mini-cell" style="background:${m.color}33;border-color:${m.color}88;color:${m.color}" title="${m.name}: ${m.desc}">${m.icon}</span>`
            : '<span class="rig-mini-cell"></span>';
        }
      }
      return `<div class="rig-mini" style="grid-template-columns:repeat(${def.cols}, 18px)">${cells}</div>`;
    };
    const modLegend = (def) => {
      const counts = {};
      for (const key in (def.mods || {})) counts[def.mods[key]] = (counts[def.mods[key]] || 0) + 1;
      return Object.entries(counts).map(([mid, n]) => {
        const m = DrillDown.CELL_MODS[mid];
        return `<div class="rig-mod-row"><span style="color:${m.color}">${m.icon} ${m.name}${n > 1 ? ` ×${n}` : ''}</span> — ${m.desc}</div>`;
      }).join('');
    };

    let cardsHtml = '';
    for (const def of Object.values(DrillDown.CHASSIS)) {
      const owned = gs.ownedChassis.includes(def.id);
      const equipped = gs.grid.chassis === def.id;
      const locked = (def.requires || 0) > (gs.bestDepth || 0);
      const afford = gs.gold >= def.cost;
      let action;
      if (equipped)   action = `<button class="btn btn-small btn-secondary" disabled>✔ Equipped</button>`;
      else if (owned) action = `<button class="btn btn-small btn-primary" data-equip="${def.id}">Equip</button>`;
      else if (locked) action = `<button class="btn btn-small btn-secondary" disabled>🔒 Reach depth ${def.requires}</button>`;
      else action = `<button class="btn btn-small ${afford ? 'btn-primary' : 'btn-secondary'}" data-buy="${def.id}" ${afford ? '' : 'disabled'}>Buy & Equip — ${def.cost}g</button>`;
      cardsHtml += `
        <div class="rig-card ${equipped ? 'equipped' : ''} ${locked && !owned ? 'locked' : ''}" style="border-top: 2px solid ${def.color}">
          <div class="rig-card-head">
            <span class="rig-card-name" style="color:${def.color}">${def.name}</span>
            <span class="rig-card-size">${def.rows}×${def.cols}</span>
          </div>
          ${miniGrid(def)}
          <div class="rig-card-stats">${fmtStats(def.stats)}</div>
          ${modLegend(def)}
          <div class="rig-card-desc">${def.desc}</div>
          <div class="rig-card-action">${action}</div>
        </div>`;
    }

    cont.innerHTML = `<h2>🏗 Rig Bay</h2>
      <div style="margin-bottom:6px;color:#888;font-size:13px;">💰 Gold: <strong style="color:#f5a623">${gs.gold}g</strong> · Best Depth: <strong style="color:#74b9ff">${gs.bestDepth || 0}</strong></div>
      <div style="margin-bottom:12px;color:#666;font-size:12px;">Frames are sidegrades — pick the one that fits your build. Owned frames swap freely between runs; swapping returns placed parts to your inventory.</div>
      <div class="rig-cards">${cardsHtml}</div>
      <div style="margin-top:14px;"><button class="btn btn-secondary" id="btn-rig-close">Close</button></div>
    `;

    const doSwap = (id) => {
      const res = Eng.swapChassis(gs, id);
      if (!res.ok) return;
      A?.loot?.();
      toast(`🏗 Equipped <b>${DrillDown.CHASSIS[id].name}</b>${res.returned ? ` · ${res.returned} part${res.returned > 1 ? 's' : ''} returned to inventory` : ''}`, 'rare');
      Eng.save(gs);
      renderRigBay();
      DrillDown.Game.updateWorkshop();
    };
    const confirmSwap = (id, buyFirst) => {
      const def = DrillDown.CHASSIS[id];
      const hasParts = Object.keys(gs.grid.placed).length > 0;
      const go = () => {
        if (buyFirst) {
          const b = Eng.buyChassis(gs, id);
          if (!b.ok) { toast(b.reason === 'gold' ? 'Not enough gold.' : 'Cannot buy that chassis yet.', 'warn'); return; }
        }
        doSwap(id);
      };
      if (hasParts || buyFirst) {
        confirmModal({
          title: buyFirst ? `Buy ${def.name} for ${def.cost}g?` : `Equip ${def.name}?`,
          body: hasParts ? 'All parts on your current rig will return to your inventory.' : (buyFirst ? 'It becomes yours permanently — swap back any time.' : ''),
          confirmLabel: buyFirst ? 'Buy & Equip' : 'Equip',
          onConfirm: go
        });
      } else {
        go();
      }
    };
    cont.querySelectorAll('[data-equip]').forEach(btn => btn.onclick = () => confirmSwap(btn.dataset.equip, false));
    cont.querySelectorAll('[data-buy]').forEach(btn => btn.onclick = () => confirmSwap(btn.dataset.buy, true));
    document.getElementById('btn-rig-close').onclick = () => {
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
        <span>🌡 Heat: <strong id="drill-heat">0</strong>/40</span>
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
      document.getElementById('drill-heat').textContent = Math.floor(entry.heat || 0);
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
      // Run-streak bonus: consecutive safe returns stack a haul-gold multiplier (+10%
      // each, capped at +100%); a destroyed drone resets the streak.
      const streakBefore = gs.streak || 0;
      const streakMult = survived ? (1 + Math.min(streakBefore, 10) * 0.1) : 1;
      const haulGold = Math.round((bonusGold + oreGold) * streakMult);
      gs.gold += haulGold;
      gs.streak = survived ? streakBefore + 1 : 0;
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
      setTimeout(() => showComplete(runResult, oreGold, bonusGold, newMilestones, { mult: streakMult, haulGold, streakAfter: gs.streak }), 400);
    }

    // Render the run summary in place — keeps the full log on screen (no separate results page)
    function showComplete(runResult, oreGold, bonusGold, newMilestones, streakInfo) {
      streakInfo = streakInfo || { mult: 1, haulGold: bonusGold + oreGold, streakAfter: gs.streak || 0 };
      const survived = runResult.surfaced;
      const milestoneGold = (newMilestones || []).reduce((s, m) => s + m.reward, 0);
      const totalGold = streakInfo.haulGold + milestoneGold;
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
            <span class="rc-chip"><label>Streak</label><b class="${survived ? '' : 'text-fail'}">${survived ? `🔥 ${streakInfo.streakAfter}${streakInfo.mult > 1 ? ` · ×${streakInfo.mult.toFixed(1)}` : ''}` : 'reset'}</b></span>
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
        document.getElementById('drill-heat').textContent = Math.floor(last.heat || 0);
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
          <p>Parts come in all the Tetris shapes and beyond — bars, squares, <b>T / S / Z / L / J</b> pieces, U-shaped claws, even a curling scorpion tail. Fit them together like Tetris.</p>
          <p><b>Mega parts</b> (3×3 and bigger) pack huge stats with real trade-offs — they eat most of a rig. Some megas are <b>directional</b>: the <span style="color:#ff5e3a">Blast Furnace</span> boosts parts touching its feed side (<span style="color:#39ff14">▲</span>) and scorches parts on its exhaust side (<span style="color:#ff4136">▼</span>); the <span style="color:#0984e3">Cryo Cascade</span> pours its boost off one edge. The arrows rotate with the part — <b>facing is a placement decision</b>. The unique <span style="color:#fdcb6e">Crucible Ring</span> is hollow: the part nested in its heart gains +50%.</p>
          <p><b>Drag</b> from inventory to place. Press <b>R</b> to <b>rotate</b> a quarter-turn — press again to cycle through all 4 orientations (while dragging, or while hovering a part in your inventory/shop; on touch, <b>hold</b> your finger still while dragging). <b>Double-click</b> a placed part to spin it in place.<br>
          <b>Right-click or Escape</b> to cancel a drag.</p>
        </div>
        <div class="help-section">
          <h3>🏗 Chassis & Zone Cells</h3>
          <p>Your grid <b>is</b> a chassis — and it's swappable. Open the <b>Rig Bay</b> to buy new frames. They're <b>sidegrades, not upgrades</b>: each has its own footprint and innate stats (a fast slim scout, a slow cargo barge, an armored tower...), so different frames suit different builds. Some hulls are <b>irregular</b> — the T-shaped Hammerhead, the cut-corner Star Fort, the clawed Scorpion — with dark <b>structural voids</b> where nothing can be placed. You keep every chassis you buy and can swap freely between runs — placed parts just return to your inventory.</p>
          <p><b>Zone cells</b> are marked squares on a chassis that modify whatever part covers them, <em>per covered cell</em>: <span style="color:#74b9ff">❄ Vented</span> +2 cooling, <span style="color:#e67e22">⚡ Conductive</span> +2 drill, <span style="color:#a0a0a0">🛡 Reinforced</span> +1 armor, <span style="color:#55efc4">📦 Cargo Bay</span> +3 cargo, <span style="color:#a29bfe">📡 Sensor</span> +4 detect. <span style="color:#ffb000">◆ Amplified</span> cells boost the covering part's primary stat by +12% each — park your best part there. <span style="color:#ff4136">▲ Unstable</span> cells <b>weaken</b> it by −15% each: leave them empty or cover them with expendable filler. Empty zone cells do nothing — placement is the puzzle.</p>
          <p>Deeper frames unlock with your <b>best depth</b> record (Surveyor Web at 75, Reactor Cradle at 150, Singularity Lattice at 300).</p>
        </div>
        <div class="help-section">
          <h3>🏪 Shop & Economy</h3>
          <p>Open the shop between runs. <b>Drag a part</b> to buy it — drop on the grid to place, or on your inventory to store.</p>
          <p>Ore converts to gold automatically. Find rare <b>Void Crystals</b> for bonus gold.</p>
          <p><b>♻ Recycle Bin</b> — drag any part you don't want here. You get a little gold <em>and</em> fill a salvage meter; rarer parts fill it faster. At 100% you craft a fragment toward a random rare/unique part — a second way to build toward the best gear.</p>
          <p><b>⚠ You only keep your haul if you surface.</b> If the drone is destroyed, all ore and fragments it was carrying are lost. Set a <b>Return Policy</b> (bank a full hold of valuables / emergency ascent at low HP) to bank your loot before it's too late. Cargo never hard-stops a run anymore — once full, each new vein swaps out your cheapest item, so diving deeper only upgrades your haul.</p>
        </div>
        <div class="help-section">
          <h3>🔧 Crafting & Fragments</h3>
          <p>Ancient caches drop <b>fragments</b> — collect enough to craft a full part:<br>
          <span style="color:#74b9ff">■ Rare</span> — <b>2 fragments</b> to combine (also available in shop)<br>
          <span style="color:#ff6b6b">■ Unique</span> — <b>3 fragments</b> to combine (craft-only, strongest tier). Uniques are powerful but come with trade-offs (extra heat, lower speed) — they're build-defining choices, not free upgrades.</p>
        </div>
        <div class="help-section">
          <h3>⬆ Mk Upgrades</h3>
          <p>Hold <b>2+ copies</b> of the same part and an <b>⬆ Mk II</b> button appears on its inventory stack. Combine two copies + gold to forge a stronger tier: <b>Mk II → Mk III → Mk IV</b>. One click rolls a whole stack up as far as your copies and gold allow (e.g. 4× a part → Mk III, 8× → Mk IV).</p>
          <p><b>Diminishing returns:</b> very high <b>drill</b>, <b>HP</b>, and <b>armor</b> are softly capped — they keep improving, but each point is worth less once you're stacked high. Cooling is <em>not</em> capped, so you can always keep heat in check. The lesson: a balanced rig beats dumping everything into one stat.</p>
        </div>
        <div class="help-section">
          <h3>🏪 Shop Stock Scales</h3>
          <p>The shop's stock improves as your <b>best depth</b> grows — commons give way to rares, and at extreme depth (300m+) a premium <b>unique</b> slot appears so you can buy one outright instead of grinding fragments.</p>
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
    if (selected) clearSelection();
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
    showScreen, renderTitle, renderWorkshop, renderShop, renderRigBay, renderDrill,
    createPartElement, initTooltip, cancelDrag, isDragging, rotateDrag, rotateHovered
  };
})();
