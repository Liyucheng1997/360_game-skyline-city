// 城市视图：把城市状态映射为三维对象（建筑实例、特殊建筑、树木、图标、动画）
import * as THREE from 'three';
import { MAP, ENTRANCE } from '../core/config.js';
import { tileToWorld, rotForDir, mulberry32 } from '../core/utils.js';
import { ModelBatch, InstanceBatch, MAT } from '../core/builder.js';
import { createSpecial } from '../models/specials.js';
import { treeGeometries } from '../models/props.js';
import { RoadRenderer } from './roads.js';
import { Overlay } from './overlay.js';
import { Particles } from './particles.js';
import { Vehicles } from './vehicles.js';

const easeOutBack = (t) => {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function iconTexture(emoji, bg) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(64, 58, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(48, 96); ctx.lineTo(80, 96); ctx.lineTo(64, 122); ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.arc(64, 58, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '56px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(emoji, 64, 62);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CityView {
  constructor(env, city, variants) {
    this.env = env;
    this.scene = env.scene;
    this.city = city;
    this.variants = variants;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.batches = new Map();
    this.blds = new Map();
    this.specials = new Map();
    this.anims = [];
    this.icons = new Map();
    this.time = 0;
    this.heights = new Map();

    this.roads = new RoadRenderer(this.scene);
    this.overlay = new Overlay(this.scene);
    this.particles = new Particles(this.scene);
    this.vehicles = new Vehicles(this.scene, city);

    // 树木
    const tg = treeGeometries();
    this.trees = tg.map((g) => new InstanceBatch(this.root, g, MAT.body, 1024));
    // 航空障碍灯
    this.blinkBatch = new InstanceBatch(this.root, new THREE.SphereGeometry(0.026, 8, 6), MAT.blink, 64, { castShadow: false });

    this.iconMats = {
      power: new THREE.SpriteMaterial({ map: iconTexture('⚡', '#e8a317'), depthTest: false, fog: false }),
      road: new THREE.SpriteMaterial({ map: iconTexture('🚧', '#d9483b'), depthTest: false, fog: false }),
    };
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#4cff7a', transparent: true, opacity: 0.45, depthWrite: false, fog: false });
    this.ghosts = new Map();
    this.ghost = null;

    // 新手引导标记
    {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 160;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgba(16,24,36,0.88)';
      ctx.beginPath(); ctx.roundRect(8, 8, 496, 104, 30); ctx.fill();
      ctx.strokeStyle = '#3fd0b6'; ctx.lineWidth = 6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(236, 110); ctx.lineTo(276, 110); ctx.lineTo(256, 150); ctx.closePath();
      ctx.fillStyle = '#3fd0b6'; ctx.fill();
      ctx.font = 'bold 50px "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
      ctx.fillText('🛣️ 从这里开始修路', 256, 62);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.hint = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
      this.hint.scale.set(3.2, 1, 1);
      this.hint.center.set(0.5, 0);
      this.hint.position.set(tileToWorld(ENTRANCE.x + 4), 0.4, tileToWorld(ENTRANCE.z));
      this.hint.renderOrder = 20;
      this.scene.add(this.hint);
    }

    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);

    city.on('roads', () => { this.roads.rebuild(city); this.vehicles.onRoadsChanged(); });
    city.on('zone', (x, z) => this.overlay.setZone(x, z, city.zone[z * MAP + x], !!city.bld[z * MAP + x]));
    city.on('trees', (x, z) => this.updateTrees(x, z));
    city.on('bld:add', (x, z, b, anim) => this.addBuilding(x, z, b, anim));
    city.on('bld:remove', (x, z, b, silent) => this.removeBuilding(x, z, silent));
    city.on('special:add', (sp) => this.addSpecial(sp, true));
    city.on('special:remove', (sp) => this.removeSpecial(sp));
    city.on('status', () => this.updateIcons());
  }

  // 全量重建（新游戏 / 读档）
  rebuildAll() {
    for (const [, info] of this.blds) this.removeBuildingObj(info);
    this.blds.clear();
    for (const b of this.batches.values()) b.clear();
    for (const [, s] of this.specials) this.disposeSpecial(s);
    this.specials.clear();
    for (const t of this.trees) t.clear();
    this.blinkBatch.clear();
    for (const [, ic] of this.icons) this.root.remove(ic);
    this.icons.clear();
    this.anims = [];
    const city = this.city;
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) {
      const i = z * MAP + x;
      this.updateTrees(x, z);
      if (city.bld[i]) this.addBuilding(x, z, city.bld[i], false);
      this.overlay.setZone(x, z, city.zone[i], !!city.bld[i]);
    }
    for (const sp of city.specials.values()) this.addSpecial(sp, false);
    this.roads.rebuild(city);
    this.vehicles.cars = [];
    this.updateIcons();
  }

  // ---------- 树 ----------
  updateTrees(x, z) {
    const i = z * MAP + x;
    const n = this.city.trees[i];
    for (let k = 0; k < 3; k++) {
      const id = i * 4 + k;
      const rng = mulberry32(i * 13 + k * 7 + 1);
      const kind = rng() < 0.45 ? 1 : rng() < 0.8 ? 0 : 2;
      for (const t of this.trees) t.remove(id);
      if (k < n) {
        const sc = 1.7 + rng() * 1.1;
        const ox = (rng() - 0.5) * 0.6, oz = (rng() - 0.5) * 0.6;
        this.q.setFromAxisAngle(this.up, rng() * 6.28);
        this.m.compose(new THREE.Vector3(tileToWorld(x) + ox, 0, tileToWorld(z) + oz), this.q, new THREE.Vector3(sc, sc * (0.85 + rng() * 0.35), sc));
        const tint = new THREE.Color().setHSL(0.24 + rng() * 0.1, 0.4 + rng() * 0.25, 0.45 + rng() * 0.15).multiplyScalar(2.0);
        this.trees[kind].add(id, this.m, tint);
      }
    }
  }

  // ---------- 区域建筑 ----------
  batchFor(res) {
    if (!this.batches.has(res.key)) this.batches.set(res.key, new ModelBatch(this.root, res));
    return this.batches.get(res.key);
  }

  heightOf(res) {
    if (!this.heights.has(res.key)) {
      res.body.computeBoundingBox();
      this.heights.set(res.key, res.body.boundingBox.max.y);
    }
    return this.heights.get(res.key);
  }

  addBuilding(x, z, b, anim) {
    const i = z * MAP + x;
    if (this.blds.has(i)) this.removeBuilding(x, z, true);
    const list = this.variants[b.zone + b.level];
    const res = list[b.variant % list.length];
    const batch = this.batchFor(res);
    const rot = rotForDir(b.dir);
    const pos = new THREE.Vector3(tileToWorld(x), 0, tileToWorld(z));
    const quat = new THREE.Quaternion().setFromAxisAngle(this.up, rot);
    const mat = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
    const rng = mulberry32(i * 31 + b.level);
    const tint = new THREE.Color(0.9 + rng() * 0.12, 0.9 + rng() * 0.1, 0.9 + rng() * 0.1);
    const info = { i, x, z, batch, mat, res, emitters: [], blinks: [], pos, quat };
    if (anim) {
      const m0 = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 0.02, 1));
      batch.add(i, m0, tint);
      this.anims.push({ info, t: 0 });
      this.particles.dust(pos.x, pos.z, 14);
    } else {
      batch.add(i, mat, tint);
      this.finishBuilding(info);
    }
    this.blds.set(i, info);
  }

  finishBuilding(info) {
    for (const e of info.res.emitters) {
      const v = new THREE.Vector3(e.x, e.y, e.z).applyMatrix4(info.mat);
      info.emitters.push(this.particles.addEmitter({ x: v.x, y: v.y, z: v.z, scale: e.scale }));
    }
    info.res.blinks.forEach((p, k) => {
      const v = p.clone().applyMatrix4(info.mat);
      const id = info.i * 8 + k;
      this.blinkBatch.add(id, new THREE.Matrix4().makeTranslation(v.x, v.y, v.z));
      info.blinks.push(id);
    });
  }

  removeBuildingObj(info) {
    info.batch.remove(info.i);
    for (const e of info.emitters) this.particles.removeEmitter(e);
    for (const id of info.blinks) this.blinkBatch.remove(id);
    this.anims = this.anims.filter((a) => a.info !== info);
  }

  removeBuilding(x, z, silent) {
    const i = z * MAP + x;
    const info = this.blds.get(i);
    if (!info) return;
    this.removeBuildingObj(info);
    this.blds.delete(i);
    if (!silent) this.particles.dust(info.pos.x, info.pos.z, 22);
    const ic = this.icons.get(i);
    if (ic) { this.root.remove(ic); this.icons.delete(i); }
  }

  // ---------- 特殊建筑 ----------
  placeTransform(obj, type, sp) {
    const n = sp.n;
    obj.position.set(tileToWorld(sp.x) + (n - 1) / 2, 0, tileToWorld(sp.z) + (n - 1) / 2);
    obj.rotation.y = rotForDir(sp.dir);
  }

  addSpecial(sp, anim) {
    const obj = createSpecial(sp.type, sp.seed || sp.id);
    this.placeTransform(obj.group, sp.type, sp);
    obj.group.traverse((o) => { if (o.isMesh) { o.castShadow = o.material !== MAT.glow; o.receiveShadow = true; } });
    this.root.add(obj.group);
    obj.group.updateMatrixWorld(true);
    obj.emitterRefs = obj.emitters.map((e) => {
      const v = new THREE.Vector3(e.x, e.y, e.z).applyMatrix4(obj.group.matrixWorld);
      return this.particles.addEmitter({ x: v.x, y: v.y, z: v.z, scale: e.scale });
    });
    if (anim) {
      obj.group.scale.set(1, 0.02, 1);
      this.anims.push({ special: obj, t: 0 });
      for (let k = 0; k < sp.n * sp.n; k++) this.particles.dust(obj.group.position.x + (Math.random() - 0.5) * sp.n * 0.6, obj.group.position.z + (Math.random() - 0.5) * sp.n * 0.6, 10);
    }
    this.specials.set(sp.id, obj);
  }

  disposeSpecial(obj) {
    this.root.remove(obj.group);
    for (const e of obj.emitterRefs) this.particles.removeEmitter(e);
  }

  removeSpecial(sp) {
    const obj = this.specials.get(sp.id);
    if (!obj) return;
    this.disposeSpecial(obj);
    this.specials.delete(sp.id);
    for (let k = 0; k < sp.n * sp.n; k++) this.particles.dust(obj.group.position.x + (Math.random() - 0.5) * sp.n * 0.6, obj.group.position.z + (Math.random() - 0.5) * sp.n * 0.6, 10);
  }

  // ---------- 放置预览（半透明幽灵模型） ----------
  showGhost(type, sp, ok) {
    if (!type) { if (this.ghost) this.ghost.visible = false; return; }
    if (!this.ghosts.has(type)) {
      const obj = createSpecial(type, 1);
      obj.group.traverse((o) => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; } });
      this.root.add(obj.group);
      this.ghosts.set(type, obj.group);
    }
    for (const [k, g] of this.ghosts) g.visible = k === type;
    this.ghost = this.ghosts.get(type);
    this.placeTransform(this.ghost, type, sp);
    this.ghostMat.color.set(ok ? '#4cff7a' : '#ff4c4c');
  }

  // ---------- 状态图标 ----------
  updateIcons() {
    const city = this.city;
    for (const [i, info] of this.blds) {
      const b = city.bld[i];
      let kind = null;
      if (b) {
        if (!b.access) kind = 'road';
        else if (!b.powered) kind = 'power';
      }
      const cur = this.icons.get(i);
      if (cur && cur.userData.kind === kind) continue;
      if (cur) { this.root.remove(cur); this.icons.delete(i); }
      if (kind) {
        const s = new THREE.Sprite(this.iconMats[kind]);
        s.userData.kind = kind;
        s.userData.base = this.heightOf(info.res) + 0.35;
        s.position.set(info.pos.x, s.userData.base, info.pos.z);
        s.scale.set(0.42, 0.42, 1);
        s.renderOrder = 10;
        this.root.add(s);
        this.icons.set(i, s);
      }
    }
  }

  update(dt, rate) {
    this.time += dt;
    const t = this.time;
    // 建造动画
    const done = [];
    for (const a of this.anims) {
      a.t += dt / 1.1;
      const k = Math.min(1, a.t);
      const s = Math.max(0.02, easeOutBack(k));
      if (a.info) {
        const info = a.info;
        this.m.compose(info.pos, info.quat, new THREE.Vector3(1, s, 1));
        info.batch.set(info.i, this.m);
        if (k >= 1) { info.batch.set(info.i, info.mat); this.finishBuilding(info); done.push(a); }
      } else if (a.special) {
        a.special.group.scale.set(1, s, 1);
        if (k >= 1) { a.special.group.scale.set(1, 1, 1); done.push(a); }
      }
    }
    if (done.length) this.anims = this.anims.filter((a) => !done.includes(a));
    // 特殊建筑动画
    for (const [, s] of this.specials) if (s.update) s.update(dt * (rate > 0 ? 1 : 0.15), t);
    for (const [, g] of this.ghosts) if (g.visible) g.position.y = 0.02;
    this.hint.visible = !this.city.quests.road;
    if (this.hint.visible) this.hint.position.y = 0.35 + Math.abs(Math.sin(t * 2.5)) * 0.25;
    // 图标浮动
    for (const [, ic] of this.icons) ic.position.y = ic.userData.base + Math.sin(t * 3 + ic.position.x) * 0.06;
    // 航空灯闪烁
    MAT.blink.emissiveIntensity = (Math.sin(t * 4) > 0.3 ? 3 : 0.15) * (0.4 + this.env.lights * 0.8);
    this.roads.update(this.env.lights);
    this.overlay.update(t, 1 - this.env.nightFactor * 0.55);
    this.particles.update(dt, rate, 0.22 + (1 - this.env.nightFactor) * 0.78);
    this.vehicles.update(dt, rate);
  }
}
