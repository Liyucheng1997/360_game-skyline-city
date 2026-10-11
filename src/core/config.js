// 全局常量与游戏数据定义
export const MAP = 64;               // 地图边长（格）
export const HALF = MAP / 2;
export const ENTRANCE = { x: 0, z: 30 }; // 高速公路入口所在格
export const START_MONEY = 30000;

// 游戏时间：1x 速度下每真实秒推进的游戏分钟数
export const MINUTES_PER_SECOND = 24;
export const SPEEDS = [0, 1, 2, 4];

export const ZONE_COLORS = {
  R: [0.30, 0.85, 0.35],
  C: [0.25, 0.55, 1.00],
  I: [1.00, 0.78, 0.15],
};

export const ZONE_NAMES = { R: '住宅', C: '商业', I: '工业' };
export const LEVEL_NAMES = ['', '低密度', '中密度', '高密度'];

// 区域建筑数值：每级 [人口/岗位, 耗电]
export const ZONE_STATS = {
  R: { cap: [0, 5, 24, 80], power: [0, 1, 3, 7], label: '居民' },
  C: { cap: [0, 5, 16, 48], power: [0, 2, 4, 10], label: '岗位' },
  I: { cap: [0, 8, 20, 36], power: [0, 3, 6, 10], label: '岗位' },
};

// 道路
export const ROAD_COST = 10;
export const BRIDGE_COST = 40;
export const ZONE_COST = 2;
export const ROAD_UPKEEP = 0.25; // 每格每日

// 特殊建筑定义
// size: 占地边长；effects: 覆盖场 {field: [radius, strength]}
export const SPECIALS = {
  park:    { name: '城市公园', icon: '🌳', cat: 'service', size: 1, cost: 150,  upkeep: 4,  unlock: 0,
             desc: '提升周边幸福度与地价', effects: { leisure: [4, 0.9] } },
  plaza:   { name: '喷泉广场', icon: '⛲', cat: 'service', size: 2, cost: 600,  upkeep: 12, unlock: 150,
             desc: '大型绿地广场，显著提升地价', effects: { leisure: [7, 1.0] } },
  school:  { name: '学校',     icon: '🏫', cat: 'service', size: 2, cost: 1200, upkeep: 30, unlock: 200,
             desc: '提供教育，工业与住宅可升级', effects: { edu: [9, 1.0] } },
  police:  { name: '警察局',   icon: '🚓', cat: 'service', size: 1, cost: 700,  upkeep: 20, unlock: 200,
             desc: '维护治安，提升幸福度', effects: { police: [8, 1.0] } },
  fire:    { name: '消防站',   icon: '🚒', cat: 'service', size: 1, cost: 700,  upkeep: 20, unlock: 200,
             desc: '消防覆盖，提升幸福度', effects: { fire: [8, 1.0] } },
  hospital:{ name: '医院',     icon: '🏥', cat: 'service', size: 2, cost: 1800, upkeep: 45, unlock: 500,
             desc: '医疗保障，提升幸福度与地价', effects: { health: [10, 1.0] } },
  wind:    { name: '风力发电机', icon: '🌬️', cat: 'power', size: 1, cost: 400, upkeep: 8, unlock: 0,
             desc: '清洁能源，发电 20', power: 20, effects: {} },
  coal:    { name: '火力发电厂', icon: '🏭', cat: 'power', size: 2, cost: 1500, upkeep: 40, unlock: 0,
             desc: '大量发电 160，但会污染环境', power: 160, effects: { pollution: [7, 1.0] } },
  solar:   { name: '太阳能电站', icon: '☀️', cat: 'power', size: 2, cost: 2200, upkeep: 20, unlock: 600,
             desc: '清洁能源，发电 90', power: 90, effects: {} },
  ferris:  { name: '摩天轮',   icon: '🎡', cat: 'landmark', size: 2, cost: 3000, upkeep: 30, unlock: 400,
             desc: '城市地标，大范围提升地价与幸福', effects: { landmark: [11, 1.0], leisure: [6, 0.6] } },
  tower:   { name: '电视塔',   icon: '📡', cat: 'landmark', size: 1, cost: 6000, upkeep: 40, unlock: 1500,
             desc: '城市天际线的标志', effects: { landmark: [15, 1.0] } },
  stadium: { name: '体育场',   icon: '🏟️', cat: 'landmark', size: 3, cost: 12000, upkeep: 80, unlock: 3500,
             desc: '万人体育场，全城幸福度提升', effects: { landmark: [20, 1.0], leisure: [8, 0.8] } },
};

// 工具栏分类
export const TOOL_GROUPS = [
  { id: 'road', name: '道路', icon: '🛣️', tools: ['road'] },
  { id: 'zone', name: '区划', icon: '🏘️', tools: ['zoneR', 'zoneC', 'zoneI', 'dezone'] },
  { id: 'service', name: '公共服务', icon: '🏛️', tools: ['park', 'plaza', 'school', 'police', 'fire', 'hospital'] },
  { id: 'power', name: '电力', icon: '⚡', tools: ['wind', 'coal', 'solar'] },
  { id: 'landmark', name: '地标', icon: '🗼', tools: ['ferris', 'tower', 'stadium'] },
  { id: 'bulldoze', name: '拆除', icon: '🚜', tools: ['bulldoze'] },
];

export const TOOLS = {
  road:   { name: '双向道路', icon: '🛣️', desc: `拖动修建道路，每格 ¥${ROAD_COST}（跨水桥梁 ¥${BRIDGE_COST}）` },
  zoneR:  { name: '住宅区', icon: '🏠', desc: '拖动框选道路旁空地，居民将在此安家', zone: 'R' },
  zoneC:  { name: '商业区', icon: '🏬', desc: '商店与写字楼，提供岗位并消费', zone: 'C' },
  zoneI:  { name: '工业区', icon: '🏭', desc: '工厂提供大量岗位，但会产生污染', zone: 'I' },
  dezone: { name: '取消区划', icon: '🧽', desc: '拖动清除空地上的区划' },
  bulldoze: { name: '推土机', icon: '🚜', desc: '拖动拆除道路、建筑与树木' },
};
for (const k in SPECIALS) TOOLS[k] = { ...SPECIALS[k], special: k };

// 人口里程碑
export const MILESTONES = [
  { pop: 50,    name: '小村庄', reward: 2000 },
  { pop: 150,   name: '热闹村镇', reward: 3000 },
  { pop: 400,   name: '小镇', reward: 5000 },
  { pop: 1000,  name: '繁华小镇', reward: 8000 },
  { pop: 2000,  name: '城市', reward: 12000 },
  { pop: 3500,  name: '大城市', reward: 18000 },
  { pop: 6000,  name: '都会', reward: 25000 },
  { pop: 10000, name: '超级都市', reward: 40000 },
];

// 新手目标
export const QUESTS = [
  { id: 'road',  text: '修建一条连接高速公路的道路', reward: 500 },
  { id: 'zoneR', text: '在道路旁划分住宅区', reward: 500 },
  { id: 'power', text: '建造一座发电设施', reward: 800 },
  { id: 'zoneCI', text: '划分商业区和工业区', reward: 800 },
  { id: 'pop100', text: '人口达到 100', reward: 1500 },
  { id: 'park', text: '建造一座公园', reward: 500 },
  { id: 'service', text: '建造学校、警察局或消防站', reward: 1500 },
  { id: 'level3', text: '出现第一座高密度建筑', reward: 3000 },
];
