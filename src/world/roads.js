// 道路网格：按连接掩码生成道路块（含人行道、标线、斑马线、桥梁），并整体合并
import * as THREE from 'three';
import { Builder, MAT } from '../core/builder.js';
import { MAP } from '../core/config.js';
import { tileToWorld, DIRS, rotForDir } from '../core/utils.js';
import { lampGeometry } from '../models/props.js';

const ASPHALT = '#4b4e53', WALK = '#bdb8ac', CURB = '#d9d5cb', YELLOW = '#e8c040', WHITE = '#eceae4';
const SW = 0.14; // 人行道宽

function flat(b, w, h, x, z, color, y = 0.0215) {
  b.quad(w, h, x, y, z, color, 'body', 0, -Math.PI / 2);
}

function makeTile(mask, bridge) {
  const b = new Builder();
  const con = (d) => (mask >> d) & 1;
  const n = con(0) + con(1) + con(2) + con(3);
  if (bridge) {
    b.box(1, 0.1, 1, 0, -0.08, 0, '#8d8a84');
    b.box(0.9, 0.03, 0.9, 0, -0.11, 0, '#6f6d68');
    b.cyl(0.07, 0.62, 0, -0.7, 0, '#9a968e', 10);
  }
  flat(b, 1, 1, 0, 0, ASPHALT, 0.02);
  // 人行道
  for (let d = 0; d < 4; d++) {
    if (con(d)) continue;
    b.push(0, 0, 0, rotForDir(d));
    b.box(1, 0.026, SW, 0, 0.02, 0.5 - SW / 2, WALK);
    b.box(1, 0.027, 0.018, 0, 0.02, 0.5 - SW, CURB);
    if (bridge) {
      b.box(1, 0.07, 0.02, 0, 0.046, 0.49, '#d0d3d6');
      for (let i = 0; i < 5; i++) b.box(0.012, 0.07, 0.012, -0.4 + i * 0.2, 0.046, 0.49, '#9aa0a5');
    }
    b.pop();
  }
  // 角落
  for (let k = 0; k < 4; k++) {
    const d1 = k, d2 = (k + 1) % 4;
    if (!(con(d1) && con(d2))) continue;
    const cx = (DIRS[d1].dx + DIRS[d2].dx) * (0.5 - SW / 2);
    const cz = (DIRS[d1].dz + DIRS[d2].dz) * (0.5 - SW / 2);
    b.box(SW, 0.026, SW, cx, 0.02, cz, WALK);
  }
  // 标线
  const straightNS = mask === 0b0101, straightEW = mask === 0b1010;
  if (straightNS || straightEW) {
    const ry = straightNS ? 0 : Math.PI / 2;
    b.push(0, 0, 0, ry);
    flat(b, 0.022, 0.2, 0, -0.25, YELLOW);
    flat(b, 0.022, 0.2, 0, 0.25, YELLOW);
    flat(b, 0.012, 1, -0.33, 0, WHITE);
    flat(b, 0.012, 1, 0.33, 0, WHITE);
    b.pop();
  } else if (n >= 3) {
    for (let d = 0; d < 4; d++) {
      if (!con(d)) continue;
      b.push(0, 0, 0, rotForDir(d));
      for (let i = 0; i < 6; i++) flat(b, 0.06, 0.09, -0.28 + i * 0.112, 0.41, WHITE);
      flat(b, 0.34, 0.02, 0.17, 0.335, WHITE); // 停止线
      b.pop();
    }
  } else if (n === 2) {
    // 弯道中心线
    for (let d = 0; d < 4; d++) {
      if (!con(d)) continue;
      b.push(0, 0, 0, rotForDir(d));
      flat(b, 0.022, 0.2, 0, 0.3, YELLOW);
      b.pop();
    }
  } else if (n === 1) {
    for (let d = 0; d < 4; d++) if (con(d)) { b.push(0, 0, 0, rotForDir(d)); flat(b, 0.022, 0.2, 0, 0.3, YELLOW); b.pop(); }
  }
  if (!bridge && (mask * 7) % 5 === 1) b.cyl(0.035, 0.003, 0.15, 0.02, -0.15, '#3a3c40', 10);
  return b.build().body;
}

export class RoadRenderer {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), MAT.body);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    // 路灯
    const lg = lampGeometry();
    const cap = MAP * MAP;
    this.poles = new THREE.InstancedMesh(lg.pole, MAT.body, cap);
    this.heads = new THREE.InstancedMesh(lg.head, MAT.glow, cap);
    this.poles.castShadow = true;
    for (const m of [this.poles, this.heads]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
    // 地面光斑
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,220,150,1)');
    gr.addColorStop(0.5, 'rgba(255,200,120,0.35)');
    gr.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    this.poolMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0, fog: false,
    });
    const pg = new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2);
    this.pools = new THREE.InstancedMesh(pg, this.poolMat, cap);
    this.pools.count = 0;
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 2;
    scene.add(this.pools);
  }

  tileGeo(mask, bridge) {
    const k = mask + (bridge ? 16 : 0);
    if (!this.cache.has(k)) this.cache.set(k, makeTile(mask, bridge));
    return this.cache.get(k);
  }

  rebuild(city) {
    const items = [];
    let total = 0;
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) {
      const i = z * MAP + x;
      if (!city.road[i]) continue;
      const g = this.tileGeo(city.roadMask(x, z), !!city.water[i]);
      items.push([g, tileToWorld(x), tileToWorld(z)]);
      total += g.attributes.position.count;
    }
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), Cc = new Float32Array(total * 3);
    let o = 0;
    for (const [g, wx, wz] of items) {
      const p = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array;
      for (let k = 0; k < p.length; k += 3) {
        P[o + k] = p[k] + wx; P[o + k + 1] = p[k + 1]; P[o + k + 2] = p[k + 2] + wz;
      }
      N.set(n, o);
      Cc.set(c, o);
      o += p.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    geo.computeBoundingSphere();
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.rebuildLamps(city);
  }

  rebuildLamps(city) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) {
      if (!city.road[z * MAP + x]) continue;
      const mask = city.roadMask(x, z);
      for (let d = 0; d < 4; d++) {
        if ((mask >> d) & 1) continue;
        if ((x + z + d) % 2) continue;
        const wx = tileToWorld(x) + DIRS[d].dx * 0.44, wz = tileToWorld(z) + DIRS[d].dz * 0.44;
        q.setFromAxisAngle(up, rotForDir((d + 2) % 4));
        m.compose(new THREE.Vector3(wx, 0.045, wz), q, s);
        this.poles.setMatrixAt(n, m);
        this.heads.setMatrixAt(n, m);
        m.compose(new THREE.Vector3(tileToWorld(x) + DIRS[d].dx * 0.32, 0.05, tileToWorld(z) + DIRS[d].dz * 0.32), q, s);
        this.pools.setMatrixAt(n, m);
        n++;
      }
    }
    for (const im of [this.poles, this.heads, this.pools]) { im.count = n; im.instanceMatrix.needsUpdate = true; }
  }

  update(lights) {
    this.poolMat.opacity = lights * 0.42;
    this.pools.visible = lights > 0.02;
  }
}
