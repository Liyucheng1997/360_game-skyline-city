// 地形网格：可建造区域 + 外围山地、装饰树木与场外高速
import * as THREE from 'three';
import { MAP, HALF, ENTRANCE } from '../core/config.js';
import { fbm, smoothstep, clamp, mulberry32, tileToWorld } from '../core/utils.js';
import { waterDist, riverCenter, riverHalfWidth } from '../game/mapgen.js';
import { Builder } from '../core/builder.js';
import { treeGeometries } from '../models/props.js';
import { MAT } from '../core/builder.js';

const C = (h) => new THREE.Color(h);
const GRASS_A = C('#5a8a36'), GRASS_B = C('#76a446'), GRASS_DRY = C('#949a4e');
const SAND = C('#d8c792'), BED = C('#9b8a64'), DEEP = C('#5f5a48');
const ROCK = C('#7a756b'), SNOW = C('#f4f6f8'), FOREST = C('#41702c');

export const ENT_Z = tileToWorld(ENTRANCE.z);

export function outerHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - HALF;
  if (Math.abs(z) > HALF - 1 && Math.abs(x - riverCenter(z)) < riverHalfWidth(z)) return -0.55;
  if (d <= 0) return 0;
  let h = smoothstep(1, 40, d) * (fbm(x * 0.022 + 5, z * 0.022 + 2, 5) * 30 - 6);
  h += smoothstep(40, 170, d) * (fbm(x * 0.01, z * 0.01, 4) * 60);
  h = Math.max(h, 0) * smoothstep(0.5, 6, d);
  // 河谷
  const wr = Math.abs(x - riverCenter(z)) - riverHalfWidth(z);
  if (Math.abs(z) > HALF - 1) {
    const valley = smoothstep(0, 18, wr);
    h *= valley;
    if (wr < 0) h = -0.5 + wr * 0.05;
  }
  // 高速走廊
  if (x < -HALF + 0.5) {
    const k = smoothstep(1.2, 6, Math.abs(z - ENT_Z));
    h *= k;
  }
  return h;
}

export function buildTerrain(scene, city) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------- 内部可建造区域 ----------
  const seg = MAP * 4;
  const g = new THREE.PlaneGeometry(MAP, MAP, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const u = x + HALF, v = z + HALF;
    // 共享该顶点的格子
    const txs = [Math.floor(u)], tzs = [Math.floor(v)];
    if (Number.isInteger(Math.round(u * 1000) / 1000) && Math.abs(u - Math.round(u)) < 1e-4) txs.push(Math.round(u) - 1);
    if (Math.abs(v - Math.round(v)) < 1e-4) tzs.push(Math.round(v) - 1);
    let anyLand = false, anyWater = false;
    for (const tx of txs) for (const tz of tzs) {
      const ix = clamp(tx, 0, MAP - 1), iz = clamp(tz, 0, MAP - 1);
      if (city.water[iz * MAP + ix]) anyWater = true; else anyLand = true;
    }
    let h = 0;
    const wd = waterDist(x, z);
    if (!anyLand) h = clamp(wd * 0.45, -0.65, 0.1) - 0.1;
    pos.setY(k, h);
    if (h < -0.1) {
      c.copy(SAND).lerp(BED, clamp((-h - 0.1) / 0.12, 0, 1)).lerp(DEEP, clamp((-h - 0.2) / 0.5, 0, 1));
    } else if (anyWater) {
      c.copy(SAND);
    } else {
      const n = fbm(x * 0.12 + 11, z * 0.12 + 3, 3);
      c.copy(GRASS_A).lerp(GRASS_B, n);
      const n2 = fbm(x * 0.05 - 7, z * 0.05 + 9, 2);
      c.lerp(GRASS_DRY, smoothstep(0.62, 0.8, n2) * 0.5);
      if (wd > 0 && wd < 0.9) c.lerp(SAND, (1 - wd / 0.9) * 0.6);
      const tx = clamp(Math.floor(u), 0, MAP - 1), tz = clamp(Math.floor(v), 0, MAP - 1);
      if (city.trees[tz * MAP + tx]) c.lerp(FOREST, 0.35);
    }
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(g, groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // ---------- 外围 ----------
  const S = 560, OS = 280;
  const og = new THREE.PlaneGeometry(S, S, OS, OS);
  og.rotateX(-Math.PI / 2);
  const op = og.attributes.position;
  const ocol = new Float32Array(op.count * 3);
  for (let k = 0; k < op.count; k++) {
    const x = op.getX(k), z = op.getZ(k);
    let h;
    if (Math.abs(x) < HALF - 0.01 && Math.abs(z) < HALF - 0.01) h = -3;
    else h = outerHeight(x, z);
    op.setY(k, h);
    if (h < -0.05) c.copy(BED).lerp(DEEP, clamp(-h, 0, 1));
    else {
      const n = fbm(x * 0.06 + 1, z * 0.06 + 4, 3);
      c.copy(GRASS_A).lerp(GRASS_B, n * 0.8);
      const fn = fbm(x * 0.04 + 20, z * 0.04 - 3, 3);
      c.lerp(FOREST, smoothstep(0.5, 0.65, fn) * 0.6);
      c.lerp(ROCK, smoothstep(9, 20, h + n * 4));
      c.lerp(SNOW, smoothstep(30, 40, h + n * 6));
    }
    ocol[k * 3] = c.r; ocol[k * 3 + 1] = c.g; ocol[k * 3 + 2] = c.b;
  }
  og.setAttribute('color', new THREE.BufferAttribute(ocol, 3));
  og.computeVertexNormals();
  const outer = new THREE.Mesh(og, groundMat);
  outer.receiveShadow = true;
  group.add(outer);

  // ---------- 外围装饰树 ----------
  const rng = mulberry32(99);
  const geos = treeGeometries(0);
  const counts = [0, 0, 0];
  const mats = [[], [], []];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const colors = [[], [], []];
  for (let i = 0; i < 14000; i++) {
    const x = (rng() - 0.5) * 300, z = (rng() - 0.5) * 300;
    const d = Math.max(Math.abs(x), Math.abs(z)) - HALF;
    if (d < 0.6) continue;
    if (x < -HALF && Math.abs(z - ENT_Z) < 2.2) continue;
    const h = outerHeight(x, z);
    if (h < 0.05 || h > 22) continue;
    const fn = fbm(x * 0.04 + 20, z * 0.04 - 3, 3);
    if (rng() > smoothstep(0.42, 0.62, fn) * 0.9 + 0.04) continue;
    const kind = h > 8 || rng() < 0.4 ? 1 : rng() < 0.75 ? 0 : 2;
    const sc = 1.6 + rng() * 1.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
    m.compose(p.set(x, h - 0.05, z), q, s.set(sc, sc * (0.85 + rng() * 0.4), sc));
    mats[kind].push(m.clone());
    const tint = new THREE.Color().setHSL(0.25 + rng() * 0.08, 0.35 + rng() * 0.25, 0.42 + rng() * 0.18);
    colors[kind].push(tint.multiplyScalar(2.1));
    counts[kind]++;
  }
  for (let k = 0; k < 3; k++) {
    if (!counts[k]) continue;
    const im = new THREE.InstancedMesh(geos[k], MAT.body, counts[k]);
    mats[k].forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, colors[k][i]); });
    im.castShadow = false;
    im.receiveShadow = true;
    group.add(im);
  }

  // ---------- 场外高速 ----------
  const hb = new Builder();
  const L = 240;
  const x0 = -HALF - L / 2;
  hb.box(L, 0.025, 0.72, x0, -0.005, ENT_Z, '#45484d');
  hb.box(L, 0.04, 0.12, x0, -0.005, ENT_Z - 0.42, '#b9b4a8');
  hb.box(L, 0.04, 0.12, x0, -0.005, ENT_Z + 0.42, '#b9b4a8');
  for (let i = 0; i < L / 0.5; i++) hb.box(0.22, 0.003, 0.018, -HALF - 0.25 - i * 0.5, 0.02, ENT_Z, '#f1c84b');
  // 护栏与标牌
  hb.box(L, 0.05, 0.015, x0, 0.035, ENT_Z - 0.48, '#c9cdd1');
  hb.box(L, 0.05, 0.015, x0, 0.035, ENT_Z + 0.48, '#c9cdd1');
  const sx = -HALF - 3;
  for (const zz of [-0.5, 0.5]) hb.cyl(0.02, 0.7, sx, 0, ENT_Z + zz, '#888', 8);
  hb.box(0.04, 0.22, 1.2, sx, 0.62, ENT_Z, '#2d7a3e');
  hb.box(0.045, 0.16, 1.1, sx, 0.65, ENT_Z, '#ffffff', 'glow');
  hb.box(0.05, 0.12, 1.0, sx, 0.67, ENT_Z, '#2d7a3e');
  const hres = hb.build();
  for (const k of ['body', 'glow']) {
    if (!hres[k]) continue;
    const mm = new THREE.Mesh(hres[k], MAT[k]);
    mm.receiveShadow = true;
    group.add(mm);
  }

  return { group, ground };
}
