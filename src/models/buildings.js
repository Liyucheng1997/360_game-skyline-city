// 区域建筑（住宅/商业/工业 × 3 级）程序化模型
import { Color } from 'three';
import { Builder } from '../core/builder.js';
import { mulberry32, pick, range } from '../core/utils.js';
import { PAL, addTree, addBush, addCar, addACUnit, addWaterTank, addFence, addBench, randomCarColor } from './props.js';

const WALLS = ['#f2e6d0', '#e8d5b5', '#dfe7ec', '#f5f0e6', '#e9c9a8', '#c9d8c5', '#f0d9d0', '#d9e2f0', '#efe0b8', '#e6d3c3'];
const ROOFS = ['#a2483a', '#6b4f3f', '#4f5d6b', '#7a3b2e', '#3f4a52', '#8c6d4f', '#5c6e58', '#94523f'];
const BRICK = ['#a0523d', '#8e4a38', '#b0654a', '#9a5b48'];
const MIDS = ['#e7e2d6', '#d8d2c4', '#cfd6dc', '#ece6da', '#d9cbb5', '#c8ccd0', '#e8dccb'];
const ACCENT = ['#d9483b', '#2f7fd6', '#2bb07f', '#f2a531', '#8a4fd1', '#e0567f', '#1fa3b8'];
const FLOWERS = ['#e85d75', '#f2c94c', '#f08a4b', '#c86dd7', '#ffffff'];

// 四个立面迭代：fn(side, faceWidth, halfDepth)
function facades(b, w, d, fn, sides = [0, 1, 2, 3]) {
  for (const s of sides) {
    const fw = s % 2 ? d : w;
    const fd = s % 2 ? w / 2 : d / 2;
    // side 0 = 正面(+Z)，1 = +X，2 = 背面，3 = -X
    b.push(0, 0, 0, s * Math.PI / 2);
    fn(s, fw, fd);
    b.pop();
  }
}

function win(b, rng, x, y, z, ww, wh, o = {}) {
  const lit = rng() < (o.lit ?? 0.5) ? 'lit' : 'glass';
  if (o.frame) b.box(ww + 0.018, wh + 0.018, 0.008, x, y - 0.009, z, o.frame);
  b.quad(ww, wh, x, y + wh / 2, z + 0.0055, o.glass || PAL.glassHouse, lit);
  if (o.sill) b.box(ww + 0.026, 0.008, 0.018, x, y - 0.014, z + 0.006, o.sill);
  if (o.shutter) {
    b.box(0.022, wh, 0.006, x - ww / 2 - 0.02, y, z + 0.004, o.shutter);
    b.box(0.022, wh, 0.006, x + ww / 2 + 0.02, y, z + 0.004, o.shutter);
  }
}

function windowRows(b, rng, fw, z, y0, floors, fh, cols, ww, wh, o = {}) {
  const step = fw / cols;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const x = -fw / 2 + step * (i + 0.5);
      win(b, rng, x, y0 + f * fh + (fh - wh) * 0.45, z, ww, wh, o);
    }
  }
}

function parapet(b, w, d, y, color, t = 0.025, h = 0.04) {
  b.box(w, h, t, 0, y, d / 2 - t / 2, color);
  b.box(w, h, t, 0, y, -d / 2 + t / 2, color);
  b.box(t, h, d - 2 * t, w / 2 - t / 2, y, 0, color);
  b.box(t, h, d - 2 * t, -w / 2 + t / 2, y, 0, color);
}

function shade(hex, f) {
  const c = new Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

function lot(b, color) { b.box(0.96, 0.02, 0.96, 0, 0, 0, color); }

// ============ 住宅 R ============
function house(rng, v) {
  const b = new Builder();
  const grass = pick(rng, PAL.grass);
  lot(b, grass);
  const wall = pick(rng, WALLS), roof = pick(rng, ROOFS), trim = '#f7f5ef';
  const stories = v === 1 || v === 5 ? 2 : 1;
  const w = range(rng, 0.44, 0.52), d = range(rng, 0.34, 0.4);
  const fh = 0.22, h = fh * stories;
  const hx = v === 1 ? -0.13 : range(rng, -0.05, 0.05);
  const hz = -0.07;
  const shutter = rng() < 0.5 ? pick(rng, ['#3e5f45', '#3b4e6b', '#6b3b33', '#f4f1ea']) : null;
  const wo = { frame: trim, sill: trim, shutter, lit: 0.5 };

  b.push(hx, 0.02, hz);
  b.box(w + 0.03, 0.035, d + 0.03, 0, 0, 0, '#9a9286');
  b.box(w, h, d, 0, 0.03, 0, wall);
  b.box(w + 0.012, 0.014, d + 0.012, 0, 0.03 + h - 0.014, 0, trim);
  if (stories === 2) b.box(w + 0.01, 0.01, d + 0.01, 0, 0.03 + fh, 0, trim);
  const roofH = range(rng, 0.13, 0.18);
  const top = 0.03 + h;
  if (v === 2) b.hipRoof(w + 0.07, d + 0.07, roofH, 0, top, 0, roof);
  else b.gableRoof(d, w, roofH, 0, top, 0, wall, roof, Math.PI / 2);
  // 烟囱
  b.box(0.05, roofH + 0.07, 0.05, w * 0.28, top, -d * 0.18, '#8a4a3a');
  b.box(0.06, 0.012, 0.06, w * 0.28, top + roofH + 0.07, -d * 0.18, '#5a3a30');
  // 门
  const doorX = v === 1 ? w * 0.22 : 0;
  b.box(0.1, 0.165, 0.008, doorX, 0.03, d / 2, trim);
  b.box(0.075, 0.15, 0.012, doorX, 0.03, d / 2, pick(rng, ['#6b4423', '#3b4e6b', '#7a2e2e', '#2f4f3f']));
  b.box(0.12, 0.02, 0.06, doorX, 0.015, d / 2 + 0.03, '#b8b0a2');
  // 正面窗
  for (let f = 0; f < stories; f++) {
    const y = 0.03 + f * fh + 0.07;
    const xs = f === 0 ? [doorX - 0.14, doorX + 0.14].filter((x) => Math.abs(x) < w / 2 - 0.05) : [-w * 0.28, 0, w * 0.28];
    if (f === 0 && v === 1) xs.splice(0, xs.length, -w * 0.18);
    for (const x of xs) win(b, rng, x, y, d / 2, 0.075, 0.085, wo);
  }
  // 侧/背窗
  facades(b, w, d, (s, fw, fd) => {
    for (let f = 0; f < stories; f++) {
      const y = 0.03 + f * fh + 0.07;
      const n = s === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) win(b, rng, n === 1 ? 0 : (i - 0.5) * fw * 0.5, y, fd, 0.07, 0.08, { frame: trim, lit: 0.4 });
    }
  }, [1, 2, 3]);
  // 门廊
  if (v === 3 || v === 5) {
    b.box(0.2, 0.012, 0.1, doorX, 0.03 + 0.19, d / 2 + 0.05, roof);
    for (const sx of [-0.09, 0.09]) b.box(0.01, 0.19, 0.01, doorX + sx, 0.03, d / 2 + 0.09, trim);
  }
  // 老虎窗
  if (v === 5) {
    for (const sx of [-w * 0.25, w * 0.25]) {
      b.box(0.08, 0.075, 0.08, sx, top + 0.01, d * 0.18, wall);
      b.gableRoof(0.1, 0.1, 0.045, sx, top + 0.085, d * 0.2, wall, roof, 0, 0.01);
      win(b, rng, sx, top + 0.025, d * 0.18 + 0.04, 0.045, 0.045, { frame: trim, lit: 0.5 });
    }
  }
  // 花坛
  for (let i = 0; i < 4; i++) addBush(b, -w / 2 + 0.05 + i * (w - 0.1) / 3, d / 2 + 0.05, 0.9, pick(rng, i % 2 ? FLOWERS : PAL.leaf));
  b.pop();

  // 车库
  if (v === 1) {
    const gx = hx + w / 2 + 0.12;
    b.box(0.22, 0.2, 0.32, gx, 0.02, hz + 0.02, wall);
    b.box(0.25, 0.02, 0.35, gx, 0.22, hz + 0.02, roof);
    b.box(0.16, 0.14, 0.008, gx, 0.02, hz + 0.18, '#e4e1da');
    for (let i = 1; i < 5; i++) b.box(0.16, 0.003, 0.01, gx, 0.02 + i * 0.028, hz + 0.18, '#c8c4bc');
    b.box(0.18, 0.004, 0.3, gx, 0.02, 0.33, PAL.pave);
    addCar(b, gx, 0.32, Math.PI, randomCarColor(rng));
  }
  // 小路
  const doorWorldX = hx + (v === 1 ? w * 0.22 : 0);
  const pathStart = hz + d / 2 + 0.06;
  b.box(0.07, 0.004, 0.48 - pathStart, doorWorldX, 0.02, (pathStart + 0.48) / 2, PAL.pave);
  // 栅栏 / 树篱
  if (v === 0 || v === 3) {
    const gap = 0.05;
    const lenL = doorWorldX - gap + 0.47, lenR = 0.47 - doorWorldX - gap;
    addFence(b, lenL, -0.47 + lenL / 2, 0.465, 0);
    addFence(b, lenR, 0.47 - lenR / 2, 0.465, 0);
    addFence(b, 0.93, 0.465, 0, Math.PI / 2);
    addFence(b, 0.93, -0.465, 0, Math.PI / 2);
    addFence(b, 0.93, 0, -0.465, 0);
  } else if (v === 2 || v === 5) {
    const hc = pick(rng, ['#3f7a35', '#4a8a3c']);
    b.box(0.05, 0.06, 0.9, 0.44, 0.02, 0, hc);
    b.box(0.05, 0.06, 0.9, -0.44, 0.02, 0, hc);
    b.box(0.83, 0.06, 0.05, 0, 0.02, -0.44, hc);
  }
  // 邮筒
  b.box(0.008, 0.06, 0.008, doorWorldX + 0.08, 0.02, 0.42, '#555');
  b.box(0.03, 0.022, 0.04, doorWorldX + 0.08, 0.08, 0.42, pick(rng, ['#2f5ea8', '#b33a3a', '#333']));
  // 后院树
  addTree(b, range(rng, -0.35, -0.2), range(rng, -0.38, -0.32), range(rng, 1.0, 1.4), rng);
  if (rng() < 0.7) addTree(b, range(rng, 0.25, 0.37), range(rng, -0.38, -0.3), range(rng, 0.9, 1.3), rng);
  return b;
}

function modernHouse(rng) {
  const b = new Builder();
  lot(b, pick(rng, PAL.grass));
  const white = '#f1f0ec', wood = pick(rng, ['#a87b51', '#8a5f3c', '#b98a5e']), dark = '#3a3d42';
  // 下层
  b.box(0.58, 0.22, 0.4, -0.05, 0.02, -0.1, white);
  // 上层悬挑
  b.box(0.4, 0.2, 0.36, 0.06, 0.24, -0.06, wood);
  b.box(0.42, 0.018, 0.38, 0.06, 0.44, -0.06, dark);
  b.box(0.6, 0.015, 0.42, -0.05, 0.235, -0.1, dark);
  // 大落地窗
  for (let i = 0; i < 3; i++) b.quad(0.12, 0.17, -0.25 + i * 0.13, 0.12, 0.103, PAL.glassHouse, rng() < 0.6 ? 'lit' : 'glass');
  b.quad(0.3, 0.13, 0.06, 0.33, 0.123, PAL.glassHouse, rng() < 0.5 ? 'lit' : 'glass');
  b.push(0.06, 0, -0.06, Math.PI / 2); b.quad(0.2, 0.1, 0, 0.33, 0.201, PAL.glassHouse, 'glass'); b.pop();
  b.push(-0.05, 0, -0.1, -Math.PI / 2); b.quad(0.2, 0.12, 0, 0.13, 0.291, PAL.glassHouse, 'lit'); b.pop();
  // 太阳能板
  for (let i = 0; i < 3; i++) b.box(0.09, 0.008, 0.13, -0.05 + i * 0.1, 0.46, -0.08, '#1d3150', 'glass', 0, -0.35);
  // 泳池与木平台
  b.box(0.36, 0.006, 0.2, 0.18, 0.02, 0.25, wood);
  b.box(0.22, 0.008, 0.12, 0.2, 0.021, 0.25, '#3fb2d6', 'glass');
  b.box(0.13, 0.004, 0.36, -0.3, 0.02, 0.3, PAL.pave);
  addCar(b, -0.3, 0.3, 0, randomCarColor(rng));
  addTree(b, 0.38, -0.36, 1.2, rng, 2);
  addTree(b, -0.4, -0.38, 1.1, rng, 2);
  for (let i = 0; i < 3; i++) addBush(b, -0.05 + i * 0.07, 0.15, 1, pick(rng, PAL.leaf));
  return b;
}

function apartment(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  const g = pick(rng, PAL.grass);
  b.box(0.9, 0.006, 0.1, 0, 0.02, -0.41, g);
  b.box(0.1, 0.006, 0.7, 0.41, 0.02, 0, g);
  const wall = pick(rng, MIDS), band = '#f6f4ef', acc = pick(rng, ['#c7a37a', '#8fa3b5', '#b88a74', '#9bb08f']);
  const floors = 4 + Math.floor(rng() * 2), fh = 0.21;
  const w = 0.78, d = 0.58, H = floors * fh + 0.06;
  b.push(-0.02, 0.02, -0.04);
  b.box(w, 0.06, d, 0, 0, 0, '#bdb6a8');
  b.box(w, H - 0.06, d, 0, 0.06, 0, wall);
  b.box(w * 0.22, H - 0.06, d + 0.01, -w * 0.39 + w * 0.11, 0.06, 0, acc);
  for (let f = 1; f <= floors; f++) b.box(w + 0.012, 0.012, d + 0.012, 0, 0.06 + f * fh - 0.012, 0, band);
  facades(b, w, d, (s, fw, fd) => {
    const cols = s % 2 ? 3 : 4;
    windowRows(b, rng, fw, fd, 0.06 + (s === 0 ? fh : 0), s === 0 ? floors - 1 : floors, fh, cols, 0.085, 0.1, { frame: band, lit: 0.55 });
  });
  // 阳台
  for (let f = 1; f < floors; f++) {
    for (const x of [-w * 0.25, w * 0.25]) {
      const y = 0.06 + f * fh;
      b.box(0.2, 0.014, 0.07, x, y, d / 2 + 0.035, band);
      b.box(0.2, 0.05, 0.006, x, y + 0.014, d / 2 + 0.068, '#9fc2d4', 'glass');
      b.box(0.006, 0.05, 0.07, x - 0.1, y + 0.014, d / 2 + 0.035, band);
      b.box(0.006, 0.05, 0.07, x + 0.1, y + 0.014, d / 2 + 0.035, band);
    }
  }
  // 一层大堂
  b.quad(0.18, 0.14, 0, 0.06 + 0.075, d / 2 + 0.006, PAL.glassHouse, 'lit');
  b.box(0.26, 0.014, 0.1, 0, 0.06 + 0.16, d / 2 + 0.05, '#555b61');
  for (const x of [-w * 0.33, w * 0.33]) win(b, rng, x, 0.06 + 0.05, d / 2, 0.1, 0.1, { frame: band });
  parapet(b, w, d, H, band);
  b.box(0.18, 0.12, 0.16, w * 0.22, H, -d * 0.15, wall);
  addACUnit(b, -w * 0.25, H, -d * 0.2);
  addACUnit(b, -w * 0.1, H, -d * 0.2);
  addWaterTank(b, -w * 0.3, H, d * 0.18);
  b.pop();
  addTree(b, 0.41, -0.41, 1.2, rng);
  addTree(b, -0.41, -0.43, 1.0, rng);
  addBench(b, 0.3, 0.42, Math.PI);
  return b;
}

function townhouses(rng) {
  const b = new Builder();
  lot(b, pick(rng, PAL.grass));
  b.box(0.96, 0.004, 0.14, 0, 0.02, 0.41, PAL.pave);
  const n = 3, uw = 0.3, d = 0.55, fh = 0.2, floors = 3;
  for (let i = 0; i < n; i++) {
    const x = -0.3 + i * 0.3;
    const wall = pick(rng, [...WALLS, ...BRICK]), roof = pick(rng, ROOFS), trim = '#f7f5ef';
    b.push(x, 0.02, -0.06);
    b.box(uw, fh * floors + 0.03, d, 0, 0, 0, wall);
    b.box(uw + 0.004, 0.012, d + 0.004, 0, fh * floors + 0.02, 0, trim);
    b.gableRoof(uw, d, 0.14, 0, fh * floors + 0.03, 0, wall, roof, 0, 0.012);
    for (let f = 0; f < floors; f++) {
      const y = 0.03 + f * fh + 0.05;
      if (f === 0) {
        b.box(0.07, 0.14, 0.01, -0.06, 0.03, d / 2, '#4b3a2c');
        b.box(0.09, 0.03, 0.06, -0.06, 0, d / 2 + 0.03, '#a59d90');
        win(b, rng, 0.06, y, d / 2, 0.08, 0.09, { frame: trim, sill: trim });
      } else {
        win(b, rng, -0.065, y, d / 2, 0.07, 0.1, { frame: trim, sill: trim });
        win(b, rng, 0.065, y, d / 2, 0.07, 0.1, { frame: trim, sill: trim });
      }
      win(b, rng, 0, y, -d / 2 - 0.001, 0.08, 0.09, { frame: trim });
    }
    b.pop();
    addBush(b, x + 0.08, 0.27, 1.1, pick(rng, FLOWERS));
  }
  addTree(b, -0.35, -0.42, 1.0, rng);
  addTree(b, 0.35, -0.42, 1.1, rng);
  return b;
}

function brickBlock(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  const brick = pick(rng, BRICK), trim = '#efe9dd';
  const floors = 5, fh = 0.2, w = 0.8, d = 0.62, H = floors * fh + 0.05;
  b.push(0, 0.02, -0.06);
  b.box(w, 0.05, d, 0, 0, 0, '#8d8579');
  b.box(w, H - 0.05, d, 0, 0.05, 0, brick);
  b.box(w + 0.04, 0.03, d + 0.04, 0, H, 0, trim);
  b.box(w + 0.02, 0.012, d + 0.02, 0, 0.05 + fh - 0.012, 0, trim);
  facades(b, w, d, (s, fw, fd) => {
    windowRows(b, rng, fw, fd, 0.05 + (s === 0 ? fh : 0), s === 0 ? floors - 1 : floors, fh, s % 2 ? 3 : 4, 0.07, 0.11, { frame: trim, sill: trim, lit: 0.5 });
  });
  // 一层入口
  b.box(0.12, 0.15, 0.012, 0, 0.05, d / 2, '#3d2b20');
  b.box(0.16, 0.012, 0.08, 0, 0.21, d / 2 + 0.04, trim);
  for (const x of [-0.25, 0.25]) win(b, rng, x, 0.09, d / 2, 0.12, 0.08, { frame: trim });
  // 消防梯
  b.push(w / 2, 0, 0, Math.PI / 2);
  for (let f = 1; f < floors; f++) {
    const y = 0.05 + f * fh;
    b.box(0.22, 0.008, 0.06, 0, y, 0.03, '#2d2f33');
    b.box(0.22, 0.04, 0.004, 0, y + 0.008, 0.06, '#2d2f33');
    if (f < floors - 1) b.box(0.006, 0.006, 0.26, 0.04, y + 0.1, 0.035, '#2d2f33', 'body', Math.PI / 2, 0, 0.9);
  }
  b.pop();
  addWaterTank(b, -0.2, H + 0.03, -0.1);
  addACUnit(b, 0.15, H + 0.03, 0.05);
  b.pop();
  addTree(b, -0.38, 0.38, 1.0, rng);
  addTree(b, 0.38, 0.38, 1.0, rng);
  return b;
}

function residentialTower(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  b.box(0.96, 0.006, 0.12, 0, 0.02, -0.42, pick(rng, PAL.grass));
  const wall = pick(rng, MIDS), acc = pick(rng, ['#5c6f80', '#8a6f5a', '#6f8a7a', '#7d7f8f']), band = '#f4f2ee';
  // 裙楼
  b.box(0.88, 0.26, 0.82, 0, 0.02, -0.02, '#cfc8bb');
  facades(b, 0.88, 0.82, (s, fw, fd) => {
    for (let i = 0; i < 4; i++) b.quad(fw / 4 - 0.03, 0.15, -fw / 2 + fw / 8 + i * fw / 4, 0.12, fd + 0.004 - 0.02 * (s % 2 ? 0 : 1) * 0, PAL.glassTower, rng() < 0.7 ? 'lit' : 'glass');
  });
  b.box(0.92, 0.02, 0.86, 0, 0.28, -0.02, band);
  const floors = 13 + Math.floor(rng() * 6), fh = 0.19, w = 0.6, d = 0.56;
  const H0 = 0.3, H = H0 + floors * fh;
  b.box(w, floors * fh, d, 0, H0, -0.02, wall);
  b.push(0, 0, -0.02);
  // 竖向色带
  for (const sx of [-1, 1]) b.box(0.08, floors * fh, d + 0.016, sx * (w / 2 - 0.04), H0, 0, acc);
  for (let f = 0; f < floors; f++) {
    const y = H0 + f * fh;
    b.box(w + 0.012, 0.01, d + 0.012, 0, y, 0, band);
    facades(b, w, d, (s, fw, fd) => {
      for (let i = 0; i < 3; i++) win(b, rng, -fw / 2 + 0.13 + i * (fw - 0.26) / 2, y + 0.05, fd, 0.09, 0.11, { lit: 0.5, glass: PAL.glassTower });
    });
    if (f % 2 === 0) {
      for (const s of [0, 2]) {
        b.push(0, 0, 0, s * Math.PI / 2);
        b.box(0.18, 0.012, 0.06, 0, y + 0.012, d / 2 + 0.03, band);
        b.box(0.18, 0.04, 0.005, 0, y + 0.024, d / 2 + 0.06, '#a8cbe0', 'glass');
        b.pop();
      }
    }
  }
  // 顶部
  b.box(w + 0.03, 0.04, d + 0.03, 0, H, 0, band);
  b.box(w * 0.6, 0.12, d * 0.6, 0, H + 0.04, 0, acc);
  b.box(w * 0.7, 0.02, d * 0.7, 0, H + 0.16, 0, band);
  b.cyl(0.006, 0.3, w * 0.15, H + 0.18, 0, '#888', 6);
  b.blink(w * 0.15, H + 0.48, 0);
  addACUnit(b, -w * 0.3, H + 0.04, d * 0.3);
  b.pop();
  return b;
}

function slabTower(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  const wall = pick(rng, ['#eae6dc', '#dcdcd6', '#e3d9c9']), rail = '#bcd6e4', band = '#ffffff';
  const floors = 12 + Math.floor(rng() * 5), fh = 0.19, w = 0.8, d = 0.38, H0 = 0.08;
  b.box(0.92, 0.08, 0.6, 0, 0.02, 0, '#bdb6a8');
  b.push(0, 0.02, 0);
  b.box(w, floors * fh, d, 0, H0, 0, wall);
  for (let f = 0; f < floors; f++) {
    const y = H0 + f * fh;
    for (const s of [0, 2]) {
      b.push(0, 0, 0, s * Math.PI / 2);
      b.box(w + 0.02, 0.014, 0.08, 0, y, d / 2 + 0.04, band);
      b.box(w + 0.02, 0.045, 0.005, 0, y + 0.014, d / 2 + 0.078, rail, 'glass');
      for (let i = 0; i < 5; i++) win(b, rng, -w / 2 + 0.08 + i * (w - 0.16) / 4, y + 0.03, d / 2, 0.1, 0.13, { lit: 0.55, glass: PAL.glassTower });
      b.pop();
    }
    for (const s of [1, 3]) {
      b.push(0, 0, 0, s * Math.PI / 2);
      win(b, rng, 0, y + 0.04, w / 2, 0.06, 0.11, { lit: 0.4, glass: PAL.glassTower });
      b.pop();
    }
  }
  const H = H0 + floors * fh;
  b.box(w + 0.04, 0.03, d + 0.04, 0, H, 0, band);
  // 屋顶构架
  for (const x of [-0.3, 0, 0.3]) b.box(0.02, 0.16, 0.02, x, H + 0.03, d / 2 - 0.02, '#777');
  b.box(0.64, 0.02, 0.02, 0, H + 0.19, d / 2 - 0.02, '#777');
  b.box(0.2, 0.1, 0.2, -0.2, H + 0.03, 0, wall);
  b.blink(0.3, H + 0.2, d / 2 - 0.02);
  b.pop();
  addTree(b, -0.4, 0.4, 1.0, rng);
  addTree(b, 0.4, 0.4, 1.0, rng);
  addTree(b, -0.4, -0.4, 1.0, rng);
  return b;
}

function octTower(rng, glassy = false) {
  const b = new Builder();
  lot(b, PAL.pave);
  b.cyl(0.46, 0.006, 0, 0.02, 0, pick(rng, PAL.grass), 24);
  const floors = 16 + Math.floor(rng() * 6), fh = 0.19, R = 0.34, seg = glassy ? 12 : 8;
  const slab = glassy ? '#d9dde2' : pick(rng, ['#f2efe8', '#e2ddd2']);
  const gc = glassy ? '#4f7393' : PAL.glassTower;
  b.cyl(0.42, 0.2, 0, 0.02, 0, '#cbc4b6', seg);
  const H0 = 0.22;
  const apo = R * Math.cos(Math.PI / seg);
  const fw = 2 * R * Math.sin(Math.PI / seg);
  b.cyl(R * 0.85, floors * fh, 0, H0, 0, '#6b747c', seg);
  for (let f = 0; f < floors; f++) {
    const y = H0 + f * fh;
    b.add(cylSlab(seg), slab, 'body', 0, y, 0, 0, Math.PI / seg, 0, R + 0.025, 0.022, R + 0.025);
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      b.push(0, 0, 0, a);
      b.quad(fw * 0.96, fh - 0.03, 0, y + 0.022 + (fh - 0.03) / 2, apo, gc, rng() < 0.55 ? 'lit' : 'glass');
      b.pop();
    }
  }
  const H = H0 + floors * fh;
  b.add(cylSlab(seg), slab, 'body', 0, H, 0, 0, Math.PI / seg, 0, R + 0.03, 0.05, R + 0.03);
  if (glassy) {
    // 停机坪
    b.cyl(0.3, 0.03, 0, H + 0.05, 0, '#3b3f44', 24);
    b.cyl(0.24, 0.004, 0, H + 0.08, 0, '#e8c33a', 24);
    b.cyl(0.22, 0.005, 0, H + 0.08, 0, '#3b3f44', 24);
    b.box(0.03, 0.006, 0.18, -0.06, H + 0.081, 0, '#fff');
    b.box(0.03, 0.006, 0.18, 0.06, H + 0.081, 0, '#fff');
    b.box(0.1, 0.006, 0.03, 0, H + 0.081, 0, '#fff');
    b.blink(0.28, H + 0.09, 0);
    b.blink(-0.28, H + 0.09, 0);
  } else {
    b.cyl(R * 0.6, 0.2, 0, H + 0.05, 0, slab, seg, 'body', 0.7);
    b.cyl(0.008, 0.45, 0, H + 0.25, 0, '#999', 6);
    b.blink(0, H + 0.7, 0);
  }
  return b;
}
const slabCache = {};
function cylSlab(seg) {
  // 单位圆柱（底部为 0）
  if (!slabCache[seg]) {
    const b = new Builder();
    b.cyl(1, 1, 0, 0, 0, '#fff', seg);
    slabCache[seg] = b.build().body;
    slabCache[seg].deleteAttribute('color');
  }
  return slabCache[seg];
}

// ============ 商业 C ============
function awning(b, rng, w, y, z, c1) {
  const n = Math.max(4, Math.round(w / 0.05));
  const sw = w / n;
  for (let i = 0; i < n; i++) b.box(sw, 0.006, 0.12, -w / 2 + sw * (i + 0.5), y, z, i % 2 ? '#f6f3ea' : c1, 'body', 0, 0.45);
}

function shop(rng, twoStory) {
  const b = new Builder();
  lot(b, PAL.pave);
  const wall = pick(rng, [...BRICK, ...MIDS]), acc = pick(rng, ACCENT), trim = '#f2efe8';
  const w = 0.84, d = 0.56, H = twoStory ? 0.5 : 0.3;
  b.push(0, 0.02, -0.12);
  b.box(w, H, d, 0, 0, 0, wall);
  b.box(w + 0.02, 0.03, d + 0.02, 0, H, 0, trim);
  // 橱窗
  b.box(w - 0.04, 0.2, 0.01, 0, 0.0, d / 2, '#2d3034');
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.11 + i * (w - 0.22) / 3;
    if (i === 1) { b.quad(0.1, 0.16, x, 0.085, d / 2 + 0.008, PAL.glassTower, 'lit'); continue; }
    b.quad(0.16, 0.15, x, 0.095, d / 2 + 0.008, PAL.glassTower, rng() < 0.85 ? 'lit' : 'glass');
  }
  awning(b, rng, w - 0.06, 0.19, d / 2 + 0.005, acc);
  // 招牌
  b.box(w * 0.6, 0.06, 0.02, 0, 0.21 + (twoStory ? 0.0 : 0.02), d / 2 + 0.01, acc);
  for (let i = 0; i < 5; i++) b.box(0.035, 0.03, 0.005, -0.1 + i * 0.05, 0.225 + (twoStory ? 0 : 0.02), d / 2 + 0.022, '#fffbe8', 'glow');
  if (twoStory) {
    for (let i = 0; i < 3; i++) win(b, rng, -0.26 + i * 0.26, 0.32, d / 2, 0.1, 0.11, { frame: trim, sill: trim });
    facades(b, w, d, (s, fw, fd) => windowRows(b, rng, fw, fd, 0.3, 1, 0.2, 2, 0.08, 0.1, { frame: trim }), [1, 3]);
  }
  addACUnit(b, -0.2, H + 0.03, -0.1);
  addACUnit(b, 0.15, H + 0.03, -0.05, 1.3);
  b.pop();
  // 花箱
  for (const x of [-0.38, 0.38]) {
    b.box(0.12, 0.04, 0.05, x, 0.02, 0.38, '#7a6a5a');
    addBush(b, x - 0.03, 0.39, 0.8, pick(rng, FLOWERS));
    addBush(b, x + 0.03, 0.39, 0.8, pick(rng, PAL.leaf));
  }
  addBench(b, 0, 0.4, Math.PI);
  return b;
}

function cafe(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  b.box(0.9, 0.004, 0.5, 0, 0.02, 0.2, '#b99c7e');
  const wall = pick(rng, ['#f1e3c8', '#e9d3c0', '#dfe8e0']), acc = pick(rng, ACCENT);
  b.push(0, 0.02, -0.25);
  b.box(0.7, 0.3, 0.4, 0, 0, 0, wall);
  b.box(0.74, 0.025, 0.44, 0, 0.3, 0, '#5a4a3e');
  b.quad(0.5, 0.17, 0, 0.1, 0.206, PAL.glassTower, 'lit');
  for (let i = 0; i < 4; i++) b.box(0.008, 0.17, 0.01, -0.25 + i * (0.5 / 3), 0.015, 0.205, '#3d3d3d');
  awning(b, rng, 0.66, 0.2, 0.205, acc);
  b.box(0.3, 0.05, 0.02, 0, 0.24, 0.21, '#3a2a20');
  for (let i = 0; i < 4; i++) b.box(0.035, 0.025, 0.005, -0.075 + i * 0.05, 0.252, 0.222, '#ffe8a8', 'glow');
  addACUnit(b, 0.2, 0.325, -0.05);
  b.pop();
  // 户外座位
  const tables = [[-0.28, 0.12], [0.02, 0.18], [0.3, 0.1], [-0.12, 0.36], [0.2, 0.36]];
  for (const [x, z] of tables) {
    b.cyl(0.04, 0.005, x, 0.08, z, '#f4f4f0', 12);
    b.cyl(0.004, 0.06, x, 0.02, z, '#555', 6);
    for (const a of [0, Math.PI]) b.box(0.03, 0.035, 0.03, x + Math.cos(a) * 0.065, 0.02, z + Math.sin(a) * 0.065, '#8a5a35');
    b.cyl(0.004, 0.18, x, 0.02, z, '#666', 6);
    b.cone(0.1, 0.05, x, 0.18, z, rng() < 0.5 ? acc : '#f6f3ea', 8);
  }
  for (const x of [-0.44, 0.44]) {
    b.box(0.04, 0.05, 0.45, x, 0.02, 0.2, '#6d5a48');
    for (let i = 0; i < 4; i++) addBush(b, x, 0.02 + i * 0.12, 0.9, pick(rng, i % 2 ? FLOWERS : PAL.leaf));
  }
  return b;
}

function convenience(rng) {
  const b = new Builder();
  lot(b, PAL.asphalt);
  const acc = pick(rng, ACCENT);
  for (let i = 0; i < 5; i++) b.box(0.008, 0.002, 0.16, -0.3 + i * 0.15, 0.02, 0.3, '#f0f0f0');
  b.push(0, 0.02, -0.22);
  b.box(0.86, 0.26, 0.46, 0, 0, 0, '#ecebe7');
  b.box(0.88, 0.05, 0.48, 0, 0.26, 0, acc);
  b.quad(0.7, 0.17, 0, 0.1, 0.236, PAL.glassTower, 'lit');
  for (let i = 0; i < 6; i++) b.box(0.008, 0.17, 0.01, -0.35 + i * 0.14, 0.015, 0.235, '#999');
  for (let i = 0; i < 7; i++) b.box(0.05, 0.03, 0.005, -0.25 + i * 0.08, 0.27, 0.242, '#ffffff', 'glow');
  addACUnit(b, -0.2, 0.31, -0.05);
  addACUnit(b, 0.0, 0.31, -0.05);
  b.pop();
  addCar(b, -0.225, 0.3, 0, randomCarColor(rng));
  if (rng() < 0.7) addCar(b, 0.225, 0.3, 0, randomCarColor(rng), 1);
  // 立牌
  b.cyl(0.012, 0.42, 0.42, 0.02, 0.42, '#777', 8);
  b.box(0.06, 0.12, 0.14, 0.42, 0.4, 0.42, acc);
  b.box(0.064, 0.08, 0.1, 0.42, 0.42, 0.42, '#ffffff', 'glow');
  return b;
}

function office(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  const spand = pick(rng, ['#d5d6d6', '#c3b9a8', '#9aa3ab', '#e4e0d8']), gc = pick(rng, ['#5d7d99', '#4d7a7f', '#6a7f96']);
  const floors = 6 + Math.floor(rng() * 4), fh = 0.19, w = 0.78, d = 0.68, H0 = 0.24;
  b.push(0, 0.02, -0.03);
  b.box(w, H0, d, 0, 0, 0, '#3b4148');
  facades(b, w, d, (s, fw, fd) => {
    for (let i = 0; i < 4; i++) b.quad(fw / 4 - 0.02, H0 - 0.04, -fw / 2 + fw / 8 + i * fw / 4, H0 / 2, fd + 0.004, gc, 'lit');
  });
  b.box(0.3, 0.015, 0.12, 0, H0 - 0.04, d / 2 + 0.06, '#e6e6e6');
  b.box(w, floors * fh, d, 0, H0, 0, spand);
  for (let f = 0; f < floors; f++) {
    const y = H0 + f * fh;
    facades(b, w, d, (s, fw, fd) => {
      const cols = s % 2 ? 4 : 5;
      for (let i = 0; i < cols; i++) b.quad(fw / cols - 0.012, fh * 0.6, -fw / 2 + (fw / cols) * (i + 0.5), y + fh * 0.55, fd + 0.004, gc, rng() < 0.65 ? 'lit' : 'glass');
      for (let i = 1; i < cols; i++) b.box(0.008, fh * 0.62, 0.014, -fw / 2 + (fw / cols) * i, y + fh * 0.24, fd, '#cfd3d6');
    });
  }
  const H = H0 + floors * fh;
  b.box(w + 0.02, 0.04, d + 0.02, 0, H, 0, spand);
  b.box(0.3, 0.14, 0.26, 0.15, H + 0.04, -0.1, '#9ea4aa');
  for (let i = 0; i < 3; i++) addACUnit(b, -0.25 + i * 0.1, H + 0.04, 0.18);
  b.cyl(0.006, 0.25, -0.25, H + 0.04, -0.2, '#888', 6);
  b.blink(-0.25, H + 0.29, -0.2);
  b.pop();
  return b;
}

function deptStore(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  const wall = pick(rng, ['#e8e0d0', '#d8d0c4', '#efe8e0', '#c9d1d6']), acc = pick(rng, ACCENT);
  const w = 0.88, d = 0.78, H = 0.95;
  b.push(0, 0.02, -0.06);
  b.box(w, H, d, 0, 0, 0, wall);
  b.box(w + 0.02, 0.04, d + 0.02, 0, H, 0, '#fafafa');
  // 底层橱窗与雨棚
  b.quad(w - 0.06, 0.18, 0, 0.11, d / 2 + 0.004, PAL.glassTower, 'lit');
  b.box(w, 0.018, 0.12, 0, 0.23, d / 2 + 0.06, acc);
  // 横条窗
  facades(b, w, d, (s, fw, fd) => {
    for (const y of [0.42, 0.66]) {
      b.box(fw - 0.1, 0.1, 0.01, 0, y, fd, '#cdd3d8');
      b.quad(fw - 0.12, 0.08, 0, y + 0.05, fd + 0.006, PAL.glassTower, rng() < 0.6 ? 'lit' : 'glass');
    }
  });
  // 竖向招牌
  b.box(0.1, 0.6, 0.03, w / 2 - 0.1, 0.3, d / 2 + 0.02, acc);
  for (let i = 0; i < 5; i++) b.box(0.06, 0.07, 0.006, w / 2 - 0.1, 0.33 + i * 0.11, d / 2 + 0.036, '#fff6dc', 'glow');
  // 屋顶广告牌
  for (const x of [-0.25, 0.25]) b.box(0.015, 0.18, 0.015, x, H + 0.04, 0, '#666');
  b.box(0.7, 0.2, 0.02, 0, H + 0.2, 0, pick(rng, ACCENT));
  b.box(0.6, 0.12, 0.005, 0, H + 0.24, 0.012, '#ffffff', 'glow');
  addACUnit(b, -0.3, H + 0.04, -0.25, 1.4);
  addACUnit(b, 0.2, H + 0.04, -0.25, 1.4);
  b.pop();
  return b;
}

function hotel(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  const wall = pick(rng, ['#efe9df', '#e1d8c8', '#d6dde3']), fin = pick(rng, ['#b59a74', '#7f8c99', '#a87760']);
  const floors = 9 + Math.floor(rng() * 3), fh = 0.19, w = 0.8, d = 0.42, H0 = 0.22;
  b.push(0, 0.02, -0.12);
  b.box(0.9, H0, 0.66, 0, 0, 0.08, '#3f454c');
  b.quad(0.84, 0.16, 0, 0.1, 0.413, PAL.glassTower, 'lit');
  b.box(0.4, 0.018, 0.22, 0, H0 - 0.03, 0.5, '#f2f2f2');
  for (const x of [-0.18, 0.18]) b.cyl(0.01, H0 - 0.03, x, 0, 0.58, '#ddd', 8);
  b.box(w, floors * fh, d, 0, H0, 0, wall);
  for (let f = 0; f < floors; f++) {
    const y = H0 + f * fh;
    facades(b, w, d, (s, fw, fd) => {
      const cols = s % 2 ? 2 : 6;
      for (let i = 0; i < cols; i++) win(b, rng, -fw / 2 + (fw / cols) * (i + 0.5), y + 0.04, fd, fw / cols - 0.05, 0.12, { lit: 0.6, glass: PAL.glassTower });
    });
  }
  for (let i = 0; i <= 6; i++) for (const s of [1, -1]) b.box(0.012, floors * fh, 0.04, -w / 2 + i * (w / 6), H0, s * (d / 2 + 0.02), fin);
  const H = H0 + floors * fh;
  b.box(w + 0.03, 0.04, d + 0.03, 0, H, 0, fin);
  b.box(0.5, 0.12, 0.02, 0, H + 0.04, d / 2 - 0.02, '#2c2f33');
  b.box(0.42, 0.07, 0.006, 0, H + 0.065, d / 2 - 0.006, '#ffe3a0', 'glow');
  b.pop();
  return b;
}

function setbackTower(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  const gc = pick(rng, ['#4f7393', '#5a7f8f', '#3f5f80', '#607590']), fr = pick(rng, ['#c8ccd0', '#9ea6ad', '#d9d3c4']);
  const tiers = [[0.82, 9], [0.66, 9], [0.5, 7]];
  let y = 0.02, fh = 0.19;
  b.box(0.9, 0.04, 0.9, 0, 0.02, 0, '#b4aea2');
  y = 0.06;
  for (const [s, n] of tiers) {
    b.box(s - 0.04, n * fh, s - 0.04, 0, y, 0, '#3a434c');
    for (let f = 0; f < n; f++) {
      const yy = y + f * fh;
      b.box(s, 0.025, s, 0, yy, 0, fr);
      facades(b, s - 0.04, s - 0.04, (side, fw, fd) => {
        const cols = Math.round(fw / 0.12);
        for (let i = 0; i < cols; i++) b.quad(fw / cols - 0.01, fh - 0.03, -fw / 2 + (fw / cols) * (i + 0.5), yy + 0.025 + (fh - 0.03) / 2, fd + 0.003, gc, rng() < 0.7 ? 'lit' : 'glass');
        for (const sx of [-1, 1]) b.box(0.02, fh, 0.02, sx * (fw / 2 - 0.01), yy, fd, fr);
      });
    }
    y += n * fh;
    b.box(s + 0.02, 0.04, s + 0.02, 0, y, 0, fr);
    y += 0.04;
  }
  b.box(0.3, 0.2, 0.3, 0, y, 0, fr);
  b.cyl(0.03, 0.12, 0, y + 0.2, 0, '#9aa', 8);
  b.cyl(0.012, 0.7, 0, y + 0.32, 0, '#ccd', 6, 'body', 0.3);
  b.blink(0, y + 1.02, 0);
  return b;
}

function twistTower(rng) {
  const b = new Builder();
  lot(b, PAL.pave);
  b.box(0.9, 0.04, 0.9, 0, 0.02, 0, '#bdb7ab');
  const gc = pick(rng, ['#5b8fb0', '#4c7c9e', '#67869e']), slab = '#e8ecef';
  const floors = 24 + Math.floor(rng() * 6), fh = 0.19, s = 0.52, twist = (Math.PI / 2) / floors;
  let y = 0.06;
  b.cyl(0.18, floors * fh, 0, y, 0, '#4a525a', 8);
  for (let f = 0; f < floors; f++) {
    b.push(0, y, 0, f * twist);
    b.box(s + 0.04, 0.022, s + 0.04, 0, 0, 0, slab);
    facades(b, s, s, (side, fw, fd) => {
      for (let i = 0; i < 4; i++) b.quad(fw / 4 - 0.008, fh - 0.026, -fw / 2 + (fw / 4) * (i + 0.5), 0.022 + (fh - 0.022) / 2, fd, gc, rng() < 0.65 ? 'lit' : 'glass');
    });
    b.pop();
    y += fh;
  }
  b.push(0, y, 0, floors * twist);
  b.box(s + 0.06, 0.05, s + 0.06, 0, 0, 0, slab);
  b.box(0.3, 0.14, 0.3, 0, 0.05, 0, '#3a424a');
  b.box(0.36, 0.02, 0.36, 0, 0.19, 0, slab);
  b.cyl(0.01, 0.5, 0, 0.21, 0, '#bbb', 6, 'body', 0.4);
  b.blink(0, 0.72, 0);
  b.pop();
  return b;
}

// ============ 工业 I ============
function corrugated(b, w, h, d, x, y, z, color, rib) {
  b.box(w, h, d, x, y, z, color);
  facades(b, w, d, (s, fw, fd) => {
    const n = Math.round(fw / 0.045);
    for (let i = 1; i < n; i++) b.box(0.008, h, 0.006, -fw / 2 + (fw / n) * i, 0, fd, rib);
  }, [1, 2, 3]);
}

function chimney(b, x, y, z, h, r = 0.045) {
  const bands = 6;
  for (let i = 0; i < bands; i++) b.cyl(r * (1 - i * 0.04), h / bands, x, y + (h / bands) * i, z, i % 2 ? '#d64a3a' : '#f0eee8', 14, 'body', 0.96);
  b.cyl(r * 0.8, 0.012, x, y + h, z, '#333', 14);
  b.emitter(x, y + h + 0.02, z, 1);
}

function tank(b, x, y, z, r, h, color = '#dcdcd8') {
  b.cyl(r, h, x, y, z, color, 16);
  b.sphere(r, x, y + h, z, color, 2, 'body', 0.35);
  b.box(0.008, h, 0.008, x + r, y, z, '#777');
}

function warehouse(rng) {
  const b = new Builder();
  lot(b, '#8d9096');
  for (let i = 0; i < 4; i++) b.box(0.006, 0.002, 0.12, -0.35 + i * 0.1, 0.02, 0.38, '#e8c33a');
  const wall = pick(rng, ['#b8bfc5', '#c9b99f', '#9fb3c0', '#c7c2b8']), rib = '#8f969c', roof = pick(rng, ['#6d737a', '#7a5a4a', '#5d6d7a']);
  b.push(0, 0.02, -0.1);
  corrugated(b, 0.8, 0.3, 0.56, 0, 0, 0, wall, rib);
  b.gableRoof(0.84, 0.6, 0.08, 0, 0.3, 0, wall, roof, Math.PI / 2, 0.01);
  b.box(0.82, 0.05, 0.12, 0, 0, 0.34, '#9a9a96');
  for (const x of [-0.24, 0.0, 0.24]) {
    b.box(0.16, 0.17, 0.01, x, 0.05, 0.28, '#e0ded8');
    for (let i = 1; i < 6; i++) b.box(0.16, 0.003, 0.012, x, 0.05 + i * 0.028, 0.28, '#b9b6af');
  }
  b.box(0.18, 0.12, 0.14, -0.31, 0.3, 0.1, '#e9e6df');
  win(b, rng, -0.31, 0.34, 0.17, 0.12, 0.05, { lit: 0.6 });
  b.pop();
  addCar(b, 0.24, 0.32, Math.PI, pick(rng, ACCENT), 2);
  for (let i = 0; i < 3; i++) {
    b.box(0.08, 0.012, 0.08, -0.38 + i * 0.1, 0.02, 0.4, '#a77d4e');
    b.box(0.07, 0.06, 0.07, -0.38 + i * 0.1, 0.032, 0.4, '#c49a64');
  }
  return b;
}

function containerYard(rng) {
  const b = new Builder();
  lot(b, '#9a9c9e');
  const cc = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#5d6d7e', '#ca6f1e'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const col = pick(rng, cc), x = -0.22 + c * 0.32, z = -0.32 + r * 0.14, y = 0.02 + k * 0.105;
      b.box(0.3, 0.1, 0.11, x, y, z, col);
      for (let i = 1; i < 8; i++) b.box(0.004, 0.1, 0.115, x - 0.15 + i * 0.0375, y, z, shade(col, 0.78));
    }
  }
  // 龙门吊
  const yc = '#e8b52f';
  for (const x of [-0.42, 0.36]) for (const z of [-0.42, 0.12]) b.box(0.03, 0.5, 0.03, x, 0.02, z, yc);
  for (const z of [-0.42, 0.12]) b.box(0.82, 0.04, 0.03, -0.03, 0.5, z, yc);
  b.box(0.08, 0.06, 0.6, 0.05, 0.47, -0.15, yc);
  b.box(0.004, 0.18, 0.004, 0.05, 0.3, -0.15, '#333');
  // 办公室
  b.box(0.24, 0.16, 0.14, 0.28, 0.02, 0.36, '#e6e3dc');
  win(b, rng, 0.28, 0.08, 0.43, 0.16, 0.05, { lit: 0.7 });
  addCar(b, -0.2, 0.34, Math.PI / 2, pick(rng, ACCENT), 2);
  return b;
}

function sawtooth(b, rng, w, d, h, x, y, z, wall, n = 4) {
  b.box(w, h, d, x, y, z, wall);
  const sw = d / n;
  for (let i = 0; i < n; i++) {
    const zz = z - d / 2 + sw * (i + 0.5);
    b.prism(sw, 0.09, w, x, y + h, zz, '#7a8088', Math.PI / 2, sw / 2);
    b.push(x, y + h, zz + sw / 2 - 0.002, 0);
    b.quad(w - 0.02, 0.08, 0, 0.045, 0, '#9fb8c8', rng() < 0.5 ? 'lit' : 'glass');
    b.pop();
  }
}

function workshop(rng) {
  const b = new Builder();
  lot(b, '#8f9295');
  const wall = pick(rng, ['#c9c2b4', '#b7c0c4', '#cbb8a0']);
  sawtooth(b, rng, 0.78, 0.56, 0.24, 0, 0.02, -0.1, wall, 4);
  b.box(0.2, 0.17, 0.01, -0.15, 0.02, 0.18, '#d8d6d0');
  b.box(0.12, 0.13, 0.01, 0.2, 0.02, 0.18, '#d8d6d0');
  chimney(b, 0.3, 0.02, -0.3, 0.55, 0.03);
  for (let i = 0; i < 5; i++) b.cyl(0.03, 0.07, -0.35 + i * 0.07, 0.02, 0.36, pick(rng, ['#2e86c1', '#c0392b', '#2e2e2e']), 10);
  addCar(b, 0.2, 0.34, 0, pick(rng, ACCENT), 2);
  return b;
}

function factory(rng) {
  const b = new Builder();
  lot(b, '#878a8e');
  const wall = pick(rng, ['#bcb4a6', '#a9b3b8', '#c4b49a']);
  sawtooth(b, rng, 0.7, 0.5, 0.32, -0.1, 0.02, 0.05, wall, 4);
  b.box(0.22, 0.2, 0.01, -0.1, 0.02, 0.305, '#d0cec8');
  for (let i = 1; i < 7; i++) b.box(0.22, 0.003, 0.012, -0.1, 0.02 + i * 0.028, 0.305, '#aaa');
  chimney(b, 0.34, 0.02, -0.32, 1.15, 0.05);
  tank(b, 0.34, 0.02, 0.12, 0.09, 0.22);
  tank(b, 0.34, 0.02, 0.34, 0.07, 0.16, '#c8d0d4');
  // 管道
  b.box(0.3, 0.02, 0.02, 0.15, 0.25, -0.32, '#8a8f94');
  b.box(0.02, 0.02, 0.4, 0.27, 0.22, -0.1, '#8a8f94');
  b.box(0.5, 0.012, 0.18, -0.15, 0.02, -0.36, '#7d7f82');
  return b;
}

function silos(rng) {
  const b = new Builder();
  lot(b, '#8c8f92');
  const wall = pick(rng, ['#d6d0c4', '#c0c8cc']);
  b.box(0.36, 0.8, 0.4, -0.25, 0.02, -0.1, wall);
  for (let f = 0; f < 4; f++) b.box(0.3, 0.05, 0.005, -0.25, 0.15 + f * 0.17, 0.101, PAL.glassTower, f % 2 ? 'glass' : 'lit');
  b.box(0.38, 0.04, 0.42, -0.25, 0.82, -0.1, '#8f8a80');
  for (let i = 0; i < 3; i++) {
    const x = 0.06 + i * 0.13;
    b.cyl(0.065, 0.75, x, 0.02, -0.2, '#e4e1da', 16);
    b.cone(0.065, 0.06, x, 0.77, -0.2, '#b9b5ad', 16);
  }
  b.box(0.42, 0.04, 0.05, 0.19, 0.78, -0.2, '#888');
  b.box(0.04, 0.04, 0.7, 0.32, 0.12, 0.15, '#6f7378', 'body', 0, -0.55);
  chimney(b, -0.36, 0.84, -0.22, 0.35, 0.03);
  addCar(b, 0.15, 0.3, 0, pick(rng, ACCENT), 2);
  return b;
}

function chemical(rng) {
  const b = new Builder();
  lot(b, '#8a8d90');
  for (const [x, z] of [[-0.25, -0.22], [0.05, -0.22], [-0.25, 0.1]]) {
    for (const [dx, dz] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) b.box(0.012, 0.13, 0.012, x + dx, 0.02, z + dz, '#666');
    b.sphere(0.12, x, 0.25, z, '#ecebe6', 2);
  }
  // 管廊
  for (let i = 0; i < 4; i++) b.box(0.015, 0.2, 0.015, 0.3, 0.02, -0.35 + i * 0.2, '#555');
  for (const y of [0.18, 0.22]) b.box(0.03, 0.02, 0.65, 0.3, y, -0.05, pick(rng, ['#c0392b', '#2471a3', '#e0b030']));
  b.box(0.25, 0.02, 0.02, 0.18, 0.2, -0.22, '#9a9a9a');
  chimney(b, 0.2, 0.02, 0.3, 0.9, 0.035);
  b.box(0.22, 0.16, 0.16, -0.05, 0.02, 0.32, '#dedad2');
  win(b, rng, -0.05, 0.08, 0.4, 0.15, 0.05, { lit: 0.7 });
  return b;
}

function refinery(rng) {
  const b = new Builder();
  lot(b, '#86898c');
  for (const [x, z] of [[-0.28, -0.26], [0.02, -0.28], [-0.28, 0.06]]) tank(b, x, 0.02, z, 0.13, 0.2, '#e8e6e0');
  // 分馏塔
  for (const [x, z, h] of [[0.28, -0.05, 1.1], [0.18, 0.22, 0.8]]) {
    b.cyl(0.05, h, x, 0.02, z, '#c9ccd0', 14);
    for (let y = 0.2; y < h; y += 0.22) b.cyl(0.075, 0.01, x, y, z, '#555', 14);
    b.cyl(0.035, 0.05, x, h + 0.02, z, '#888', 10);
  }
  for (let i = 0; i < 4; i++) b.box(0.015, 0.22, 0.015, -0.05 + i * 0.1, 0.02, 0.3, '#555');
  b.box(0.36, 0.03, 0.04, 0.1, 0.22, 0.3, '#2471a3');
  b.box(0.36, 0.03, 0.04, 0.1, 0.26, 0.3, '#c0392b');
  chimney(b, -0.05, 0.02, 0.12, 1.3, 0.04);
  b.emitter(0.28, 1.15, -0.05, 0.6);
  return b;
}

function heavyPlant(rng) {
  const b = new Builder();
  lot(b, '#85888b');
  const wall = pick(rng, ['#9da7ad', '#b0a594', '#a4a8a0']);
  corrugated(b, 0.62, 0.55, 0.6, -0.12, 0.02, 0.0, wall, '#7f878c');
  b.box(0.66, 0.04, 0.64, -0.12, 0.57, 0, '#5d6268');
  for (let i = 0; i < 3; i++) {
    b.cyl(0.05, 0.05, -0.3 + i * 0.18, 0.61, -0.1, '#9aa0a6', 12);
    b.cyl(0.04, 0.005, -0.3 + i * 0.18, 0.66, -0.1, '#333', 12);
  }
  b.box(0.3, 0.26, 0.012, -0.12, 0.02, 0.3, '#cfcdc6');
  chimney(b, 0.32, 0.02, -0.3, 1.55, 0.055);
  chimney(b, 0.32, 0.02, 0.05, 1.3, 0.05);
  b.box(0.04, 0.04, 0.5, 0.32, 0.4, 0.3, '#666', 'body', 0, -0.4);
  addCar(b, 0.3, 0.36, 0, pick(rng, ACCENT), 2);
  return b;
}

// ============ 生成全部变体 ============
const RECIPES = {
  R1: [(r) => house(r, 0), (r) => house(r, 1), (r) => house(r, 2), (r) => house(r, 3), (r) => modernHouse(r), (r) => house(r, 5)],
  R2: [apartment, townhouses, brickBlock, apartment],
  R3: [residentialTower, slabTower, (r) => octTower(r, false)],
  C1: [(r) => shop(r, false), (r) => shop(r, true), cafe, convenience],
  C2: [office, deptStore, hotel],
  C3: [setbackTower, twistTower, (r) => octTower(r, true)],
  I1: [warehouse, containerYard, workshop],
  I2: [factory, silos, chemical],
  I3: [refinery, heavyPlant],
};
const COPIES = { R1: 2, R2: 1, R3: 2, C1: 2, C2: 2, C3: 1, I1: 1, I2: 1, I3: 1 };

export function buildZoneVariants() {
  const out = {};
  let seed = 1000;
  for (const key in RECIPES) {
    out[key] = [];
    for (let c = 0; c < COPIES[key]; c++) {
      RECIPES[key].forEach((fn, i) => {
        const rng = mulberry32(seed++ * 7919 + i);
        const b = fn(rng);
        const res = b.build();
        res.key = `${key}_${c}_${i}`;
        out[key].push(res);
      });
    }
  }
  return out;
}
