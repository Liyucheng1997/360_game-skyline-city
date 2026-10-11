import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- 共享材质 ----------
export const MAT = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.65, envMapIntensity: 1.2 }),
  lit: new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.12, metalness: 0.65, envMapIntensity: 1.2,
    emissive: new THREE.Color('#ffc477'), emissiveIntensity: 0,
  }),
  glow: new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.5, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.2,
  }),
  ds: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide }),
  blink: new THREE.MeshStandardMaterial({
    color: '#550000', emissive: new THREE.Color('#ff2010'), emissiveIntensity: 2,
  }),
};

// 发光材质：自发光颜色取自顶点色（招牌、车灯、霓虹灯）
MAT.glow.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace(
    'vec3 totalEmissiveRadiance = emissive;',
    'vec3 totalEmissiveRadiance = emissive * vColor.rgb;',
  );
};

// ---------- 基础几何 ----------
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).toNonIndexed();
const PLANE = new THREE.PlaneGeometry(1, 1).toNonIndexed();
const cylCache = new Map();
function cylGeo(seg, open = false) {
  const k = seg + (open ? 'o' : '');
  if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(1, 1, 1, seg, 1, open).translate(0, 0.5, 0).toNonIndexed());
  return cylCache.get(k);
}
const coneCache = new Map();
function coneGeo(seg) {
  if (!coneCache.has(seg)) coneCache.set(seg, new THREE.ConeGeometry(1, 1, seg, 1).translate(0, 0.5, 0).toNonIndexed());
  return coneCache.get(seg);
}
const sphCache = new Map();
function sphGeo(detail) {
  if (!sphCache.has(detail)) sphCache.set(detail, new THREE.IcosahedronGeometry(1, detail).toNonIndexed());
  return sphCache.get(detail);
}

// 三角棱柱：底宽 w，高 h，沿 z 深 d，顶点 x 位置 apex（相对中心）
export function prismGeo(w, h, d, apex = 0) {
  const A = [-w / 2, 0], B = [w / 2, 0], C = [apex, h];
  const zf = d / 2, zb = -d / 2;
  const v = [];
  const P = (p, z) => v.push(p[0], p[1], z);
  // front
  P(A, zf); P(B, zf); P(C, zf);
  // back
  P(A, zb); P(C, zb); P(B, zb);
  // left slope
  P(A, zf); P(C, zf); P(C, zb);
  P(A, zf); P(C, zb); P(A, zb);
  // right slope
  P(B, zf); P(B, zb); P(C, zb);
  P(B, zf); P(C, zb); P(C, zf);
  // bottom
  P(A, zf); P(A, zb); P(B, zb);
  P(A, zf); P(B, zb); P(B, zf);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function hipRoofGeo(w, d, h) {
  const swap = d > w;
  if (swap) [w, d] = [d, w];
  const r = (w - d) / 2;
  const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
  const R1 = [-r, h, 0], R2 = [r, h, 0];
  const v = [];
  const T = (...p) => p.forEach((q) => v.push(...q));
  T(D, C, R2); T(D, R2, R1);
  T(B, A, R1); T(B, R1, R2);
  T(A, D, R1);
  T(C, B, R2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  if (swap) g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * 程序化建模工具：把各种零件合并成按材质分组的几何体。
 * 坐标约定：y 为零件底部；模型正面朝 +Z。
 */
export class Builder {
  constructor() {
    this.parts = { body: [], glass: [], lit: [], glow: [], ds: [] };
    this.emitters = [];   // 烟囱等粒子发射点
    this.blinks = [];     // 航空障碍灯
    this.stack = [new THREE.Matrix4()];
  }
  get base() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.stack.push(this.base.clone().multiply(m));
    return this;
  }
  pop() { this.stack.pop(); return this; }

  add(geo, color, key, x, y, z, rx, ry, rz, sx, sy, sz) {
    const g = geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    _m.premultiply(this.base);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    (this.parts[key] || this.parts.body).push(g);
    return this;
  }
  box(w, h, d, x, y, z, color, key = 'body', ry = 0, rx = 0, rz = 0) {
    return this.add(BOX, color, key, x, y, z, rx, ry, rz, w, h, d);
  }
  // 面朝 +Z 的四边形（中心定位）
  quad(w, h, x, y, z, color, key = 'glass', ry = 0, rx = 0) {
    return this.add(PLANE, color, key, x, y, z, rx, ry, 0, w, h, 1);
  }
  cyl(r, h, x, y, z, color, seg = 12, key = 'body', rTopScale = 1, rx = 0, rz = 0, ry = 0) {
    if (rTopScale === 1) return this.add(cylGeo(seg), color, key, x, y, z, rx, ry, rz, r, h, r);
    const g = new THREE.CylinderGeometry(r * rTopScale, r, h, seg, 1).translate(0, h / 2, 0).toNonIndexed();
    return this.add(g, color, key, x, y, z, rx, ry, rz, 1, 1, 1);
  }
  cone(r, h, x, y, z, color, seg = 8, key = 'body', ry = 0) {
    return this.add(coneGeo(seg), color, key, x, y, z, 0, ry, 0, r, h, r);
  }
  sphere(r, x, y, z, color, detail = 1, key = 'body', sy = 1) {
    return this.add(sphGeo(detail), color, key, x, y, z, 0, 0, 0, r, r * sy, r);
  }
  prism(w, h, d, x, y, z, color, ry = 0, apex = 0, key = 'body') {
    return this.add(prismGeo(w, h, d, apex), color, key, x, y, z, 0, ry, 0, 1, 1, 1);
  }
  geo(g, color, x = 0, y = 0, z = 0, ry = 0, key = 'body', rx = 0, rz = 0) {
    const gg = g.index ? g.toNonIndexed() : g;
    return this.add(gg, color, key, x, y, z, rx, ry, rz, 1, 1, 1);
  }
  emitter(x, y, z, scale = 1) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(this.base);
    this.emitters.push({ x: v.x, y: v.y, z: v.z, scale });
    return this;
  }
  blink(x, y, z, r = 0.025) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(this.base);
    this.blinks.push(v);
    return this;
  }

  // 两坡屋顶（屋脊沿 z），含山墙
  gableRoof(w, d, h, x, y, z, wallColor, roofColor, ry = 0, over = 0.035) {
    this.push(x, y, z, ry);
    this.prism(w, h, d, 0, 0, 0, wallColor);
    const a = Math.atan2(h, w / 2);
    const half = w / 2 + over;
    const len = half / Math.cos(a);
    const t = 0.022;
    for (const s of [-1, 1]) {
      const cx = (s * half) / 2;
      const cy = h - (half * Math.tan(a)) / 2 + 0.008;
      this.box(len, t, d + over * 2, cx, cy - t / 2, 0, roofColor, 'body', 0, 0, -s * a);
    }
    this.box(0.035, 0.02, d + over * 2, 0, h - 0.004, 0, roofColor);
    this.pop();
    return this;
  }
  // 四坡屋顶（带屋脊）
  hipRoof(w, d, h, x, y, z, color, ry = 0) {
    return this.add(hipRoofGeo(w, d, h), color, 'body', x, y, z, 0, ry, 0, 1, 1, 1);
  }

  build() {
    const out = {};
    for (const k in this.parts) {
      const list = this.parts[k];
      out[k] = list.length ? mergeGeometries(list, false) : null;
      list.forEach((g) => g.dispose());
    }
    out.emitters = this.emitters;
    out.blinks = this.blinks;
    return out;
  }
}

// 把 build() 结果组合成可直接加入场景的 Group
export function meshFromBuild(res, { shadow = true } = {}) {
  const g = new THREE.Group();
  for (const k of ['body', 'glass', 'lit', 'glow', 'ds']) {
    if (!res[k]) continue;
    const m = new THREE.Mesh(res[k], MAT[k]);
    m.castShadow = shadow && k !== 'glow';
    m.receiveShadow = true;
    g.add(m);
  }
  if (res.blinks && res.blinks.length) {
    const sg = new THREE.SphereGeometry(0.028, 8, 6);
    for (const p of res.blinks) {
      const s = new THREE.Mesh(sg, MAT.blink);
      s.position.copy(p);
      g.add(s);
    }
  }
  return g;
}

/**
 * 可增删的实例批次：同一几何体的大量实例（建筑/树木/路灯）
 */
export class InstanceBatch {
  constructor(parent, geometry, material, cap = 32, { castShadow = true, receiveShadow = true } = {}) {
    this.parent = parent;
    this.geometry = geometry;
    this.material = material;
    this.cast = castShadow;
    this.recv = receiveShadow;
    this.ids = [];
    this.index = new Map();
    this.mesh = this._make(cap);
    parent.add(this.mesh);
  }
  _make(cap) {
    const m = new THREE.InstancedMesh(this.geometry, this.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = this.cast;
    m.receiveShadow = this.recv;
    m.frustumCulled = false;
    m.count = 0;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    return m;
  }
  _grow() {
    const old = this.mesh;
    const cap = old.instanceMatrix.count * 2;
    const m = this._make(cap);
    m.instanceMatrix.array.set(old.instanceMatrix.array);
    m.instanceColor.array.set(old.instanceColor.array);
    m.count = old.count;
    this.parent.remove(old);
    old.dispose();
    this.parent.add(m);
    this.mesh = m;
  }
  add(id, matrix, color) {
    if (this.mesh.count >= this.mesh.instanceMatrix.count) this._grow();
    const i = this.mesh.count++;
    this.ids[i] = id;
    this.index.set(id, i);
    this.mesh.setMatrixAt(i, matrix);
    if (color) this.mesh.setColorAt(i, color);
    else this.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
  set(id, matrix) {
    const i = this.index.get(id);
    if (i === undefined) return;
    this.mesh.setMatrixAt(i, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  has(id) { return this.index.has(id); }
  remove(id) {
    const i = this.index.get(id);
    if (i === undefined) return;
    const last = --this.mesh.count;
    if (i !== last) {
      const lastId = this.ids[last];
      const a = this.mesh.instanceMatrix.array;
      for (let k = 0; k < 16; k++) a[i * 16 + k] = a[last * 16 + k];
      const c = this.mesh.instanceColor.array;
      for (let k = 0; k < 3; k++) c[i * 3 + k] = c[last * 3 + k];
      this.ids[i] = lastId;
      this.index.set(lastId, i);
    }
    this.ids.length = last;
    this.index.delete(id);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
  clear() {
    this.ids.length = 0;
    this.index.clear();
    this.mesh.count = 0;
  }
}

// 一个模型（多材质几何）的批次组
export class ModelBatch {
  constructor(parent, res, opts = {}) {
    this.batches = [];
    for (const k of ['body', 'glass', 'lit', 'glow', 'ds']) {
      if (!res[k]) continue;
      this.batches.push(new InstanceBatch(parent, res[k], MAT[k], opts.cap || 16, {
        castShadow: opts.castShadow !== false && k !== 'glow',
        receiveShadow: true,
      }));
    }
  }
  add(id, m, color) { for (const b of this.batches) b.add(id, m, color); }
  set(id, m) { for (const b of this.batches) b.set(id, m); }
  remove(id) { for (const b of this.batches) b.remove(id); }
  clear() { for (const b of this.batches) b.clear(); }
}
