DrillDown.Game = (() => {
  const Eng = DrillDown.Engine;
  const UI = DrillDown.UI;

  let state = null;

  function defaultState() {
    return {
      gold: 100,
      grid: Eng.createGrid(3, 4),
      inventory: ['basic_drill', 'small_fan', 'light_plating', 'cargo_pod'],
      fragments: {},
      recycleProgress: 0,
      returnPolicy: { cargoFull: true, hpPct: 0.25 },
      milestones: [],
      shop: Eng.generateShop(1, 0),
      runNumber: 1,
      lastDepth: 0,
      bestDepth: 0,
      totalRuns: 0,
      highScore: 0,
      streak: 0
    };
  }

  function newRun() {
    state = defaultState();
    localStorage.removeItem('drill_down_save');
    updateWorkshop();
  }

  function continueRun() {
    const data = Eng.load();
    if (data) {
      state = data;
      updateWorkshop();
    } else {
      newRun();
    }
  }

  function updateWorkshop() {
    if (!state) return;
    Eng.save(state);
    UI.renderWorkshop();
  }

  function startRun() {
    if (!state) return;
    // check if robot has any drill power
    const stats = Eng.computeStats(state.grid);
    if (stats.drillPower < 1) {
      alert('Your rig needs a drill! Place a drill part on the grid.');
      return;
    }
    UI.renderDrill();
  }

  function init() {
    UI.initTooltip?.();
    UI.renderTitle();
    // Quick-start: if a save exists, jump straight into the workshop (title is still
    // reachable via the workshop's "Title Menu" button).
    if (Eng.load()) continueRun();
    // Audio contexts must start after a user gesture
    const resumeAudio = () => { DrillDown.Audio?.resume(); document.removeEventListener('pointerdown', resumeAudio); };
    document.addEventListener('pointerdown', resumeAudio);
    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('shop-overlay')?.classList.remove('active');
        UI.cancelDrag?.();
      }
      // R rotates the part being dragged, or the part card under the cursor
      if (e.key === 'r' || e.key === 'R') {
        if (UI.isDragging?.()) { e.preventDefault(); UI.rotateDrag?.(); }
        else if (UI.rotateHovered?.()) { e.preventDefault(); }
      }
    });
    // Right-click cancels an in-progress drag (and suppresses the browser menu)
    document.addEventListener('contextmenu', (e) => {
      if (UI.isDragging?.()) {
        e.preventDefault();
        UI.cancelDrag?.();
      }
    });
  }

  return {
    init, newRun, continueRun, updateWorkshop, startRun,
    get state() { return state; },
    set state(s) { state = s; }
  };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => {
  DrillDown.Game.init();
});
