// 鼠标/键盘输入与建造工具
import * as THREE from 'three';
import { MAP, HALF, TOOLS, SPECIALS, ZONE_COLORS, ROAD_COST, BRIDGE_COST, ZONE_COST } from '../core/config.js';
import { worldToTile, formatMoney, clamp } from '../core/utils.js';

export class Input {
  constructor(game) {
    this.game = game;
    const { env } = game;
    this.env = env;
    this.city = game.city;
    this.view = game.view;
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mouse = new THREE.Vector2();
    this.tool = 'select';
    this.hover = null;
    this.drag = null;
    this.keys = {};
    this.downPos = null;

    const el = env.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerleave', () => { this.hover = null; this.refresh(); this.game.ui.tooltip(null); });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    this.setTool('select');
  }

  setTool(t) {
    this.tool = t;
    this.drag = null;
    const c = this.env.controls;
    c.mouseButtons.LEFT = t === 'select' ? THREE.MOUSE.PAN : null;
    this.view.overlay.mat.uniforms.uGrid.value = t === 'select' ? 0 : 1;
    this.view.overlay.clearPreview();
    this.view.showGhost(null);
    this.game.ui.setActiveTool(t);
    this.game.ui.tooltip(null);
    this.refresh();
  }

  pick(e) {
    const r = this.env.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.env.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, p)) return null;
    const x = worldToTile(p.x), z = worldToTile(p.z);
    return { x, z, wx: p.x, wz: p.z, inside: x >= 0 && z >= 0 && x < MAP && z < MAP };
  }

  onDown(e) {
    this.downPos = [e.clientX, e.clientY];
    if (e.button !== 0) return;
    const h = this.pick(e);
    if (!h || !h.inside) return;
    if (this.tool === 'select') return;
    if (TOOLS[this.tool].special) {
      this.city.placeSpecial(this.tool, h.x, h.z);
      this.refresh();
      return;
    }
    this.drag = { x: h.x, z: h.z };
    this.refresh();
  }

  onMove(e) {
    const h = this.pick(e);
    this.hover = h && h.inside ? h : null;
    this.lastEvent = e;
    this.refresh();
  }

  onUp(e) {
    if (e.button === 0 && this.tool === 'select' && this.downPos) {
      const moved = Math.hypot(e.clientX - this.downPos[0], e.clientY - this.downPos[1]);
      if (moved < 5 && e.target === this.env.renderer.domElement) {
        const h = this.pick(e);
        if (h && h.inside) this.game.ui.showInfo(h.x, h.z);
        else this.game.ui.hideInfo();
      }
    }
    if (e.button === 2 && this.downPos && this.tool !== 'select') {
      const moved = Math.hypot(e.clientX - this.downPos[0], e.clientY - this.downPos[1]);
      if (moved < 5) {
        if (this.drag) this.drag = null;
        else this.setTool('select');
        this.refresh();
      }
    }
    this.downPos = null;
    if (!this.drag || e.button !== 0) return;
    const tiles = this.currentTiles();
    const t = this.tool;
    if (t === 'road') this.city.buildRoads(tiles);
    else if (TOOLS[t].zone) this.city.zoneArea(tiles, TOOLS[t].zone);
    else if (t === 'dezone') this.city.dezoneArea(tiles);
    else if (t === 'bulldoze') this.city.bulldozeArea(tiles);
    this.drag = null;
    this.refresh();
  }

  currentTiles() {
    const a = this.drag, b = this.hover || a;
    if (!a) return b ? [[b.x, b.z]] : [];
    const out = [];
    if (this.tool === 'road') {
      const horiz = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z);
      const corner = horiz ? [b.x, a.z] : [a.x, b.z];
      const seg = (p, q) => {
        const dx = Math.sign(q[0] - p[0]), dz = Math.sign(q[1] - p[1]);
        let x = p[0], z = p[1];
        out.push([x, z]);
        while (x !== q[0] || z !== q[1]) { x += dx; z += dz; out.push([x, z]); }
      };
      seg([a.x, a.z], corner);
      out.pop();
      seg(corner, [b.x, b.z]);
      return out;
    }
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push([x, z]);
    return out;
  }

  refresh() {
    const ov = this.view.overlay;
    const ui = this.game.ui;
    const h = this.hover;
    if (h) ov.mat.uniforms.uHover.value.set(h.wx, h.wz);
    const t = this.tool;
    const city = this.city;
    if (!h && !this.drag) { ov.setCursor(null); ov.clearPreview(); this.view.showGhost(null); return; }
    if (t === 'select') {
      ov.clearPreview();
      ov.setCursor(h ? h.x : null, h ? h.z : null, 1, '#ffffff');
      return;
    }
    if (TOOLS[t].special) {
      ov.clearPreview();
      if (!h) { this.view.showGhost(null); ov.setCursor(null); return; }
      const def = SPECIALS[t];
      const fp = city.footprint(t, h.x, h.z);
      const chk = city.canPlaceSpecial(t, h.x, h.z);
      const locked = def.unlock > city.maxPop;
      const ok = chk.ok && !locked && city.money >= def.cost;
      this.view.showGhost(t, { ...fp, dir: chk.ok ? chk.dir : 2 }, ok);
      ov.setCursor(h.x, h.z, fp.n, ok ? '#7dffa0' : '#ff7070');
      const why = locked ? `🔒 人口 ${def.unlock} 解锁` : !chk.ok ? chk.why : city.money < def.cost ? '资金不足' : '';
      this.tip(`${def.icon} ${def.name}  ${formatMoney(def.cost)}${why ? `<br><span class="bad">${why}</span>` : ''}`);
      return;
    }
    ov.setCursor(h ? h.x : null, h ? h.z : null, 1, '#ffffff');
    const tiles = this.currentTiles();
    const prev = [];
    let cost = 0, count = 0;
    if (t === 'road') {
      for (const [x, z] of tiles) {
        const c = city.roadCost(x, z);
        if (c < 0) prev.push([x, z, '#ff4040']);
        else { prev.push([x, z, c === 0 ? '#9fb8d0' : '#4aa8ff']); cost += Math.max(0, c); if (c > 0) count++; }
      }
      ov.showPreview(prev, '#4aa8ff');
      this.tip(this.drag ? `🛣️ ${count} 格  ${formatMoney(cost)}` : `🛣️ 按住左键拖动修路<br><small>普通 ${formatMoney(ROAD_COST)}/格 · 桥梁 ${formatMoney(BRIDGE_COST)}/格</small>`, city.money < cost);
    } else if (TOOLS[t].zone) {
      const zt = TOOLS[t].zone;
      const col = '#' + new THREE.Color(...ZONE_COLORS[zt]).getHexString();
      const dim = '#' + new THREE.Color(...ZONE_COLORS[zt]).multiplyScalar(0.55).getHexString();
      const sel = new Set(tiles.map(([x, z]) => z * MAP + x));
      const ok = (x, z, i) => city.canZone(x, z) && !city.bld[i] && city.zone[i] !== zt;
      // 淡色提示所有可以划区的位置（道路两旁）
      for (let i = 0; i < MAP * MAP; i++) {
        if (sel.has(i)) continue;
        const x = i % MAP, z = (i / MAP) | 0;
        if (ok(x, z, i)) prev.push([x, z, dim]);
      }
      let bad = 0;
      for (const [x, z] of tiles) {
        const i = z * MAP + x;
        if (ok(x, z, i)) { prev.push([x, z]); count++; }
        else if (!city.road[i] && !city.water[i] && !city.bld[i] && city.zone[i] !== zt) { prev.push([x, z, '#c03030']); bad++; }
      }
      ov.showPreview(prev, col);
      if (!count && bad) this.tip(`<span class="bad">⚠️ 区划只能划在道路两旁的空地</span><br><small>先用「道路」修路，再沿着路边拖动（亮色格子为可划区域）</small>`, true);
      else this.tip(this.drag ? `${TOOLS[t].icon} ${count} 格  ${formatMoney(count * ZONE_COST)}` : `${TOOLS[t].icon} 按住左键沿<b>道路两旁</b>拖动划区`);
    } else if (t === 'dezone') {
      for (const [x, z] of tiles) { const i = z * MAP + x; if (city.zone[i] && !city.bld[i]) prev.push([x, z]); }
      ov.showPreview(prev, '#ffffff');
      this.tip('🧽 拖动清除区划');
    } else if (t === 'bulldoze') {
      for (const [x, z] of tiles) {
        const i = z * MAP + x;
        if (city.road[i] || city.bld[i] || city.spec[i] || city.trees[i]) prev.push([x, z]);
      }
      ov.showPreview(prev, '#ff3b3b');
      this.tip(this.drag ? `🚜 拆除 ${prev.length} 格` : '🚜 拖动框选要拆除的区域');
    }
  }

  tip(html, bad) {
    const e = this.lastEvent;
    if (!e) return;
    this.game.ui.tooltip(html, e.clientX, e.clientY, bad);
  }

  onKey(e, down) {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    this.keys[k] = down;
    if (!down) return;
    const ui = this.game.ui;
    if (k === 'escape') { if (this.tool !== 'select') this.setTool('select'); else ui.hideInfo(); ui.closePanels(); }
    else if (k === ' ') { e.preventDefault(); this.game.togglePause(); }
    else if (k === 'b') this.setTool('bulldoze');
    else if (k === 'r') this.setTool('road');
    else if (k === '1') this.game.setSpeed(1);
    else if (k === '2') this.game.setSpeed(2);
    else if (k === '3') this.game.setSpeed(3);
  }

  // 键盘控制相机
  updateCamera(dt) {
    const c = this.env.controls, cam = this.env.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const dist = cam.position.distanceTo(c.target);
    const sp = dist * 0.9 * dt;
    const mv = new THREE.Vector3();
    const K = this.keys;
    if (K.w || K.arrowup) mv.add(fwd);
    if (K.s || K.arrowdown) mv.sub(fwd);
    if (K.d || K.arrowright) mv.add(right);
    if (K.a || K.arrowleft) mv.sub(right);
    if (mv.lengthSq() > 0) {
      mv.normalize().multiplyScalar(sp);
      c.target.add(mv);
      cam.position.add(mv);
    }
    if (K.q || K.e) {
      const ang = (K.q ? 1 : -1) * dt * 1.4;
      const off = cam.position.clone().sub(c.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      cam.position.copy(c.target).add(off);
    }
    // 限制范围
    const lim = HALF + 6;
    const tx = clamp(c.target.x, -lim, lim), tz = clamp(c.target.z, -lim, lim);
    if (tx !== c.target.x || tz !== c.target.z) {
      const d = new THREE.Vector3(tx - c.target.x, 0, tz - c.target.z);
      c.target.add(d);
      cam.position.add(d);
    }
    c.target.y = 0;
  }
}
