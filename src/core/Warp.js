import * as THREE from 'three';

// Salto al hiperespacio: estelas de luz que pasan junto a la cámara. Va
// enganchado a la cámara (sus coordenadas son locales a ella), así que basta
// con subir `intensity` (0..1) para que las estrellas "se estiren".

export class Warp {
  constructor(camera, { count = 420 } = {}) {
    this.count = count;
    this.intensity = 0;
    this.seeds = new Float32Array(count * 3); // x, y, z de la cabeza
    const pos = new Float32Array(count * 6);  // cabeza + cola por segmento
    const col = new Float32Array(count * 6);

    for (let i = 0; i < count; i++) {
      this._reset(i, -60 + Math.random() * 58);
      // cabeza blanca-violeta, cola negra (con mezcla aditiva = invisible)
      col.set([0.92, 0.88, 1.0, 0, 0, 0], i * 6);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    camera.add(this.lines);
  }

  _reset(i, z) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.8 + Math.random() * 7;
    this.seeds[i * 3] = Math.cos(a) * r;
    this.seeds[i * 3 + 1] = Math.sin(a) * r;
    this.seeds[i * 3 + 2] = z;
  }

  update(dt) {
    const k = this.intensity;
    this.lines.visible = k > 0.01;
    if (!this.lines.visible) return;
    this.lines.material.opacity = Math.min(1, k * 1.3);

    const speed = 18 + k * 90;
    const len = 0.3 + k * 9;
    const pos = this.lines.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < this.count; i++) {
      const s = i * 3;
      this.seeds[s + 2] += speed * dt;
      if (this.seeds[s + 2] > -0.5) this._reset(i, -60);
      const o = i * 6;
      arr[o] = arr[o + 3] = this.seeds[s];
      arr[o + 1] = arr[o + 4] = this.seeds[s + 1];
      arr[o + 2] = this.seeds[s + 2];
      arr[o + 5] = this.seeds[s + 2] - len;
    }
    pos.needsUpdate = true;
  }
}
