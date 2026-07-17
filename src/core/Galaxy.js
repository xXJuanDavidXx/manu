import * as THREE from 'three';

// Sistema de partículas de la galaxia. Todo el trabajo pesado (morph entre
// formas, color por radio y reacción al audio) se hace en el shader (GPU), así
// que el bucle de animación en CPU queda mínimo aunque haya cientos de miles de
// partículas.

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMorph;
  uniform float uSize;
  uniform float uBass;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uPixelRatio;
  uniform vec3 uColorIn;
  uniform vec3 uColorOut;

  attribute vec3 aTarget;
  attribute float aRadius;
  attribute float aScale;
  attribute float aRandom;

  varying vec3 vColor;

  void main() {
    vec3 pos = mix(position, aTarget, uMorph);
    float galaxyMode = 1.0 - uMorph;

    // respiración/deriva suave y empuje radial en el golpe (solo en galaxia)
    vec3 dir = normalize(pos + 0.0001);
    float breathe = sin(uTime * 0.7 + aRandom * 6.2831) * 0.03;
    pos += dir * (breathe + uBeat * 0.35) * galaxyMode;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * aScale * (1.0 + uBass * 1.2 + uBeat * 0.4);
    gl_PointSize = size * uPixelRatio * (300.0 / -mv.z);

    vColor = mix(uColorIn, uColorOut, aRadius) + uTreble * 0.15;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = pow(smoothstep(0.5, 0.0, d), 1.6);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export class Galaxy {
  constructor(count, { pixelRatio = 1 } = {}) {
    this.count = count;
    this.params = { radius: 5, branches: 3, spin: 1.3, randomness: 0.25, size: 0.05 };

    const positions = new Float32Array(count * 3); // galaxia base
    const target = new Float32Array(count * 3);     // objetivo de morph (inicial = galaxia)
    const aRadius = new Float32Array(count);
    const aScale = new Float32Array(count);
    const aRandom = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = Math.random() * this.params.radius;
      const branchAngle = ((i % this.params.branches) / this.params.branches) * Math.PI * 2;
      const spinAngle = radius * this.params.spin;
      const rand = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * this.params.randomness * radius;

      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + rand();
      positions[i3 + 1] = rand();
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + rand();

      target[i3] = positions[i3];
      target[i3 + 1] = positions[i3 + 1];
      target[i3 + 2] = positions[i3 + 2];

      aRadius[i] = radius / this.params.radius;
      aScale[i] = 0.6 + Math.random() * 0.9;
      aRandom[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(aScale, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(aRandom, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uSize: { value: this.params.size },
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uBeat: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uColorIn: { value: new THREE.Color('#1e90ff') },
        uColorOut: { value: new THREE.Color('#4b0082') },
      },
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  // Copia una nube de puntos como nuevo objetivo de morph.
  setTarget(positions) {
    const attr = this.points.geometry.attributes.aTarget;
    attr.array.set(positions);
    attr.needsUpdate = true;
  }

  setColors(inHex, outHex) {
    this.material.uniforms.uColorIn.value.set(inHex);
    this.material.uniforms.uColorOut.value.set(outHex);
  }

  update(time, audio, morph) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uMorph.value = morph;
    if (audio) {
      u.uBass.value = audio.bass;
      u.uTreble.value = audio.treble;
      u.uBeat.value = audio.beatHold;
      // giro lento acumulado como antes
      this.points.rotation.y = audio.energy * 0.15;
    }
  }
}
