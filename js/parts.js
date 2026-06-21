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
  }
};

DrillDown.RARITY_COLORS = {
  common: '#ffffff',
  uncommon: '#55efc4',
  rare: '#74b9ff',
  unique: '#ff6b6b'
};

DrillDown.PART_TYPES = Object.keys(DrillDown.PARTS);
