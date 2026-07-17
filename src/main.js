import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { AudioProcessor } from './core/AudioProcessor.js';
import { Galaxy } from './core/Galaxy.js';
import { Phrases } from './core/Phrases.js';
import { Scenery } from './core/Scenery.js';
import { buildShapes } from './core/shapes.js';
import { phrases, centerPhrases, playlist } from './data.js';

// --- ajuste por dispositivo (optimización) ---
const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
const PARTICLE_COUNT = isMobile ? 35000 : 110000;
const STAR_COUNT = isMobile ? 7000 : 16000;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// --- escena base ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000008, 0.012);

const BASE_FOV = 75;
const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.minDistance = 2;
controls.maxDistance = 40;
controls.enablePan = false;
controls.enabled = false; // durante la intro

// --- contenido ---
const galaxy = new Galaxy(PARTICLE_COUNT, { pixelRatio: renderer.getPixelRatio() });
scene.add(galaxy.points);

const scenery = new Scenery(scene, { starCount: STAR_COUNT });

// Las frases y el nombre "MANUELA" se dibujan en canvas: esperamos a que las
// fuentes (Cinzel / Cormorant) carguen para no rasterizarlas con la de defecto.
let phraseCloud = null;
let shapes = [];
const fontsReady = document.fonts
  ? Promise.all([
      document.fonts.load('600 42px "Cinzel"'),
      document.fonts.load('500 32px "Cormorant Garamond"'),
      document.fonts.load('italic 500 32px "Cormorant Garamond"'),
    ]).catch(() => {})
  : Promise.resolve();

Promise.race([fontsReady, new Promise((r) => setTimeout(r, 3000))]).then(() => {
  phraseCloud = new Phrases(phrases);
  scene.add(phraseCloud.group);
  shapes = buildShapes(PARTICLE_COUNT, 'MANUELA');
});

const audio = document.getElementById('audio');
const audioProcessor = new AudioProcessor(audio);

// --- post-procesado (bloom = brillo real) ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  isMobile ? 0.32 : 0.42, // strength
  0.4,                    // radius
  0.5                     // threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- máquina de estados del morph ---
let morphFactor = 0;
let targetMorph = 0;
let shapeIdx = -1;    // -1 = galaxia
let pending = null;   // forma pendiente de aplicar tras dispersarse

function cycleShape() {
  if (!shapes.length) return;
  shapeIdx++;
  if (shapeIdx >= shapes.length) {
    shapeIdx = -1;
    pending = null;
    targetMorph = 0; // vuelve a la galaxia
    return;
  }
  pending = shapes[shapeIdx]; // dispersa y luego se reforma en el bucle
  targetMorph = 0;
}

// --- reproductor ---
let currentTrackIndex = 0;
const playBtn = document.getElementById('playBtn');

// El estado se muestra encendiendo la luna llena (no con texto: es un SVG).
function setPlaying(isPlaying) {
  document.body.classList.toggle('is-playing', isPlaying);
  playBtn.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir');
}

function updateTrackDisplay(name) {
  const display = document.getElementById('track-display');
  document.getElementById('track-name').textContent = name;
  display.style.opacity = 1;
  clearTimeout(updateTrackDisplay._t);
  updateTrackDisplay._t = setTimeout(() => { display.style.opacity = 0.8; }, 2000);
}

function playTrack(index) {
  if (!audioProcessor.isSetup) audioProcessor.setup();
  audioProcessor.resume();
  currentTrackIndex = (index + playlist.length) % playlist.length;
  const track = playlist[currentTrackIndex];
  audio.src = track.src;
  audio.play();
  setPlaying(true);
  updateTrackDisplay(track.name);
  if (track.colors) galaxy.setColors(track.colors.in, track.colors.out);
}

playBtn.onclick = () => {
  if (!audioProcessor.isSetup) audioProcessor.setup();
  audioProcessor.resume();
  if (audio.paused) {
    if (!audio.src) { playTrack(currentTrackIndex); return; }
    audio.play();
    setPlaying(true);
    updateTrackDisplay(playlist[currentTrackIndex].name);
  } else {
    audio.pause();
    setPlaying(false);
  }
};
document.getElementById('nextBtn').onclick = () => playTrack(currentTrackIndex + 1);
document.getElementById('prevBtn').onclick = () => playTrack(currentTrackIndex - 1);
document.getElementById('pickBtn').onclick = () => document.getElementById('pickFile').click();
document.getElementById('pickFile').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!audioProcessor.isSetup) audioProcessor.setup();
  playlist.push({ name: file.name.replace(/\.[^.]+$/, ''), src: URL.createObjectURL(file), colors: null });
  playTrack(playlist.length - 1);
};
audio.onended = () => playTrack(currentTrackIndex + 1);

// --- texto central: clic = cambia de forma ---
const centerText = document.getElementById('dynamic-center-text');
centerText.style.pointerEvents = 'auto';
centerText.style.cursor = 'pointer';
centerText.onclick = cycleShape;

let phraseIndex = 0;
setInterval(() => {
  centerText.style.opacity = 0;
  setTimeout(() => {
    phraseIndex = (phraseIndex + 1) % centerPhrases.length;
    centerText.textContent = centerPhrases[phraseIndex];
    centerText.style.opacity = 0.8;
  }, 1000);
}, 5000);

// --- intro cinematográfica ---
const INTRO_DURATION = 4.5;
let introTime = 0;
const camFar = new THREE.Vector3(0, 3, 34);
const camNear = new THREE.Vector3(4, 3, 6);

// --- bucle ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  audioProcessor.update();

  // morph: aplica la forma pendiente cuando la galaxia ya se dispersó
  if (pending && morphFactor < 0.06) {
    galaxy.setTarget(pending.positions);
    pending = null;
    targetMorph = 1;
  }
  morphFactor += (targetMorph - morphFactor) * 0.06;

  galaxy.update(time, audioProcessor, morphFactor);
  if (phraseCloud) phraseCloud.update(time, audioProcessor, morphFactor);
  scenery.update(dt, audioProcessor);

  // cámara
  if (introTime < INTRO_DURATION) {
    introTime += dt;
    const t = easeOutCubic(Math.min(1, introTime / INTRO_DURATION));
    camera.position.lerpVectors(camFar, camNear, t);
    camera.lookAt(0, 0, 0);
    if (introTime >= INTRO_DURATION) {
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      controls.update();
    }
  } else {
    const targetFov = BASE_FOV - audioProcessor.bass * 4 - audioProcessor.beatHold * 3;
    camera.fov += (targetFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();
    controls.update();
  }

  // texto central pulsante
  const bass = audioProcessor.bass;
  const mid = audioProcessor.mid;
  const pulse = 1 + bass * 0.12 + Math.sin(time * 1.5) * 0.04;
  centerText.style.transform = `translate(-50%, -50%) scale(${pulse})`;
  // halo oscuro para legibilidad + brillo suave reactivo (ember/selene)
  centerText.style.textShadow =
    `0 0 3px rgba(4,5,12,0.98), 0 0 10px rgba(4,5,12,0.95), 0 2px 14px rgba(4,5,12,0.9), ` +
    `0 0 ${12 + bass * 12}px rgba(255,93,143,0.55), 0 0 ${18 + mid * 16}px rgba(201,179,255,0.35)`;

  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});

animate();
