import * as THREE from 'three';
import { Environment } from './world/environment.js';
import { buildTerrain } from './world/terrain.js';
import { CityView } from './world/cityView.js';
import { buildZoneVariants } from './models/buildings.js';
import { City } from './game/city.js';
import { Input } from './game/input.js';
import { Audio } from './game/audio.js';
import { UI } from './ui/ui.js';
import { SPEEDS, MINUTES_PER_SECOND, ENTRANCE } from './core/config.js';
import { tileToWorld } from './core/utils.js';

const SAVE_KEY = 'tianji-city-save-v1';
const $ = (s) => document.querySelector(s);
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

class Game {
  async init() {
    this.env = new Environment($('#app'));
    await nextFrame();
    const t0 = performance.now();
    this.variants = buildZoneVariants();
    const t1 = performance.now();
    const counts = {};
    for (const k in this.variants) counts[k] = this.variants[k].length;
    this.city = new City(counts);
    this.terrain = buildTerrain(this.env.scene, this.city);
    this.view = new CityView(this.env, this.city, this.variants);
    this.audio = new Audio();
    this.ui = new UI(this);
    this.input = new Input(this);
    this.speed = 1;
    this.prevSpeed = 1;
    this.started = false;
    this.bindCity();
    this.view.rebuildAll();
    this.resetCamera();
    console.info(`[init] 模型 ${(t1 - t0).toFixed(0)}ms，总计 ${(performance.now() - t0).toFixed(0)}ms`);

    this.clock = new THREE.Clock();
    this.uiTimer = 0;
    this.saveTimer = 0;
    this.env.renderer.setAnimationLoop(() => this.frame());

    // 开始界面
    $('#loading').classList.add('hidden');
    $('#start-buttons').classList.remove('hidden');
    if (localStorage.getItem(SAVE_KEY)) $('#btn-continue').classList.remove('hidden');
    $('#btn-new').onclick = () => { this.newGame(); this.start(); };
    $('#btn-continue').onclick = () => { if (this.load()) this.start(); };
  }

  bindCity() {
    const c = this.city, ui = this.ui;
    c.on('notify', (t, type) => { ui.toast(t, type); if (type === 'bad') this.audio.play('bad'); });
    c.on('sfx', (n) => this.audio.play(n));
    c.on('milestone', (m) => ui.milestone(m));
    c.on('unlock', (d) => { ui.toast(`🔓 解锁新建筑：${d.icon} ${d.name}`, 'good'); ui.renderSub(); });
    c.on('quest', (q) => {
      ui.toast(`🎯 目标完成：${q.text}　<b style="color:#ffc24b">+¥${q.reward}</b>`, 'good');
      ui.renderQuests();
      this.audio.play('coin');
    });
    c.on('upgrade', (x, z, b) => { if (b.level === 3 && Math.random() < 0.3) this.audio.play('coin'); });
    c.on('stats', () => { this.statTick = (this.statTick || 0) + 1; if (this.statTick % 4 === 0) ui.refreshHeat(); });
    c.on('day', () => { if (this.started) this.save(); });
  }

  resetCamera() {
    const c = this.env.controls;
    const tx = tileToWorld(ENTRANCE.x + 9), tz = tileToWorld(ENTRANCE.z);
    c.target.set(tx, 0, tz);
    this.env.camera.position.set(tx - 8, 17, tz + 17);
    c.update();
  }

  start() {
    this.started = true;
    $('#start').classList.add('fade');
    setTimeout(() => $('#start').classList.add('hidden'), 700);
    $('#hud').classList.remove('hidden');
    this.setSpeed(1);
    this.audio.ensure();
    this.ui.renderQuests();
    setTimeout(() => this.ui.toast('👋 欢迎市长！先从高速入口修建道路开始吧', 'good'), 800);
  }

  newGame() {
    this.city.reset();
    this.view.rebuildAll();
    this.ui.renderQuests();
    this.ui.hideInfo();
    this.resetCamera();
    localStorage.removeItem(SAVE_KEY);
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.city.serialize())); } catch (e) { console.warn(e); }
  }

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      this.city.load(d);
      this.view.rebuildAll();
      this.ui.renderQuests();
      return true;
    } catch (e) {
      console.error(e);
      this.ui.toast('存档损坏，已开始新城市', 'bad');
      this.newGame();
      return true;
    }
  }

  setSpeed(s) {
    if (s > 0) this.prevSpeed = s;
    this.speed = s;
    this.ui.setSpeedButtons(s);
  }
  togglePause() { this.setSpeed(this.speed === 0 ? this.prevSpeed : 0); }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const rate = this.started ? SPEEDS[this.speed] : 0;
    if (rate > 0) this.city.advance(dt * MINUTES_PER_SECOND * rate);
    if (!this.started) {
      // 开始界面背景：缓慢环绕
      const c = this.env.controls, cam = this.env.camera;
      const off = cam.position.clone().sub(c.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.05);
      cam.position.copy(c.target).add(off);
    }
    this.env.updateDayNight(this.city.minute / 60, dt);
    this.input.updateCamera(dt);
    this.env.controls.update();
    this.view.update(dt, this.started ? rate : 0.5);
    this.uiTimer += dt;
    if (this.uiTimer > 0.2 && this.started) { this.uiTimer = 0; this.ui.update(); }
    this.saveTimer += dt;
    if (this.saveTimer > 60 && this.started) { this.saveTimer = 0; this.save(); }
    this.env.render();
  }
}

if (import.meta.env.DEV) import('./dev.js');

const game = new Game();
window.__game = game;
game.init().catch((e) => {
  console.error(e);
  $('#loading span').textContent = '加载失败：' + e.message;
});
window.addEventListener('beforeunload', () => { if (game.started) game.save(); });
