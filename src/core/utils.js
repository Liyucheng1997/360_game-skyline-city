import { HALF } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// 可复现随机数
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const range = (rng, a, b) => a + (b - a) * rng();

// 2D 值噪声 + 分形
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// 格子 <-> 世界坐标
export const tileToWorld = (t) => t + 0.5 - HALF;
export const worldToTile = (w) => Math.floor(w + HALF);

export const DIRS = [
  { dx: 0, dz: -1 }, // 0 北 N
  { dx: 1, dz: 0 },  // 1 东 E
  { dx: 0, dz: 1 },  // 2 南 S
  { dx: -1, dz: 0 }, // 3 西 W
];

// 模型正面朝 +Z，求让正面朝向方向 d 的 Y 轴旋转角
export const rotForDir = (d) => Math.atan2(DIRS[d].dx, DIRS[d].dz);

export function formatMoney(v) {
  const s = Math.round(Math.abs(v)).toLocaleString('en-US');
  return (v < 0 ? '-¥' : '¥') + s;
}
