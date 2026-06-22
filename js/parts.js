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
    stats: { hp: 18 },
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
    stats: { hp: 30 },
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
    stats: { hp: 20, armor: 3 },
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

  // -- Cores (amplify adjacent parts; no stats of their own) --
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
    stats: { drillPower: 28, heatGen: 14 },
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
    stats: { cooling: 22 },
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
    stats: { hp: 50, armor: 6 },
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
    stats: { cargo: 35 },
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
    stats: { speed: 1.5, detect: 30 },
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
    stats: {},
    amp: 0.5,
    desc: 'Amplifies all adjacent drill / cooling / defense parts by +50%.',
    rarity: 'unique',
    cost: 0,
    color: '#8854d0',
    emoji: '🌀'
  }
};

DrillDown.RARITY_COLORS = {
  common: '#ffffff',
  uncommon: '#55efc4',
  rare: '#74b9ff',
  unique: '#ff6b6b'
};

DrillDown.PART_TYPES = Object.keys(DrillDown.PARTS);
