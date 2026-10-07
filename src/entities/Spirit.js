import * as THREE from 'three';
import { radialTexture } from '../core/textures.js';

// El espíritu de la llama: una llama viva (la antorcha de Hécate) con tres
// luces que la orbitan —la triple diosa— y una estela de brasas. Se pilota en
// el vuelo libre; siempre avanza y se guía con yaw/pitch.

const trailVertex = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // tope: las brasas que pasan junto a la cámara no se vuelven manchas gigantes
    gl_PointSize = min(aSize * sqrt(aLife) * (300.0 / -mv.z), 14.0) * uPixelRatio;
  }
`;

const trailFragment = /* glsl */ `
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vLife <= 0.0) discard;
    vec3 hot = vec3(1.0, 0.95, 0.82);
    vec3 ember = vec3(0.96, 0.55, 0.28);
    vec3 spirit = vec3(0.72, 0.6, 1.0);
    vec3 c = vLife > 0.55 ? mix(ember, hot, (vLife - 0.55) / 0.45) : mix(spirit, ember, vLife / 0.55);
    gl_FragColor = vec4(c, smoothstep(0.5, 0.0, d) * vLife);
  }
`;

function flameTexture() {
  const w = 128, h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // gota invertida: punta arriba, panza abajo
  const g = ctx.createRadialGradient(w / 2, h * 0.68, 2, w / 2, h * 0.62, h * 0.5);
  g.addColorStop(0, 'rgba(255,252,240,1)');
  g.addColorStop(0.25, 'rgba(255,214,140,0.95)');
  g.addColorStop(0.55, 'rgba(246,140,70,0.6)');
  g.addColorStop(1, 'rgba(160,80,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.04);
  ctx.bezierCurveTo(w * 0.62, h * 0.3, w * 0.95, h * 0.5, w * 0.86, h * 0.72);
  ctx.bezierCurveTo(w * 0.78, h * 0.94, w * 0.22, h * 0.94, w * 0.14, h * 0.72);
  ctx.bezierCurveTo(w * 0.05, h * 0.5, w * 0.38, h * 0.3, w / 2, h * 0.04);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const UP = new THREE.Vector3(0, 1, 0);
const BOUND = 46; // más allá, la llama vuelve suavemente hacia la galaxia

export class Spirit {
  constructor(scene, { isMobile = false, pixelRatio = 1 } = {}) {
    this.active = false;
    this.yaw = 0;
    this.pitch = 0;
    this.speed = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._tmp = new THREE.Vector3();

    // --- cuerpo: halo + llama + tres luces ---
    this.group = new THREE.Group();
    this.group.visible = false;
    const glow = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color('#f6a15a'), opacity: 0.55, ...additive }));
    this.halo.scale.setScalar(1.15);
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), ...additive }));
    this.flame.center.set(0.5, 0.3);
    this.flame.scale.set(0.42, 0.63, 1);
    this.group.add(this.halo, this.flame);

    this.wisps = ['#c9b3ff', '#ff5d8f', '#ece8f5'].map((c) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(c), opacity: 0.95, ...additive }));
      s.scale.setScalar(0.16);
      this.group.add(s);
      return s;
    });
    scene.add(this.group);

    // --- estela de brasas (pool reutilizable) ---
    this.trailCount = isMobile ? 160 : 300;
    this.emitRate = isMobile ? 80 : 150; // brasas/segundo
    this._emitAcc = 0;
    this._next = 0;
    const n = this.trailCount;
    this.tPos = new Float32Array(n * 3);
    this.tVel = new Float32Array(n * 3);
    this.tLife = new Float32Array(n);   // fracción restante 1..0
    this.tMax = new Float32Array(n);    // duración total
    this.tSize = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.tLife, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.tSize, 1));
    this.trail = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: trailVertex, fragmentShader: trailFragment,
      uniforms: { uPixelRatio: { value: pixelRatio } }, ...additive,
    }));
    this.trail.frustumCulled = false;
    scene.add(this.trail);
  }

  get position() { return this.group.position; }

  // Aparece en `pos` mirando hacia `dir`.
  spawn(pos, dir) {
    this.group.position.copy(pos);
    this.setHeading(dir);
    this.speed = 0;
    this.active = true;
    this.group.visible = true;
  }

  dismiss() {
    this.active = false;
    this.group.visible = false;
  }

  setHeading(dir) {
    const d = this._tmp.copy(dir).normalize();
    this.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    this.yaw = Math.atan2(-d.x, -d.z);
    this._updateForward();
  }

  _updateForward() {
    this._euler.set(this.pitch, this.yaw, 0);
    this.forward.set(0, 0, -1).applyEuler(this._euler);
  }

  // Dónde debe ir la cámara para seguir a la llama.
  chasePosition(out) {
    return out.copy(this.group.position).addScaledVector(this.forward, -3.2).addScaledVector(UP, 1.05);
  }

  update(dt, time, input, audio) {
    if (this.active) {
      // giro y avance
      this.yaw -= input.yaw * 1.7 * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.pitch * 1.3 * dt, -1.25, 1.25);
      if (!input.pitch) this.pitch *= 1 - Math.min(1, dt * 0.35); // se nivela sola despacio
      this._updateForward();

      // límite suave del espacio: vuelve hacia el centro
      const dist = this.group.position.length();
      if (dist > BOUND) {
        const k = Math.min(1, ((dist - BOUND) / 10) * dt * 3);
        const toCenter = this._tmp.copy(this.group.position).multiplyScalar(-k / dist);
        this.setHeading(toCenter.addScaledVector(this.forward, 1 - k));
      }

      const target = input.boost ? 15 : 6;
      this.speed += (target - this.speed) * Math.min(1, dt * 2.2);
      this.group.position.addScaledVector(this.forward, this.speed * dt);

      // la llama titila; las tres luces la orbitan
      const bass = audio ? audio.bass : 0;
      const flick = 1 + Math.sin(time * 23) * 0.05 + Math.sin(time * 37) * 0.04 + bass * 0.3;
      this.flame.scale.set(0.42 * flick, 0.63 * (flick + (input.boost ? 0.25 : 0)), 1);
      this.halo.material.opacity = 0.45 + bass * 0.35 + (input.boost ? 0.2 : 0);
      this.wisps.forEach((w, i) => {
        const a = time * 2.1 + (i * Math.PI * 2) / 3;
        w.position.set(Math.cos(a) * 0.48, Math.sin(a * 1.3) * 0.16, Math.sin(a) * 0.48);
      });

      this._emitAcc += dt * this.emitRate * (input.boost ? 1.8 : 1);
    }

    // emitir brasas
    while (this._emitAcc >= 1) {
      this._emitAcc -= 1;
      this._emit();
    }

    // avanzar brasas
    for (let i = 0; i < this.trailCount; i++) {
      if (this.tLife[i] <= 0) continue;
      const i3 = i * 3;
      this.tPos[i3] += this.tVel[i3] * dt;
      this.tPos[i3 + 1] += this.tVel[i3 + 1] * dt;
      this.tPos[i3 + 2] += this.tVel[i3 + 2] * dt;
      this.tVel[i3 + 1] += 0.35 * dt; // las brasas suben
      this.tLife[i] = Math.max(0, this.tLife[i] - dt / this.tMax[i]);
    }
    const g = this.trail.geometry.attributes;
    g.position.needsUpdate = true;
    g.aLife.needsUpdate = true;
    g.aSize.needsUpdate = true;
  }

  _emit() {
    const i = this._next;
    this._next = (this._next + 1) % this.trailCount;
    const i3 = i * 3;
    const p = this.group.position;
    const f = this.forward;
    const r = () => (Math.random() - 0.5);
    this.tPos[i3] = p.x + r() * 0.18;
    this.tPos[i3 + 1] = p.y + r() * 0.18 - 0.05;
    this.tPos[i3 + 2] = p.z + r() * 0.18;
    const back = this.speed * 0.12;
    this.tVel[i3] = -f.x * back + r() * 0.5;
    this.tVel[i3 + 1] = -f.y * back + r() * 0.5 + 0.2;
    this.tVel[i3 + 2] = -f.z * back + r() * 0.5;
    this.tMax[i] = 0.9 + Math.random() * 0.8;
    this.tLife[i] = 1;
    this.tSize[i] = 0.05 + Math.random() * 0.07;
  }
}
