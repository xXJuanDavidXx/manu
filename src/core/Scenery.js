import * as THREE from 'three';
import { drawHecateSigil } from './shapes.js';

// Ambiente espacial: campo de estrellas, nebulosas de color, estrellas fugaces
// y el sigilo de Hécate flotando siempre de fondo. Todas las texturas se generan
// en canvas (nada externo) y los objetos se reutilizan (sin allocs por frame).

function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cometTexture() {
  const w = 256, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.85, 'rgba(200,220,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h / 2 - 2, w, 4);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.arc(w - 8, h / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sigilTexture() {
  const s = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.shadowColor = 'rgba(180,140,255,0.9)';
  ctx.shadowBlur = 22;
  drawHecateSigil(ctx, s, s, s * 0.006);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Scenery {
  constructor(scene, { starCount = 15000, isMobile = false } = {}) {
    this.scene = scene;

    // --- campo de estrellas ---
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 20 + Math.random() * 40;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = r * Math.cos(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.06, color: 0xffffff, transparent: true, opacity: 0.6, sizeAttenuation: true, depthWrite: false,
    }));
    scene.add(this.stars);

    // --- nebulosas ---
    this.nebulaGroup = new THREE.Group();
    const nebTex = radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    const nebColors = ['#5b2a86', '#1e3a8a', '#7a1f5c', '#241a52', '#0e4d6e'];
    const nebCount = isMobile ? 3 : nebColors.length;
    for (let i = 0; i < nebCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: nebTex, color: new THREE.Color(nebColors[i]), transparent: true,
        opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const spr = new THREE.Sprite(mat);
      const r = 22 + Math.random() * 20;
      const a = Math.random() * Math.PI * 2;
      spr.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 24, Math.sin(a) * r);
      const sc = 24 + Math.random() * 22;
      spr.scale.set(sc, sc, 1);
      this.nebulaGroup.add(spr);
    }
    scene.add(this.nebulaGroup);

    // --- sigilo de Hécate de fondo ---
    this.sigil = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sigilTexture(), color: new THREE.Color('#c9b3ff'), transparent: true,
      opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.sigil.position.set(0, 0, -34);
    this.sigil.scale.set(30, 30, 1);
    scene.add(this.sigil);

    // --- estrellas fugaces (pool reutilizable) ---
    const comet = cometTexture();
    this.shooting = [];
    const shootCount = isMobile ? 2 : 4;
    for (let i = 0; i < shootCount; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: comet, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.center.set(1, 0.5); // ancla en la cabeza del cometa
      scene.add(spr);
      this.shooting.push({ sprite: spr, vel: new THREE.Vector3(), life: 0 });
    }
    this._nextSpawn = 1.5;
  }

  _spawnShootingStar() {
    const s = this.shooting.find((s) => s.life <= 0);
    if (!s) return;
    const r = 28;
    const a = Math.random() * Math.PI * 2;
    s.sprite.position.set(Math.cos(a) * r, 6 + Math.random() * 14, Math.sin(a) * r - 6);
    const speed = 22 + Math.random() * 16;
    s.vel.set(-Math.cos(a) * 0.6, -0.4 - Math.random() * 0.5, -Math.sin(a) * 0.6 + 0.2)
      .normalize().multiplyScalar(speed);
    const len = 3 + Math.random() * 3;
    s.sprite.scale.set(len, len * 0.25, 1);
    s.sprite.material.rotation = Math.atan2(s.vel.y, s.vel.x);
    s.life = 1.2 + Math.random() * 0.8;
    s.maxLife = s.life;
  }

  update(dt, audio) {
    const bass = audio ? audio.bass : 0;
    const mid = audio ? audio.mid : 0;

    this.stars.rotation.y += (0.01 + bass * 0.03) * dt;
    this.stars.material.opacity = 0.35 + mid * 0.45;

    this.nebulaGroup.rotation.y += 0.012 * dt;
    this.nebulaGroup.rotation.z += 0.004 * dt;

    this.sigil.material.rotation += (0.05 + bass * 0.15) * dt;
    this.sigil.material.opacity = 0.08 + mid * 0.10;

    this._nextSpawn -= dt;
    if (this._nextSpawn <= 0) {
      this._spawnShootingStar();
      this._nextSpawn = 2.5 + Math.random() * 4;
    }
    for (const s of this.shooting) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.sprite.position.addScaledVector(s.vel, dt);
      const k = Math.max(0, s.life / s.maxLife);
      s.sprite.material.opacity = Math.sin(k * Math.PI) * 0.9;
      if (s.life <= 0) s.sprite.material.opacity = 0;
    }
  }
}
