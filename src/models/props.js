import * as THREE from 'three';
import { Builder } from '../core/builder.js';
import { pick, range } from '../core/utils.js';

export const PAL = {
  grass: ['#78a94e', '#6f9f47', '#82b257'],
  leaf: ['#4f8a3a', '#5d9a3f', '#3f7a35', '#6aa646', '#7fae43'],
  trunk: '#6b4a32',
  pave: '#c9c3b6',
  paveDark: '#a9a397',
  asphalt: '#4a4d52',
  white: '#f3f1ec',
  glassHouse: '#7d97ad',
  glassTower: '#5d7d99',
  carColors: ['#d23c3c', '#2f6fd0', '#f0f0f0', '#202428', '#e8b52f', '#3a9a5b', '#8a8f96', '#c45d2a', '#5b3fa0'],
};

// ---------- 树 ----------
export function addTree(b, x, z, s, rng, kind, lod = 1) {
  kind = kind ?? Math.floor(rng() * 3);
  const leaf = pick(rng, PAL.leaf);
  if (kind === 0) {
    // 圆冠阔叶树
    b.cyl(0.018 * s, 0.14 * s, x, 0, z, PAL.trunk, 6);
    b.sphere(0.1 * s, x, 0.2 * s, z, leaf, lod, 'body', 0.9);
    b.sphere(0.07 * s, x + 0.05 * s, 0.25 * s, z + 0.02 * s, leaf, 0);
    b.sphere(0.065 * s, x - 0.04 * s, 0.27 * s, z - 0.03 * s, leaf, 0);
  } else if (kind === 1) {
    // 针叶松
    b.cyl(0.016 * s, 0.08 * s, x, 0, z, PAL.trunk, 6);
    const c = pick(rng, ['#2f6b3a', '#356f3c', '#2c5e36']);
    b.cone(0.11 * s, 0.17 * s, x, 0.06 * s, z, c, 7);
    b.cone(0.085 * s, 0.15 * s, x, 0.14 * s, z, c, 7);
    b.cone(0.06 * s, 0.13 * s, x, 0.22 * s, z, c, 7);
  } else {
    // 高瘦杨树
    b.cyl(0.015 * s, 0.1 * s, x, 0, z, PAL.trunk, 6);
    b.sphere(0.07 * s, x, 0.22 * s, z, leaf, lod, 'body', 1.9);
  }
}

// 独立树木几何（用于实例化森林）
export function treeGeometries(lod = 1) {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const b = new Builder();
    const rng = () => 0.4;
    addTree(b, 0, 0, 1, rng, k, lod);
    // 树叶颜色用白色调制 → 交给实例颜色
    out.push(b.build().body);
  }
  return out;
}

export function addBush(b, x, z, s, color) {
  b.sphere(0.035 * s, x, 0.02 * s, z, color, 1, 'body', 0.8);
}

// ---------- 汽车 ----------
export function addCar(b, x, z, ry, color, kind = 0) {
  b.push(x, 0, z, ry);
  const dark = '#1d1f22';
  if (kind === 2) {
    // 货车
    b.box(0.12, 0.09, 0.09, 0, 0.02, 0.1, color);
    b.box(0.1, 0.035, 0.012, 0, 0.07, 0.146, PAL.glassHouse, 'glass');
    b.box(0.13, 0.12, 0.2, 0, 0.025, -0.06, '#e9e9e6');
    for (const zz of [0.1, -0.02, -0.11]) for (const xx of [-0.058, 0.058]) b.cyl(0.026, 0.018, xx + 0.009, 0.026, zz, dark, 8, 'body', 1, 0, Math.PI / 2);
  } else if (kind === 3) {
    // 公交车
    b.box(0.13, 0.12, 0.42, 0, 0.022, 0, color);
    b.box(0.132, 0.045, 0.38, 0, 0.075, 0, '#2a3a48', 'glass');
    b.box(0.12, 0.05, 0.005, 0, 0.07, 0.212, '#2a3a48', 'glass');
    b.box(0.12, 0.01, 0.4, 0, 0.142, 0, '#e8e8e8');
    for (const zz of [0.14, -0.14]) for (const xx of [-0.06, 0.06]) b.cyl(0.026, 0.018, xx + 0.009, 0.026, zz, dark, 8, 'body', 1, 0, Math.PI / 2);
  } else {
    const L = kind === 1 ? 0.24 : 0.27;
    b.box(0.13, 0.05, L, 0, 0.02, 0, color);
    const cl = kind === 1 ? 0.15 : 0.13;
    const cz = kind === 1 ? -0.02 : -0.01;
    b.box(0.115, 0.045, cl, 0, 0.07, cz, color);
    b.box(0.118, 0.032, cl - 0.02, 0, 0.075, cz, '#33434f', 'glass');
    b.box(0.1, 0.03, cl + 0.006, 0, 0.076, cz, '#33434f', 'glass');
    for (const zz of [L / 2 - 0.05, -L / 2 + 0.05]) for (const xx of [-0.058, 0.058]) b.cyl(0.024, 0.016, xx + 0.008, 0.024, zz, dark, 8, 'body', 1, 0, Math.PI / 2);
    b.box(0.03, 0.015, 0.006, -0.04, 0.045, L / 2, '#fff7d6', 'glow');
    b.box(0.03, 0.015, 0.006, 0.04, 0.045, L / 2, '#fff7d6', 'glow');
    b.box(0.03, 0.012, 0.006, -0.04, 0.045, -L / 2, '#a01010', 'glow');
    b.box(0.03, 0.012, 0.006, 0.04, 0.045, -L / 2, '#a01010', 'glow');
  }
  b.pop();
}

// 行驶车辆几何：车身白色由实例颜色着色
export function vehicleGeometries() {
  const list = [];
  for (const kind of [0, 1, 2, 3]) {
    const b = new Builder();
    addCar(b, 0, 0, 0, '#ffffff', kind);
    list.push(b.build());
  }
  return list;
}

// ---------- 路灯 ----------
export function lampGeometry() {
  const b = new Builder();
  b.cyl(0.012, 0.03, 0, 0, 0, '#3a3d40', 6);
  b.cyl(0.007, 0.42, 0, 0, 0, '#4a4e52', 6);
  b.box(0.008, 0.008, 0.12, 0, 0.41, 0.055, '#4a4e52');
  b.box(0.04, 0.014, 0.06, 0, 0.398, 0.11, '#3a3d40');
  const res = b.build();
  const h = new Builder();
  h.box(0.032, 0.006, 0.05, 0, 0.392, 0.11, '#fff3d0', 'glow');
  return { pole: res.body, head: h.build().glow };
}

export function addLampProp(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.cyl(0.007, 0.32, 0, 0, 0, '#3d4044', 6);
  b.sphere(0.022, 0, 0.33, 0, '#fff1c8', 1, 'glow');
  b.pop();
}

export function addBench(b, x, z, ry = 0) {
  b.push(x, 0, z, ry);
  b.box(0.12, 0.008, 0.035, 0, 0.03, 0, '#8a5a35');
  b.box(0.12, 0.03, 0.006, 0, 0.038, -0.018, '#8a5a35');
  b.box(0.006, 0.03, 0.03, -0.05, 0, 0, '#333');
  b.box(0.006, 0.03, 0.03, 0.05, 0, 0, '#333');
  b.pop();
}

export function addACUnit(b, x, y, z, s = 1) {
  b.box(0.06 * s, 0.035 * s, 0.05 * s, x, y, z, '#c9cdd1');
  b.cyl(0.016 * s, 0.003, x, y + 0.035 * s, z, '#55595d', 10);
}

export function addWaterTank(b, x, y, z) {
  for (const [dx, dz] of [[-0.03, -0.03], [0.03, -0.03], [-0.03, 0.03], [0.03, 0.03]]) b.box(0.006, 0.07, 0.006, x + dx, y, z + dz, '#5b4a3a');
  b.cyl(0.05, 0.07, x, y + 0.07, z, '#8b6a4c', 12);
  b.cone(0.052, 0.03, x, y + 0.14, z, '#5b4a3a', 12);
}

// 栅栏：沿 x 方向长 len
export function addFence(b, len, x, z, ry, color = '#f2f0ea', h = 0.045) {
  b.push(x, 0, z, ry);
  const n = Math.max(2, Math.round(len / 0.06));
  for (let i = 0; i <= n; i++) b.box(0.008, h, 0.008, -len / 2 + (len * i) / n, 0.015, 0, color);
  b.box(len, 0.006, 0.006, 0, 0.015 + h * 0.4, 0, color);
  b.box(len, 0.006, 0.006, 0, 0.015 + h * 0.8, 0, color);
  b.pop();
}

export function randomCarColor(rng) { return pick(rng, PAL.carColors); }
export { range };
