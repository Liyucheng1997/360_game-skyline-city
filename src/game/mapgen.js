// 地形数据：河流、湖泊、森林（城市状态与地形网格共用）
import { MAP, ENTRANCE } from '../core/config.js';
import { fbm, tileToWorld, mulberry32 } from '../core/utils.js';

export function riverCenter(z) {
  return 17 + 4 * Math.sin(z * 0.07 + 1.3) + 2.2 * Math.sin(z * 0.19 + 0.4);
}
export function riverHalfWidth(z) {
  return 1.7 + 0.6 * Math.sin(z * 0.11 + 2.0);
}
export const LAKE = { x: -16, z: 17, r: 4.8 };

// 到水边的有符号距离（负值在水中）
export function waterDist(x, z) {
  const dr = Math.abs(x - riverCenter(z)) - riverHalfWidth(z);
  const lx = x - LAKE.x, lz = z - LAKE.z;
  const ang = Math.atan2(lz, lx);
  const lr = LAKE.r * (1 + 0.18 * Math.sin(ang * 3 + 1) + 0.1 * Math.sin(ang * 5));
  const dl = Math.hypot(lx, lz) - lr;
  return Math.min(dr, dl);
}

export function isWaterTile(tx, tz) {
  return waterDist(tileToWorld(tx), tileToWorld(tz)) < 0;
}

// 每格树木数量（0~3）
export function generateTrees(water, seed = 7) {
  const rng = mulberry32(seed);
  const trees = new Uint8Array(MAP * MAP);
  for (let z = 0; z < MAP; z++) {
    for (let x = 0; x < MAP; x++) {
      const i = z * MAP + x;
      if (water[i]) continue;
      // 入口附近留出空地
      const de = Math.hypot(x - ENTRANCE.x - 8, z - ENTRANCE.z);
      if (de < 7) continue;
      const n = fbm(x * 0.07 + 3.1, z * 0.07 + 8.7, 4);
      const wd = waterDist(tileToWorld(x), tileToWorld(z));
      let p = (n - 0.48) * 4;
      if (wd < 3 && wd > 0) p += 0.35;
      if (rng() < p) trees[i] = 1 + Math.floor(rng() * 3);
      else if (rng() < 0.015) trees[i] = 1;
    }
  }
  return trees;
}
