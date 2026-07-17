import * as THREE from 'three';

// Frases de amor como sprites orbitando la galaxia. Reaccionan al audio y —lo
// importante— se desvanecen cuando la galaxia adopta una forma (corazón, nombre,
// sigilo...), para que no queden textos flotando solos sobre la figura.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Phrases {
  constructor(phrases) {
    this.group = new THREE.Group();

    phrases.forEach((text, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const isSpecial = text.includes('pequeña') || text.toLowerCase().includes('hécate');
      ctx.font = isSpecial ? '600 44px "Cinzel"' : 'italic 500 40px "Cormorant Garamond"';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(138, 43, 226, 1)';
      ctx.shadowBlur = 12;
      ctx.fillText(text, 512, 128);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const sprite = new THREE.Sprite(material);

      const angle = (i / phrases.length) * Math.PI * 2;
      const radiusVar = 1.2 + Math.random() * 3.8;
      const yVar = (Math.random() - 0.5) * 2;
      sprite.position.set(Math.cos(angle) * radiusVar, yVar, Math.sin(angle) * radiusVar);

      const scaleFactor = isSpecial ? 1.4 : 0.8 + Math.random() * 0.4;
      sprite.scale.set(scaleFactor * 2, scaleFactor * 0.5, 1);
      sprite.userData.baseScale = scaleFactor;
      this.group.add(sprite);
    });
  }

  update(time, audio, morph) {
    // 1 con galaxia, 0 cuando hay una forma tomada
    const visibility = 1 - smoothstep(0.08, 0.5, morph);
    this.group.rotation.y = audio ? audio.energy * 0.18 : 0;

    const mid = audio ? audio.mid : 0;
    const treble = audio ? audio.treble : 0;
    this.group.children.forEach((sprite, i) => {
      const react = Math.sin(time + i * 0.2) * 0.03;
      const s = sprite.userData.baseScale * (1 + mid * 0.25 + react);
      sprite.scale.set(s * 2, s * 0.5, 1);
      sprite.material.opacity = (0.65 + treble * 0.35) * visibility;
      sprite.visible = visibility > 0.02;
    });
  }
}
