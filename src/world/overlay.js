// 区划/网格/热力图覆盖层 + 建造预览
import * as THREE from 'three';
import { MAP, HALF, ZONE_COLORS } from '../core/config.js';
import { tileToWorld } from '../core/utils.js';

export class Overlay {
  constructor(scene) {
    this.zoneData = new Uint8Array(MAP * MAP * 4);
    this.zoneTex = new THREE.DataTexture(this.zoneData, MAP, MAP, THREE.RGBAFormat);
    this.zoneTex.magFilter = this.zoneTex.minFilter = THREE.NearestFilter;
    this.zoneTex.needsUpdate = true;
    this.heatData = new Uint8Array(MAP * MAP * 4);
    this.heatTex = new THREE.DataTexture(this.heatData, MAP, MAP, THREE.RGBAFormat);
    this.heatTex.magFilter = this.heatTex.minFilter = THREE.LinearFilter;
    this.heatTex.needsUpdate = true;

    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uZone: { value: this.zoneTex }, uHeat: { value: this.heatTex }, uHeatOn: { value: 0 },
        uGrid: { value: 0 }, uHover: { value: new THREE.Vector2(9999, 9999) }, uTime: { value: 0 },
        uMap: { value: MAP }, uHalf: { value: HALF }, uLight: { value: 1 },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform sampler2D uZone, uHeat; uniform float uHeatOn, uGrid, uTime, uMap, uHalf, uLight; uniform vec2 uHover;
        varying vec3 vW;
        void main(){
          vec2 cell = vW.xz + uHalf;
          vec2 f = fract(cell);
          vec2 id = floor(cell);
          vec4 z = texture2D(uZone, (id + 0.5) / uMap);
          float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
          vec4 col = vec4(0.0);
          if (z.a > 0.0) {
            float inset = smoothstep(0.05, 0.07, edge);
            float border = (1.0 - smoothstep(0.1, 0.12, edge)) * inset;
            float pulse = 0.85 + 0.15 * sin(uTime * 2.5);
            col = vec4(z.rgb, (0.3 * inset + 0.7 * border) * z.a * pulse);
          }
          if (uHeatOn > 0.5) {
            vec4 h = texture2D(uHeat, cell / uMap);
            col.rgb = mix(col.rgb, h.rgb, h.a);
            col.a = max(col.a, h.a * 0.62);
          }
          float gl = 1.0 - smoothstep(0.0, 0.03, edge);
          float d = distance(vW.xz, uHover);
          float ga = gl * uGrid * (0.5 * (1.0 - smoothstep(3.0, 12.0, d)) + 0.05);
          col.rgb = mix(col.rgb, vec3(1.0), ga / max(col.a + ga, 0.001));
          col.a = col.a + ga * (1.0 - col.a);
          if (col.a < 0.004) discard;
          gl_FragColor = vec4(col.rgb * uLight, col.a);
        }`,
    });
    const g = new THREE.PlaneGeometry(MAP, MAP).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.position.y = 0.03;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);

    // 预览方块
    const pg = new THREE.BoxGeometry(0.92, 0.06, 0.92).translate(0, 0.03, 0);
    this.prevMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    this.preview = new THREE.InstancedMesh(pg, this.prevMat, MAP * MAP);
    this.preview.count = 0;
    this.preview.frustumCulled = false;
    this.preview.renderOrder = 4;
    scene.add(this.preview);

    // 悬停光标
    const cg = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.1, 1));
    this.cursor = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, fog: false }));
    this.cursor.position.y = 0.06;
    this.cursor.visible = false;
    scene.add(this.cursor);
  }

  setZone(x, z, zone, hasBuilding) {
    const i = (z * MAP + x) * 4;
    if (zone && !hasBuilding) {
      const c = ZONE_COLORS[zone];
      this.zoneData[i] = c[0] * 255; this.zoneData[i + 1] = c[1] * 255; this.zoneData[i + 2] = c[2] * 255; this.zoneData[i + 3] = 255;
    } else {
      this.zoneData[i + 3] = 0;
    }
    this.zoneTex.needsUpdate = true;
  }

  // mode: null | 'land' | 'pollution' | 'power'
  setHeat(mode, city) {
    this.mat.uniforms.uHeatOn.value = mode ? 1 : 0;
    if (!mode) return;
    const c = new THREE.Color();
    for (let i = 0; i < MAP * MAP; i++) {
      let v, a = 0.85;
      if (mode === 'land') { v = city.landValue[i] / 100; c.setHSL(0.0 + v * 0.33, 0.85, 0.5); }
      else if (mode === 'pollution') { v = city.fields.pollution[i]; c.setHSL(0.28 - v * 0.28, 0.8, 0.45 + (1 - v) * 0.1); a = v > 0.02 ? 0.4 + v * 0.5 : 0.15; }
      else if (mode === 'service') {
        const F = city.fields;
        v = Math.min(1, (F.police[i] + F.fire[i] + F.health[i] + F.edu[i]) / 2.5);
        c.setHSL(0.6, 0.8, 0.2 + v * 0.45); a = 0.25 + v * 0.6;
      }
      if (city.water[i]) a = 0;
      this.heatData[i * 4] = c.r * 255; this.heatData[i * 4 + 1] = c.g * 255; this.heatData[i * 4 + 2] = c.b * 255;
      this.heatData[i * 4 + 3] = a * 255;
    }
    this.heatTex.needsUpdate = true;
  }

  showPreview(tiles, color) {
    const m = new THREE.Matrix4();
    const cache = (this._colors ||= new Map());
    const get = (h) => { if (!cache.has(h)) cache.set(h, new THREE.Color(h)); return cache.get(h); };
    const col = get(color);
    let n = 0;
    for (const t of tiles) {
      m.makeTranslation(tileToWorld(t[0]), 0, tileToWorld(t[1]));
      this.preview.setMatrixAt(n, m);
      this.preview.setColorAt(n, t[2] ? get(t[2]) : col);
      n++;
    }
    this.preview.count = n;
    this.preview.instanceMatrix.needsUpdate = true;
    if (this.preview.instanceColor) this.preview.instanceColor.needsUpdate = true;
  }
  clearPreview() { this.preview.count = 0; }

  setCursor(x, z, n = 1, color = '#ffffff') {
    if (x == null) { this.cursor.visible = false; return; }
    this.cursor.visible = true;
    const o = Math.floor((n - 1) / 2);
    this.cursor.scale.set(n, 1, n);
    this.cursor.position.set(tileToWorld(x - o) + (n - 1) / 2, 0.06, tileToWorld(z - o) + (n - 1) / 2);
    this.cursor.material.color.set(color);
  }

  update(t, light = 1) { this.mat.uniforms.uTime.value = t; this.mat.uniforms.uLight.value = light; }
}
