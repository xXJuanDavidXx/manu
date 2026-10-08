import * as THREE from 'three';
import { radialTexture } from '../core/textures.js';

// Un planeta que orbita la galaxia. La superficie es un shader procedural
// (bandas + ruido, sin texturas externas); los planetas "dormidos" se ven
// apagados, en gris. Cada planeta tiene una etiqueta en DOM que lo sigue en
// pantalla y una esfera invisible más grande para que sea fácil tocarlo.

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uTime;
  uniform float uPulse;
  uniform float uDormant;
  varying vec3 vNormal;
  varying vec3 vPos;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  void main() {
    vec3 p = normalize(vPos);
    float n = noise(p * 3.0 + vec3(0.0, uTime * 0.06, 0.0)) * 0.6 + noise(p * 8.0) * 0.4;
    float bands = sin(p.y * 9.0 + n * 4.0) * 0.5 + 0.5;
    vec3 col = mix(uB, uA, bands) * (0.45 + 0.55 * n);

    // luz suave desde arriba-izquierda y borde luminoso (atmósfera)
    float light = clamp(dot(vNormal, normalize(vec3(-0.4, 0.6, 0.7))), 0.0, 1.0);
    col *= 0.35 + 0.75 * light;
    float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.4);
    col += uA * rim * (0.9 + uPulse * 0.8);

    float grey = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(grey) * 0.45, uDormant);
    gl_FragColor = vec4(col, 1.0);
  }
`;

let haloTex = null;

// Cada planeta escucha una parte de la canción, como las barras de un
// ecualizador: [nivel suavizado, nivel instantáneo, ganancia].
const BANDS = {
  bass: ['bass', 'rawBass', 1],
  mid: ['mid', 'rawMid', 2],
  treble: ['treble', 'rawTreble', 4],
};

export class Planet {
  constructor(def, labelLayer) {
    this.def = def;
    this.awake = Boolean(def.game);
    this.group = new THREE.Group();
    this.worldPos = new THREE.Vector3();

    const [a, b] = def.colors;
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uA: { value: new THREE.Color(a) },
        uB: { value: new THREE.Color(b) },
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uDormant: { value: this.awake ? 0 : 0.75 },
      },
    });
    this.body = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 48, 32), this.material);
    this.group.add(this.body);

    // halo (atmósfera brillante)
    haloTex ??= radialTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, color: new THREE.Color(a), transparent: true,
      opacity: this.awake ? 0.5 : 0.12, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.halo.scale.setScalar(def.radius * 4.2);
    this.group.add(this.halo);

    if (def.ring) {
      const ring = this.ring = new THREE.Mesh(
        new THREE.RingGeometry(def.radius * 1.45, def.radius * 2.1, 96),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(a), transparent: true, opacity: 0.35, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2.4;
      this.group.add(ring);
    }

    // zona de toque: invisible y generosa (en el celular el planeta se ve chico)
    this.hitArea = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius * 2.4, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitArea.userData.planet = this;
    this.group.add(this.hitArea);

    // etiqueta
    this.label = document.createElement('div');
    this.label.className = 'planet-label' + (this.awake ? '' : ' dormant');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = def.name;
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = this.awake ? 'Toca para viajar' : def.subtitle;
    this.label.append(name, sub);
    labelLayer.append(this.label);
    this._nudgeTimer = 0;

    // camino de la órbita: un anillo tenue que el planeta recorre exactamente
    // (se muestra u oculta con el interruptor de órbitas)
    const SEG = 160;
    const pts = new Float32Array(SEG * 3);
    for (let i = 0; i < SEG; i++) this.orbitPoint((i / SEG) * Math.PI * 2, pts, i * 3);
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.orbitBase = this.awake ? 0.2 : 0.08;
    this.orbitLine = new THREE.LineLoop(orbitGeo, new THREE.LineBasicMaterial({
      color: new THREE.Color(this.awake ? a : '#ece8f5'), transparent: true,
      opacity: this.orbitBase, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.orbitLine.visible = false;

    // reacción a la música
    this.band = BANDS[def.band] ?? BANDS.bass;
    this._angle = def.phase; // avanza más rápido cuando la música sube
    this._level = 0;         // nivel suavizado de su banda (0..1)
    this._avg = 0;           // media reciente, para detectar sus golpes
    this._kick = 0;          // impulso del último golpe (1 → 0)
    this._cool = 0;

    this.update(0, 0, null);
  }

  // Punto de la órbita en el ángulo `angle`: un círculo inclinado `tilt`
  // radianes (la altura sigue a z, así el camino se cierra sobre sí mismo).
  orbitPoint(angle, out, o = 0) {
    const d = this.def;
    const z = Math.sin(angle) * d.orbit;
    out[o] = Math.cos(angle) * d.orbit;
    out[o + 1] = Math.sin(d.tilt) * z;
    out[o + 2] = Math.cos(d.tilt) * z;
    return out;
  }

  update(time, dt, audio) {
    const d = this.def;

    // escuchar su banda y detectar sus propios golpes
    const [smooth, raw, gain] = this.band;
    let level = 0;
    if (audio?.isSetup) {
      level = Math.min(1, audio[smooth] * gain);
      const r = audio[raw] * gain;
      this._avg += (r - this._avg) * 0.05;
      this._cool -= dt;
      if (r > this._avg * 1.3 + 0.06 && this._cool <= 0) {
        this._kick = 1;
        this._cool = 0.18;
      }
    }
    this._kick = Math.max(0, this._kick - dt * 4);
    this._level += (level - this._level) * Math.min(1, dt * 10);
    const life = this.awake ? 1 : 0.5; // los dormidos también bailan, más tenues
    const L = this._level * life;
    const K = this._kick * life;

    // la órbita acelera con la música y el planeta da un saltito en cada golpe
    this._angle += dt * d.speed * (1 + L * 3);
    const p = this.orbitPoint(this._angle, this._orbitTmp ??= [0, 0, 0]);
    this.group.position.set(p[0], p[1] + K * K * d.radius * 0.4, p[2]);
    this.group.getWorldPosition(this.worldPos);

    // late: crece con su banda y en cada golpe; gira más rápido con la energía
    this.body.scale.setScalar(1 + L * 0.1 + K * 0.16);
    this.body.rotation.y += dt * (0.15 + L * 0.9);

    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uPulse.value = L * 0.8 + K * 0.7;
    this.halo.material.opacity = (this.awake ? 0.38 : 0.1) + L * 0.35 + K * 0.3;
    this.halo.scale.setScalar(d.radius * 4.2 * (1 + L * 0.18 + K * 0.28));
    // la órbita también brilla con su parte de la canción
    if (this.orbitLine.visible) this.orbitLine.material.opacity = this.orbitBase * (1 + L * 1.6 + K * 1.2);
    if (this.ring) {
      this.ring.scale.setScalar(1 + K * 0.14);
      this.ring.material.opacity = 0.3 + L * 0.3 + K * 0.2;
    }

    if (this._nudgeTimer > 0) {
      this._nudgeTimer -= dt;
      if (this._nudgeTimer <= 0) this.label.classList.remove('nudge');
    }
  }

  // Muestra el subtítulo un momento (p. ej. al tocar un planeta dormido).
  nudge() {
    this.label.classList.add('nudge');
    this._nudgeTimer = 2.6;
  }

  setHover(on) { this.label.classList.toggle('hover', on); }

  // Coloca la etiqueta sobre el planeta en pantalla.
  placeLabel(camera, width, height, visible, tmp) {
    if (!visible) { this.label.style.opacity = 0; return; }
    tmp.copy(this.worldPos);
    tmp.y += this.def.radius * 1.9;
    tmp.project(camera);
    if (tmp.z > 1) { this.label.style.opacity = 0; return; }
    // que el nombre no se salga por los bordes de la pantalla
    const half = (this._labelHalf ||= this.label.offsetWidth / 2) + 8;
    const x = Math.min(width - half, Math.max(half, (tmp.x * 0.5 + 0.5) * width));
    const y = (-tmp.y * 0.5 + 0.5) * height;
    this.label.style.opacity = '';
    this.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}
