// 城市状态与模拟
import {
  MAP, ENTRANCE, START_MONEY, ZONE_STATS, SPECIALS, ROAD_COST, BRIDGE_COST, ZONE_COST, ROAD_UPKEEP,
  MILESTONES, QUESTS, ZONE_NAMES,
} from '../core/config.js';
import { clamp, DIRS, mulberry32 } from '../core/utils.js';
import { isWaterTile, generateTrees, waterDist } from './mapgen.js';
import { tileToWorld } from '../core/utils.js';

const FIELDS = ['leisure', 'police', 'fire', 'health', 'edu', 'landmark', 'pollution'];
const ENTRANCE_ROAD = 5;

export class City {
  constructor(variantCounts) {
    this.variantCounts = variantCounts; // {R1: n, ...}
    this.listeners = {};
    this.rng = mulberry32(Date.now() & 0xffff);
    this.reset();
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }

  reset() {
    const N = MAP * MAP;
    this.water = new Uint8Array(N);
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) this.water[z * MAP + x] = isWaterTile(x, z) ? 1 : 0;
    this.trees = generateTrees(this.water);
    this.road = new Uint8Array(N);
    this.zone = new Array(N).fill(null);
    this.bld = new Array(N).fill(null);
    this.spec = new Int32Array(N).fill(0); // special id
    this.connected = new Uint8Array(N);
    this.nearWater = new Uint8Array(N);
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) {
      const d = waterDist(tileToWorld(x), tileToWorld(z));
      this.nearWater[z * MAP + x] = d > 0 && d < 3.5 ? 1 : 0;
    }
    this.fields = {};
    for (const f of FIELDS) this.fields[f] = new Float32Array(N);
    this.landValue = new Float32Array(N);
    this.fieldsDirty = true;
    this.specials = new Map();
    this.nextId = 1;
    this.money = START_MONEY;
    this.day = 0;
    this.minute = 8 * 60;
    this.tax = 9;
    this.stats = { pop: 0, jobsC: 0, jobsI: 0, workers: 0, powerCap: 0, powerUse: 0, happiness: 60, roads: 0, buildings: 0, popCap: 0, jobsCapC: 0, jobsCapI: 0 };
    this.demand = { R: 1, C: 0.8, I: 1 };
    this.budget = { income: 0, expense: 0, incR: 0, incC: 0, incI: 0, expRoad: 0, expSvc: 0 };
    this.maxPop = 0;
    this.milestone = 0;
    this.quests = {};
    this.buildSeq = 0;
    this.warned = {};
    // 高速入口道路
    for (let x = ENTRANCE.x; x < ENTRANCE.x + ENTRANCE_ROAD; x++) {
      const i = this.idx(x, ENTRANCE.z);
      this.road[i] = 1;
      this.trees[i] = 0;
    }
    this.computeConnectivity();
  }

  idx(x, z) { return z * MAP + x; }
  inside(x, z) { return x >= 0 && z >= 0 && x < MAP && z < MAP; }
  isRoad(x, z) { return this.inside(x, z) && this.road[this.idx(x, z)] === 1; }

  roadMask(x, z) {
    let m = 0;
    for (let d = 0; d < 4; d++) if (this.isRoad(x + DIRS[d].dx, z + DIRS[d].dz)) m |= 1 << d;
    if (x === ENTRANCE.x && z === ENTRANCE.z) m |= 1 << 3; // 连向场外高速
    return m;
  }

  computeConnectivity() {
    this.connected.fill(0);
    const s = this.idx(ENTRANCE.x, ENTRANCE.z);
    if (!this.road[s]) return;
    const q = [s];
    this.connected[s] = 1;
    while (q.length) {
      const i = q.pop();
      const x = i % MAP, z = (i / MAP) | 0;
      for (const d of DIRS) {
        const nx = x + d.dx, nz = z + d.dz;
        if (!this.inside(nx, nz)) continue;
        const j = this.idx(nx, nz);
        if (this.road[j] && !this.connected[j]) { this.connected[j] = 1; q.push(j); }
      }
    }
  }

  adjacentRoad(x, z) {
    for (let d = 0; d < 4; d++) if (this.isRoad(x + DIRS[d].dx, z + DIRS[d].dz)) return true;
    return false;
  }
  // 返回连通道路所在方向（优先），无则 -1
  accessDir(x, z, connectedOnly = true) {
    let any = -1;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d].dx, nz = z + DIRS[d].dz;
      if (!this.isRoad(nx, nz)) continue;
      if (this.connected[this.idx(nx, nz)]) return d;
      if (any < 0) any = d;
    }
    return connectedOnly ? -1 : any;
  }

  pay(cost) {
    if (this.money < cost) {
      this.emit('notify', '资金不足！', 'bad');
      return false;
    }
    this.money -= cost;
    this.emit('money', -cost);
    return true;
  }

  // ---------------- 建造操作 ----------------
  roadCost(x, z) {
    if (!this.inside(x, z)) return -1;
    const i = this.idx(x, z);
    if (this.road[i]) return 0;
    if (this.bld[i] || this.spec[i]) return -1;
    return this.water[i] ? BRIDGE_COST : ROAD_COST;
  }

  buildRoads(path) {
    let cost = 0;
    const list = [];
    for (const [x, z] of path) {
      const c = this.roadCost(x, z);
      if (c > 0) { cost += c; list.push([x, z]); }
    }
    if (!list.length) return false;
    if (!this.pay(cost)) return false;
    for (const [x, z] of list) {
      const i = this.idx(x, z);
      this.road[i] = 1;
      if (this.zone[i]) { this.zone[i] = null; this.emit('zone', x, z); }
      if (this.trees[i]) { this.trees[i] = 0; this.emit('trees', x, z); }
    }
    this.computeConnectivity();
    this.emit('roads');
    this.emit('sfx', 'build');
    this.checkQuests();
    return true;
  }

  canZone(x, z) {
    if (!this.inside(x, z)) return false;
    const i = this.idx(x, z);
    return !this.water[i] && !this.road[i] && !this.spec[i] && this.adjacentRoad(x, z);
  }

  zoneArea(tiles, type) {
    let n = 0;
    const list = [];
    for (const [x, z] of tiles) {
      const i = this.idx(x, z);
      if (!this.canZone(x, z)) continue;
      if (this.zone[i] === type) continue;
      if (this.bld[i]) continue;
      list.push(i);
      n++;
    }
    if (!n) return false;
    if (!this.pay(n * ZONE_COST)) return false;
    for (const i of list) {
      this.zone[i] = type;
      this.emit('zone', i % MAP, (i / MAP) | 0);
    }
    this.emit('sfx', 'zone');
    this.checkQuests();
    return true;
  }

  dezoneArea(tiles) {
    let any = false;
    for (const [x, z] of tiles) {
      const i = this.idx(x, z);
      if (this.zone[i] && !this.bld[i]) { this.zone[i] = null; this.emit('zone', x, z); any = true; }
    }
    if (any) this.emit('sfx', 'zone');
    return any;
  }

  bulldozeArea(tiles) {
    let any = false, roads = false;
    let refund = 0;
    for (const [x, z] of tiles) {
      if (!this.inside(x, z)) continue;
      const i = this.idx(x, z);
      if (this.spec[i]) {
        const sp = this.specials.get(this.spec[i]);
        if (sp) { refund += Math.floor(SPECIALS[sp.type].cost * 0.5); this.removeSpecial(sp.id); any = true; }
      }
      if (this.bld[i]) { this.removeBuilding(x, z); any = true; }
      if (this.road[i]) {
        if (x >= ENTRANCE.x && x < ENTRANCE.x + 1 && z === ENTRANCE.z) continue; // 入口不可拆
        this.road[i] = 0; roads = true; any = true;
      }
      if (this.trees[i]) { this.trees[i] = 0; this.emit('trees', x, z); any = true; }
    }
    if (roads) {
      this.computeConnectivity();
      this.emit('roads');
    }
    if (refund) { this.money += refund; this.emit('money', refund); }
    if (any) this.emit('sfx', 'bulldoze');
    return any;
  }

  removeBuilding(x, z) {
    const i = this.idx(x, z);
    const b = this.bld[i];
    if (!b) return;
    this.bld[i] = null;
    this.emit('bld:remove', x, z, b);
    this.emit('zone', x, z);
    this.fieldsDirty = true;
  }

  footprint(type, hx, hz) {
    const n = SPECIALS[type].size;
    const o = Math.floor((n - 1) / 2);
    return { x: hx - o, z: hz - o, n };
  }

  canPlaceSpecial(type, hx, hz) {
    const { x, z, n } = this.footprint(type, hx, hz);
    for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) {
      const tx = x + dx, tz = z + dz;
      if (!this.inside(tx, tz)) return { ok: false, why: '超出地图' };
      const i = this.idx(tx, tz);
      if (this.water[i]) return { ok: false, why: '不能建在水上' };
      if (this.road[i] || this.spec[i] || this.bld[i]) return { ok: false, why: '空间被占用' };
    }
    const dir = this.footprintRoadDir(x, z, n);
    if (dir < 0) return { ok: false, why: '需要紧邻道路' };
    return { ok: true, dir };
  }

  footprintRoadDir(x, z, n) {
    // 依次检查四边：南(+z) 东 北 西，返回朝向
    const order = [2, 1, 0, 3];
    for (const d of order) {
      for (let k = 0; k < n; k++) {
        let tx, tz;
        if (d === 0) { tx = x + k; tz = z - 1; }
        else if (d === 2) { tx = x + k; tz = z + n; }
        else if (d === 1) { tx = x + n; tz = z + k; }
        else { tx = x - 1; tz = z + k; }
        if (this.isRoad(tx, tz)) return d;
      }
    }
    return -1;
  }

  placeSpecial(type, hx, hz) {
    const def = SPECIALS[type];
    if (def.unlock > this.maxPop) { this.emit('notify', `人口达到 ${def.unlock} 后解锁`, 'bad'); return false; }
    const chk = this.canPlaceSpecial(type, hx, hz);
    if (!chk.ok) { this.emit('notify', chk.why, 'bad'); return false; }
    if (!this.pay(def.cost)) return false;
    const { x, z, n } = this.footprint(type, hx, hz);
    const sp = { id: this.nextId++, type, x, z, n, dir: chk.dir, seed: Math.floor(this.rng() * 1e6) };
    this.addSpecialRaw(sp);
    this.emit('sfx', 'build');
    this.checkQuests();
    return true;
  }

  addSpecialRaw(sp) {
    this.specials.set(sp.id, sp);
    for (let dz = 0; dz < sp.n; dz++) for (let dx = 0; dx < sp.n; dx++) {
      const i = this.idx(sp.x + dx, sp.z + dz);
      this.spec[i] = sp.id;
      if (this.zone[i]) { this.zone[i] = null; this.emit('zone', sp.x + dx, sp.z + dz); }
      if (this.trees[i]) { this.trees[i] = 0; this.emit('trees', sp.x + dx, sp.z + dz); }
    }
    this.fieldsDirty = true;
    this.emit('special:add', sp);
  }

  removeSpecial(id) {
    const sp = this.specials.get(id);
    if (!sp) return;
    for (let dz = 0; dz < sp.n; dz++) for (let dx = 0; dx < sp.n; dx++) this.spec[this.idx(sp.x + dx, sp.z + dz)] = 0;
    this.specials.delete(id);
    this.fieldsDirty = true;
    this.emit('special:remove', sp);
  }

  // ---------------- 覆盖场 ----------------
  computeFields() {
    for (const f of FIELDS) this.fields[f].fill(0);
    const stamp = (field, cx, cz, r, s) => {
      const F = this.fields[field];
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(MAP - 1, Math.ceil(cx + r));
      const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(MAP - 1, Math.ceil(cz + r));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d > r) continue;
        const v = s * (1 - (d / r) * 0.75);
        const i = z * MAP + x;
        F[i] = Math.min(1, F[i] + v * (field === 'pollution' ? 1 : 0.8));
      }
    };
    for (const sp of this.specials.values()) {
      const def = SPECIALS[sp.type];
      const cx = sp.x + sp.n / 2, cz = sp.z + sp.n / 2;
      for (const f in def.effects) stamp(f, cx, cz, def.effects[f][0], def.effects[f][1]);
    }
    for (let i = 0; i < MAP * MAP; i++) {
      const b = this.bld[i];
      if (b && b.zone === 'I') stamp('pollution', (i % MAP) + 0.5, ((i / MAP) | 0) + 0.5, 2 + b.level, 0.22 + 0.1 * b.level);
    }
    const F = this.fields;
    for (let i = 0; i < MAP * MAP; i++) {
      let lv = 18 + 32 * F.leisure[i] + 9 * F.police[i] + 9 * F.fire[i] + 12 * F.health[i] + 12 * F.edu[i] + 28 * F.landmark[i] - 60 * F.pollution[i];
      if (this.nearWater[i]) lv += 10;
      this.landValue[i] = clamp(lv, 0, 100);
    }
    this.fieldsDirty = false;
  }

  // ---------------- 时间推进 ----------------
  advance(minutes) {
    const prevHour = Math.floor(this.minute / 60);
    this.minute += minutes;
    let hours = Math.floor(this.minute / 60) - prevHour;
    while (this.minute >= 1440) {
      this.minute -= 1440;
      this.day++;
      this.dayTick();
    }
    hours = Math.min(hours, 6);
    for (let h = 0; h < hours; h++) this.hourTick();
  }

  get dateText() {
    const y = Math.floor(this.day / 360) + 1;
    const m = Math.floor((this.day % 360) / 30) + 1;
    const d = (this.day % 30) + 1;
    return `第${y}年 ${m}月${d}日`;
  }
  get timeText() {
    const h = Math.floor(this.minute / 60), mi = Math.floor(this.minute % 60);
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  }

  hourTick() {
    if (this.fieldsDirty) this.computeFields();
    this.updateBuildings();
    this.computeDemand();
    this.grow();
    this.economyHour();
    this.checkMilestones();
    this.checkQuests();
    this.emit('stats');
  }

  dayTick() {
    this.emit('day');
  }

  updateBuildings() {
    const s = this.stats;
    let cap = 0;
    for (const sp of this.specials.values()) cap += SPECIALS[sp.type].power || 0;
    // 按建造顺序供电
    const list = [];
    for (let i = 0; i < MAP * MAP; i++) if (this.bld[i]) list.push(i);
    list.sort((a, b) => this.bld[a].seq - this.bld[b].seq);
    let use = 0, pop = 0, jobsC = 0, jobsI = 0, popCap = 0, jcC = 0, jcI = 0;
    let hsum = 0, hw = 0;
    const F = this.fields;
    for (const i of list) {
      const b = this.bld[i];
      const x = i % MAP, z = (i / MAP) | 0;
      const need = ZONE_STATS[b.zone].power[b.level];
      b.powered = use + need <= cap;
      if (b.powered) use += need;
      b.access = this.accessDir(x, z) >= 0;
      const ok = b.powered && b.access;
      const target = ok ? b.cap : b.cap * 0.3;
      b.occ += (target - b.occ) * (ok ? 0.25 : 0.06);
      if (b.occ < 0.5 && target < 0.5) b.occ = 0;
      // 幸福度
      let h;
      if (b.zone === 'R') {
        h = 52 + 22 * F.leisure[i] + 8 * F.police[i] + 8 * F.fire[i] + 10 * F.health[i] + 10 * F.edu[i] + 15 * F.landmark[i] - 60 * F.pollution[i];
      } else {
        h = 62 + 8 * F.police[i] + 8 * F.fire[i] + 6 * F.health[i] + 10 * F.landmark[i] + (b.zone === 'C' ? 10 * F.leisure[i] : 0);
      }
      h -= (this.tax - 9) * 3;
      if (!b.powered) h -= 25;
      if (!b.access) h -= 25;
      b.happy = clamp(h, 0, 100);
      hsum += b.happy * Math.max(1, b.occ);
      hw += Math.max(1, b.occ);
      if (b.zone === 'R') { pop += b.occ; popCap += b.cap; }
      else if (b.zone === 'C') { jobsC += b.occ; jcC += b.cap; }
      else { jobsI += b.occ; jcI += b.cap; }
    }
    s.powerCap = cap;
    s.powerUse = use;
    s.pop = Math.round(pop);
    s.jobsC = Math.round(jobsC);
    s.jobsI = Math.round(jobsI);
    s.popCap = popCap;
    s.jobsCapC = jcC;
    s.jobsCapI = jcI;
    s.buildings = list.length;
    s.happiness = hw ? hsum / hw : 60;
    let roads = 0;
    for (let i = 0; i < MAP * MAP; i++) roads += this.road[i];
    s.roads = roads;
    if (s.pop > this.maxPop) {
      const old = this.maxPop;
      this.maxPop = s.pop;
      for (const k in SPECIALS) {
        const u = SPECIALS[k].unlock;
        if (u > old && u <= s.pop) this.emit('unlock', SPECIALS[k]);
      }
    }
    this.emit('status');
  }

  computeDemand() {
    const s = this.stats;
    const taxMul = 1 + (9 - this.tax) * 0.07;
    const hapMul = 0.65 + s.happiness / 230;
    const jobs = s.jobsCapC + s.jobsCapI;
    // 岗位吸引居民；幸福度越高，城市越有吸引力
    const tp = (jobs / 0.45) * (0.75 + s.happiness / 200) + 60;
    const r = (tp - s.popCap) / Math.max(tp * 0.3, 30);
    const tc = s.popCap * 0.22 + 8;
    const c = (tc - s.jobsCapC) / Math.max(tc * 0.35, 10);
    const ti = s.popCap * 0.22 + s.jobsCapC * 0.25 + 10;
    const ii = (ti - s.jobsCapI) / Math.max(ti * 0.35, 10);
    const sm = (o, v) => o + (v - o) * 0.35;
    this.demand.R = sm(this.demand.R, clamp(r * taxMul * hapMul, 0, 1));
    this.demand.C = sm(this.demand.C, clamp(c * taxMul, 0, 1));
    this.demand.I = sm(this.demand.I, clamp(ii * taxMul, 0, 1));
  }

  grow() {
    const s = this.stats;
    const cand = { R: [], C: [], I: [] };
    const upg = [];
    for (let i = 0; i < MAP * MAP; i++) {
      const zt = this.zone[i];
      if (!zt) continue;
      const b = this.bld[i];
      if (b) { if (b.level < 3 && b.powered && b.access) upg.push(i); continue; }
      const x = i % MAP, z = (i / MAP) | 0;
      if (this.accessDir(x, z) >= 0) cand[zt].push(i);
    }
    let spare = s.powerCap - s.powerUse;
    let blockedByPower = false;
    for (const zt of ['R', 'C', 'I']) {
      const d = this.demand[zt];
      const list = cand[zt];
      if (d < 0.05 || !list.length) continue;
      const attempts = Math.ceil(d * 3);
      for (let k = 0; k < attempts && list.length; k++) {
        if (this.rng() > d + 0.1) continue;
        const need = ZONE_STATS[zt].power[1];
        if (spare < need) { blockedByPower = true; break; }
        const j = Math.floor(this.rng() * list.length);
        const i = list.splice(j, 1)[0];
        spare -= need;
        this.spawnBuilding(i % MAP, (i / MAP) | 0, zt, 1);
      }
    }
    if (blockedByPower) this.warnOnce('power', '⚡ 电力不足，新建筑无法开工！请建造发电设施', 40);
    // 升级
    for (const i of upg) {
      if (this.rng() > 0.07) continue;
      const b = this.bld[i];
      if (b.occ < b.cap * 0.75) continue;
      const nl = b.level + 1;
      if (nl === 3 && this.maxPop < 500) continue;
      const lv = this.landValue[i];
      let ok;
      if (b.zone === 'I') ok = nl === 2 ? (this.fields.edu[i] > 0.2 || lv > 28) : this.fields.edu[i] > 0.45 && lv > 20;
      else ok = nl === 2 ? lv >= 30 : lv >= 52;
      if (!ok) continue;
      const extra = ZONE_STATS[b.zone].power[nl] - ZONE_STATS[b.zone].power[b.level];
      if (spare < extra) continue;
      spare -= extra;
      this.upgradeBuilding(i % MAP, (i / MAP) | 0);
    }
  }

  warnOnce(key, text, hours) {
    const now = this.day * 24 + this.minute / 60;
    if (this.warned[key] && now - this.warned[key] < hours) return;
    this.warned[key] = now;
    this.emit('notify', text, 'warn');
  }

  pickVariant(zt, level) {
    const n = this.variantCounts[zt + level];
    return Math.floor(this.rng() * n);
  }

  spawnBuilding(x, z, zt, level, opts = {}) {
    const i = this.idx(x, z);
    const dir = this.accessDir(x, z, false);
    const cap = ZONE_STATS[zt].cap[level];
    const b = {
      zone: zt, level, variant: opts.variant ?? this.pickVariant(zt, level),
      dir: dir < 0 ? 2 : dir, cap: Math.round(cap * (0.85 + this.rng() * 0.3)),
      occ: opts.occ ?? 0, powered: true, access: true, happy: 60, seq: opts.seq ?? this.buildSeq++,
    };
    if (this.trees[i]) { this.trees[i] = 0; this.emit('trees', x, z); }
    this.bld[i] = b;
    this.fieldsDirty = this.fieldsDirty || zt === 'I';
    this.emit('bld:add', x, z, b, !opts.silent);
    this.emit('zone', x, z);
    return b;
  }

  upgradeBuilding(x, z) {
    const i = this.idx(x, z);
    const old = this.bld[i];
    this.emit('bld:remove', x, z, old, true);
    const b = this.spawnBuilding(x, z, old.zone, old.level + 1, { occ: old.occ, seq: old.seq });
    if (b.level === 3) this.completeQuest('level3');
    this.emit('upgrade', x, z, b);
  }

  economyHour() {
    const s = this.stats;
    const tm = this.tax / 9;
    const hm = 0.8 + s.happiness / 250;
    const incR = s.pop * 1.3 * tm * hm;
    const incC = s.jobsC * 1.7 * tm * hm;
    const incI = s.jobsI * 1.4 * tm * hm;
    const expRoad = s.roads * ROAD_UPKEEP;
    let expSvc = 0;
    for (const sp of this.specials.values()) expSvc += SPECIALS[sp.type].upkeep;
    const inc = incR + incC + incI, exp = expRoad + expSvc;
    this.budget = { income: inc, expense: exp, incR, incC, incI, expRoad, expSvc };
    this.money += (inc - exp) / 24;
  }

  checkMilestones() {
    const pop = this.stats.pop;
    while (this.milestone < MILESTONES.length && pop >= MILESTONES[this.milestone].pop) {
      const m = MILESTONES[this.milestone];
      this.money += m.reward;
      this.milestone++;
      this.emit('milestone', m);
    }
  }

  completeQuest(id) {
    if (this.quests[id]) return;
    const q = QUESTS.find((q) => q.id === id);
    if (!q) return;
    this.quests[id] = true;
    this.money += q.reward;
    this.emit('quest', q);
  }

  checkQuests() {
    const has = (t) => [...this.specials.values()].some((s) => t.includes(s.type));
    let connectedRoads = 0;
    for (let i = 0; i < MAP * MAP; i++) connectedRoads += this.connected[i];
    if (connectedRoads > ENTRANCE_ROAD) this.completeQuest('road');
    const zc = { R: 0, C: 0, I: 0 };
    for (let i = 0; i < MAP * MAP; i++) if (this.zone[i]) zc[this.zone[i]]++;
    if (zc.R > 0) this.completeQuest('zoneR');
    if (has(['wind', 'coal', 'solar'])) this.completeQuest('power');
    if (zc.C > 0 && zc.I > 0) this.completeQuest('zoneCI');
    if (this.stats.pop >= 100) this.completeQuest('pop100');
    if (has(['park', 'plaza'])) this.completeQuest('park');
    if (has(['school', 'police', 'fire'])) this.completeQuest('service');
  }

  // ---------------- 查询 ----------------
  tileInfo(x, z) {
    if (!this.inside(x, z)) return null;
    const i = this.idx(x, z);
    return {
      x, z, water: !!this.water[i], road: !!this.road[i], zone: this.zone[i], bld: this.bld[i],
      special: this.spec[i] ? this.specials.get(this.spec[i]) : null,
      landValue: this.landValue[i], pollution: this.fields.pollution[i],
      zoneName: this.zone[i] ? ZONE_NAMES[this.zone[i]] : null,
    };
  }

  // ---------------- 存档 ----------------
  serialize() {
    const blds = [];
    for (let i = 0; i < MAP * MAP; i++) {
      const b = this.bld[i];
      if (b) blds.push([i, b.zone, b.level, b.variant, b.dir, b.cap, Math.round(b.occ), b.seq]);
    }
    return {
      v: 1,
      road: Array.from(this.road).join(''),
      trees: Array.from(this.trees).join(''),
      zone: this.zone.map((z) => z || '.').join(''),
      blds,
      specials: [...this.specials.values()],
      money: this.money, day: this.day, minute: this.minute, tax: this.tax,
      maxPop: this.maxPop, milestone: this.milestone, quests: this.quests, nextId: this.nextId, buildSeq: this.buildSeq,
    };
  }

  load(d) {
    this.reset();
    for (let i = 0; i < MAP * MAP; i++) {
      this.road[i] = +d.road[i];
      this.trees[i] = +d.trees[i];
      this.zone[i] = d.zone[i] === '.' ? null : d.zone[i];
    }
    Object.assign(this, { money: d.money, day: d.day, minute: d.minute, tax: d.tax, maxPop: d.maxPop, milestone: d.milestone, quests: d.quests || {}, nextId: d.nextId, buildSeq: d.buildSeq });
    this.computeConnectivity();
    for (const [i, zt, level, variant, dir, cap, occ, seq] of d.blds) {
      const b = { zone: zt, level, variant: variant % this.variantCounts[zt + level], dir, cap, occ, powered: true, access: true, happy: 60, seq };
      this.bld[i] = b;
    }
    for (const sp of d.specials) {
      this.specials.set(sp.id, sp);
      for (let dz = 0; dz < sp.n; dz++) for (let dx = 0; dx < sp.n; dx++) this.spec[this.idx(sp.x + dx, sp.z + dz)] = sp.id;
    }
    this.fieldsDirty = true;
    this.computeFields();
    this.updateBuildings();
    this.computeDemand();
  }
}
