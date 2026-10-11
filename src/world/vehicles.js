// 车辆：在道路网络上随机巡游，经高速公路进出城市
import * as THREE from 'three';
import { MAT } from '../core/builder.js';
import { MAP, HALF, ENTRANCE } from '../core/config.js';
import { DIRS, tileToWorld, pick } from '../core/utils.js';
import { vehicleGeometries, PAL } from '../models/props.js';

const LANE = 0.17;
const CAP = 260;
const HW_LEN = 30;
const R = (d) => [-DIRS[d].dz, DIRS[d].dx];

export class Vehicles {
  constructor(scene, city) {
    this.city = city;
    this.cars = [];
    this.kinds = vehicleGeometries().map((res) => {
      const meshes = [];
      for (const k of ['body', 'glass', 'glow']) {
        if (!res[k]) continue;
        const im = new THREE.InstancedMesh(res[k], MAT[k], CAP);
        im.count = 0;
        im.castShadow = k === 'body';
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (k === 'body') im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3);
        scene.add(im);
        meshes.push(im);
      }
      return meshes;
    });
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.p = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.spawnAcc = 0;
    this.entX = tileToWorld(ENTRANCE.x) - 0.5;
    this.entZ = tileToWorld(ENTRANCE.z);
  }

  target() {
    const s = this.city.stats;
    return Math.min(CAP - 10, Math.floor(s.pop / 9 + (s.jobsC + s.jobsI) / 14) + (s.roads > 8 ? 3 : 0));
  }

  randomKind() {
    const r = Math.random();
    return r < 0.45 ? 0 : r < 0.78 ? 1 : r < 0.94 ? 2 : 3;
  }

  newCar(kind) {
    const color = new THREE.Color(kind === 3 ? pick(Math.random, ['#2f8fd0', '#e8b52f', '#d64a3a']) : kind === 2 ? pick(Math.random, ['#e9e9e6', '#d0d4d8', '#2f6fd0']) : pick(Math.random, PAL.carColors));
    return { kind, color, speed: (kind >= 2 ? 0.75 : 0.95) * (0.9 + Math.random() * 0.25), state: 'road', t: 0 };
  }

  spawnFromHighway() {
    const c = this.newCar(this.randomKind());
    c.state = 'in';
    c.x = this.entX - HW_LEN;
    this.cars.push(c);
  }

  spawnOnRoad() {
    const city = this.city;
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * MAP * MAP);
      if (!city.road[i] || !city.connected[i]) continue;
      const x = i % MAP, z = (i / MAP) | 0;
      const mask = city.roadMask(x, z);
      if (!mask) continue;
      const dirs = [0, 1, 2, 3].filter((d) => (mask >> d) & 1);
      const d = pick(Math.random, dirs);
      const c = this.newCar(this.randomKind());
      this.enterTile(c, x, z, d);
      c.t = Math.random();
      this.cars.push(c);
      return;
    }
  }

  // 车辆以方向 d 进入格子 (x,z)
  enterTile(c, x, z, d) {
    const city = this.city;
    c.state = 'road';
    c.tx = x; c.tz = z; c.d = d;
    const mask = city.roadMask(x, z);
    const back = (d + 2) % 4;
    let opts = [0, 1, 2, 3].filter((k) => (mask >> k) & 1 && k !== back);
    // 入口处更倾向于驶离城市（当车多于目标）
    const isEnt = x === ENTRANCE.x && z === ENTRANCE.z;
    if (isEnt && opts.includes(3)) {
      const leave = this.cars.length > this.target() ? 0.85 : 0.25;
      if (Math.random() > leave) opts = opts.filter((k) => k !== 3);
      if (!opts.length) opts = [3];
    }
    if (!opts.length) opts = [back];
    // 稍微偏好直行
    let d2;
    if (opts.includes(d) && Math.random() < 0.55) d2 = d;
    else d2 = pick(Math.random, opts);
    c.d2 = d2;
    const cx = tileToWorld(x), cz = tileToWorld(z);
    const r1 = R(d), r2 = R(d2);
    const D1 = DIRS[d], D2 = DIRS[d2];
    c.p0 = [cx - D1.dx * 0.5 + r1[0] * LANE, cz - D1.dz * 0.5 + r1[1] * LANE];
    c.p2 = [cx + D2.dx * 0.5 + r2[0] * LANE, cz + D2.dz * 0.5 + r2[1] * LANE];
    if (d2 === d) c.p1 = [(c.p0[0] + c.p2[0]) / 2, (c.p0[1] + c.p2[1]) / 2];
    else if (d2 === back) c.p1 = [cx + D1.dx * 0.35, cz + D1.dz * 0.35];
    else c.p1 = [cx + (r1[0] + r2[0]) * LANE, cz + (r1[1] + r2[1]) * LANE];
    const L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    c.len = (L(c.p0, c.p1) + L(c.p1, c.p2) + L(c.p0, c.p2)) / 2;
    c.t = 0;
  }

  onRoadsChanged() {
    const city = this.city;
    this.cars = this.cars.filter((c) => c.state !== 'road' || city.road[c.tz * MAP + c.tx]);
    // 重新规划当前格（掩码可能变化）
    for (const c of this.cars) if (c.state === 'road') {
      const t = c.t;
      this.enterTile(c, c.tx, c.tz, c.d);
      c.t = Math.min(t, 0.5);
    }
  }

  update(dt, rate) {
    const city = this.city;
    const target = this.target();
    const connectedEntrance = city.connected[ENTRANCE.z * MAP + ENTRANCE.x];
    if (rate > 0 && connectedEntrance) {
      this.spawnAcc += dt * Math.min(rate, 2) * 3;
      if (this.spawnAcc > 1) {
        this.spawnAcc = 0;
        if (this.cars.length < target) {
          if (this.cars.length < target * 0.6 && Math.random() < 0.6) this.spawnOnRoad();
          else this.spawnFromHighway();
        }
      }
    }
    const vrate = rate > 0 ? Math.min(2.2, 0.7 + rate * 0.4) : 0;
    const counts = [0, 0, 0, 0];
    const keep = [];
    for (const c of this.cars) {
      const step = c.speed * dt * vrate;
      let x, z, ang;
      if (c.state === 'in') {
        c.x += step * 2.2;
        if (c.x >= this.entX) {
          if (!connectedEntrance) continue;
          this.enterTile(c, ENTRANCE.x, ENTRANCE.z, 1);
        } else {
          x = c.x; z = this.entZ + LANE; ang = Math.PI / 2;
        }
      } else if (c.state === 'out') {
        c.x -= step * 2.2;
        if (c.x < this.entX - HW_LEN) continue;
        x = c.x; z = this.entZ - LANE; ang = -Math.PI / 2;
      }
      if (c.state === 'road') {
        c.t += step / c.len;
        let guard = 0;
        while (c.t >= 1 && guard++ < 3) {
          const over = (c.t - 1) * c.len;
          const nd = c.d2;
          const nx = c.tx + DIRS[nd].dx, nz = c.tz + DIRS[nd].dz;
          if (c.tx === ENTRANCE.x && c.tz === ENTRANCE.z && nd === 3) {
            c.state = 'out';
            c.x = this.entX - over;
            break;
          }
          if (!city.isRoad(nx, nz)) { this.enterTile(c, c.tx, c.tz, (nd + 2) % 4); c.t = 0; break; }
          this.enterTile(c, nx, nz, nd);
          c.t = over / c.len;
        }
        if (c.state === 'out') { x = c.x; z = this.entZ - LANE; ang = -Math.PI / 2; }
        else {
          const t = Math.min(c.t, 1), u = 1 - t;
          x = u * u * c.p0[0] + 2 * u * t * c.p1[0] + t * t * c.p2[0];
          z = u * u * c.p0[1] + 2 * u * t * c.p1[1] + t * t * c.p2[1];
          const dx = 2 * u * (c.p1[0] - c.p0[0]) + 2 * t * (c.p2[0] - c.p1[0]);
          const dz = 2 * u * (c.p1[1] - c.p0[1]) + 2 * t * (c.p2[1] - c.p1[1]);
          ang = Math.atan2(dx, dz);
        }
      }
      keep.push(c);
      const ms = this.kinds[c.kind];
      const n = counts[c.kind]++;
      if (n >= CAP) continue;
      this.q.setFromAxisAngle(this.up, ang);
      this.m.compose(this.p.set(x, 0.022, z), this.q, this.one);
      for (const im of ms) im.setMatrixAt(n, this.m);
      ms[0].setColorAt(n, c.color);
    }
    this.cars = keep;
    this.kinds.forEach((ms, k) => {
      for (const im of ms) {
        im.count = Math.min(counts[k], CAP);
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    });
  }
}
