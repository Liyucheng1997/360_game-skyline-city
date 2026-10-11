// 特殊建筑（服务/电力/地标）模型，含动画
import * as THREE from 'three';
import { Builder, meshFromBuild, MAT } from '../core/builder.js';
import { mulberry32, pick } from '../core/utils.js';
import { PAL, addTree, addBush, addCar, addBench, addLampProp, addACUnit, addFence } from './props.js';

const FLOWERS = ['#e85d75', '#f2c94c', '#f08a4b', '#c86dd7', '#ffffff'];

function winRow(b, rng, fw, z, y, cols, ww, wh, frame, gc = PAL.glassHouse, lit = 0.6) {
  const step = fw / cols;
  for (let i = 0; i < cols; i++) {
    const x = -fw / 2 + step * (i + 0.5);
    if (frame) b.box(ww + 0.016, wh + 0.016, 0.008, x, y - 0.008, z, frame);
    b.quad(ww, wh, x, y + wh / 2, z + 0.0055, gc, rng() < lit ? 'lit' : 'glass');
  }
}
function sides(b, w, d, fn, list = [0, 1, 2, 3]) {
  for (const s of list) {
    b.push(0, 0, 0, s * Math.PI / 2);
    fn(s, s % 2 ? d : w, s % 2 ? w / 2 : d / 2);
    b.pop();
  }
}
function flag(b, x, z, h, color) {
  b.cyl(0.006, h, x, 0.02, z, '#ddd', 6);
  b.box(0.002, 0.06, 0.1, x, h - 0.06, z + 0.05, color);
}

// ---------- 公园 ----------
function park(b, rng) {
  b.box(0.98, 0.022, 0.98, 0, 0, 0, '#6fa64a');
  // 环形小路
  const ring = new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2);
  b.geo(ring, '#d9c9a3', 0, 0.025, 0);
  b.box(0.08, 0.004, 0.3, 0, 0.022, 0.36, '#d9c9a3');
  b.box(0.3, 0.004, 0.08, -0.36, 0.022, 0, '#d9c9a3');
  // 喷泉
  b.cyl(0.14, 0.04, 0, 0.02, 0, '#cfcac0', 20);
  b.cyl(0.12, 0.01, 0, 0.05, 0, '#58b4d8', 20, 'glass');
  b.cyl(0.025, 0.1, 0, 0.02, 0, '#cfcac0', 10);
  b.cyl(0.05, 0.012, 0, 0.11, 0, '#cfcac0', 12);
  b.sphere(0.02, 0, 0.13, 0, '#a8dcf0', 1, 'glass');
  for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [0.37, 0.34], [-0.34, 0.37]]) addTree(b, x, z, 1.25 + rng() * 0.3, rng, rng() < 0.7 ? 0 : 1);
  addTree(b, 0.38, 0, 1.0, rng, 2);
  addTree(b, 0, -0.39, 1.1, rng, 0);
  addBench(b, 0.18, 0.2, -Math.PI * 0.75);
  addBench(b, -0.2, -0.18, Math.PI * 0.25);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    addBush(b, Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.8, pick(rng, FLOWERS));
  }
  addLampProp(b, 0.12, 0.42);
  addLampProp(b, -0.42, -0.12);
}

function plaza(b, rng) {
  b.box(1.98, 0.022, 1.98, 0, 0, 0, '#d8d0c0');
  // 草坪四块
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(0.68, 0.03, 0.68, sx * 0.58, 0.02, sz * 0.58, '#6fa64a');
    b.box(0.72, 0.05, 0.04, sx * 0.58, 0.02, sz * 0.58 + sz * 0.36, '#3f7a35');
    addTree(b, sx * 0.72, sz * 0.72, 1.6, rng, 0);
    addTree(b, sx * 0.45, sz * 0.72, 1.2, rng, 2);
    addTree(b, sx * 0.72, sz * 0.45, 1.3, rng, 0);
    for (let i = 0; i < 5; i++) addBush(b, sx * (0.3 + i * 0.04), sz * 0.3, 0.9, pick(rng, FLOWERS));
    addBench(b, sx * 0.25, sz * 0.5, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    addLampProp(b, sx * 0.22, sz * 0.22);
  }
  // 大喷泉
  b.cyl(0.36, 0.05, 0, 0.02, 0, '#c9c2b2', 32);
  b.cyl(0.33, 0.012, 0, 0.065, 0, '#4fb0d8', 32, 'glass');
  b.cyl(0.08, 0.16, 0, 0.02, 0, '#c9c2b2', 16);
  b.cyl(0.16, 0.025, 0, 0.18, 0, '#c9c2b2', 24);
  b.cyl(0.14, 0.008, 0, 0.205, 0, '#4fb0d8', 24, 'glass');
  b.cyl(0.03, 0.14, 0, 0.2, 0, '#c9c2b2', 10);
  b.cyl(0.06, 0.02, 0, 0.34, 0, '#c9c2b2', 14);
  b.sphere(0.035, 0, 0.38, 0, '#bfe6f5', 1, 'glass');
  b.emitter(0, 0.42, 0, -1);
  // 地砖纹理
  for (let i = -4; i <= 4; i++) {
    b.box(0.01, 0.003, 1.9, i * 0.22, 0.022, 0, '#c9c0ae');
    b.box(1.9, 0.003, 0.01, 0, 0.022, i * 0.22, '#c9c0ae');
  }
}

// ---------- 学校 ----------
function school(b, rng) {
  b.box(1.98, 0.022, 1.98, 0, 0, 0, '#79a957');
  const brick = '#b0654a', trim = '#f3efe6';
  // 主楼
  b.push(-0.35, 0.02, -0.55);
  b.box(1.2, 0.6, 0.42, 0, 0, 0, brick);
  b.box(1.24, 0.04, 0.46, 0, 0.6, 0, trim);
  for (let f = 0; f < 3; f++) b.box(1.22, 0.015, 0.44, 0, 0.0 + f * 0.2, 0, trim);
  sides(b, 1.2, 0.42, (s, fw, fd) => { for (let f = 0; f < 3; f++) winRow(b, rng, fw, fd, 0.06 + f * 0.2, s % 2 ? 2 : 8, 0.07, 0.1, trim); });
  // 门廊立柱
  b.box(0.36, 0.035, 0.18, 0, 0.42, 0.3, trim);
  for (let i = 0; i < 4; i++) b.cyl(0.018, 0.42, -0.14 + i * 0.093, 0, 0.36, trim, 10);
  b.prism(0.4, 0.1, 0.2, 0, 0.455, 0.3, trim);
  b.box(0.12, 0.12, 0.01, 0, 0.47, 0.21, '#2d3a4a');
  b.cyl(0.04, 0.01, 0, 0.52, 0.215, '#fff', 16, 'glow', 1, Math.PI / 2);
  b.pop();
  // 侧翼
  b.push(0.55, 0.02, -0.25);
  b.box(0.4, 0.4, 0.9, 0, 0, 0, brick);
  b.box(0.44, 0.04, 0.94, 0, 0.4, 0, trim);
  sides(b, 0.4, 0.9, (s, fw, fd) => { for (let f = 0; f < 2; f++) winRow(b, rng, fw, fd, 0.06 + f * 0.2, s % 2 ? 6 : 2, 0.07, 0.1, trim); });
  b.pop();
  // 运动场
  b.push(-0.25, 0.022, 0.48);
  b.box(1.1, 0.004, 0.72, 0, 0, 0, '#b8573e');
  b.cyl(0.36, 0.004, -0.37, 0, 0, '#b8573e', 24);
  b.cyl(0.36, 0.004, 0.37, 0, 0, '#b8573e', 24);
  b.box(0.74, 0.006, 0.5, 0, 0, 0, '#5d9e48');
  b.cyl(0.25, 0.006, -0.37, 0, 0, '#5d9e48', 24);
  b.cyl(0.25, 0.006, 0.37, 0, 0, '#5d9e48', 24);
  b.box(0.004, 0.008, 0.5, 0, 0, 0, '#fff');
  b.cyl(0.08, 0.007, 0, 0, 0, '#fff', 20);
  b.cyl(0.075, 0.008, 0, 0, 0, '#5d9e48', 20);
  for (const x of [-0.55, 0.55]) b.box(0.01, 0.06, 0.12, x, 0, 0, '#fff');
  b.pop();
  // 篮球场
  b.box(0.36, 0.006, 0.5, 0.72, 0.022, 0.62, '#3f6f9a');
  b.box(0.3, 0.004, 0.004, 0.72, 0.028, 0.62, '#fff');
  flag(b, 0.25, -0.1, 0.7, '#d23c3c');
  addCar(b, 0.15, 0.1, Math.PI / 2, '#f2c12e', 3);
  for (const [x, z] of [[-0.9, -0.1], [0.9, -0.85], [0.9, 0.2], [-0.9, 0.9]]) addTree(b, x, z, 1.4, rng);
}

// ---------- 警察局 ----------
function police(b, rng) {
  b.box(0.98, 0.022, 0.98, 0, 0, 0, '#bdb7ab');
  b.push(0, 0.02, -0.15);
  b.box(0.76, 0.42, 0.5, 0, 0, 0, '#eef0f2');
  b.box(0.77, 0.06, 0.51, 0, 0.18, 0, '#2b55a3');
  b.box(0.8, 0.03, 0.54, 0, 0.42, 0, '#d0d4d8');
  sides(b, 0.76, 0.5, (s, fw, fd) => {
    winRow(b, rng, fw, fd, 0.27, s % 2 ? 3 : 5, 0.08, 0.09, null, PAL.glassTower, 0.8);
    if (s !== 0) winRow(b, rng, fw, fd, 0.05, s % 2 ? 3 : 5, 0.08, 0.09, null, PAL.glassTower, 0.8);
  });
  b.quad(0.2, 0.15, 0, 0.095, 0.256, PAL.glassTower, 'lit');
  b.box(0.3, 0.015, 0.12, 0, 0.17, 0.31, '#2b55a3');
  b.box(0.26, 0.05, 0.01, 0, 0.2, 0.37, '#ffffff', 'glow');
  b.box(0.15, 0.2, 0.15, 0.2, 0.45, -0.08, '#dfe3e7');
  b.cyl(0.006, 0.5, 0.2, 0.65, -0.08, '#888', 6);
  b.blink(0.2, 1.15, -0.08);
  addACUnit(b, -0.2, 0.45, 0);
  b.pop();
  for (const x of [-0.26, 0.02]) {
    addCar(b, x, 0.33, 0, '#f4f4f4');
    b.box(0.06, 0.012, 0.025, x, 0.12, 0.32, '#2050ff', 'glow');
  }
  flag(b, 0.38, 0.38, 0.55, '#2b55a3');
}

// ---------- 消防站 ----------
function fire(b, rng) {
  b.box(0.98, 0.022, 0.98, 0, 0, 0, '#bdb7ab');
  b.box(0.6, 0.004, 0.35, -0.1, 0.022, 0.3, '#9c968a');
  const brick = '#a3412f', trim = '#f2eee5';
  b.push(-0.1, 0.02, -0.12);
  b.box(0.66, 0.4, 0.5, 0, 0, 0, brick);
  b.box(0.7, 0.035, 0.54, 0, 0.4, 0, trim);
  for (const x of [-0.16, 0.16]) {
    b.box(0.24, 0.24, 0.012, x, 0, 0.25, trim);
    b.box(0.22, 0.22, 0.014, x, 0, 0.25, '#cf3a2b');
    for (let i = 1; i < 6; i++) b.box(0.22, 0.003, 0.016, x, i * 0.037, 0.25, '#b02e22');
  }
  winRow(b, rng, 0.66, 0.25, 0.28, 4, 0.08, 0.08, trim);
  b.box(0.3, 0.05, 0.01, 0, 0.345 - 0.02, 0.256, trim);
  b.pop();
  // 训练塔
  b.box(0.18, 0.85, 0.18, 0.33, 0.02, -0.25, brick);
  b.box(0.21, 0.03, 0.21, 0.33, 0.87, -0.25, trim);
  b.prism(0.2, 0.08, 0.2, 0.33, 0.9, -0.25, '#4b4f54');
  for (let f = 0; f < 3; f++) winRow(b, rng, 0.18, -0.16, 0.25 + f * 0.2, 1, 0.06, 0.08, trim);
  addCar(b, -0.26, 0.32, 0, '#d2281e', 2);
  addCar(b, 0.06, 0.32, 0, '#d2281e', 0);
  addTree(b, 0.38, 0.38, 1.1, rng);
}

// ---------- 医院 ----------
function hospital(b, rng) {
  b.box(1.98, 0.022, 1.98, 0, 0, 0, '#c4beb2');
  b.box(0.8, 0.004, 0.55, 0.5, 0.022, 0.6, '#5a5d62');
  for (let i = 0; i < 6; i++) b.box(0.006, 0.002, 0.14, 0.18 + i * 0.13, 0.026, 0.48, '#eee');
  const white = '#f4f5f6', gc = '#6a8fb0';
  // 主楼
  b.push(-0.35, 0.02, -0.3);
  b.box(0.9, 1.2, 0.6, 0, 0, 0, white);
  for (let f = 0; f < 6; f++) {
    sides(b, 0.9, 0.6, (s, fw, fd) => {
      b.box(fw - 0.06, 0.09, 0.008, 0, 0.07 + f * 0.19, fd, '#d6e0e8');
      winRow(b, rng, fw - 0.08, fd + 0.002, 0.075 + f * 0.19, s % 2 ? 4 : 7, (fw - 0.08) / (s % 2 ? 4 : 7) - 0.02, 0.08, null, gc, 0.65);
    });
  }
  b.box(0.94, 0.04, 0.64, 0, 1.2, 0, '#dfe4e8');
  // 红十字
  b.box(0.3, 0.3, 0.04, 0, 1.24, 0.2, white);
  b.box(0.08, 0.24, 0.012, 0, 1.27, 0.225, '#e02424', 'glow');
  b.box(0.24, 0.08, 0.012, 0, 1.35, 0.225, '#e02424', 'glow');
  addACUnit(b, -0.3, 1.24, -0.15, 1.5);
  addACUnit(b, 0.3, 1.24, -0.15, 1.5);
  b.pop();
  // 侧楼 + 停机坪
  b.push(0.5, 0.02, -0.4);
  b.box(0.8, 0.55, 0.85, 0, 0, 0, white);
  sides(b, 0.8, 0.85, (s, fw, fd) => { for (let f = 0; f < 3; f++) winRow(b, rng, fw, fd, 0.06 + f * 0.17, 5, 0.1, 0.08, null, gc, 0.6); });
  b.box(0.84, 0.03, 0.89, 0, 0.55, 0, '#dfe4e8');
  b.cyl(0.3, 0.03, 0, 0.58, 0, '#45494e', 24);
  b.cyl(0.26, 0.004, 0, 0.61, 0, '#ffffff', 24);
  b.cyl(0.245, 0.005, 0, 0.61, 0, '#45494e', 24);
  b.box(0.035, 0.006, 0.2, -0.06, 0.612, 0, '#fff');
  b.box(0.035, 0.006, 0.2, 0.06, 0.612, 0, '#fff');
  b.box(0.12, 0.006, 0.035, 0, 0.612, 0, '#fff');
  b.blink(0.28, 0.62, 0.28); b.blink(-0.28, 0.62, -0.28);
  b.pop();
  // 入口雨棚
  b.box(0.5, 0.02, 0.25, -0.35, 0.22, 0.12, '#e8ecef');
  for (const x of [-0.55, -0.15]) b.cyl(0.01, 0.2, x, 0.02, 0.22, '#ccc', 8);
  b.quad(0.3, 0.16, -0.35, 0.1, 0.006, gc, 'lit');
  addCar(b, -0.35, 0.4, Math.PI / 2, '#f4f4f4', 2);
  b.box(0.08, 0.012, 0.03, -0.35, 0.16, 0.4, '#ff2020', 'glow');
  for (let i = 0; i < 4; i++) addCar(b, 0.24 + i * 0.18, 0.55, 0, pick(rng, PAL.carColors), i % 2);
  for (const [x, z] of [[-0.9, 0.5], [-0.9, 0.85], [-0.55, 0.85], [0.9, 0.9]]) addTree(b, x, z, 1.3, rng);
}

// ---------- 电力 ----------
function windTurbine(b, rng) {
  b.box(0.98, 0.022, 0.98, 0, 0, 0, '#79a957');
  b.cyl(0.14, 0.04, 0, 0.02, 0, '#bdb7ab', 16);
  b.cyl(0.07, 2.2, 0, 0.06, 0, '#f2f3f4', 14, 'body', 0.5);
  b.box(0.08, 0.08, 0.2, 0, 2.24, -0.04, '#eceeef');
  b.box(0.15, 0.08, 0.12, 0.3, 0.02, 0.32, '#d9d6cf');
  b.box(0.04, 0.06, 0.01, 0.3, 0.02, 0.38, '#5a6068');
  for (let i = 0; i < 6; i++) addBush(b, -0.3 + (i % 3) * 0.08, 0.3 + Math.floor(i / 3) * 0.08, 1, pick(rng, PAL.leaf));
}
function windRotor() {
  const b = new Builder();
  b.add(new THREE.ConeGeometry(0.045, 0.1, 12).toNonIndexed(), '#f4f5f6', 'body', 0, 0, 0.03, Math.PI / 2, 0, 0, 1, 1, 1);
  for (let i = 0; i < 3; i++) {
    b.push(0, 0, 0, 0);
    const a = (i / 3) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.06, 1.0, 0.015).translate(0, 0.52, 0).toNonIndexed(), '#f4f5f6', 'body', 0, 0, 0, 0, 0, a, 1, 1, 1);
    b.pop();
  }
  return meshFromBuild(b.build());
}

function coalPlant(b, rng) {
  b.box(1.98, 0.022, 1.98, 0, 0, 0, '#8e9094');
  const wall = '#b9b4aa';
  // 冷却塔
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = t * 0.9;
    const r = 0.34 - 0.17 * Math.sin(t * Math.PI * 0.8) + 0.04 * t * t;
    pts.push(new THREE.Vector2(r, y));
  }
  const lathe = new THREE.LatheGeometry(pts, 28);
  for (const [x, z] of [[-0.5, -0.5], [0.2, -0.55]]) {
    b.geo(lathe, '#d8d5ce', x, 0.02, z, 0, 'ds');
    b.cyl(0.25, 0.01, x, 0.8, z, '#55575a', 20);
    b.emitter(x, 0.95, z, 2.6);
  }
  // 锅炉房 + 汽轮机房
  b.box(0.5, 0.75, 0.45, 0.6, 0.02, -0.4, wall);
  for (let f = 0; f < 3; f++) b.box(0.42, 0.06, 0.005, 0.6, 0.15 + f * 0.2, -0.172, PAL.glassTower, f === 1 ? 'lit' : 'glass');
  b.box(1.2, 0.35, 0.4, -0.15, 0.02, 0.15, '#c7c1b5');
  b.box(1.22, 0.03, 0.42, -0.15, 0.37, 0.15, '#8a8f94');
  for (let i = 0; i < 8; i++) b.quad(0.1, 0.1, -0.68 + i * 0.15, 0.22, 0.352, PAL.glassTower, rng() < 0.6 ? 'lit' : 'glass');
  // 烟囱
  const bands = 8, h = 1.8;
  for (let i = 0; i < bands; i++) b.cyl(0.08 * (1 - i * 0.03), h / bands, 0.75, 0.02 + (h / bands) * i, 0.05, i % 2 ? '#d64a3a' : '#f0eee8', 16, 'body', 0.97);
  b.emitter(0.75, 1.85, 0.05, 1.8);
  b.blink(0.75, 1.83, 0.05);
  // 煤堆
  b.cone(0.22, 0.14, -0.55, 0.02, 0.65, '#2a2a2c', 10);
  b.cone(0.15, 0.1, -0.25, 0.02, 0.72, '#323234', 9);
  b.box(0.05, 0.04, 0.6, -0.42, 0.12, 0.45, '#6f7378', 'body', 0, 0.35, 0);
  // 变压器
  for (let i = 0; i < 3; i++) {
    b.box(0.1, 0.1, 0.1, 0.4 + i * 0.16, 0.02, 0.7, '#9aa0a5');
    b.cyl(0.006, 0.18, 0.4 + i * 0.16, 0.12, 0.7, '#555', 6);
  }
  addFence(b, 1.9, 0, 0.95, 0, '#8a8f94', 0.07);
}

function solar(b, rng) {
  b.box(1.98, 0.022, 1.98, 0, 0, 0, '#a8a090');
  for (let r = 0; r < 6; r++) {
    const z = -0.75 + r * 0.27;
    for (let c = 0; c < 2; c++) {
      const x = -0.42 + c * 0.84;
      b.box(0.008, 0.06, 0.008, x - 0.3, 0.02, z, '#777');
      b.box(0.008, 0.06, 0.008, x + 0.3, 0.02, z, '#777');
      b.box(0.76, 0.012, 0.18, x, 0.07, z, '#1b2d4f', 'glass', 0, -0.5);
      for (let k = 1; k < 6; k++) b.box(0.004, 0.014, 0.18, x - 0.38 + k * 0.127, 0.071, z, '#9aa6b5', 'body', 0, -0.5);
    }
  }
  b.box(0.2, 0.14, 0.14, 0.8, 0.02, 0.85, '#e6e3dc');
  b.box(0.2, 0.14, 0.14, -0.8, 0.02, 0.85, '#e6e3dc');
  addFence(b, 1.9, 0, 0.96, 0, '#8a8f94', 0.06);
  addFence(b, 1.9, 0, -0.96, 0, '#8a8f94', 0.06);
}

// ---------- 地标 ----------
function ferrisBase(b, rng) {
  b.box(1.98, 0.022, 1.98, 0, 0, 0, '#d4c8b0');
  b.box(1.0, 0.03, 0.5, 0, 0.02, 0, '#bfb39b');
  // A 字形支架
  const H = 1.08;
  for (const z of [-0.17, 0.17]) {
    for (const sx of [-1, 1]) {
      const len = Math.hypot(0.45, H);
      const ang = Math.atan2(0.45, H);
      b.box(0.035, len, 0.035, sx * 0.45, 0.04, z, '#e8e8ea', 'body', 0, 0, sx * ang);
    }
  }
  b.cyl(0.04, 0.4, 0, H + 0.04, -0.2, '#9a9ea3', 12, 'body', 1, Math.PI / 2);
  // 小摊
  const cols = ['#e0567f', '#2f7fd6', '#f2a531', '#2bb07f'];
  for (let i = 0; i < 4; i++) {
    const x = -0.75 + i * 0.5;
    const z = i % 2 ? 0.75 : 0.62;
    if (Math.abs(x) < 0.3) continue;
    b.box(0.18, 0.13, 0.14, x, 0.02, z, '#f6f3ea');
    b.prism(0.22, 0.07, 0.18, x, 0.15, z, cols[i]);
  }
  addTree(b, -0.85, -0.85, 1.4, rng);
  addTree(b, 0.85, -0.85, 1.4, rng);
  addTree(b, 0.85, 0.85, 1.3, rng);
  addTree(b, -0.85, 0.85, 1.3, rng);
  for (const x of [-0.6, 0.6]) addLampProp(b, x, 0.35);
}
function ferrisWheel() {
  const g = new THREE.Group();
  const R = 0.9;
  const rimMat = new THREE.MeshStandardMaterial({ color: '#f4f4f6', roughness: 0.4, metalness: 0.3 });
  const wheel = new THREE.Group();
  for (const z of [-0.07, 0.07]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(R, 0.014, 6, 64), rimMat);
    t.position.z = z; t.castShadow = true; wheel.add(t);
    const t2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.008, 6, 48), rimMat);
    t2.position.z = z; wheel.add(t2);
  }
  const N = 16;
  const b = new Builder();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    for (const z of [-0.07, 0.07]) b.add(new THREE.BoxGeometry(0.008, R, 0.008).translate(0, R / 2, 0).toNonIndexed(), '#f0f0f2', 'body', 0, 0, z, 0, 0, a, 1, 1, 1);
    b.add(new THREE.BoxGeometry(0.006, 0.006, 0.14).toNonIndexed(), '#f0f0f2', 'body', Math.sin(a) * R, Math.cos(a) * R, 0, 0, 0, 0, 1, 1, 1);
    // 霓虹灯珠
    for (let k = 0; k < 3; k++) {
      const aa = a + (k / 3) * (Math.PI * 2 / N);
      b.sphere(0.02, Math.sin(aa) * R, Math.cos(aa) * R, 0.085, ['#ff5ab4', '#5ad8ff', '#ffe25a'][k], 0, 'glow');
    }
  }
  b.cyl(0.07, 0.2, 0, 0, -0.1, '#c0c4c8', 16, 'body', 1, Math.PI / 2);
  // 霓虹灯环
  b.geo(new THREE.TorusGeometry(R * 1.01, 0.008, 4, 96), '#ff5ab4', 0, 0, 0.088, 0, 'glow');
  b.geo(new THREE.TorusGeometry(R * 1.01, 0.008, 4, 96), '#5ad8ff', 0, 0, -0.088, 0, 'glow');
  b.geo(new THREE.TorusGeometry(R * 0.55, 0.006, 4, 64), '#ffe25a', 0, 0, 0.088, 0, 'glow');
  wheel.add(meshFromBuild(b.build()));
  g.add(wheel);
  const gondolas = [];
  const cols = ['#e0567f', '#2f7fd6', '#f2a531', '#2bb07f', '#8a4fd1', '#e8483b'];
  for (let i = 0; i < N; i++) {
    const gb = new Builder();
    const c = cols[i % cols.length];
    gb.box(0.004, 0.05, 0.004, 0, -0.05, 0, '#888');
    gb.box(0.09, 0.08, 0.08, 0, -0.13, 0, c);
    gb.quad(0.07, 0.035, 0, -0.085, 0.0405, '#b8d8ec', 'lit');
    gb.push(0, 0, 0, Math.PI); gb.quad(0.07, 0.035, 0, -0.085, 0.0405, '#b8d8ec', 'lit'); gb.pop();
    gb.cyl(0.055, 0.025, 0, -0.05, 0, c, 10, 'body', 0.4);
    const gm = meshFromBuild(gb.build());
    g.add(gm);
    gondolas.push(gm);
  }
  return { group: g, wheel, gondolas, R };
}

function tvTower(b, rng) {
  b.box(0.98, 0.022, 0.98, 0, 0, 0, '#cfc8b8');
  b.cyl(0.4, 0.12, 0, 0.02, 0, '#e8e4dc', 24);
  b.cyl(0.42, 0.015, 0, 0.14, 0, '#bdb7ab', 24);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.quad(0.12, 0.07, Math.sin(a) * 0.402, 0.07, Math.cos(a) * 0.402, PAL.glassTower, 'lit', a);
  }
  // 塔身
  b.cyl(0.13, 3.6, 0, 0.14, 0, '#f0eee9', 16, 'body', 0.5);
  for (let y = 0.6; y < 3.4; y += 0.6) b.cyl(0.1 * (1 - y / 7.2) + 0.03, 0.02, 0, y, 0, '#d9483b', 16);
  // 观光层
  const P = 3.2;
  b.cyl(0.12, 0.14, 0, P - 0.14, 0, '#e8e4dc', 20, 'body', 2.4);
  b.cyl(0.3, 0.04, 0, P, 0, '#e6e2da', 24);
  b.cyl(0.3, 0.13, 0, P + 0.04, 0, '#4f7393', 24, 'lit');
  b.cyl(0.32, 0.04, 0, P + 0.17, 0, '#e6e2da', 24);
  b.cyl(0.32, 0.12, 0, P + 0.21, 0, '#e6e2da', 24, 'body', 0.45);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    b.sphere(0.012, Math.sin(a) * 0.325, P + 0.19, Math.cos(a) * 0.325, '#ffe9a8', 0, 'glow');
  }
  // 小球舱
  b.sphere(0.12, 0, P + 0.7, 0, '#e6e2da', 2);
  b.cyl(0.124, 0.04, 0, P + 0.68, 0, '#4f7393', 24, 'lit');
  b.cyl(0.04, 0.5, 0, P + 0.33, 0, '#f0eee9', 12);
  // 天线
  b.cyl(0.025, 0.9, 0, P + 0.8, 0, '#d9d9d9', 8, 'body', 0.4);
  for (let i = 0; i < 4; i++) b.cyl(0.02 - i * 0.003, 0.1, 0, P + 0.85 + i * 0.22, 0, i % 2 ? '#fff' : '#d9483b', 8);
  b.blink(0, P + 1.72, 0);
  b.blink(0, P + 1.25, 0.02);
  addTree(b, -0.42, -0.42, 1.1, rng);
  addTree(b, 0.42, -0.42, 1.1, rng);
}

function stadium(b, rng) {
  b.box(2.98, 0.022, 2.98, 0, 0, 0, '#c9c2b2');
  const sx = 1, sz = 0.78;
  // 看台（椭圆碗）
  const seat = [];
  for (let i = 0; i <= 6; i++) seat.push(new THREE.Vector2(1.32 - i * 0.075, 0.62 - i * 0.09));
  const bowl = new THREE.LatheGeometry(seat, 48);
  b.add(bowl.toNonIndexed(), '#2f6fc4', 'ds', 0, 0.02, 0, 0, 0, 0, sx, 1, sz);
  const seat2 = [];
  for (let i = 0; i <= 3; i++) seat2.push(new THREE.Vector2(1.0 - i * 0.06, 0.12 - i * 0.03));
  b.add(new THREE.LatheGeometry(seat2, 48).toNonIndexed(), '#d8d8dc', 'ds', 0, 0.02, 0, 0, 0, 0, sx, 1, sz);
  // 外墙
  const wall = new THREE.CylinderGeometry(1.35, 1.38, 0.64, 48, 1, true).translate(0, 0.32, 0);
  b.add(wall.toNonIndexed(), '#e9e6df', 'ds', 0, 0.02, 0, 0, 0, 0, sx, 1, sz);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    b.box(0.04, 0.64, 0.02, Math.sin(a) * 1.385 * sx, 0.02, Math.cos(a) * 1.385 * sz, '#b9b4aa', 'body', a);
  }
  // 顶棚
  const roof = new THREE.RingGeometry(1.02, 1.42, 48, 1).rotateX(-Math.PI / 2);
  b.add(roof.toNonIndexed(), '#f4f4f2', 'ds', 0, 0.74, 0, 0, 0, 0, sx, 1, sz);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.box(0.03, 0.1, 0.03, Math.sin(a) * 1.4 * sx, 0.64, Math.cos(a) * 1.4 * sz, '#cfcfcf', 'body', a);
    b.sphere(0.018, Math.sin(a) * 1.05 * sx, 0.72, Math.cos(a) * 1.05 * sz, '#fffbe6', 0, 'glow');
  }
  // 球场
  b.box(1.3, 0.006, 0.84, 0, 0.02, 0, '#4e9a3e');
  for (let i = 0; i < 8; i++) b.box(0.1625, 0.007, 0.8, -0.65 + 0.08125 + i * 0.1625, 0.02, 0, i % 2 ? '#56a646' : '#4a933c');
  b.box(1.1, 0.008, 0.006, 0, 0.021, 0.34, '#fff');
  b.box(1.1, 0.008, 0.006, 0, 0.021, -0.34, '#fff');
  b.box(0.006, 0.008, 0.68, 0.55, 0.021, 0, '#fff');
  b.box(0.006, 0.008, 0.68, -0.55, 0.021, 0, '#fff');
  b.box(0.006, 0.008, 0.68, 0, 0.021, 0, '#fff');
  b.cyl(0.1, 0.008, 0, 0.02, 0, '#fff', 24);
  b.cyl(0.094, 0.009, 0, 0.02, 0, '#4e9a3e', 24);
  for (const x of [-0.56, 0.56]) b.box(0.02, 0.05, 0.12, x, 0.02, 0, '#fff');
  // 灯塔
  for (const [x, z] of [[-1.3, -1.25], [1.3, -1.25], [1.3, 1.25], [-1.3, 1.25]]) {
    b.cyl(0.025, 1.3, x, 0.02, z, '#bfc3c7', 8);
    b.push(x, 1.3, z, Math.atan2(-x, -z));
    b.box(0.3, 0.14, 0.03, 0, 0, 0, '#5a5f66');
    b.box(0.27, 0.11, 0.006, 0, 0.015, 0.018, '#fffbea', 'glow');
    b.pop();
  }
}

// ---------- 入口 ----------
const MAKERS = {
  park, plaza, school, police, fire, hospital, wind: windTurbine, coal: coalPlant, solar,
  ferris: ferrisBase, tower: tvTower, stadium,
};

export function createSpecial(type, seed = 1) {
  const rng = mulberry32(seed * 131 + type.length * 7);
  const b = new Builder();
  MAKERS[type](b, rng);
  const res = b.build();
  const group = meshFromBuild(res);
  const obj = { group, emitters: res.emitters, update: null };
  if (type === 'wind') {
    const rotor = windRotor();
    rotor.position.set(0, 2.28, 0.08);
    group.add(rotor);
    const speed = 1.2 + rng() * 0.6;
    rotor.rotation.z = rng() * 6;
    obj.update = (dt) => { rotor.rotation.z -= dt * speed; };
  } else if (type === 'ferris') {
    const fw = ferrisWheel();
    fw.group.position.set(0, 1.12, 0);
    group.add(fw.group);
    obj.update = (dt, t) => {
      const a = t * 0.12;
      fw.wheel.rotation.z = a;
      fw.gondolas.forEach((gm, i) => {
        const ang = a + (i / fw.gondolas.length) * Math.PI * 2;
        gm.position.set(-Math.sin(ang) * fw.R, Math.cos(ang) * fw.R, 0);
      });
    };
  }
  return obj;
}
