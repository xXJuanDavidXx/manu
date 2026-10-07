import * as THREE from 'three';
import { radialTexture } from '../core/textures.js';

// El espíritu: una figura velada hecha de luz (capucha, rostro en sombra y un
// manto que ondea y se deshace en jirones detrás de ella). Lleva en la mano la
// antorcha de Hécate, una corona de luna triple, y la acompañan tres luces —la
// triple diosa—. Las brasas brotan de la antorcha. Se pilota en el vuelo
// libre: siempre avanza y se guía con yaw/pitch.

// --- manto: partículas en la superficie de una silueta de capucha + túnica ---
const veilVertex = /* glsl */ `
  uniform float uTime;
  uniform float uFlutter;   // graves de la música: el manto ondea más
  uniform float uDrift;     // 0..1 según la velocidad: el manto se va hacia atrás
  uniform float uPixelRatio;
  uniform float uOpacity;
  uniform vec3 uTorch;      // posición local de la antorcha (luz cálida)
  attribute float aU;       // 0 = coronilla · 1 = borde del manto
  attribute float aTheta;
  attribute float aSeed;
  attribute float aKind;    // 0 = manto · 1 = jirón que se desprende
  varying float vAlpha;
  varying vec3 vColor;

  float radiusAt(float u) {
    if (u < 0.2) { float t = u / 0.2; return 0.2 * sqrt(1.0 - (1.0 - t) * (1.0 - t)); } // capucha
    if (u < 0.32) return mix(0.2, 0.29, smoothstep(0.2, 0.32, u));                      // hombros
    float t = (u - 0.32) / 0.68;
    return 0.29 - 0.05 * sin(t * 3.1416) + 0.2 * pow(t, 2.2);                            // túnica: talle y vuelo
  }

  vec3 veilPoint(float u, float th) {
    float r = radiusAt(u);
    r += sin(th * 3.0 + uTime * 2.4 + u * 8.0 + aSeed * 2.0) * 0.035 * u * (1.0 + uFlutter * 2.5);
    vec3 p = vec3(cos(th) * r, 0.55 - u * 1.5, sin(th) * r);
    p.z += u * u * (0.08 + 0.32 * uDrift);                         // el manto se queda atrás
    p.y += sin(uTime * 1.8 + th * 2.0) * 0.025 * u;
    return p;
  }

  void main() {
    vec3 p;
    float alpha;
    if (aKind < 0.5) {
      p = veilPoint(aU, aTheta);
      alpha = 0.5 * (1.0 - smoothstep(0.82, 1.0, aU) * 0.55);
      // rostro en sombra: sin luz en el frente de la capucha
      if (aU < 0.24 && sin(aTheta) < -0.55) alpha = 0.0;
    } else {
      // jirones: nacen en el borde del manto y fluyen hacia atrás
      float t = fract(uTime * (0.3 + aSeed * 0.25) + aSeed);
      p = veilPoint(1.0, aTheta);
      p += vec3(sin(t * 6.0 + aSeed * 9.0) * 0.12 * t, -0.25 * t, t * (0.8 + 1.4 * uDrift));
      alpha = (1.0 - t) * 0.45;
    }

    float warm = exp(-distance(p, uTorch) * 2.4);
    vec3 veil = mix(vec3(0.93, 0.91, 1.0), vec3(0.62, 0.5, 1.0), aU);
    vColor = mix(veil, vec3(1.0, 0.68, 0.36), warm * 0.85);
    vAlpha = alpha * uOpacity;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = (0.6 + aSeed * 0.6) * 0.05;
    gl_PointSize = min(size * (300.0 / -mv.z), 12.0) * uPixelRatio;
  }
`;

const veilFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha <= 0.0) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * vAlpha);
  }
`;

// --- brasas de la antorcha ---
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

// Corona de luna triple: creciente · llena · creciente.
function crownTexture() {
  const w = 256, h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const R = 26, cy = h / 2;
  ctx.shadowColor = 'rgba(201,179,255,0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w / 2, cy, R, 0, Math.PI * 2);
  ctx.fill();
  for (const dir of [-1, 1]) {
    const layer = document.createElement('canvas');
    layer.width = w;
    layer.height = h;
    const l = layer.getContext('2d');
    const cx = w / 2 + dir * R * 2.6;
    l.fillStyle = '#fff';
    l.beginPath();
    l.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
    l.fill();
    l.globalCompositeOperation = 'destination-out';
    l.beginPath();
    l.arc(cx + dir * R * 0.62, cy, R * 0.9, 0, Math.PI * 2);
    l.fill();
    ctx.drawImage(layer, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const UP = new THREE.Vector3(0, 1, 0);
const BOUND = 46; // más allá, el espíritu vuelve suavemente hacia la galaxia
const TORCH = new THREE.Vector3(0.38, 0.12, -0.2); // mano derecha, algo adelante

export class Spirit {
  constructor(scene, { isMobile = false, pixelRatio = 1 } = {}) {
    this.active = false;
    this.yaw = 0;
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._tmp = new THREE.Vector3();
    this._torchWorld = new THREE.Vector3();
    this._appear = 0;

    this.group = new THREE.Group();
    this.group.visible = false;
    const glow = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

    // --- manto velado ---
    const shell = isMobile ? 1100 : 2400;
    const strands = isMobile ? 260 : 520;
    const n = shell + strands;
    const aU = new Float32Array(n);
    const aTheta = new Float32Array(n);
    const aSeed = new Float32Array(n);
    const aKind = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const isStrand = i >= shell;
      // más densidad abajo (la túnica es más grande que la capucha)
      aU[i] = isStrand ? 1 : Math.pow(Math.random(), 0.75);
      aTheta[i] = Math.random() * Math.PI * 2;
      aSeed[i] = Math.random();
      aKind[i] = isStrand ? 1 : 0;
    }
    const veilGeo = new THREE.BufferGeometry();
    veilGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // la calcula el shader
    veilGeo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
    veilGeo.setAttribute('aTheta', new THREE.BufferAttribute(aTheta, 1));
    veilGeo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    veilGeo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
    this.veil = new THREE.Points(veilGeo, new THREE.ShaderMaterial({
      vertexShader: veilVertex, fragmentShader: veilFragment, ...additive,
      uniforms: {
        uTime: { value: 0 }, uFlutter: { value: 0 }, uDrift: { value: 0 },
        uPixelRatio: { value: pixelRatio }, uOpacity: { value: 0 }, uTorch: { value: TORCH },
      },
    }));
    this.veil.frustumCulled = false;
    this.group.add(this.veil);

    // --- corona de luna triple ---
    this.crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: crownTexture(), color: new THREE.Color('#d9c8ff'), ...additive }));
    this.crown.position.set(0, 0.69, 0);
    this.crown.scale.set(0.5, 0.19, 1);
    this.group.add(this.crown);

    // --- antorcha: mango, llama y su resplandor ---
    const handle = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(TORCH.x - 0.03, TORCH.y - 0.42, TORCH.z + 0.08),
        new THREE.Vector3(TORCH.x, TORCH.y - 0.03, TORCH.z),
      ]),
      new THREE.LineBasicMaterial({ color: new THREE.Color('#b08850'), transparent: true, opacity: 0.8 }),
    );
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color('#f6a15a'), opacity: 0.55, ...additive }));
    this.halo.position.copy(TORCH);
    this.halo.scale.setScalar(0.9);
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), ...additive }));
    this.flame.position.copy(TORCH);
    this.flame.center.set(0.5, 0.3);
    this.group.add(handle, this.halo, this.flame);

    // --- las tres luces de la triple diosa ---
    this.wisps = ['#c9b3ff', '#ff5d8f', '#ece8f5'].map((c) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(c), opacity: 0.95, ...additive }));
      s.scale.setScalar(0.14);
      this.group.add(s);
      return s;
    });
    scene.add(this.group);

    // --- estela de brasas (pool reutilizable, en coordenadas del mundo) ---
    this.trailCount = isMobile ? 160 : 300;
    this.emitRate = isMobile ? 70 : 130; // brasas/segundo
    this._emitAcc = 0;
    this._next = 0;
    const m = this.trailCount;
    this.tPos = new Float32Array(m * 3);
    this.tVel = new Float32Array(m * 3);
    this.tLife = new Float32Array(m);   // fracción restante 1..0
    this.tMax = new Float32Array(m);    // duración total
    this.tSize = new Float32Array(m);
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

  // Aparece en `pos` mirando hacia `dir`; se materializa en un instante.
  spawn(pos, dir) {
    this.group.position.copy(pos);
    this.setHeading(dir);
    this.speed = 0;
    this.bank = 0;
    this._appear = 0;
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

  // Dónde debe ir la cámara para seguir al espíritu.
  chasePosition(out) {
    return out.copy(this.group.position).addScaledVector(this.forward, -3.9).addScaledVector(UP, 1.0);
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

      // postura: se inclina en los giros y al subir/bajar (solo visual)
      this.bank += (input.yaw * -0.45 - this.bank) * Math.min(1, dt * 4);
      this.group.rotation.set(this.pitch * 0.6, this.yaw, this.bank, 'YXZ');
      this.group.position.y += Math.sin(time * 1.6) * 0.0015; // flota

      this._appear = Math.min(1, this._appear + dt * 1.4);
      const bass = audio ? audio.bass : 0;
      const u = this.veil.material.uniforms;
      u.uTime.value = time;
      u.uFlutter.value = bass;
      u.uDrift.value = THREE.MathUtils.clamp((this.speed - 4) / 11, 0, 1);
      u.uOpacity.value = this._appear;
      this.crown.material.opacity = 0.75 * this._appear * (0.8 + bass * 0.4);

      // la antorcha titila; las tres luces orbitan al espíritu
      const flick = 1 + Math.sin(time * 23) * 0.05 + Math.sin(time * 37) * 0.04 + bass * 0.3;
      const a = this._appear;
      this.flame.scale.set(0.24 * flick * a, 0.36 * (flick + (input.boost ? 0.3 : 0)) * a, 1);
      this.halo.material.opacity = (0.4 + bass * 0.35 + (input.boost ? 0.2 : 0)) * a;
      this.wisps.forEach((w, i) => {
        const ang = time * 1.9 + (i * Math.PI * 2) / 3;
        w.position.set(Math.cos(ang) * 0.72, 0.1 + Math.sin(ang * 1.3) * 0.22, Math.sin(ang) * 0.72);
        w.material.opacity = 0.95 * a;
      });

      this.group.updateMatrixWorld();
      this._torchWorld.copy(TORCH).applyMatrix4(this.group.matrixWorld);
      this._emitAcc += dt * this.emitRate * (input.boost ? 1.8 : 1) * a;
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
    const p = this._torchWorld;
    const f = this.forward;
    const r = () => (Math.random() - 0.5);
    this.tPos[i3] = p.x + r() * 0.08;
    this.tPos[i3 + 1] = p.y + r() * 0.08 + 0.08;
    this.tPos[i3 + 2] = p.z + r() * 0.08;
    const back = this.speed * 0.12;
    this.tVel[i3] = -f.x * back + r() * 0.4;
    this.tVel[i3 + 1] = -f.y * back + r() * 0.4 + 0.25;
    this.tVel[i3 + 2] = -f.z * back + r() * 0.4;
    this.tMax[i] = 0.8 + Math.random() * 0.7;
    this.tLife[i] = 1;
    this.tSize[i] = 0.04 + Math.random() * 0.06;
  }
}
