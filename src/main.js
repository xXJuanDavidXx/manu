import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { AudioProcessor } from './core/AudioProcessor.js';
import { Galaxy } from './core/Galaxy.js';
import { Scenery } from './core/Scenery.js';
import { Warp } from './core/Warp.js';
import { buildShapes } from './core/shapes.js';
import { Planet } from './entities/Planet.js';
import { Spirit } from './entities/Spirit.js';
import { FlightInput } from './input/FlightInput.js';
import { Phrases } from './core/Phrases.js';
import { Rewards } from './core/Rewards.js';
import { playlist, planets as planetDefs, loveNotes } from './data.js';

// Juegos de cada planeta: se cargan solo al visitarlo.
const games = {
  ritmo: () => import('./games/ritmo/index.js'),
  retro: () => import('./games/retro/index.js'),
  recuerdos: () => import('./games/recuerdos/index.js'),
  chakras: () => import('./games/chakras/index.js'),
};

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

// Frases de él: solo orbitan las que ella ya ganó en los juegos. En móvil las
// texturas van a la mitad (menos VRAM y menos coste de subida).
const rewards = new Rewards({ onUnlock: (text) => phraseCloud.add(text, { fresh: true }) });
const phraseCloud = new Phrases(rewards.won, { texScale: isMobile ? 0.5 : 1 });
scene.add(phraseCloud.group);

const labelLayer = document.getElementById('planet-labels');
const planets = planetDefs.map((def) => {
  const p = new Planet(def, labelLayer);
  scene.add(p.group, p.orbitLine);
  return p;
});
const planetHitAreas = planets.map((p) => p.hitArea);

scene.add(camera); // el salto (warp) va enganchado a la cámara
const warp = new Warp(camera, { count: isMobile ? 220 : 420 });

const spirit = new Spirit(scene, { isMobile, pixelRatio: renderer.getPixelRatio() });
const flightInput = new FlightInput(renderer.domElement, {
  joystickEl: document.getElementById('joystick'),
  boostEl: document.getElementById('boostBtn'),
});

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
  renderGrimoire();
  playTrack(playlist.length - 1);
};
audio.onended = () => playTrack(currentTrackIndex + 1);
// la luna llena refleja el estado real (también cuando un juego pausa la música)
audio.addEventListener('play', () => setPlaying(true));
audio.addEventListener('pause', () => setPlaying(false));

// --- grimorio: lista de canciones para elegir directamente ---
const grimoire = document.getElementById('grimoire');
const grimoireList = document.getElementById('grimoire-list');
const listBtn = document.getElementById('listBtn');

function renderGrimoire() {
  grimoireList.replaceChildren(...playlist.map((track, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = track.colors
      ? `linear-gradient(135deg, ${track.colors.in}, ${track.colors.out})`
      : 'var(--selene)';
    btn.append(dot, track.name);
    btn.onclick = () => { playTrack(i); setGrimoireOpen(false); };
    li.append(btn);
    return li;
  }));
  markCurrentInGrimoire();
}

function markCurrentInGrimoire() {
  [...grimoireList.children].forEach((li, i) => {
    const isCurrent = i === currentTrackIndex;
    li.classList.toggle('current', isCurrent);
    li.firstChild.setAttribute('aria-current', isCurrent ? 'true' : 'false');
  });
}

function setGrimoireOpen(open) {
  grimoire.classList.toggle('open', open);
  listBtn.setAttribute('aria-expanded', open);
  if (open) grimoireList.children[currentTrackIndex]?.scrollIntoView({ block: 'nearest' });
}

listBtn.onclick = (e) => {
  e.stopPropagation();
  setGrimoireOpen(!grimoire.classList.contains('open'));
};
document.addEventListener('pointerdown', (e) => {
  if (!grimoire.contains(e.target) && !listBtn.contains(e.target)) setGrimoireOpen(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setGrimoireOpen(false); });
audio.addEventListener('play', markCurrentInGrimoire);
renderGrimoire();

// --- hilo del tiempo: progreso y salto dentro de la canción ---
const seek = document.getElementById('seek');
const seekFill = seek.querySelector('.fill');
const seekKnob = seek.querySelector('.knob');
const timeNow = document.getElementById('timeNow');
const timeTotal = document.getElementById('timeTotal');
let dragging = false;

const fmt = (s) => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function paintProgress(fraction) {
  const pct = `${(fraction * 100).toFixed(2)}%`;
  seekFill.style.width = pct;
  seekKnob.style.left = pct;
  seek.setAttribute('aria-valuenow', Math.round(fraction * 100));
}

function refreshProgress() {
  if (dragging) return;
  const d = audio.duration;
  paintProgress(d ? audio.currentTime / d : 0);
  timeNow.textContent = fmt(audio.currentTime);
  timeTotal.textContent = fmt(d);
}
audio.addEventListener('timeupdate', refreshProgress);
audio.addEventListener('loadedmetadata', refreshProgress);

const fractionAt = (clientX) => {
  const r = seek.getBoundingClientRect();
  return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
};
seek.addEventListener('pointerdown', (e) => {
  if (!audio.duration) return;
  dragging = true;
  seek.classList.add('dragging');
  seek.setPointerCapture(e.pointerId);
  paintProgress(fractionAt(e.clientX));
});
seek.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const f = fractionAt(e.clientX);
  paintProgress(f);
  timeNow.textContent = fmt(f * audio.duration);
});
const endDrag = (e) => {
  if (!dragging) return;
  dragging = false;
  seek.classList.remove('dragging');
  audio.currentTime = fractionAt(e.clientX) * audio.duration;
  refreshProgress();
};
seek.addEventListener('pointerup', endDrag);
seek.addEventListener('pointercancel', () => { dragging = false; seek.classList.remove('dragging'); refreshProgress(); });
seek.addEventListener('keydown', (e) => {
  if (!audio.duration) return;
  const step = { ArrowRight: 5, ArrowLeft: -5 }[e.key];
  if (step === undefined) return;
  e.preventDefault();
  audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + step));
});

// =====================================================================
// Estados del viaje
//   intro → galaxy ⇄ flight
//   galaxy|flight → warp-in → planet → warp-out → galaxy|flight
// =====================================================================
let state = 'intro';
const hint = document.getElementById('hint');
const HINTS = {
  galaxy: 'Toca un <b>planeta</b> para viajar · arrastra para <b>orbitar</b>',
  flight: isMobile
    ? 'Arrastra para <b>guiar al espíritu</b> · mantén la llama para <b>avivar su antorcha</b>'
    : '<b>Flechas / WASD</b> para guiar al espíritu · <b>Shift</b> para avivar su antorcha',
};

function setState(s) {
  state = s;
  document.body.dataset.state = s;
  flightInput.setEnabled(s === 'flight');
  if (s === 'galaxy' || s === 'flight') {
    if (audioStarted || s === 'flight') hint.innerHTML = HINTS[s];
  }
  flameBtn.setAttribute('aria-pressed', s === 'flight');
  if (s !== 'flight') { descendBtn.hidden = true; nearPlanet = null; }
  if (s !== 'galaxy' && hovered) {
    hovered.setHover(false);
    hovered = null;
    document.body.classList.remove('hovering-planet');
  }
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const bump = (t) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

// --- animación genérica de cámara (posiciones y miradas que pueden moverse) ---
let tween = null;
const _look = new THREE.Vector3();
function startTween({ duration, to, lookFrom, lookTo, ease = easeInOutCubic, onUpdate, onDone }) {
  tween = { t: 0, duration, from: camera.position.clone(), to, lookFrom: lookFrom.clone(), lookTo, ease, onUpdate, onDone };
}
function runTween(dt) {
  const tw = tween;
  tw.t = Math.min(1, tw.t + dt / tw.duration);
  const k = tw.ease(tw.t);
  camera.position.lerpVectors(tw.from, tw.to(), k);
  camera.lookAt(_look.copy(tw.lookFrom).lerp(tw.lookTo(), k));
  tw.onUpdate?.(tw.t);
  if (tw.t >= 1) {
    tween = null;
    tw.onDone?.();
  }
}

const veil = document.getElementById('veil');
function fadeVeil(opacity, seconds) {
  veil.style.transition = `opacity ${seconds}s ease`;
  veil.style.opacity = opacity;
}

// --- el audio arranca con el primer toque (los navegadores lo exigen) ---
let audioStarted = false;
audio.addEventListener('play', () => {
  if (!audioStarted && state === 'galaxy') hint.innerHTML = HINTS.galaxy;
  audioStarted = true;
});
function ensurePlaying() {
  if (audio.paused) playBtn.onclick();
}

// --- viaje a un planeta ---
let visit = null; // { planet, returnTo, returnPos, game }

function travelTo(planet) {
  if (state !== 'galaxy' && state !== 'flight') return;
  if (!planet.awake) { planet.nudge(); return; }
  if (planet.def.music) ensurePlaying(); // juegos que viven de nuestra música

  const returnTo = state;
  visit = { planet, returnTo, returnPos: camera.position.clone(), game: null };
  controls.enabled = false;
  setState('warp-in');
  if (returnTo === 'flight') spirit.dismiss();

  const lookFrom = returnTo === 'flight' ? spirit.position.clone() : controls.target.clone();
  const arrive = new THREE.Vector3();
  const r = planet.def.radius;
  startTween({
    duration: 2.6,
    lookFrom,
    lookTo: () => planet.worldPos,
    to: () => arrive.copy(visit.returnPos).sub(planet.worldPos).setLength(r * 1.25).add(planet.worldPos),
    ease: (t) => t * t * t, // acelera como un salto
    onUpdate: (t) => {
      warp.intensity = bump(t * 0.85);
      camera.fov = BASE_FOV + 28 * bump(t * 0.9);
      camera.updateProjectionMatrix();
      if (t > 0.72) { veil.style.transition = 'none'; veil.style.opacity = (t - 0.72) / 0.28; }
    },
    onDone: () => enterPlanet(planet),
  });
}

async function enterPlanet(planet) {
  warp.intensity = 0;
  camera.fov = BASE_FOV;
  camera.updateProjectionMatrix();
  setState('planet');
  try {
    const mod = await games[planet.def.game]();
    if (state !== 'planet') return;
    visit.game = mod.mount(document.getElementById('planet-stage'), {
      audio,
      audioProcessor,
      loveNotes,
      playlist,
      playTrack,
      reward: (n, reason) => rewards.grant(n, reason),
      getTrackIndex: () => currentTrackIndex,
      getTrack: () => playlist[currentTrackIndex],
      getConsoleTop: () => document.querySelector('.console').getBoundingClientRect().top,
      exit: leavePlanet,
    });
  } catch (err) {
    console.error('No se pudo cargar el juego:', err);
    leavePlanet();
    return;
  }
  fadeVeil(0, 0.7);
}

let leaving = false;
function leavePlanet() {
  if (state !== 'planet' || leaving) return;
  leaving = true;
  fadeVeil(1, 0.35);
  setTimeout(() => {
    leaving = false;
    visit.game?.unmount();
    visit.game = null;
    const { planet, returnTo } = visit;
    const r = planet.def.radius;

    // al volver al vuelo, el espíritu reaparece junto al planeta mirando hacia afuera
    let lookTo;
    if (returnTo === 'flight') {
      const out = planet.worldPos.clone().normalize();
      spirit.spawn(planet.worldPos.clone().addScaledVector(out, r * 4 + 2), out);
      spirit.chasePosition(visit.returnPos);
      lookTo = () => spirit.position;
    } else {
      lookTo = () => controls.target;
    }

    camera.position.copy(visit.returnPos).sub(planet.worldPos).setLength(r * 1.4).add(planet.worldPos);
    setState('warp-out');
    fadeVeil(0, 0.6);
    const back = visit.returnPos.clone();
    startTween({
      duration: 2.2,
      lookFrom: planet.worldPos,
      lookTo,
      to: () => back,
      ease: (t) => 1 - Math.pow(1 - t, 3),
      onUpdate: (t) => {
        warp.intensity = 1 - t;
        camera.fov = BASE_FOV + 22 * (1 - t);
        camera.updateProjectionMatrix();
      },
      onDone: () => {
        warp.intensity = 0;
        if (returnTo === 'flight') {
          setState('flight');
        } else {
          controls.enabled = true;
          setState('galaxy');
        }
        visit = null;
      },
    });
  }, 380);
}

// --- interruptor de órbitas (se recuerda en este navegador) ---
const orbitBtn = document.getElementById('orbitBtn');
function setOrbits(on) {
  for (const p of planets) p.orbitLine.visible = on;
  orbitBtn.setAttribute('aria-pressed', on);
  try { localStorage.setItem('galaxia:orbits', on ? '1' : '0'); } catch { /* sin almacenamiento */ }
}
let orbitsOn = false;
try { orbitsOn = localStorage.getItem('galaxia:orbits') === '1'; } catch { /* sin almacenamiento */ }
setOrbits(orbitsOn);
orbitBtn.onclick = () => { orbitsOn = !orbitsOn; setOrbits(orbitsOn); };

// --- tocar / señalar planetas ---
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function planetAt(clientX, clientY) {
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(planetHitAreas, false)[0];
  return hit ? hit.object.userData.planet : null;
}

let downAt = null;
let hovered = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (state !== 'galaxy' || !downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 8) return; // fue un arrastre para orbitar
  const p = planetAt(e.clientX, e.clientY);
  if (p) travelTo(p);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (state !== 'galaxy' || e.pointerType !== 'mouse') return;
  const p = planetAt(e.clientX, e.clientY);
  if (p === hovered) return;
  hovered?.setHover(false);
  hovered = p;
  p?.setHover(true);
  document.body.classList.toggle('hovering-planet', Boolean(p));
});

// --- vuelo libre ---
const flameBtn = document.getElementById('flameBtn');
const descendBtn = document.getElementById('descend');
let nearPlanet = null;

function startFlight() {
  if (state !== 'galaxy') return;
  controls.enabled = false;
  hovered?.setHover(false);
  hovered = null;
  document.body.classList.remove('hovering-planet');
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  spirit.spawn(camera.position.clone().addScaledVector(dir, 4), dir);
  setState('flight');
}

function endFlight() {
  if (state !== 'flight') return;
  setState('warp-out'); // estado de tránsito: sin controles
  const home = camera.position.clone().setLength(THREE.MathUtils.clamp(camera.position.length(), 9, 16));
  if (home.y < 1.5) home.y = 3;
  startTween({
    duration: 1.8,
    lookFrom: spirit.position,
    lookTo: () => controls.target.set(0, 0, 0),
    to: () => home,
    onDone: () => {
      controls.enabled = true;
      setState('galaxy');
    },
  });
  spirit.dismiss();
}

flameBtn.onclick = () => {
  flameBtn.blur(); // que Espacio/Enter no vuelvan a "clicar" el botón en vuelo
  if (state === 'flight') endFlight(); else startFlight();
};
descendBtn.onclick = () => { descendBtn.blur(); if (nearPlanet) travelTo(nearPlanet); };
window.addEventListener('keydown', (e) => {
  if (state === 'flight' && e.key === 'Enter' && nearPlanet?.awake) { e.preventDefault(); travelTo(nearPlanet); }
  if (state === 'flight' && e.key === 'Escape') endFlight();
});

const _chase = new THREE.Vector3();
const _aim = new THREE.Vector3();
function updateFlight(dt, time) {
  flightInput.update();
  spirit.update(dt, time, flightInput, audioProcessor);

  // cámara que persigue al espíritu
  spirit.chasePosition(_chase);
  camera.position.lerp(_chase, 1 - Math.exp(-dt * 4));
  camera.lookAt(_aim.copy(spirit.position).addScaledVector(spirit.forward, 2));
  const targetFov = BASE_FOV + (flightInput.boost ? 14 : 0) - audioProcessor.beatHold * 2;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
  warp.intensity += ((flightInput.boost ? 0.35 : 0) - warp.intensity) * Math.min(1, dt * 3);

  // ¿cerca de un planeta?
  let near = null;
  for (const p of planets) {
    if (spirit.position.distanceTo(p.worldPos) < p.def.radius * 5 + 1.8) near = p;
  }
  if (near !== nearPlanet) {
    nearPlanet = near;
    descendBtn.hidden = !near;
    if (near) {
      descendBtn.classList.toggle('dormant', !near.awake);
      descendBtn.disabled = !near.awake;
      descendBtn.textContent = near.awake
        ? `Descender a ${near.def.name}${isMobile ? '' : ' · Enter'}`
        : `${near.def.name} · aún duerme`;
    }
  }
}

// --- intro cinematográfica ---
const INTRO_DURATION = 4.5;
let introTime = 0;
const camFar = new THREE.Vector3(0, 3, 34);
// Más lejos y más alto que antes, para que las órbitas de los planetas se vean
// por debajo. En pantallas verticales (celular) el ángulo horizontal es mucho
// menor, así que la cámara se aleja más para que los planetas quepan.
const portraitBoost = THREE.MathUtils.clamp(0.95 / camera.aspect, 1, 2.1);
const camNear = new THREE.Vector3(5.2, 5.6, 9.6).multiplyScalar(portraitBoost);

// --- bucle ---
const clock = new THREE.Clock();
const _tmp = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  audioProcessor.update();

  // dentro de un planeta, la galaxia no se dibuja (ahorra batería): solo el juego
  if (state === 'planet') {
    visit?.game?.update(dt, time);
    return;
  }

  updateAutoMorph(dt);

  // aplica la forma pendiente cuando la galaxia ya está reunida (morph≈0)
  if (pending && morphFactor < 0.06) {
    galaxy.setTarget(pending.positions);
    pending = null;
    targetMorph = 1;
  }
  morphFactor += (targetMorph - morphFactor) * 0.06;

  galaxy.update(time, audioProcessor, morphFactor);
  scenery.update(dt, audioProcessor);
  phraseCloud.update(time, audioProcessor, morphFactor);
  for (const p of planets) p.update(time, dt, audioProcessor);

  // cámara
  if (state === 'intro') {
    introTime += dt;
    const t = easeOutCubic(Math.min(1, introTime / INTRO_DURATION));
    camera.position.lerpVectors(camFar, camNear, t);
    camera.lookAt(0, 0, 0);
    if (introTime >= INTRO_DURATION) {
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      controls.update();
      setState('galaxy');
    }
  } else if (tween) {
    runTween(dt);
  } else if (state === 'flight') {
    updateFlight(dt, time);
  } else if (state === 'galaxy') {
    const targetFov = BASE_FOV - audioProcessor.bass * 4 - audioProcessor.beatHold * 3;
    camera.fov += (targetFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();
    controls.update();
  }
  if (state !== 'flight') spirit.update(dt, time, flightInput, audioProcessor); // que la estela se apague sola

  warp.update(dt);

  const showLabels = state === 'galaxy' || state === 'flight';
  for (const p of planets) p.placeLabel(camera, window.innerWidth, window.innerHeight, showLabels, _tmp);

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
