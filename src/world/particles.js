// 粒子：烟囱烟雾、冷却塔蒸汽、喷泉水花、施工尘土
import * as THREE from 'three';

const N = 2400;

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.size = new Float32Array(N);
    this.alpha = new Float32Array(N);
    this.color = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.max = new Float32Array(N);
    this.grow = new Float32Array(N);
    this.grav = new Float32Array(N);
    this.base = new Float32Array(N);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: window.innerHeight * 0.6 }, uLight: { value: 1 } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        uniform float uScale; varying float vA; varying vec3 vC;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / -mv.z;
          vA = aAlpha; vC = aColor;
        }`,
      fragmentShader: `
        uniform float uLight; varying float vA; varying vec3 vC;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.1, r) * vA;
          gl_FragColor = vec4(vC * uLight, a);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.emitters = new Set();
    window.addEventListener('resize', () => { this.mat.uniforms.uScale.value = window.innerHeight * 0.6; });
  }

  addEmitter(e) { e.acc = Math.random(); this.emitters.add(e); return e; }
  removeEmitter(e) { this.emitters.delete(e); }

  spawn(x, y, z, vx, vy, vz, size, life, r, g, b, alpha, grow = 1, grav = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % N;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.size[i] = size;
    this.life[i] = 0;
    this.max[i] = life;
    this.color[i * 3] = r; this.color[i * 3 + 1] = g; this.color[i * 3 + 2] = b;
    this.base[i] = alpha;
    this.alpha[i] = 0;
    this.grow[i] = grow;
    this.grav[i] = grav;
  }

  dust(x, z, n = 18) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = 0.2 + Math.random() * 0.5;
      this.spawn(x + Math.cos(a) * 0.3, 0.05 + Math.random() * 0.1, z + Math.sin(a) * 0.3,
        Math.cos(a) * s, 0.15 + Math.random() * 0.3, Math.sin(a) * s,
        0.25 + Math.random() * 0.2, 0.9 + Math.random() * 0.6, 0.72, 0.64, 0.52, 0.55, 1.2, -0.25);
    }
  }

  update(dt, simRate, light) {
    this.mat.uniforms.uLight.value = light;
    // 发射
    if (simRate > 0) {
      for (const e of this.emitters) {
        const s = e.scale;
        if (s < 0) {
          e.acc += dt * 30;
          while (e.acc > 1) {
            e.acc -= 1;
            const a = Math.random() * Math.PI * 2, sp = 0.08 + Math.random() * 0.08;
            this.spawn(e.x, e.y, e.z, Math.cos(a) * sp, 0.55 + Math.random() * 0.2, Math.sin(a) * sp, 0.05, 0.9, 0.85, 0.94, 1.0, 0.8, 0.2, 1.2);
          }
          continue;
        }
        e.acc += dt * (s > 2 ? 4 : 6) * Math.min(simRate, 2);
        while (e.acc > 1) {
          e.acc -= 1;
          const steam = s > 2;
          const c = steam ? 0.95 : 0.55 + Math.random() * 0.15;
          this.spawn(
            e.x + (Math.random() - 0.5) * 0.05 * s, e.y, e.z + (Math.random() - 0.5) * 0.05 * s,
            0.12 + Math.random() * 0.06, (steam ? 0.35 : 0.3) + Math.random() * 0.1, 0.03 + (Math.random() - 0.5) * 0.05,
            (steam ? 0.35 : 0.18) * s, steam ? 5 : 4.5, c, c, c * 1.02, steam ? 0.45 : 0.5, steam ? 0.9 : 0.75, 0,
          );
        }
      }
    }
    // 更新
    const p = this.pos, v = this.vel;
    for (let i = 0; i < N; i++) {
      if (this.life[i] >= this.max[i]) { this.alpha[i] = 0; continue; }
      this.life[i] += dt;
      const t = this.life[i] / this.max[i];
      v[i * 3 + 1] -= this.grav[i] * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (this.grav[i] > 0.5 && p[i * 3 + 1] < 0.05) this.life[i] = this.max[i];
      this.size[i] += this.grow[i] * dt * 0.12;
      this.alpha[i] = this.base[i] * Math.min(1, t * 6) * (1 - t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}
