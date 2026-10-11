// 渲染器、相机、天空、光照、水面与昼夜循环
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MAT } from '../core/builder.js';
import { clamp, lerp, smoothstep } from '../core/utils.js';
import { HALF } from '../core/config.js';

// 昼夜关键帧
const KEYS = [
  { h: 0,    top: '#060b1c', hor: '#1a2440', sun: '#8aa4ff', si: 0.25, hemi: 0.22, fog: '#141c33', env: 0.08, night: 1 },
  { h: 4.8,  top: '#08102a', hor: '#1d2948', sun: '#8aa4ff', si: 0.22, hemi: 0.22, fog: '#18213a', env: 0.08, night: 1 },
  { h: 6.0,  top: '#3b5a8c', hor: '#f0a070', sun: '#ffb27a', si: 1.2, hemi: 0.35, fog: '#c99a86', env: 0.25, night: 0.5 },
  { h: 7.5,  top: '#5f9be0', hor: '#d9e6f0', sun: '#ffe2b8', si: 2.4, hemi: 0.4, fog: '#c6d8e6', env: 0.35, night: 0 },
  { h: 12,   top: '#4a8fe0', hor: '#cfe4f5', sun: '#fff6e8', si: 2.9, hemi: 0.42, fog: '#c4dcef', env: 0.4, night: 0 },
  { h: 16.5, top: '#5590dc', hor: '#dfe6ec', sun: '#ffe7c4', si: 2.7, hemi: 0.4, fog: '#cdd9e2', env: 0.38, night: 0 },
  { h: 18.2, top: '#40508a', hor: '#ff9a5c', sun: '#ff9a55', si: 1.4, hemi: 0.38, fog: '#d08c70', env: 0.25, night: 0.45 },
  { h: 19.4, top: '#141d40', hor: '#6a4a6a', sun: '#ff7a50', si: 0.5, hemi: 0.3, fog: '#3a3350', env: 0.15, night: 0.9 },
  { h: 20.5, top: '#070d22', hor: '#1d2746', sun: '#8aa4ff', si: 0.25, hemi: 0.22, fog: '#161e38', env: 0.08, night: 1 },
  { h: 24,   top: '#060b1c', hor: '#1a2440', sun: '#8aa4ff', si: 0.25, hemi: 0.22, fog: '#141c33', env: 0.08, night: 1 },
];
const KC = KEYS.map((k) => ({ ...k, top: new THREE.Color(k.top), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun), fog: new THREE.Color(k.fog) }));

export class Environment {
  constructor(container) {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(-22, 26, 18);

    const c = (this.controls = new MapControls(this.camera, r.domElement));
    c.target.set(-20, 0, -1.5);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.minDistance = 3;
    c.maxDistance = 95;
    c.maxPolarAngle = 1.32;
    c.minPolarAngle = 0.2;
    c.zoomSpeed = 1.2;
    c.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
    c.update();

    // 环境贴图（玻璃反射）
    const pm = new THREE.PMREMGenerator(r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    for (const k of ['glass', 'lit']) MAT[k].envMap = this.envTex;

    // 光照
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#5b6b3a', 0.8);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#fff4e0', 3));
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.025;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    this.scene.add(sun, sun.target);

    this.scene.fog = new THREE.Fog('#c4dcef', 70, 260);
    this.buildSky();
    this.buildWater();

    // 后期：泛光
    const comp = (this.composer = new EffectComposer(r));
    comp.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.9);
    comp.addPass(this.bloom);
    comp.addPass(new OutputPass());
    this.quality = 'high';

    window.addEventListener('resize', () => this.resize());
    this.nightFactor = 0;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
    this.sun.shadow.mapSize.set(q === 'high' ? 4096 : 2048, q === 'high' ? 4096 : 2048);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.resize();
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(500, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
        uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uNight: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uTop, uHor, uSunCol, uSunDir, uMoonDir; uniform float uNight; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(uHor, uTop, pow(clamp(h,0.0,1.0), 0.55)) : mix(uHor, uHor*0.55, pow(clamp(-h,0.0,1.0),0.5));
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 10.0) * 0.28) * (1.0 - uNight*0.9);
          float md = max(dot(d, uMoonDir), 0.0);
          col += vec3(0.9,0.95,1.0) * pow(md, 1600.0) * 3.0 * uNight;
          col += vec3(0.5,0.6,0.9) * pow(md, 30.0) * 0.08 * uNight;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // 星空
    const n = 1500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.95);
      pos[i * 3] = Math.sin(v) * Math.cos(u) * 480;
      pos[i * 3 + 1] = Math.cos(v) * 480;
      pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 480;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildWater() {
    // 程序化法线贴图
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    const hgt = (x, y) => {
      let v = 0;
      for (let k = 1; k <= 4; k++) {
        const f = k * 2;
        v += Math.sin((x * f + y * (k % 2 ? 1 : -1) * f * 0.7) * Math.PI * 2 / S + k) / k;
        v += Math.cos((y * f * 1.3 - x * f * 0.4) * Math.PI * 2 / S + k * 2) / (k * 1.5);
      }
      return v;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(60, 60);
    this.waterNormal = tex;
    this.waterMat = new THREE.MeshStandardMaterial({
      color: '#2a7ea3', roughness: 0.14, metalness: 0.1, transparent: true, opacity: 0.84,
      normalMap: tex, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 1.1,
    });
    this.waterMat.envMap = this.envTex;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), this.waterMat);
    w.rotation.x = -Math.PI / 2;
    w.position.y = -0.1;
    w.receiveShadow = true;
    this.water = w;
    this.scene.add(w);
  }

  // hour: 0~24 浮点
  updateDayNight(hour, dt) {
    let a = KC[0], b = KC[1];
    for (let i = 0; i < KC.length - 1; i++) if (hour >= KC[i].h && hour <= KC[i + 1].h) { a = KC[i]; b = KC[i + 1]; break; }
    const t = (hour - a.h) / Math.max(0.001, b.h - a.h);
    const top = a.top.clone().lerp(b.top, t), hor = a.hor.clone().lerp(b.hor, t);
    const sunCol = a.sun.clone().lerp(b.sun, t), fog = a.fog.clone().lerp(b.fog, t);
    const si = lerp(a.si, b.si, t), hemi = lerp(a.hemi, b.hemi, t), env = lerp(a.env, b.env, t);
    const night = lerp(a.night, b.night, t);
    this.nightFactor = night;

    // 太阳方位
    const sunAng = ((hour - 6) / 12) * Math.PI; // 6点升起，18点落下
    const elev = Math.sin(sunAng);
    const sunDir = new THREE.Vector3(Math.cos(sunAng) * 0.95, Math.max(elev, -0.3) * 0.8, 0.6).normalize();
    const moonDir = new THREE.Vector3(-Math.cos(sunAng) * 0.8, Math.max(-elev, 0.15) + 0.2, -0.4).normalize();
    const lightDir = elev > 0.05 ? sunDir : moonDir;

    const tgt = this.controls.target;
    const dist = this.camera.position.distanceTo(tgt);
    const half = clamp(dist * 0.95, 14, 52);
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) {
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    // 阴影中心对齐像素网格，减少闪烁
    const snap = (half * 2) / this.sun.shadow.mapSize.x;
    const cx = Math.round(tgt.x / snap) * snap, cz = Math.round(tgt.z / snap) * snap;
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + lightDir.x * 120, lightDir.y * 120, cz + lightDir.z * 120);
    this.sun.color.copy(sunCol);
    this.sun.intensity = si * smoothstep(-0.05, 0.12, elev > 0.05 ? elev : 0.2);

    this.hemi.intensity = hemi;
    this.hemi.color.copy(top).lerp(new THREE.Color('#ffffff'), 0.5);
    this.hemi.groundColor.set(night > 0.5 ? '#1a2030' : '#5b6b3a');

    this.skyMat.uniforms.uTop.value.copy(top);
    this.skyMat.uniforms.uHor.value.copy(hor);
    this.skyMat.uniforms.uSunDir.value.copy(sunDir);
    this.skyMat.uniforms.uMoonDir.value.copy(moonDir);
    this.skyMat.uniforms.uSunCol.value.copy(sunCol);
    this.skyMat.uniforms.uNight.value = night;
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.starMat.opacity = smoothstep(0.6, 1, night) * 0.9;

    this.scene.fog.color.copy(fog);
    this.scene.environmentIntensity = env * 0.3;
    MAT.glass.envMapIntensity = MAT.lit.envMapIntensity = 0.25 + env * 1.6;
    this.waterMat.envMapIntensity = 0.05 + env * 1.6;

    // 夜间灯光
    const lights = smoothstep(0.25, 0.8, night);
    MAT.lit.emissiveIntensity = lights * 0.75;
    MAT.glow.emissiveIntensity = 0.15 + lights * 1.3;
    this.bloom.strength = 0.1 + lights * 0.45;
    this.bloom.threshold = lerp(1.0, 0.82, lights);
    this.bloom.radius = 0.35;
    this.lights = lights;

    // 水面流动
    this.waterNormal.offset.x += dt * 0.004;
    this.waterNormal.offset.y += dt * 0.0025;
    this.waterMat.color.set(night > 0.5 ? '#123a55' : '#2a7ea3');
  }

  render() {
    this.composer.render();
  }
}
