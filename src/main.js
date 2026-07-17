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
import { phrases, playlist } from './data.js';

// --- ajuste por dispositivo (optimización) ---
const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
const PARTICLE_COUNT = isMobile ? 22000 : 110000;
const STAR_COUNT = isMobile ? 4000 : 16000;
const BLOOM_SCALE = isMobile ? 0.5 : 1; // el bloom se calcula a media resolución en móvil

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// --- escena base ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000008, 0.012);

const BASE_FOV = 75;
const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
// En móvil el canvas WebGL va a 1x (la UI en DOM sigue nítida): mitad de píxeles
// que a 1.5x, gran ahorro de fillrate sin penalizar el texto.
renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
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

const scenery = new Scenery(scene, { starCount: STAR_COUNT, isMobile });

// Frases en Arial (fuente del sistema): se dibujan ya.
// En móvil las texturas van a la mitad (menos VRAM y menos coste de subida).
const phraseCloud = new Phrases(phrases, { texScale: isMobile ? 0.5 : 1 });
scene.add(phraseCloud.group);

const shapes = buildShapes(PARTICLE_COUNT);

const audio = document.getElementById('audio');
const audioProcessor = new AudioProcessor(audio);

// --- post-procesado (bloom = brillo real) ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth * BLOOM_SCALE, window.innerHeight * BLOOM_SCALE),
  isMobile ? 0.32 : 0.42, // strength
  0.4,                    // radius
  0.5                     // threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- morph automático y temporizado ---
// La galaxia se mantiene pura un rato y, cada tanto, se transfigura en una forma
// (corazón, nombre, luna triple, sigilo, infinito), la sostiene y vuelve.
let morphFactor = 0;
let targetMorph = 0;
let shapeIdx = -1;       // índice de la última forma mostrada
let pending = null;      // forma pendiente de aplicar
let showingShape = false;
let autoTimer = 0;

const rand = (a, b) => a + Math.random() * (b - a);
// Tiempos aleatorios y espaciados: la galaxia se sostiene largo entre formas.
const GALAXY_HOLD = () => rand(24, 55); // galaxia pura hasta la próxima forma
const SHAPE_HOLD = () => rand(7, 12);   // cuánto se mantiene cada forma
let nextDelay = GALAXY_HOLD();

function updateAutoMorph(dt) {
  autoTimer += dt;
  if (autoTimer < nextDelay) return;
  autoTimer = 0;

  if (!showingShape) {
    // elige una forma al azar (sin repetir la anterior)
    let next = Math.floor(Math.random() * shapes.length);
    if (shapes.length > 1 && next === shapeIdx) next = (next + 1) % shapes.length;
    shapeIdx = next;
    pending = shapes[shapeIdx]; // se aplica en el bucle cuando morph≈0
    showingShape = true;
    nextDelay = SHAPE_HOLD();
  } else {
    targetMorph = 0;            // vuelve a la galaxia
    showingShape = false;
    nextDelay = GALAXY_HOLD();
  }
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
  updateAutoMorph(dt);

  // aplica la forma pendiente cuando la galaxia ya está reunida (morph≈0)
  if (pending && morphFactor < 0.06) {
    galaxy.setTarget(pending.positions);
    pending = null;
    targetMorph = 1;
  }
  morphFactor += (targetMorph - morphFactor) * 0.06;

  galaxy.update(time, audioProcessor, morphFactor);
  phraseCloud.update(time, audioProcessor, morphFactor);
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

  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth * BLOOM_SCALE, window.innerHeight * BLOOM_SCALE);
});

animate();
