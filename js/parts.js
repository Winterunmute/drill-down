const DrillDown = {};

DrillDown.PARTS = {
  basic_drill: {
    id: 'basic_drill',
    name: 'Basic Drill',
    type: 'drill',
    shape: [[0,0], [0,1]],
    stats: { drillPower: 4, heatGen: 2 },
    rarity: 'common',
    cost: 30,
    color: '#d4a574',
    emoji: '⚙'
  },
  rotary_drill: {
    id: 'rotary_drill',
    name: 'Rotary Drill',
    type: 'drill',
    shape: [[0,0], [1,0]],
    stats: { drillPower: 7, heatGen: 4 },
    rarity: 'common',
    cost: 50,
    color: '#d4a574',
    emoji: '⚙'
  },
  impact_drill: {
    id: 'impact_drill',
    name: 'Impact Drill',
    type: 'drill',
    shape: [[0,0], [0,1], [0,2]],
    stats: { drillPower: 11, heatGen: 6 },
    rarity: 'uncommon',
    cost: 90,
    color: '#e67e22',
    emoji: '⚡'
  },
  laser_drill: {
    id: 'laser_drill',
    name: 'Laser Drill',
    type: 'drill',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { drillPower: 18, heatGen: 10 },
    rarity: 'rare',
    cost: 180,
    color: '#e74c3c',
    emoji: '🔥'
  },
  small_fan: {
    id: 'small_fan',
    name: 'Small Fan',
    type: 'cooling',
    shape: [[0,0]],
    stats: { cooling: 3 },
    rarity: 'common',
    cost: 20,
    color: '#74b9ff',
    emoji: '💨'
  },
  radiator: {
    id: 'radiator',
    name: 'Radiator',
    type: 'cooling',
    shape: [[0,0], [0,1]],
    stats: { cooling: 5 },
    rarity: 'common',
    cost: 40,
    color: '#74b9ff',
    emoji: '❄'
  },
  cryo_unit: {
    id: 'cryo_unit',
    name: 'Cryo Unit',
    type: 'cooling',
    shape: [[0,0], [1,0]],
    stats: { cooling: 8 },
    rarity: 'uncommon',
    cost: 80,
    color: '#0984e3',
    emoji: '🧊'
  },
  liquid_cooler: {
    id: 'liquid_cooler',
    name: 'Liquid Cooler',
    type: 'cooling',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { cooling: 14 },
    rarity: 'rare',
    cost: 160,
    color: '#0984e3',
    emoji: '🌊'
  },
  light_plating: {
    id: 'light_plating',
    name: 'Light Plating',
    type: 'defense',
    shape: [[0,0]],
    stats: { hp: 10 },
    rarity: 'common',
    cost: 15,
    color: '#a0a0a0',
    emoji: '🛡'
  },
  heavy_plating: {
    id: 'heavy_plating',
    name: 'Heavy Plating',
    type: 'defense',
    shape: [[0,0], [0,1]],
    stats: { hp: 18, speed: -0.1 },
    desc: 'Tough but heavy — slows the drone slightly.',
    rarity: 'common',
    cost: 35,
    color: '#a0a0a0',
    emoji: '🛡'
  },
  reinforced_armor: {
    id: 'reinforced_armor',
    name: 'Reinforced Armor',
    type: 'defense',
    shape: [[0,0], [1,0]],
    stats: { hp: 30, speed: -0.2 },
    desc: 'Heavy plating — high HP at the cost of speed.',
    rarity: 'uncommon',
    cost: 70,
    color: '#636e72',
    emoji: '🧱'
  },
  nano_shield: {
    id: 'nano_shield',
    name: 'Nano Shield',
    type: 'defense',
    shape: [[0,0]],
    stats: { armor: 3, hp: 5 },
    rarity: 'rare',
    cost: 130,
    color: '#00b894',
    emoji: '✨'
  },
  cargo_pod: {
    id: 'cargo_pod',
    name: 'Cargo Pod',
    type: 'utility',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { cargo: 12 },
    rarity: 'common',
    cost: 45,
    color: '#55efc4',
    emoji: '📦'
  },
  expanded_cargo: {
    id: 'expanded_cargo',
    name: 'Expanded Cargo',
    type: 'utility',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { cargo: 20 },
    rarity: 'uncommon',
    cost: 100,
    color: '#55efc4',
    emoji: '🚛'
  },
  treads: {
    id: 'treads',
    name: 'Treads',
    type: 'utility',
    shape: [[0,0]],
    stats: { speed: 0.4 },
    rarity: 'uncommon',
    cost: 60,
    color: '#dfe6e9',
    emoji: '🔩'
  },
  deep_scanner: {
    id: 'deep_scanner',
    name: 'Deep Scanner',
    type: 'utility',
    shape: [[0,0], [1,0]],
    stats: { detect: 20 },
    rarity: 'rare',
    cost: 140,
    color: '#a29bfe',
    emoji: '📡'
  },

  // -- Drills --
  twin_bore: {
    id: 'twin_bore',
    name: 'Twin Bore',
    type: 'drill',
    shape: [[0,0], [1,0]],
    stats: { drillPower: 9, heatGen: 5 },
    rarity: 'uncommon',
    cost: 65,
    color: '#e67e22',
    emoji: '⚙'
  },
  plasma_cutter: {
    id: 'plasma_cutter',
    name: 'Plasma Cutter',
    type: 'drill',
    shape: [[0,0], [1,0], [1,1]],
    stats: { drillPower: 15, heatGen: 9 },
    rarity: 'uncommon',
    cost: 115,
    color: '#e74c3c',
    emoji: '🔥'
  },
  overclocked_drill: {
    id: 'overclocked_drill',
    name: 'Overclocked Drill',
    type: 'drill',
    shape: [[0,0], [0,1]],
    stats: { drillPower: 17, heatGen: 18 },
    desc: 'Massive bite for its size — but it runs dangerously hot. Pack cooling.',
    rarity: 'uncommon',
    cost: 120,
    color: '#ff5e3a',
    emoji: '🔥'
  },
  core_borer: {
    id: 'core_borer',
    name: 'Core Borer',
    type: 'drill',
    shape: [[0,0], [1,0], [2,0]],
    stats: { drillPower: 22, heatGen: 13 },
    rarity: 'rare',
    cost: 200,
    color: '#e74c3c',
    emoji: '🔥'
  },

  // -- Cooling --
  thermal_paste: {
    id: 'thermal_paste',
    name: 'Thermal Paste',
    type: 'cooling',
    shape: [[0,0]],
    stats: { cooling: 2 },
    rarity: 'common',
    cost: 12,
    color: '#74b9ff',
    emoji: '💧'
  },
  heat_sink: {
    id: 'heat_sink',
    name: 'Heat Sink',
    type: 'cooling',
    shape: [[0,0]],
    stats: { cooling: 6 },
    rarity: 'uncommon',
    cost: 70,
    color: '#0984e3',
    emoji: '❄'
  },
  vent_array: {
    id: 'vent_array',
    name: 'Vent Array',
    type: 'cooling',
    shape: [[0,0], [0,1], [0,2]],
    stats: { cooling: 13 },
    rarity: 'rare',
    cost: 170,
    color: '#0984e3',
    emoji: '🌊'
  },

  // -- Defense --
  deflector: {
    id: 'deflector',
    name: 'Deflector',
    type: 'defense',
    shape: [[0,0]],
    stats: { armor: 5 },
    rarity: 'uncommon',
    cost: 90,
    color: '#00b894',
    emoji: '🛡'
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    type: 'defense',
    shape: [[0,0], [0,1]],
    stats: { hp: 16, armor: 2 },
    rarity: 'uncommon',
    cost: 75,
    color: '#636e72',
    emoji: '🧱'
  },
  aegis_field: {
    id: 'aegis_field',
    name: 'Aegis Field',
    type: 'defense',
    shape: [[0,0], [1,0]],
    stats: { hp: 20, armor: 3, speed: -0.2 },
    desc: 'Projected shielding — heavy emitters drag on speed.',
    rarity: 'rare',
    cost: 150,
    color: '#00b894',
    emoji: '✨'
  },

  // -- Utility --
  gyro: {
    id: 'gyro',
    name: 'Gyro',
    type: 'utility',
    shape: [[0,0]],
    stats: { speed: 0.5 },
    rarity: 'uncommon',
    cost: 70,
    color: '#dfe6e9',
    emoji: '🔩'
  },
  ore_magnet: {
    id: 'ore_magnet',
    name: 'Ore Magnet',
    type: 'utility',
    shape: [[0,0], [1,0]],
    stats: { detect: 14, cargo: 4 },
    rarity: 'uncommon',
    cost: 85,
    color: '#a29bfe',
    emoji: '🧲'
  },
  survey_drone: {
    id: 'survey_drone',
    name: 'Survey Drone',
    type: 'utility',
    shape: [[0,0], [0,1]],
    stats: { detect: 25, speed: 0.2 },
    rarity: 'rare',
    cost: 150,
    color: '#a29bfe',
    emoji: '📡'
  },

  // -- Irregular shapes (Tetris & beyond — T, S/Z, L/J, I4, U, W pentomino) --
  t_bore: {
    id: 't_bore',
    name: 'T-Bore',
    type: 'drill',
    shape: [[0,0], [0,1], [0,2], [1,1]],   // T
    stats: { drillPower: 14, heatGen: 8 },
    rarity: 'uncommon',
    cost: 100,
    color: '#e67e22',
    emoji: '⚙'
  },
  serpent_drill: {
    id: 'serpent_drill',
    name: 'Serpent Drill',
    type: 'drill',
    shape: [[0,1], [0,2], [1,0], [1,1]],   // S
    stats: { drillPower: 19, heatGen: 11 },
    rarity: 'rare',
    cost: 190,
    color: '#e74c3c',
    emoji: '🐍'
  },
  rail_lance: {
    id: 'rail_lance',
    name: 'Rail Lance',
    type: 'drill',
    shape: [[0,0], [0,1], [0,2], [0,3]],   // I4
    stats: { drillPower: 26, heatGen: 15 },
    rarity: 'rare',
    cost: 230,
    color: '#e74c3c',
    emoji: '🔥'
  },
  coolant_elbow: {
    id: 'coolant_elbow',
    name: 'Coolant Elbow',
    type: 'cooling',
    shape: [[0,0], [1,0], [2,0], [2,1]],   // L
    stats: { cooling: 9 },
    rarity: 'uncommon',
    cost: 85,
    color: '#0984e3',
    emoji: '🧊'
  },
  zigzag_duct: {
    id: 'zigzag_duct',
    name: 'Zigzag Duct',
    type: 'cooling',
    shape: [[0,0], [0,1], [1,1], [1,2]],   // Z
    stats: { cooling: 12 },
    rarity: 'rare',
    cost: 150,
    color: '#0984e3',
    emoji: '🌊'
  },
  girder_truss: {
    id: 'girder_truss',
    name: 'Girder Truss',
    type: 'defense',
    shape: [[0,0], [0,1], [0,2], [0,3]],   // I4
    stats: { hp: 32, armor: 1 },
    rarity: 'uncommon',
    cost: 95,
    color: '#636e72',
    emoji: '🧱'
  },
  claw_shell: {
    id: 'claw_shell',
    name: 'Claw Shell',
    type: 'defense',
    shape: [[0,0], [0,2], [1,0], [1,1], [1,2]],   // U — cradles a 1×1 part in its notch
    stats: { hp: 28, armor: 3 },
    desc: 'Wraps around a small part — tuck a core or 1×1 into its notch for easy adjacency.',
    rarity: 'rare',
    cost: 165,
    color: '#00b894',
    emoji: '🦀'
  },
  crane_arm: {
    id: 'crane_arm',
    name: 'Crane Arm',
    type: 'utility',
    shape: [[0,1], [1,1], [2,0], [2,1]],   // J
    stats: { cargo: 14, detect: 5 },
    rarity: 'uncommon',
    cost: 95,
    color: '#55efc4',
    emoji: '🏗'
  },
  scorpion_tail: {
    id: 'scorpion_tail',
    name: 'Scorpion Tail',
    type: 'utility',
    shape: [[0,0], [1,0], [1,1], [2,1], [2,2]],   // W pentomino — a curling stinger
    stats: { speed: 0.4, detect: 12 },
    desc: 'A segmented sensor-tail that snakes around other parts.',
    rarity: 'rare',
    cost: 175,
    color: '#a29bfe',
    emoji: '🦂'
  },
  nexus_core: {
    id: 'nexus_core',
    name: 'Nexus Core',
    type: 'core',
    shape: [[0,1], [1,0], [1,1], [1,2], [2,1]],   // plus — maximum adjacency reach
    stats: {},
    amp: 0.2,
    desc: 'Amplifies adjacent drill / cooling / defense parts by +20%. Its cross shape touches more neighbors than any other core.',
    rarity: 'rare',
    cost: 260,
    color: '#a55eea',
    emoji: '✚'
  },

  // -- Mega parts (huge footprints, huge stats, real trade-offs) --
  titan_excavator: {
    id: 'titan_excavator',
    name: 'Titan Excavator',
    type: 'drill',
    shape: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],   // 3×3
    stats: { drillPower: 38, heatGen: 26, speed: -0.2 },
    desc: 'A drilling rig the size of a house. Monstrous bite, monstrous heat, and its bulk drags on speed.',
    rarity: 'rare',
    cost: 420,
    color: '#e74c3c',
    emoji: '🏗'
  },
  glacier_block: {
    id: 'glacier_block',
    name: 'Glacier Block',
    type: 'cooling',
    shape: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],   // 3×3
    stats: { cooling: 30, speed: -0.3 },
    desc: 'A hauled slab of ancient ice. Immense cooling — and immense weight.',
    rarity: 'rare',
    cost: 380,
    color: '#48dbfb',
    emoji: '🧊'
  },
  citadel_block: {
    id: 'citadel_block',
    name: 'Citadel Block',
    type: 'defense',
    shape: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]],   // 2×4
    stats: { hp: 55, armor: 3, speed: -0.3 },
    desc: 'A rolling fortress wall. Nothing gets through — or moves fast carrying it.',
    rarity: 'rare',
    cost: 400,
    color: '#636e72',
    emoji: '🏰'
  },
  colossus_vault: {
    id: 'colossus_vault',
    name: 'Colossus Vault',
    type: 'utility',
    shape: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],   // 3×3
    stats: { cargo: 45, speed: -0.4 },
    desc: 'A bank vault with treads. Cavernous hold; glacial pace.',
    rarity: 'rare',
    cost: 390,
    color: '#55efc4',
    emoji: '🏦'
  },

  // -- Directional megas (adjacency depends on WHICH side touches; rotates with the part) --
  blast_furnace: {
    id: 'blast_furnace',
    name: 'Blast Furnace',
    type: 'drill',
    shape: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],   // 2 rows × 3 cols
    stats: { drillPower: 20, heatGen: 14 },
    dirEffects: [
      { side: 'up',   amp: 0.25 },
      { side: 'down', amp: -0.15 }
    ],
    desc: 'Directional: parts touching its feed side (▲) gain +25% to their primary stat; parts on its exhaust side (▼) are scorched for −15%. The sides rotate with the part.',
    rarity: 'rare',
    cost: 450,
    color: '#ff5e3a',
    emoji: '🔥'
  },
  cryo_cascade: {
    id: 'cryo_cascade',
    name: 'Cryo Cascade',
    type: 'cooling',
    shape: [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]],   // 3 rows × 2 cols
    stats: { cooling: 16 },
    dirEffects: [
      { side: 'down', amp: 0.25 }
    ],
    desc: 'Directional: coolant pours off its lower edge (▼) — parts touching that side gain +25% to their primary stat. Rotate it to aim the flow.',
    rarity: 'rare',
    cost: 430,
    color: '#0984e3',
    emoji: '🌊'
  },
  crucible_ring: {
    id: 'crucible_ring',
    name: 'Crucible Ring',
    type: 'core',
    shape: [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]],   // 3×3 ring, hollow heart
    stats: { heatGen: 6 },
    nestAmp: 0.5,
    desc: 'A ring of containment — the single part nested in its hollow heart gains +50% to its primary stat. The field bleeds heat into the rig.',
    rarity: 'unique',
    cost: 0,
    color: '#fdcb6e',
    emoji: '⭕'
  },

  // -- Cores (amplify adjacent parts; no stats of their own) --
  flux_node: {
    id: 'flux_node',
    name: 'Flux Node',
    type: 'core',
    shape: [[0,0]],
    stats: {},
    amp: 0.15,
    desc: 'Amplifies adjacent drill / cooling / defense parts by +15%. Cheap and compact — a starter core.',
    rarity: 'uncommon',
    cost: 110,
    color: '#9b59b6',
    emoji: '🔮'
  },
  reactor_core: {
    id: 'reactor_core',
    name: 'Reactor Core',
    type: 'core',
    shape: [[0,0]],
    stats: {},
    amp: 0.25,
    desc: 'Amplifies adjacent drill / cooling / defense parts by +25%.',
    rarity: 'rare',
    cost: 190,
    color: '#a55eea',
    emoji: '🔆'
  },

  // -- Unique (craft-only, 3 fragments) --
  mega_drill: {
    id: 'mega_drill',
    name: 'Mega Drill',
    type: 'drill',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { drillPower: 30, heatGen: 24 },
    desc: 'A monstrous bite — but it runs blisteringly hot. Build serious cooling around it or it cooks the rig.',
    rarity: 'unique',
    cost: 0,
    color: '#ff6b6b',
    emoji: '⚡'
  },
  cryo_chamber: {
    id: 'cryo_chamber',
    name: 'Cryo Chamber',
    type: 'cooling',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { cooling: 24, speed: -0.2 },
    desc: 'Enormous heat-sink — drinks heat, but its bulk drags on the drone.',
    rarity: 'unique',
    cost: 0,
    color: '#48dbfb',
    emoji: '❄'
  },
  titan_armor: {
    id: 'titan_armor',
    name: 'Titan Armor',
    type: 'defense',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { hp: 50, armor: 6, speed: -0.4 },
    desc: 'Near-impervious, but its sheer mass slows the drone considerably.',
    rarity: 'unique',
    cost: 0,
    color: '#ff9ff3',
    emoji: '🛡'
  },
  void_pack: {
    id: 'void_pack',
    name: 'Void Pack',
    type: 'utility',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { cargo: 35, speed: -0.3 },
    desc: 'A bottomless hold — but a full void pack is heavy, dragging the drone down.',
    rarity: 'unique',
    cost: 0,
    color: '#5f27cd',
    emoji: '📦'
  },
  warp_drive: {
    id: 'warp_drive',
    name: 'Warp Drive',
    type: 'utility',
    shape: [[0,0], [0,1]],
    stats: { speed: 1.5, detect: 30, heatGen: 10 },
    desc: 'Blistering speed and sensors, but the drive coils bleed heat into the rig every step.',
    rarity: 'unique',
    cost: 0,
    color: '#f368e0',
    emoji: '⚡'
  },
  singularity_core: {
    id: 'singularity_core',
    name: 'Singularity Core',
    type: 'core',
    shape: [[0,0], [0,1], [1,0], [1,1]],
    stats: { heatGen: 8 },
    amp: 0.5,
    desc: 'Amplifies all adjacent drill / cooling / defense parts by +50% — but its unstable field radiates heat into the build.',
    rarity: 'unique',
    cost: 0,
    color: '#8854d0',
    emoji: '🌀'
  }
};

// -- Mk II/III/IV tier upgrades --
// For every non-unique part, synthesize a chain of strictly-stronger "Mk" tiers the
// player crafts by combining two copies of the previous tier plus gold (see
// Engine.upgradePart). Generated here (rather than hand-authored) so every base part
// gets a consistent ladder. Each tier carries an `upgradeOf` back-reference and the
// previous tier gets an `upgradeTo` forward-reference, forming base → Mk II → Mk III →
// Mk IV. Mk parts are combine-only: the shop, fragment caches and recycle pools all skip
// anything with an `upgradeOf` field. Good stats scale ~×1.6 per tier; heat scales
// slower (×1.3) so each tier is more heat-efficient; trade-off penalties stay fixed.
(function generateUpgrades() {
  const UP_MULT = 1.6;                 // good stats per tier
  const HEAT_MULT = 1.5;               // heat tracks power closely → tiers stay bigger, not free-er
  const NEXT_RARITY = { common: 'uncommon', uncommon: 'rare', rare: 'rare' };
  const TIERS = [
    { suffix: '_mk2', tier: 'Mk II' },
    { suffix: '_mk3', tier: 'Mk III' },
    { suffix: '_mk4', tier: 'Mk IV' }
  ];
  const round = (k, v) => k === 'speed' ? Math.round(v * 10) / 10 : Math.round(v);
  // Object.keys snapshots the base parts, so tiers added below aren't re-iterated.
  for (const baseId of Object.keys(DrillDown.PARTS)) {
    const base = DrillDown.PARTS[baseId];
    if (base.rarity === 'unique') continue;            // uniques are already the top tier
    let prevId = baseId;
    for (const t of TIERS) {
      const prev = DrillDown.PARTS[prevId];
      const stats = {};
      for (const k in prev.stats) {
        const v = prev.stats[k];
        if (k === 'heatGen') stats[k] = Math.max(v, round(k, v * HEAT_MULT));
        else if (v > 0) stats[k] = Math.max(round(k, v) + (k === 'speed' ? 0.1 : 1), round(k, v * UP_MULT));
        else stats[k] = v;                             // keep trade-off penalties (e.g. -speed) as-is
      }
      const upId = baseId + t.suffix;
      const up = {
        id: upId,
        name: base.name + ' ' + t.tier,
        tier: t.tier,
        type: base.type,
        shape: base.shape.map(s => s.slice()),
        stats,
        rarity: NEXT_RARITY[prev.rarity],
        cost: Math.round(prev.cost * 2.2),
        color: base.color,
        emoji: base.emoji,
        upgradeOf: prevId,
        desc: (base.desc ? base.desc + ' ' : '') + `${t.tier} tier — forged by combining two ${prev.name}.`
      };
      if (prev.amp) up.amp = Math.round((prev.amp + 0.15) * 100) / 100;   // cores amplify harder each tier
      if (prev.dirEffects) up.dirEffects = prev.dirEffects.map(e => ({ ...e }));   // directional sides carry through tiers unchanged
      if (prev.nestAmp) up.nestAmp = prev.nestAmp;
      DrillDown.PARTS[upId] = up;
      DrillDown.PARTS[prevId].upgradeTo = upId;
      prevId = upId;
    }
  }
})();

// -- Cell modifiers (chassis zone cells) --
// A chassis can mark individual grid cells with a modifier. The effect applies per
// covered cell to whatever part is placed over it (Engine.computeStats): flat mods add
// `amount` to `stat`; amp mods scale the covering part's primary (largest positive)
// stat by `amp`. Unoccupied modded cells do nothing — placement is the puzzle.
DrillDown.CELL_MODS = {
  vented:     { id: 'vented',     name: 'Vented',     icon: '❄', color: '#74b9ff', stat: 'cooling',    amount: 2, desc: '+2 cooling while a part covers this cell' },
  conductive: { id: 'conductive', name: 'Conductive', icon: '⚡', color: '#e67e22', stat: 'drillPower', amount: 2, desc: '+2 drill power while a part covers this cell' },
  reinforced: { id: 'reinforced', name: 'Reinforced', icon: '🛡', color: '#a0a0a0', stat: 'armor',      amount: 1, desc: '+1 armor while a part covers this cell' },
  cargo_bay:  { id: 'cargo_bay',  name: 'Cargo Bay',  icon: '📦', color: '#55efc4', stat: 'cargo',      amount: 3, desc: '+3 cargo while a part covers this cell' },
  sensor:     { id: 'sensor',     name: 'Sensor Node',icon: '📡', color: '#a29bfe', stat: 'detect',     amount: 4, desc: '+4 detect while a part covers this cell' },
  amplified:  { id: 'amplified',  name: 'Amplified',  icon: '◆', color: '#ffb000', amp: 0.12,  desc: "+12% to the covering part's primary stat, per cell" },
  unstable:   { id: 'unstable',   name: 'Unstable',   icon: '▲', color: '#ff4136', amp: -0.15, desc: "−15% to the covering part's primary stat, per cell — leave empty or cover with expendable parts" }
};

// -- Chassis (rig frames, bought in the Rig Bay) --
// Sidegrades, not upgrades: each frame has its own footprint, innate stats (some with
// trade-offs) and zone cells, suiting a different build. `mods` maps 'row,col' →
// CELL_MODS id. `requires` gates the purchase behind a best-depth record. You own every
// chassis you've bought and can swap freely between runs (placed parts return to
// inventory on swap). An optional `mask` (array of strings, one char per cell, 'X' =
// usable) carves an irregular hull outline — non-'X' cells are structural voids where
// nothing can be placed. Mask dimensions must match rows/cols.
DrillDown.CHASSIS = {
  scrap_frame: {
    id: 'scrap_frame', name: 'Scrap Frame', rows: 4, cols: 5, cost: 0,
    stats: {}, mods: {},
    color: '#d4a574',
    desc: 'Standard-issue starter frame. No innate stats, no zone cells — a blank slate.'
  },
  venting_lattice: {
    id: 'venting_lattice', name: 'Venting Lattice', rows: 4, cols: 5, cost: 200,
    stats: { cooling: 3 },
    mods: { '0,0': 'vented', '0,4': 'vented', '3,0': 'vented', '3,4': 'vented' },
    color: '#74b9ff',
    desc: 'Heat-dump frame for hot drill builds — innate cooling plus vented corner cells.'
  },
  drill_platform: {
    id: 'drill_platform', name: 'Drill Platform', rows: 4, cols: 5, cost: 250,
    stats: { drillPower: 3, heatGen: 2 },
    mods: { '0,1': 'conductive', '1,1': 'conductive', '2,1': 'conductive', '3,1': 'conductive' },
    color: '#e67e22',
    desc: 'Power-feed spine down one column boosts drills placed along it. Runs a little hot.'
  },
  slipstream: {
    id: 'slipstream', name: 'Slipstream', rows: 3, cols: 7, cost: 280,
    stats: { speed: 0.5 },
    mods: { '0,6': 'sensor', '1,6': 'sensor', '2,6': 'sensor' },
    color: '#dfe6e9',
    desc: 'Slim scout hull — fewer slots, innate speed, sensor nodes in the nose. Built for fast shallow-loot runs.'
  },
  hauler_barge: {
    id: 'hauler_barge', name: 'Hauler Barge', rows: 4, cols: 6, cost: 300,
    stats: { cargo: 6, speed: -0.1 },
    mods: { '3,1': 'cargo_bay', '3,2': 'cargo_bay', '3,3': 'cargo_bay', '3,4': 'cargo_bay' },
    color: '#55efc4',
    desc: 'Wide freight frame with a cargo-bay keel. Heavy — drags on speed.'
  },
  bastion: {
    id: 'bastion', name: 'Bastion', rows: 5, cols: 4, cost: 320,
    stats: { hp: 15, speed: -0.2 },
    mods: { '0,0': 'reinforced', '0,3': 'reinforced', '4,0': 'reinforced', '4,3': 'reinforced' },
    color: '#a0a0a0',
    desc: 'Tall armored tower — innate HP and reinforced corners. Slow but very hard to kill.'
  },
  surveyor_web: {
    id: 'surveyor_web', name: 'Surveyor Web', rows: 5, cols: 5, cost: 500, requires: 75,
    stats: { detect: 10 },
    mods: { '0,0': 'sensor', '1,1': 'sensor', '2,2': 'sensor', '3,3': 'sensor', '4,4': 'sensor' },
    color: '#a29bfe',
    desc: 'Prospector frame — a diagonal lattice of sensor nodes threads detect through the whole build.'
  },
  reactor_cradle: {
    id: 'reactor_cradle', name: 'Reactor Cradle', rows: 5, cols: 5, cost: 650, requires: 150,
    stats: { heatGen: 2 },
    mods: { '1,1': 'amplified', '1,2': 'amplified', '2,1': 'amplified', '2,2': 'amplified' },
    color: '#ffb000',
    desc: 'An amplified 2×2 heart — park your best parts dead center. The field bleeds a little heat.'
  },
  leviathan_hull: {
    id: 'leviathan_hull', name: 'Leviathan Hull', rows: 5, cols: 6, cost: 900, requires: 150,
    stats: { hp: 20, cargo: 5, speed: -0.3 },
    mods: { '1,2': 'unstable', '2,2': 'unstable', '3,2': 'unstable' },
    color: '#636e72',
    desc: 'A salvaged deep-hauler: huge, tough, roomy — but its cracked core column destabilizes anything placed over it.'
  },
  hammerhead: {
    id: 'hammerhead', name: 'Hammerhead', rows: 5, cols: 6, cost: 350, requires: 25,
    mask: [
      'XXXXXX',
      '.XXXX.',
      '..XX..',
      '..XX..',
      '..XX..'
    ],
    stats: { drillPower: 2, detect: 5 },
    mods: { '0,0': 'sensor', '0,5': 'sensor', '2,2': 'conductive', '3,2': 'conductive', '4,2': 'conductive' },
    color: '#f39c12',
    desc: 'T-shaped prospector hull — a wide sensor head over a powered drill spine. Awkward to pack, deadly straight down.'
  },
  star_fort: {
    id: 'star_fort', name: 'Star Fort', rows: 6, cols: 6, cost: 800, requires: 150,
    mask: [
      '.XXXX.',
      'XXXXXX',
      'XXXXXX',
      'XXXXXX',
      'XXXXXX',
      '.XXXX.'
    ],
    stats: { hp: 20, armor: 2, speed: -0.2 },
    mods: { '0,2': 'reinforced', '0,3': 'reinforced', '2,0': 'reinforced', '2,5': 'reinforced', '3,0': 'reinforced', '3,5': 'reinforced', '5,2': 'reinforced', '5,3': 'reinforced', '2,2': 'amplified', '2,3': 'amplified', '3,2': 'amplified', '3,3': 'amplified' },
    color: '#00b894',
    desc: 'A cut-corner bastion — reinforced bulwarks at every point and an amplified keep at its heart.'
  },
  scorpion: {
    id: 'scorpion', name: 'Scorpion', rows: 5, cols: 7, cost: 1100, requires: 200,
    mask: [
      'XXX.XXX',
      'XXXXXX.',
      '.XXXXXX',
      '..XXXXX',
      '....XXX'
    ],
    stats: { speed: 0.3, armor: 2 },
    mods: { '0,0': 'reinforced', '0,6': 'reinforced', '4,5': 'conductive', '4,6': 'amplified' },
    color: '#e74c3c',
    desc: 'Segmented predator hull — armored claws, a quick body, and an amplified stinger at the tail tip.'
  },
  singularity_lattice: {
    id: 'singularity_lattice', name: 'Singularity Lattice', rows: 6, cols: 6, cost: 1500, requires: 300,
    stats: { heatGen: 4 },
    mods: {
      '2,2': 'amplified', '1,2': 'amplified', '3,2': 'amplified', '2,1': 'amplified', '2,3': 'amplified',
      '2,4': 'amplified', '4,2': 'amplified',
      '0,0': 'unstable', '0,5': 'unstable', '5,0': 'unstable', '5,5': 'unstable'
    },
    color: '#8854d0',
    desc: 'Endgame relic — an amplified cross at its heart, unstable void-scarred corners. The ultimate placement puzzle.'
  }
};

DrillDown.RARITY_COLORS = {
  common: '#ffffff',
  uncommon: '#55efc4',
  rare: '#74b9ff',
  unique: '#ff6b6b'
};

DrillDown.PART_TYPES = Object.keys(DrillDown.PARTS);
