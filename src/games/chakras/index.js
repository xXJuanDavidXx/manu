import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { radialTexture } from '../../core/textures.js';
import { chakras, ORDINALS, ending } from './chakras.js';

// Planeta Loto: «Sendero de Luz». Un vuelo lento y psicodélico por un túnel
// de luz que atraviesa los siete chakras, de la raíz a la corona. No se pierde
// nunca: se guía una pequeña luz, se recogen chispas al ritmo de la
// respiración y, al despertar cada chakra, aparece su loto; al cruzarlo se
// pasa al siguiente. Cada chakra tiene su túnel, sus formas flotantes, su
// mantra, su frecuencia (cuenco opcional) y su enseñanza.
//
// Interfaz de juego (la misma para todos los planetas):
//   mount(stage, ctx) -> { update(dt, time), unmount() }

const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ritmo del viaje (segundos / cantidades)
const CARD_TIME = 9;       // la tarjeta de cada chakra
const PHASE_MIN = 55;      // mínimo en cada chakra antes de que aparezca su loto
const PHASE_MAX = 95;      // como mucho (aunque no se recoja nada)
const ORBS_NEEDED = 16;    // chispas que despiertan el chakra
const TEACH_AT = [24, 42, 62];
const BREATH = [4, 2, 6];  // inhala · sostén · exhala
const FAR = -150;          // de dónde llega todo
const PLAYER_Z = -5;
const REACH = 2.5;         // radio por el que se mueve la luz

const CSS = `
.chakras { position: absolute; inset: 0; overflow: hidden; color: var(--moon); background: #04050c; touch-action: none;
  user-select: none; -webkit-user-select: none; }
.chakras canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.chakras button { font: inherit; }
.chakras .hud { position: absolute; top: 20px; left: 20px; z-index: 8; }
.chakras .tools { position: absolute; top: 20px; right: 20px; z-index: 8; display: flex; gap: 8px; }
.chakras .tbtn { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; border-radius: 999px; padding: 7px 13px;
  background: rgba(8,8,16,.55); border: 1px solid var(--hair); color: rgba(236,232,245,.7);
  font-family: 'Cinzel', serif; font-size: .58rem; font-weight: 600; letter-spacing: .18em; text-transform: uppercase;
  transition: color .3s, border-color .3s, box-shadow .3s; }
.chakras .tbtn:hover, .chakras .tbtn:focus-visible { color: var(--moon); outline: none; border-color: var(--selene); }
.chakras .tbtn[aria-pressed="true"] { color: #fff; border-color: var(--c, var(--selene)); box-shadow: 0 0 14px color-mix(in srgb, var(--c, #c9b3ff) 50%, transparent); }

/* sendero: los siete chakras como cuentas de luz */
.chakras .path { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); z-index: 4; display: flex; flex-direction: column;
  align-items: center; gap: 7px; pointer-events: none; transition: opacity .8s; padding: 8px 16px 7px; border-radius: 14px;
  background: rgba(4,5,12,.5); }
.chakras .beads { display: flex; gap: 12px; align-items: center; }
.chakras .bead { --c: #fff; --m: 0; width: 10px; height: 10px; border-radius: 50%; background: color-mix(in srgb, var(--c) 30%, #04050c);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--c) 50%, transparent); transition: all .6s ease; }
.chakras .bead.done { background: var(--c); box-shadow: 0 0 8px var(--c); }
.chakras .bead.now { width: 18px; height: 18px; background:
  radial-gradient(circle, var(--c) 0 34%, transparent 36%),
  conic-gradient(var(--c) calc(var(--m) * 1turn), rgba(255,255,255,.12) 0);
  -webkit-mask: radial-gradient(circle, #000 34%, transparent 36%, transparent 54%, #000 56%);
          mask: radial-gradient(circle, #000 34%, transparent 36%, transparent 54%, #000 56%);
  box-shadow: none; filter: drop-shadow(0 0 6px var(--c)); }
.chakras .path .label { font-family: 'Cinzel', serif; font-size: .58rem; letter-spacing: .3em; text-transform: uppercase; color: rgba(236,232,245,.75);
  text-shadow: 0 0 8px #04050c; }

/* tarjeta de cada chakra */
.chakras .card { position: absolute; left: 50%; top: 45%; z-index: 6; width: min(600px, calc(100vw - 24px)); max-height: calc(100% - 210px);
  overflow: hidden; transform: translate(-50%, -50%) scale(.97); text-align: center; opacity: 0; pointer-events: none; padding: 28px 40px;
  background: radial-gradient(ellipse at center, rgba(4,5,12,.78) 0%, rgba(4,5,12,.55) 55%, rgba(4,5,12,0) 72%);
  transition: opacity 1.4s ease, transform 1.6s ease; text-shadow: 0 0 10px #04050c, 0 0 24px #04050c; }
.chakras .card.show { opacity: 1; transform: translate(-50%, -50%); pointer-events: auto; }
.chakras .card img { width: clamp(90px, 22vmin, 150px); height: auto; display: block; margin: 0 auto 6px; filter: drop-shadow(0 0 20px var(--c)); }
.chakras .card .ord { font-family: 'Cinzel', serif; font-size: .6rem; letter-spacing: .34em; text-transform: uppercase; color: color-mix(in srgb, var(--c) 45%, #fff); }
.chakras .card h2 { margin: 4px 0 2px; font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: .14em; font-size: clamp(1.7rem, 7vw, 2.6rem);
  color: #fff; text-shadow: 0 0 14px var(--c), 0 0 40px var(--c); }
.chakras .card .meta { font-style: italic; font-size: 1.05rem; color: rgba(236,232,245,.85); }
.chakras .card .mantra { margin: 8px 0; font-family: 'Cinzel', serif; font-size: .8rem; letter-spacing: .3em; color: color-mix(in srgb, var(--c) 40%, #fff); }
.chakras .card p { margin: 0 auto; max-width: 30rem; font-size: clamp(1rem, 3.4vw, 1.15rem); line-height: 1.4; color: rgba(236,232,245,.92); }
.chakras .card .aff { margin-top: 12px; font-style: italic; font-size: clamp(1.15rem, 4vw, 1.4rem); color: #fff; }

.chakras .teach { position: absolute; left: 50%; top: 22%; z-index: 5; width: min(600px, calc(100vw - 24px)); transform: translateX(-50%);
  padding: 18px 26px; background: radial-gradient(ellipse at center, rgba(4,5,12,.6), rgba(4,5,12,0) 70%);
  text-align: center; pointer-events: none; font-style: italic; font-size: clamp(1.15rem, 4vw, 1.6rem); line-height: 1.35; color: #fff;
  text-shadow: 0 0 8px #04050c, 0 0 22px #04050c, 0 0 30px var(--c, #c9b3ff); opacity: 0; transition: opacity 2s ease; }
.chakras .teach.show { opacity: 1; }

/* guía de respiración */
.chakras .breath { position: absolute; left: 50%; z-index: 4; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;
  gap: 6px; pointer-events: none; transition: opacity .8s; }
.chakras .breath .ring { width: 54px; height: 54px; border-radius: 50%; border: 1px solid var(--c, #c9b3ff);
  background: radial-gradient(circle, color-mix(in srgb, var(--c, #c9b3ff) 35%, transparent), transparent 70%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--c, #c9b3ff) 45%, transparent); }
.chakras .breath .word { font-family: 'Cinzel', serif; font-size: .58rem; letter-spacing: .3em; text-transform: uppercase; color: rgba(236,232,245,.8);
  text-shadow: 0 0 8px #04050c; }
.chakras .breath[hidden] { display: none; }
.chakras.reading .breath, .chakras.reading .teach { opacity: 0; }

/* inicio y final */
.chakras .panel { position: absolute; inset: 0; z-index: 7; display: flex; align-items: center; justify-content: center; padding: 80px 22px 160px;
  background: radial-gradient(ellipse at center, rgba(4,5,12,.35), rgba(4,5,12,.8)); opacity: 0; pointer-events: none; transition: opacity 1.2s ease; }
.chakras .panel.show { opacity: 1; pointer-events: auto; }
.chakras .panel .in { max-width: 34rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.chakras .panel h1 { margin: 0; font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: .28em; text-transform: uppercase;
  font-size: clamp(1.4rem, 6vw, 2.3rem); color: #fff; text-shadow: 0 0 12px #c77dff, 0 0 40px rgba(199,125,255,.6); }
.chakras .panel .sub { margin: 0; font-style: italic; font-size: 1.2rem; color: rgba(236,232,245,.88); white-space: pre-line; }
.chakras .panel .how { margin: 6px 0 4px; font-size: 1rem; color: rgba(236,232,245,.66); }
.chakras .panel .love { margin: 0; font-style: italic; font-size: clamp(1.2rem, 4.4vw, 1.5rem); color: #fff; text-shadow: 0 0 20px #ff8fab; }
.chakras .panel .start-beads { display: flex; gap: 10px; margin: 6px 0; }
.chakras .panel .start-beads button { --c: #fff; width: 26px; height: 26px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
  background: color-mix(in srgb, var(--c) 22%, #04050c); box-shadow: 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent); transition: transform .3s; }
.chakras .panel .start-beads button.lit { background: var(--c); box-shadow: 0 0 10px var(--c); }
.chakras .panel .start-beads button.next { animation: chk-bead 2.4s ease-in-out infinite; }
.chakras .panel .start-beads button:disabled { cursor: default; }
.chakras .panel .start-beads button:not(:disabled):hover, .chakras .panel .start-beads button:focus-visible { transform: scale(1.2); outline: none; }
.chakras .panel .pick { margin: -4px 0 0; font-size: .9rem; font-style: italic; color: rgba(236,232,245,.5); }
@keyframes chk-bead { 50% { box-shadow: 0 0 0 1px var(--c), 0 0 14px var(--c); } }
.chakras .panel .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.chakras .go { cursor: pointer; padding: 11px 24px; border-radius: 999px; color: #fff; background: rgba(8,8,16,.6);
  border: 1px solid #c77dff; box-shadow: 0 0 24px rgba(199,125,255,.4);
  font-family: 'Cinzel', serif; font-size: .7rem; font-weight: 600; letter-spacing: .24em; text-transform: uppercase;
  animation: chk-breathe 3s ease-in-out infinite; }
.chakras .go.alt { border-color: var(--hair); box-shadow: none; animation: none; color: rgba(236,232,245,.8); }
.chakras .go:focus-visible { outline: 1px solid #fff; outline-offset: 3px; }
@keyframes chk-breathe { 50% { box-shadow: 0 0 40px rgba(199,125,255,.7); } }

@media (max-width: 560px) {
  .chakras .hud { top: 14px; left: 14px; }
  .chakras .tools { top: 62px; right: 12px; }
  .chakras .path { top: 112px; }
  .chakras .teach { top: 30%; }
}
@media (prefers-reduced-motion: reduce) { .chakras .go { animation: none; } }
`;

// =====================================================================
// Túnel: un shader a pantalla completa con una escena por chakra. Mezcla
// la escena de origen y la de destino durante las transiciones.
// =====================================================================
const tunnelVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;

const tunnelFragment = /* glsl */ `
  precision highp float;
  uniform float uTime, uTravel, uMix, uBass, uMid, uTreble, uBeat, uFlash, uAspect, uRoll, uBreath;
  uniform int uFrom, uTo;
  uniform vec3 uA0, uA1, uA2, uB0, uB1, uB2;
  uniform vec2 uLook;
  varying vec2 vUv;

  #define PI 3.14159265
  #define TAU 6.2831853

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; } return v; }
  vec3 pal(float t, vec3 c0, vec3 c1, vec3 c2) {
    t = clamp(t, 0.0, 1.0);
    return t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, t * 2.0 - 1.0);
  }

  // a: ángulo · d: profundidad (avanza con el viaje) · r: distancia al centro
  vec3 scene(int s, float a, float d, float r, vec2 p, vec3 c0, vec3 c1, vec3 c2) {
    vec3 ring = vec3(cos(a), sin(a), 0.0);
    float t = uTime;
    if (s == 0) {
      // RAÍZ · tierra: roca viva con grietas de lava que laten
      float n = fbm(ring * 2.2 + vec3(0.0, 0.0, d * 1.3));
      float cr = abs(fbm(ring * 3.0 + vec3(5.0, 1.0, d * 2.0)) - 0.5);
      float lava = smoothstep(0.06, 0.0, cr) * (0.7 + 0.3 * sin(d * 1.5 - t * 1.2) + uBass * 1.4);
      float strata = 0.5 + 0.5 * sin(d * 3.0 + n * 4.0);
      vec3 col = mix(c0, c1 * 0.55, n * strata);
      return col + c2 * lava;
    }
    if (s == 1) {
      // SACRO · agua: corrientes que se enroscan, cáusticas
      float c = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        c += sin(a * (3.0 + fi * 2.0) + d * (1.2 + fi * 0.6) + sin(d * 0.7 + t * (0.5 + fi * 0.2) + a * 2.0) * 1.8 + t * 0.4);
      }
      c = c / 6.0 + 0.5;
      float caus = pow(1.0 - abs(sin(c * PI * 3.0 + t * 0.3)), 8.0);
      return pal(c * c * 0.95, c0, c1, c2) * 0.6 + c2 * caus * (0.35 + uMid * 1.2);
    }
    if (s == 2) {
      // PLEXO SOLAR · fuego: espiral de rayos de sol y llamas
      float spiral = sin(a * 10.0 + d * 2.5 - t * 1.6) * 0.5 + 0.5;
      float flame = fbm(ring * 2.5 + vec3(0.0, 0.0, d * 2.4 - t * 1.4));
      float tongues = pow(flame, 3.0) * 1.6;                         // lenguas de fuego que suben
      float rays = pow(spiral, 12.0) * (0.45 + uBass * 1.5);          // diez rayos de sol en espiral
      float heat = smoothstep(0.32, 0.68, flame);
      vec3 col = mix(vec3(0.16, 0.02, 0.0), vec3(0.9, 0.22, 0.01), heat);              // de brasa a llama
      col = mix(col, vec3(1.0, 0.62, 0.05), smoothstep(0.55, 0.8, flame));              // corazón amarillo
      return col * 0.8 + c1 * rays * 0.9 + c2 * tongues * 0.3;
    }
    if (s == 3) {
      // CORAZÓN · aire: pétalos de doce lóbulos que respiran, verde y rosa
      float pet = pow(abs(cos(a * 6.0 + sin(d * 0.4) * 0.6)), 2.0);
      float rings = 0.5 + 0.5 * sin(d * 1.6 - t * 0.6);
      float v = smoothstep(0.15, 1.0, pet * rings + 0.25 * sin(d * 0.5 + t * 0.4));
      float rose = smoothstep(0.75, 1.0, 0.5 + 0.5 * sin(d * 0.45 + t * 0.25)); // a ratos, un pulso rosa de amor
      vec3 col = mix(c0, mix(c1 * 0.8, c2, rose * 0.45), v);
      float breeze = pow(0.5 + 0.5 * sin(a * 3.0 + d * 0.9 - t * 0.7), 6.0) * 0.18; // corrientes de aire
      float spark = pow(noise(vec3(a * 24.0, d * 8.0, t * 0.5)), 30.0) * 2.5;
      return col * (0.7 + 0.35 * uBreath) + c1 * breeze + vec3(0.85, 1.0, 0.9) * spark;
    }
    if (s == 4) {
      // GARGANTA · sonido: ondas concéntricas que vibran con la música
      float amp = 0.5 + 0.5 * sin(a * 16.0 + t * 0.8);
      float wave = sin(d * 7.0 - t * 3.0 + amp * (1.0 + uMid * 6.0));
      float v = pow(wave * 0.5 + 0.5, 3.0 - uTreble * 2.0);
      float spokes = pow(abs(cos(a * 8.0 + d * 0.2)), 40.0) * 0.3;
      return pal(v * 0.85, c0, c1, c2) * 0.75 + c2 * spokes;
    }
    if (s == 5) {
      // TERCER OJO · luz: caleidoscopio fractal
      float seg = TAU / 6.0;
      float aa = abs(mod(a + t * 0.05, seg) - seg * 0.5);
      vec2 q = vec2(cos(aa), sin(aa)) * (0.7 + 0.35 * sin(d * 0.35));
      float acc = 0.0;
      for (int i = 0; i < 6; i++) {
        q = abs(q) / dot(q, q) - vec2(0.82 + 0.06 * sin(t * 0.15), 0.62 + 0.05 * sin(d * 0.2));
        acc += exp(-3.0 * length(q));
      }
      float v = fract(acc * 0.35 + d * 0.06);
      vec3 col = pal(v * v, c0, c1, c2) * (0.4 + acc * 0.15);
      // el tercer ojo: un ojo almendrado que mira desde el fondo del túnel
      float ex = p.x / 0.62;
      float lid = 0.2 * (1.0 - ex * ex) * (0.75 + 0.25 * uBreath);
      float inEye = step(abs(ex), 1.0) * smoothstep(0.012, -0.012, abs(p.y) - lid);
      float lidLine = step(abs(ex), 1.0) * smoothstep(0.018, 0.0, abs(abs(p.y) - lid));
      float iris = smoothstep(0.13, 0.12, r) - smoothstep(0.055, 0.045, r);
      float rays = pow(abs(cos(a * 12.0 + t * 0.3)), 6.0) * smoothstep(0.13, 0.06, r);
      col = mix(col, c0 * 0.4, inEye * 0.7);
      col += c2 * (iris * 0.9 + rays * 0.5) * inEye + c2 * lidLine * 1.2;
      return col;
    }
    // CORONA · conciencia: el loto de mil pétalos. Coronas de pétalos que se
    // abren y se cierran mientras se avanza, en blanco, violeta y oro.
    float v = 0.0, rim = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float n = 12.0 * pow(2.0, fi);
      float q = fract(d * (0.35 + 0.12 * fi) + fi * 0.37);           // posición a lo largo del pétalo
      float w = sin(q * PI) * 0.92;                                   // ancho: punta, panza, punta
      float rot = t * 0.03 * (mod(fi, 2.0) * 2.0 - 1.0) + fi * 0.5;
      float u = abs(fract(a / TAU * n + rot + 0.5 * floor(d * (0.35 + 0.12 * fi) + fi * 0.37)) - 0.5) * 2.0;
      float petal = smoothstep(w, w - 0.12, u);
      v += petal * (1.0 - q * 0.5) / (1.0 + fi * 0.7);
      rim += smoothstep(0.05, 0.0, abs(u - w + 0.04)) * step(0.05, w) / (1.0 + fi);
    }
    float near = mix(1.0, 0.45, smoothstep(0.5, 1.5, r));            // la luz vive en el centro
    vec3 col = pal(clamp(v * 0.55, 0.0, 0.85), c0, c1, c2) * 0.7;
    col += vec3(1.0, 0.8, 0.45) * rim * 0.3;                          // bordes dorados
    return (col + vec3(1.0, 0.95, 1.0) * pow(v * 0.35, 3.0)) * near;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
    float cr = cos(uRoll), sr = sin(uRoll);
    p = mat2(cr, -sr, sr, cr) * p + uLook;
    float r = max(length(p), 1e-3);
    float a = atan(p.y, p.x);
    float d = 0.55 / r + uTravel;

    vec3 col;
    if (uMix < 0.001) col = scene(uFrom, a, d, r, p, uA0, uA1, uA2);
    else if (uMix > 0.999) col = scene(uTo, a, d, r, p, uB0, uB1, uB2);
    else col = mix(scene(uFrom, a, d, r, p, uA0, uA1, uA2), scene(uTo, a, d, r, p, uB0, uB1, uB2), uMix);

    // lejos (el centro) se apaga en niebla… y al fondo, la luz
    col *= 0.82;
    col *= smoothstep(0.0, 0.42, r) * 0.85 + 0.15;
    vec3 glowCol = mix(uA2, uB2, uMix);
    col += glowCol * (0.02 / (r + 0.045)) * (0.5 + uBass * 0.7 + uBreath * 0.25);
    col *= 1.0 + uBeat * 0.18;
    // viñeta
    col *= 1.0 - smoothstep(1.1, 2.2, length((vUv - 0.5) * vec2(uAspect, 1.0) * 2.0)) * 0.55;
    col = mix(col, vec3(1.0), uFlash);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// --- formas flotantes: brillo de borde (fresnel), translúcidas ---
const glowVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vZ;
  void main() {
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * local;
    vN = normalize(normalMatrix * n);
    vV = normalize(-mv.xyz);
    vZ = mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const glowFragment = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uRim;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  varying float vZ;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    vec3 c = uCore * 0.35 + uRim * f * 1.7;
    float fade = smoothstep(-150.0, -70.0, vZ) * smoothstep(0.5, -4.0, vZ);
    gl_FragColor = vec4(c, uOpacity * (0.3 + f) * fade);
    #include <colorspace_fragment>
  }
`;

function glowMaterial(core, rim) {
  return new THREE.ShaderMaterial({
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    uniforms: { uCore: { value: new THREE.Color(core) }, uRim: { value: new THREE.Color(rim) }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.65, -0.05, -0.45, 0.55, 0, 0.25);
  s.bezierCurveTo(0.45, 0.55, 0.65, -0.05, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 });
  g.center();
  return g;
}

// Qué flota en cada chakra (y cómo se mueve).
const DRIFT = [
  { geo: () => new THREE.OctahedronGeometry(0.55).scale(0.7, 1.9, 0.7), spin: 0.4, size: [0.8, 1.8] },    // cristales de tierra
  { geo: () => new THREE.SphereGeometry(0.55, 20, 14), spin: 0.2, size: [0.4, 1.4], wobble: 1 },          // burbujas
  { geo: () => new THREE.IcosahedronGeometry(0.45, 0), spin: 1.4, size: [0.4, 1.0], rise: 1 },            // brasas
  { geo: heartGeometry, spin: 0.5, size: [0.7, 1.3], wobble: 1 },                                          // corazones
  { geo: () => new THREE.TorusGeometry(0.9, 0.035, 6, 56), spin: 0.6, size: [0.8, 2.2], pulse: 1 },       // ondas de sonido
  { geo: () => new THREE.TetrahedronGeometry(0.65), spin: 0.9, size: [0.6, 1.5] },                        // prismas
  { geo: () => new THREE.SphereGeometry(0.5, 16, 10).scale(0.32, 0.07, 1), spin: 0.3, size: [0.8, 1.6], wobble: 1 }, // pétalos
];

// --- el loto de cada chakra, dibujado en canvas (puerta y tarjeta) ---
function drawLotus(ch, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const [deep, mid, bright] = ch.palette;
  const R = size / 2;
  x.translate(R, R);
  x.lineJoin = 'round';

  const petal = (len, wid, a) => {
    x.save();
    x.rotate(a);
    x.beginPath();
    x.moveTo(0, -R * 0.36);
    x.bezierCurveTo(wid, -R * 0.36 - len * 0.35, wid * 0.55, -R * 0.36 - len * 0.85, 0, -R * 0.36 - len);
    x.bezierCurveTo(-wid * 0.55, -R * 0.36 - len * 0.85, -wid, -R * 0.36 - len * 0.35, 0, -R * 0.36);
    const gr = x.createLinearGradient(0, -R * 0.36, 0, -R * 0.36 - len);
    gr.addColorStop(0, mid);
    gr.addColorStop(1, bright);
    x.fillStyle = gr;
    x.globalAlpha = 0.85;
    x.fill();
    x.globalAlpha = 1;
    x.stroke();
    x.restore();
  };

  x.shadowColor = bright;
  x.shadowBlur = size * 0.04;
  x.strokeStyle = bright;
  x.lineWidth = size * 0.006;
  if (ch.petals >= 1000) {
    // mil pétalos: varias coronas, cada una más fina
    const layers = [[48, 0.6, 0.05], [32, 0.5, 0.07], [20, 0.4, 0.1]];
    layers.forEach(([n, len, wid], k) => {
      for (let i = 0; i < n; i++) petal(R * len, R * wid, (i / n) * Math.PI * 2 + k * 0.2);
    });
  } else if (ch.petals === 2) {
    petal(R * 0.6, R * 0.5, -Math.PI / 2);
    petal(R * 0.6, R * 0.5, Math.PI / 2);
  } else {
    const n = ch.petals;
    const wid = Math.min(R * 0.36, (Math.PI * R * 0.5) / n);
    for (let i = 0; i < n; i++) petal(R * 0.55, wid, (i / n) * Math.PI * 2);
  }

  // disco central con la forma del chakra
  const disc = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.38);
  disc.addColorStop(0, bright);
  disc.addColorStop(0.55, mid);
  disc.addColorStop(1, deep);
  x.fillStyle = disc;
  x.beginPath();
  x.arc(0, 0, R * 0.38, 0, Math.PI * 2);
  x.fill();
  x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.9)';
  x.lineWidth = size * 0.008;
  const poly = (pts) => { x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.stroke(); };
  const tri = (r, down) => poly([0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + (down ? Math.PI / 2 : -Math.PI / 2);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }));
  const k = R * 0.3;
  switch (ch.scene) {
    case 0: poly([[-k * 0.75, -k * 0.75], [k * 0.75, -k * 0.75], [k * 0.75, k * 0.75], [-k * 0.75, k * 0.75]]); tri(k * 0.6, true); break;
    case 1: x.beginPath(); x.arc(0, 0, k * 0.85, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(0, -k * 0.2, k * 0.6, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); break;
    case 2: tri(k * 0.95, true); break;
    case 3: tri(k * 0.9, true); tri(k * 0.9, false); break;
    case 4: x.beginPath(); x.arc(0, 0, k * 0.85, 0, Math.PI * 2); x.stroke(); tri(k * 0.8, true); x.beginPath(); x.arc(0, k * 0.12, k * 0.35, 0, Math.PI * 2); x.stroke(); break;
    case 5: x.beginPath(); x.arc(0, 0, k * 0.8, 0, Math.PI * 2); x.stroke(); tri(k * 0.6, true); break;
    default: x.beginPath(); x.arc(0, 0, k * 0.85, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(0, 0, k * 0.45, 0, Math.PI * 2); x.stroke();
  }
  x.shadowBlur = size * 0.02;
  x.fillStyle = '#fff';
  x.font = `700 ${Math.round(size * (ch.mantra.length > 3 ? 0.045 : 0.07))}px Cinzel, serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (ch.mantra.length <= 3) x.fillText(ch.mantra, 0, ch.scene === 4 ? k * 0.12 : 0);
  return c;
}

// =====================================================================
// Cuenco: la frecuencia de cada chakra como un zumbido suave, campanas al
// cruzar un loto y notas al recoger chispas. Solo suena si ella lo enciende.
// =====================================================================
class Bowl {
  constructor() {
    this.ctx = null;
    this.on = false;
  }
  _ensure() {
    if (this.ctx) return;
    const A = window.AudioContext || window.webkitAudioContext;
    this.ctx = new A();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);
    // zumbido: fundamental grave + octavas + quinta, con un vaivén lento
    this.voices = [[0.25, 0.5], [0.5, 0.3], [0.75, 0.1], [1, 0.05]].map(([mul, gain]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      const gnode = c.createGain();
      gnode.gain.value = gain;
      o.connect(gnode).connect(this.master);
      o.start();
      return { o, mul };
    });
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const depth = c.createGain();
    depth.gain.value = 0.08;
    lfo.connect(depth).connect(this.master.gain);
    lfo.start();
  }
  setOn(on, hz) {
    this.on = on;
    if (on) this._ensure();
    if (!this.ctx) return;
    this.ctx.resume?.();
    if (hz) this.tune(hz);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 0.16 : 0, now, on ? 1.2 : 0.4);
  }
  tune(hz) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of this.voices) v.o.frequency.setTargetAtTime(hz * v.mul, now, 1.5); // se desliza al nuevo chakra
  }
  _tone(freq, peak, decay, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + decay + 0.1);
  }
  bell(hz) {
    if (!this.on || !this.ctx) return;
    const f = hz / 2;
    [[1, 0.12, 6], [2.76, 0.05, 4], [5.4, 0.025, 2.5], [1.003, 0.08, 6]].forEach(([m, p, d]) => this._tone(f * m, p, d));
  }
  ping(hz) {
    if (!this.on || !this.ctx) return;
    const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
    this._tone((hz / 2) * scale[Math.floor(Math.random() * scale.length)], 0.05, 1.4);
  }
  dispose() {
    this.ctx?.close?.();
    this.ctx = null;
  }
}

// --- progreso guardado ---
const KEY = 'galaxia:chakras';
function load(key, fallback) {
  try { const v = localStorage.getItem(`${KEY}:${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(`${KEY}:${key}`, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
}

export function mount(stage, ctx) {
  const { exit, audio, audioProcessor: ap, getConsoleTop, loveNotes = [], reward } = ctx;

  // --- DOM ---
  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'chakras';
  root.innerHTML = `
    <div class="hud">
      <button class="planet-exit exit" type="button" aria-label="Volver a la galaxia">
        <svg width="18" height="18" viewBox="0 0 40 40" aria-hidden="true">
          <defs><mask id="chk-exit-moon"><circle cx="20" cy="20" r="15" fill="#fff"/><circle cx="29" cy="20" r="13.5" fill="#000"/></mask></defs>
          <circle cx="20" cy="20" r="15" fill="currentColor" mask="url(#chk-exit-moon)"/>
        </svg>
        Volver a la galaxia
      </button>
    </div>
    <div class="tools">
      <button class="tbtn sound" type="button" aria-pressed="false" title="La frecuencia de cada chakra">◎ Cuenco</button>
      <button class="tbtn breathe" type="button" aria-pressed="true" title="Guía para respirar">Respirar</button>
    </div>
    <div class="path" aria-hidden="true"><div class="beads"></div><div class="label"></div></div>
    <div class="card" role="status"></div>
    <div class="teach" role="status"></div>
    <div class="breath" aria-hidden="true"><div class="ring"></div><div class="word"></div></div>
    <div class="panel start"><div class="in">
      <h1>Sendero de Luz</h1>
      <p class="sub">Un viaje por los siete chakras,\nde la raíz a la corona</p>
      <div class="start-beads" role="group" aria-label="Ir directo a un chakra"></div>
      <p class="pick"></p>
      <p class="how"></p>
      <div class="row"><button class="go resume" type="button" hidden></button><button class="go begin" type="button">Comenzar el viaje</button></div>
    </div></div>
    <div class="panel end"><div class="in">
      <h1></h1>
      <p class="sub"></p>
      <p class="love"></p>
      <div class="row">
        <button class="go float" type="button">Flotar en la luz</button>
        <button class="go alt again" type="button">Recorrer otra vez</button>
      </div>
    </div></div>`;
  stage.append(style, root);

  const $ = (s) => root.querySelector(s);
  const beadsEl = $('.beads'), pathEl = $('.path'), pathLabel = $('.path .label');
  const cardEl = $('.card'), teachEl = $('.teach');
  const breathEl = $('.breath'), breathRing = $('.breath .ring'), breathWord = $('.breath .word');
  const startPanel = $('.panel.start'), endPanel = $('.panel.end');
  const soundBtn = $('.sound'), breatheBtn = $('.breathe');
  $('.exit').onclick = () => exit();
  $('.how').textContent = isMobile
    ? 'Desliza el dedo para guiar tu luz · recoge las chispas · respira'
    : 'Mueve el ratón (o usa las flechas) para guiar tu luz · recoge las chispas · respira';

  const beads = chakras.map((ch) => {
    const b = document.createElement('i');
    b.className = 'bead';
    b.style.setProperty('--c', ch.palette[1]);
    beadsEl.append(b);
    return b;
  });

  // --- three.js ---
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
  root.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);

  let composer = null, bloom = null;
  if (!isMobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.78);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };

  // túnel
  const col = (hex) => new THREE.Color(hex);
  const tu = {
    uTime: { value: 0 }, uTravel: { value: 0 }, uMix: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
    uBeat: { value: 0 }, uFlash: { value: 0 }, uAspect: { value: 1 }, uRoll: { value: 0 }, uBreath: { value: 0 },
    uFrom: { value: 0 }, uTo: { value: 0 }, uLook: { value: new THREE.Vector2() },
    uA0: { value: col('#000') }, uA1: { value: col('#000') }, uA2: { value: col('#000') },
    uB0: { value: col('#000') }, uB1: { value: col('#000') }, uB2: { value: col('#000') },
  };
  const tunnel = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(2, 2)),
    keep(new THREE.ShaderMaterial({ vertexShader: tunnelVertex, fragmentShader: tunnelFragment, uniforms: tu, depthWrite: false, depthTest: false })),
  );
  tunnel.frustumCulled = false;
  tunnel.renderOrder = -10;
  scene.add(tunnel);

  const setPalette = (prefix, ch) => ch.palette.forEach((h, i) => tu[`${prefix}${i}`].value.set(h));

  const glowTex = keep(radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));

  // polvo de luz que fluye hacia nosotros
  const DUST = isMobile ? 500 : 1400;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 12;
    dustPos.set([Math.cos(a) * r, Math.sin(a) * r, FAR + Math.random() * (5 - FAR)], i * 3);
    dustSeed[i] = Math.random();
  }
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = keep(new THREE.PointsMaterial({
    size: 0.16, map: glowTex, color: 0xffffff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // formas flotantes (una por chakra; se crean al llegar a él)
  const DRIFT_N = isMobile ? 22 : 40;
  const drifters = new Map(); // scene -> { mesh, items, opacity, target }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function drifterFor(i) {
    if (drifters.has(i)) return drifters.get(i);
    const ch = chakras[i];
    const mesh = new THREE.InstancedMesh(keep(DRIFT[i].geo()), keep(glowMaterial(ch.palette[1], ch.palette[2])), DRIFT_N);
    mesh.frustumCulled = false;
    const items = Array.from({ length: DRIFT_N }, () => spawnDrifter({}, true, i));
    scene.add(mesh);
    const d = { mesh, items, opacity: 0, target: 0 };
    drifters.set(i, d);
    return d;
  }
  function spawnDrifter(it, anywhere, i) {
    const a = Math.random() * Math.PI * 2, r = 3.4 + Math.random() * 6;
    const [lo, hi] = DRIFT[i].size;
    Object.assign(it, {
      x: Math.cos(a) * r, y: Math.sin(a) * r,
      z: anywhere ? FAR + Math.random() * (0 - FAR) : FAR - Math.random() * 20,
      rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
      sx: (Math.random() - 0.5) * 2, sy: (Math.random() - 0.5) * 2,
      scale: lo + Math.random() * (hi - lo), speed: 0.75 + Math.random() * 0.4, ph: Math.random() * 6.28,
    });
    return it;
  }

  // anillos para cruzar (fuego y sonido)
  const ringGeo = keep(new THREE.TorusGeometry(1.15, 0.06, 8, 72));
  const rings = [];
  function ringMat(ch) { const m = keep(glowMaterial(ch.palette[2], ch.palette[2])); m.uniforms.uOpacity.value = 1; return m; }

  // chispas para recoger
  const orbs = [];
  const orbMatFor = new Map();
  function orbMaterial(i) {
    if (!orbMatFor.has(i)) {
      orbMatFor.set(i, keep(new THREE.SpriteMaterial({
        map: glowTex, color: new THREE.Color(chakras[i].palette[2]).lerp(new THREE.Color('#fff'), 0.35),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })));
    }
    return orbMatFor.get(i);
  }

  // estallidos
  const SPARKS = 220;
  const sparkPos = new Float32Array(SPARKS * 3).fill(9999);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = keep(new THREE.BufferGeometry());
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = keep(new THREE.PointsMaterial({
    size: 0.22, map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const sparkPts = new THREE.Points(sparkGeo, sparkMat);
  sparkPts.frustumCulled = false;
  scene.add(sparkPts);
  let sparkNext = 0;
  function burst(x, y, z, n = 26, speed = 3) {
    for (let k = 0; k < n; k++) {
      const i = sparkNext++ % SPARKS;
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const v = speed * (0.4 + Math.random() * 0.8);
      sparkPos.set([x, y, z], i * 3);
      sparkVel.set([Math.cos(th) * s * v, Math.sin(th) * s * v, u * v], i * 3);
      sparkLife[i] = 1;
    }
  }

  // la luz que ella guía, con su estela
  const player = { x: 0, y: -0.6, tx: 0, ty: -0.6, vx: 0, vy: 0 };
  const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const core = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  halo.scale.setScalar(1.3);
  core.scale.setScalar(0.45);
  scene.add(halo, core);
  const TRAIL = 16;
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 0.5 * (1 - i / TRAIL), blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    s.scale.setScalar(0.5 * (1 - i / TRAIL) + 0.08);
    scene.add(s);
    return s;
  });
  const history = Array.from({ length: TRAIL }, () => [player.x, player.y]);

  // el loto-puerta
  const gateTex = new Map();
  function lotusTexture(i) {
    if (!gateTex.has(i)) {
      const t = keep(new THREE.CanvasTexture(drawLotus(chakras[i], 512)));
      t.colorSpace = THREE.SRGBColorSpace;
      gateTex.set(i, t);
    }
    return gateTex.get(i);
  }
  const gate = new THREE.Mesh(keep(new THREE.PlaneGeometry(13, 13)), keep(new THREE.MeshBasicMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
  })));
  gate.visible = false;
  scene.add(gate);

  // =====================================================================
  // Estado del viaje
  // =====================================================================
  let mode = 'menu'; // menu · journey · ending · float
  let idx = 0;
  const phase = { t: 0, orbs: 0, gate: false, teach: 0 };
  let reached = Math.min(6, load('reached', 0));
  let mixT = 1;           // 0..1 transición del túnel
  let flash = 0, flashTarget = 0;
  let travel = 0, speed = 6;
  let sinceOrb = 0, nextOrb = 2, sinceRing = 0;
  let cardTimer = 0, teachTimer = null;
  let floatClock = 0;
  let breathOn = load('breath', true);
  let soundOn = load('sound', false);
  const bowl = new Bowl();
  const baseVolume = audio.volume;
  const lovelyIdx = Math.floor(Math.random() * Math.max(1, loveNotes.length));

  function setChakra(i, blend) {
    const prev = idx;
    idx = i;
    const ch = chakras[i];
    if (blend) {
      tu.uFrom.value = prev;
      setPalette('uA', chakras[prev]);
      mixT = 0;
    } else {
      tu.uFrom.value = i;
      setPalette('uA', ch);
      mixT = 1;
    }
    tu.uTo.value = i;
    setPalette('uB', ch);
    // formas: las del chakra anterior se desvanecen
    for (const [k, d] of drifters) d.target = k === i ? 1 : 0;
    drifterFor(i).target = 1;
    root.style.setProperty('--c', ch.palette[1]);
    pathLabel.textContent = `${ch.name} · ${ch.title.replace('Chakra ', '')}`;
    halo.material.color.set(ch.palette[2]);
    trail.forEach((s) => s.material.color.set(ch.palette[2]));
    dustMat.color.set(ch.palette[2]).lerp(new THREE.Color('#fff'), 0.5);
    sparkMat.color.set(ch.palette[2]).lerp(new THREE.Color('#fff'), 0.4);
    bowl.tune(ch.hz);
    paintBeads();
  }

  function paintBeads() {
    beads.forEach((b, i) => {
      b.classList.toggle('done', mode !== 'menu' && (i < idx || mode === 'ending' || mode === 'float'));
      b.classList.toggle('now', mode === 'journey' && i === idx);
    });
    const m = Math.min(1, Math.max(phase.orbs / ORBS_NEEDED, phase.t / PHASE_MAX));
    beads[idx].style.setProperty('--m', mode === 'journey' ? m.toFixed(3) : 0);
    pathEl.style.opacity = mode === 'menu' ? 0 : 1;
  }

  function showCard(i) {
    const ch = chakras[i];
    const img = new Image();
    img.src = drawLotus(ch, 300).toDataURL();
    img.alt = '';
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; return e; };
    cardEl.replaceChildren(
      img,
      el('div', 'ord', `${ORDINALS[i]} chakra`),
      el('h2', '', ch.name),
      el('div', 'meta', `${ch.title} · ${ch.element} · ${ch.place}`),
      el('div', 'mantra', ch.mantra === 'Silencio' ? `Silencio · ${ch.hz} Hz` : `${ch.mantra} · ${ch.hz} Hz`),
      el('p', '', ch.meaning),
      el('p', 'aff', `«${ch.affirmation}»`),
    );
    cardEl.style.setProperty('--c', ch.palette[1]);
    cardEl.classList.add('show');
    root.classList.add('reading');
    cardTimer = CARD_TIME;
  }
  cardEl.addEventListener('pointerdown', () => { cardTimer = Math.min(cardTimer, 0.01); });

  function teach(text, ms = 6500) {
    teachEl.textContent = text;
    teachEl.classList.add('show');
    clearTimeout(teachTimer);
    teachTimer = setTimeout(() => teachEl.classList.remove('show'), ms);
  }

  function beginPhase(i, blend) {
    Object.assign(phase, { t: 0, orbs: 0, gate: false, teach: 0 });
    setChakra(i, blend);
    // su loto espera, pequeño, al fondo del túnel
    gate.material.map = lotusTexture(i);
    gate.material.needsUpdate = true;
    gate.position.set(0, 0, FAR);
    gate.material.opacity = 0;
    gate.visible = true;
    showCard(i);
    sinceOrb = 0;
    nextOrb = CARD_TIME * 0.6;
  }

  function startJourney(from = 0) {
    mode = 'journey';
    startPanel.classList.remove('show');
    endPanel.classList.remove('show');
    for (const o of orbs) o.dead = true;
    beginPhase(from, from !== idx);
  }

  function passGate() {
    gate.visible = false;
    gate.scale.setScalar(1);
    flash = 0;
    flashTarget = 1;
    bowl.bell(chakras[idx].hz);
    navigator.vibrate?.(30);
    reward?.(idx < chakras.length - 1 ? 1 : 3, `${chakras[idx].name} despertó`);
    if (idx < chakras.length - 1) {
      const next = idx + 1;
      reached = Math.max(reached, next);
      save('reached', reached);
      setTimeout(() => { flashTarget = 0; }, 450);
      beginPhase(next, true);
    } else {
      // ¡iluminación!
      mode = 'ending';
      reached = 6;
      save('reached', 6);
      save('completed', true);
      cardEl.classList.remove('show');
      root.classList.remove('reading');
      setTimeout(() => { flashTarget = 0.0; }, 2200);
      setTimeout(() => {
        $('.end h1').textContent = ending.title;
        $('.end .sub').textContent = ending.text;
        $('.end .love').textContent = ending.love;
        endPanel.classList.add('show');
      }, 2600);
      setTimeout(() => bowl.bell(chakras[6].hz * 0.75), 900);
      paintBeads();
    }
  }

  // --- panel de inicio ---
  // El sendero se recorre en orden: desde la raíz, o siguiendo en el chakra
  // donde ella se quedó. Los chakras ya alcanzados se pueden visitar directo
  // (y desde ahí el viaje sigue en orden hacia la corona).
  function renderStart() {
    const wrap = $('.start-beads');
    wrap.replaceChildren(...chakras.map((ch, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.setProperty('--c', ch.palette[1]);
      b.className = i < reached ? 'lit' : i === reached ? 'next' : '';
      b.disabled = i > reached;
      b.title = i > reached ? `${ch.name}: aún no llegas aquí` : `Ir a ${ch.name}`;
      b.setAttribute('aria-label', b.title);
      b.onclick = () => startJourney(i);
      return b;
    }));
    $('.pick').textContent = reached > 0 ? 'Toca un chakra que ya despertaste para volver a él' : '';
    const resume = $('.resume');
    resume.hidden = reached === 0;
    resume.textContent = `Seguir en ${chakras[reached].name}`;
    $('.begin').className = reached > 0 ? 'go alt begin' : 'go begin';
    $('.begin').textContent = reached > 0 ? 'Desde la raíz' : 'Comenzar el viaje';
  }
  $('.begin').onclick = () => startJourney(0);
  $('.resume').onclick = () => startJourney(reached);
  $('.again').onclick = () => startJourney(0);
  $('.float').onclick = () => {
    mode = 'float';
    floatClock = 0;
    endPanel.classList.remove('show');
    teach('Quédate aquí todo lo que quieras 💜', 5000);
    paintBeads();
  };

  // --- interruptores ---
  function paintTools() {
    soundBtn.setAttribute('aria-pressed', soundOn);
    breatheBtn.setAttribute('aria-pressed', breathOn);
    breathEl.hidden = !breathOn;
  }
  soundBtn.onclick = () => {
    soundOn = !soundOn;
    save('sound', soundOn);
    bowl.setOn(soundOn, chakras[idx].hz);
    // la música baja un poco para que el cuenco se escuche
    audio.volume = soundOn ? baseVolume * 0.4 : baseVolume;
    paintTools();
  };
  breatheBtn.onclick = () => { breathOn = !breathOn; save('breath', breathOn); paintTools(); };
  if (soundOn) { bowl.setOn(true, chakras[0].hz); audio.volume = baseVolume * 0.4; }
  paintTools();

  // --- entrada: la luz sigue al dedo / ratón; o flechas ---
  const keys = new Set();
  let pointerActive = false;
  function aim(e) {
    const r = root.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const aspect = r.width / r.height;
    player.tx = nx * REACH * Math.min(1.5, Math.max(0.8, aspect)) * 1.1;
    player.ty = ny * REACH * 1.1;
  }
  const onPointerDown = (e) => { if (e.target.closest('button, .panel.show')) return; pointerActive = true; aim(e); };
  const onPointerMove = (e) => { if (e.pointerType === 'mouse' || pointerActive) { if (!e.target.closest?.('.panel.show')) aim(e); } };
  const onPointerUp = () => { pointerActive = false; };
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  const onKey = (e) => {
    if (e.key === 'Escape' && e.type === 'keydown') { exit(); return; }
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k)) {
      e.preventDefault();
      if (e.type === 'keydown') keys.add(k); else keys.delete(k);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // --- tamaño ---
  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    bloom?.setSize(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    tu.uAspect.value = w / h;
    // la guía de respiración, justo sobre la consola de música
    const top = getConsoleTop();
    breathEl.style.top = `${Math.max(h * 0.6, Math.min(h - 110, top - 100))}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  // =====================================================================
  // Bucle
  // =====================================================================
  let breathPhase = 0; // 0..1 dentro del ciclo
  const CYCLE = BREATH[0] + BREATH[1] + BREATH[2];
  let breathLevel = 0;

  function updateBreath(time) {
    const t = time % CYCLE;
    let word, lvl;
    if (t < BREATH[0]) { word = 'inhala'; lvl = t / BREATH[0]; }
    else if (t < BREATH[0] + BREATH[1]) { word = 'sostén'; lvl = 1; }
    else { word = 'exhala'; lvl = 1 - (t - BREATH[0] - BREATH[1]) / BREATH[2]; }
    breathLevel = 0.5 - 0.5 * Math.cos(lvl * Math.PI);
    breathPhase = t / CYCLE;
    if (breathOn) {
      breathRing.style.transform = `scale(${(0.55 + breathLevel * 0.6).toFixed(3)})`;
      if (breathWord.textContent !== word) breathWord.textContent = word;
    }
  }

  function spawnOrb() {
    let o = orbs.find((q) => q.dead);
    if (!o) {
      o = { sprite: new THREE.Sprite(orbMaterial(idx)), dead: true };
      scene.add(o.sprite);
      orbs.push(o);
    }
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * REACH * 0.95;
    Object.assign(o, { x: Math.cos(a) * r, y: Math.sin(a) * r, z: FAR * 0.6, dead: false, ph: Math.random() * 6.28 });
    o.sprite.material = orbMaterial(idx);
    o.sprite.visible = true;
  }

  function spawnRing() {
    const a = Math.random() * Math.PI * 2, r = Math.random() * REACH * 0.7;
    const mesh = new THREE.Mesh(ringGeo, ringMat(chakras[idx]));
    mesh.position.set(Math.cos(a) * r, Math.sin(a) * r, FAR * 0.7);
    scene.add(mesh);
    rings.push({ mesh, passed: false });
  }

  const _drift = new THREE.Vector3();
  function update(dt, time) {
    const playing = audio && !audio.paused;
    const bass = playing ? ap.bass || 0 : 0;
    const mid = playing ? ap.mid || 0 : 0;
    const treble = playing ? ap.treble || 0 : 0;
    const beat = playing ? ap.beatHold || 0 : 0;
    updateBreath(time);

    // --- ritmo del viaje ---
    const calm = mode === 'menu' ? 0.45 : mode === 'ending' ? 0.25 : mode === 'float' ? 0.55 : 1;
    const targetSpeed = (11 + bass * 5) * (0.85 + breathLevel * 0.3) * calm * (reducedMotion ? 0.6 : 1);
    speed += (targetSpeed - speed) * Math.min(1, dt * 1.5);
    const step = speed * dt;
    travel += step * 0.035;

    // --- fases ---
    if (mode === 'journey') {
      phase.t += dt;
      if (cardTimer > 0) {
        cardTimer -= dt;
        if (cardTimer <= 0) { cardEl.classList.remove('show'); root.classList.remove('reading'); }
      }
      if (phase.teach < TEACH_AT.length && phase.t > TEACH_AT[phase.teach] && !phase.gate) {
        const ch = chakras[idx];
        // en el corazón, la última enseñanza es una nota de amor
        const text = idx === 3 && phase.teach === 2 && loveNotes.length ? loveNotes[lovelyIdx % loveNotes.length] : ch.teachings[phase.teach % ch.teachings.length];
        teach(text);
        phase.teach++;
      }
      const awake = phase.orbs >= ORBS_NEEDED && phase.t >= PHASE_MIN;
      if (!phase.gate && (awake || phase.t >= PHASE_MAX)) {
        phase.gate = true;
        teach(`${chakras[idx].name} ha despertado ✨`, 5000);
        bowl.bell(chakras[idx].hz * 1.5);
      }
      paintBeads();
    } else if (mode === 'float') {
      // flotar: los chakras se suceden solos, despacio, sin tarjetas
      floatClock += dt;
      if (floatClock > 40) { floatClock = 0; setChakra((idx + 1) % chakras.length, true); }
    }

    // --- transiciones del túnel ---
    if (mixT < 1) {
      mixT = Math.min(1, mixT + dt / 4);
      tu.uMix.value = mixT * mixT * (3 - 2 * mixT);
      if (mixT >= 1) {
        tu.uFrom.value = idx;
        setPalette('uA', chakras[idx]);
        tu.uMix.value = 0;
      }
    }
    flash += (flashTarget - flash) * Math.min(1, dt * (flashTarget > flash ? 6 : 1.2));

    // --- la luz ---
    const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
    const ky = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
    if (kx || ky) { player.tx += kx * dt * 4; player.ty += ky * dt * 4; }
    const tl = Math.hypot(player.tx, player.ty);
    if (tl > REACH) { player.tx *= REACH / tl; player.ty *= REACH / tl; }
    const px = player.x, py = player.y;
    const ease = 1 - Math.exp(-dt * 3.2);
    player.x += (player.tx - player.x) * ease;
    player.y += (player.ty - player.y) * ease;
    player.vx = (player.x - px) / Math.max(dt, 1e-3);
    player.vy = (player.y - py) / Math.max(dt, 1e-3);
    const pulse = 1 + Math.sin(time * 3) * 0.06 + beat * 0.25;
    halo.position.set(player.x, player.y, PLAYER_Z);
    core.position.copy(halo.position);
    halo.scale.setScalar(1.3 * pulse * (0.9 + breathLevel * 0.25));
    core.scale.setScalar(0.42 * pulse);
    history.pop();
    history.unshift([player.x, player.y]);
    trail.forEach((s, i) => s.position.set(history[i][0], history[i][1], PLAYER_Z + i * 0.22));

    // --- cámara: sigue a la luz, se mece despacio ---
    const roll = Math.sin(time * 0.05) * 0.35 - player.vx * 0.04;
    camera.position.set(player.x * 0.45, player.y * 0.45, 0);
    camera.lookAt(player.x * 0.2, player.y * 0.2, -20);
    camera.rotateZ(roll);
    camera.fov += (70 + (mode === 'ending' ? 18 : 0) + beat * 2 - camera.fov) * Math.min(1, dt * 2);
    camera.updateProjectionMatrix();

    // --- túnel ---
    tu.uTime.value = time;
    tu.uTravel.value = travel;
    tu.uBass.value = bass;
    tu.uMid.value = mid;
    tu.uTreble.value = treble;
    tu.uBeat.value = beat;
    tu.uBreath.value = breathLevel;
    tu.uFlash.value = flash;
    tu.uRoll.value = -roll;
    tu.uLook.value.set(camera.position.x * 0.09, camera.position.y * 0.09);

    // --- polvo ---
    for (let i = 0; i < DUST; i++) {
      const o = i * 3;
      dustPos[o + 2] += step * (0.8 + dustSeed[i] * 0.6);
      if (dustPos[o + 2] > 5) dustPos[o + 2] = FAR;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.size = 0.14 + treble * 0.12;

    // --- formas flotantes ---
    for (const [k, d] of drifters) {
      d.opacity += (d.target - d.opacity) * Math.min(1, dt * 0.8);
      d.mesh.material.uniforms.uOpacity.value = d.opacity * (0.85 + bass * 0.6);
      d.mesh.visible = d.opacity > 0.01;
      if (!d.mesh.visible) continue;
      const cfg = DRIFT[k];
      d.items.forEach((it, n) => {
        it.z += step * it.speed;
        if (it.z > 4) spawnDrifter(it, false, k);
        it.rx += dt * cfg.spin * it.sx;
        it.ry += dt * cfg.spin * it.sy;
        let x = it.x, y = it.y;
        if (cfg.wobble) { x += Math.sin(time * 0.6 + it.ph) * 0.5; y += Math.cos(time * 0.5 + it.ph) * 0.5; }
        if (cfg.rise) y += Math.sin(time * 1.3 + it.ph) * 0.3 + ((time * 0.4 + it.ph) % 3) * 0.3;
        let sc = it.scale;
        if (cfg.pulse) sc *= 1 + beat * 0.5 + Math.sin(time * 2 + it.ph) * 0.15;
        _p.set(x, y, it.z);
        _q.setFromEuler(_e.set(it.rx, it.ry, it.rz));
        _s.setScalar(sc);
        d.mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      d.mesh.instanceMatrix.needsUpdate = true;
    }

    // --- chispas ---
    const spawning = (mode === 'journey' && cardTimer < CARD_TIME * 0.4 && !phase.gate) || mode === 'float';
    sinceOrb += dt;
    if (spawning && (sinceOrb > nextOrb || (beat > 0.9 && sinceOrb > 0.9))) {
      spawnOrb();
      sinceOrb = 0;
      nextOrb = 1.6 + Math.random() * 1.2;
    }
    for (const o of orbs) {
      if (o.dead) { o.sprite.visible = false; continue; }
      const prevZ = o.z;
      o.z += step;
      const sc = 0.75 + Math.sin(time * 4 + o.ph) * 0.12;
      o.sprite.position.set(o.x, o.y, o.z);
      o.sprite.scale.setScalar(sc);
      o.sprite.material.opacity = Math.min(1, (o.z - FAR * 0.6) / 25);
      if (prevZ < PLAYER_Z && o.z >= PLAYER_Z) {
        if (Math.hypot(o.x - player.x, o.y - player.y) < 0.85) {
          o.dead = true;
          if (mode === 'journey') phase.orbs++;
          burst(o.x, o.y, PLAYER_Z, 22, 2.6);
          bowl.ping(chakras[idx].hz);
        }
      }
      if (o.z > 3) o.dead = true;
    }

    // --- anillos de fuego / sonido: cruzarlos suma luz ---
    const ringScenes = idx === 2 || idx === 4;
    sinceRing += dt;
    if (mode === 'journey' && ringScenes && !phase.gate && cardTimer <= 0 && sinceRing > 6) { spawnRing(); sinceRing = 0; }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      const prevZ = r.mesh.position.z;
      r.mesh.position.z += step;
      r.mesh.rotation.z += dt * 0.6;
      r.mesh.scale.setScalar(1 + beat * 0.12 + (r.passed ? (r.mesh.position.z - PLAYER_Z) * 0.3 : 0));
      if (!r.passed && prevZ < PLAYER_Z && r.mesh.position.z >= PLAYER_Z) {
        const dx = player.x - r.mesh.position.x, dy = player.y - r.mesh.position.y;
        if (Math.hypot(dx, dy) < 1.1) {
          r.passed = true;
          if (mode === 'journey') phase.orbs += 2;
          burst(r.mesh.position.x, r.mesh.position.y, PLAYER_Z, 50, 4);
          bowl.ping(chakras[idx].hz * 2);
        }
      }
      if (r.mesh.position.z > 4) {
        scene.remove(r.mesh);
        rings.splice(i, 1);
      }
    }

    // --- loto-puerta ---
    if (gate.visible) {
      gate.rotation.z += dt * 0.15;
      if (mode === 'journey' && phase.gate) {
        // despertó: el loto viene hacia ella
        gate.position.z += step * 0.8;
        gate.position.x += (player.x * 0.5 - gate.position.x) * dt;
        gate.position.y += (player.y * 0.5 - gate.position.y) * dt;
        gate.material.opacity = Math.min(1, gate.material.opacity + dt * 0.5) * (0.92 + beat * 0.08);
        if (gate.position.z > PLAYER_Z - 1) passGate();
      } else {
        // mientras tanto, late al fondo y se enciende a medida que despierta
        const m = mode === 'journey' ? Math.min(1, Math.max(phase.orbs / ORBS_NEEDED, phase.t / PHASE_MAX)) : 0;
        gate.material.opacity += (0.45 + m * 0.4 + breathLevel * 0.1 - gate.material.opacity) * Math.min(1, dt * 2);
        gate.scale.setScalar(1 + m * 0.6 + beat * 0.05);
      }
    }

    // --- estallidos ---
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue;
      const o = i * 3;
      sparkLife[i] -= dt * 1.2;
      sparkPos[o] += sparkVel[o] * dt;
      sparkPos[o + 1] += sparkVel[o + 1] * dt;
      sparkPos[o + 2] += sparkVel[o + 2] * dt + step * 0.5;
      sparkVel[o] *= 0.97; sparkVel[o + 1] *= 0.97; sparkVel[o + 2] *= 0.97;
      if (sparkLife[i] <= 0) sparkPos[o + 2] = 9999;
    }
    sparkGeo.attributes.position.needsUpdate = true;

    if (composer) composer.render(dt); else renderer.render(scene, camera);
  }

  // --- arranque: el túnel de la raíz, en calma, tras el panel de inicio ---
  setChakra(0, false);
  renderStart();
  startPanel.classList.add('show');
  paintBeads();
  $('.begin').focus({ preventScroll: true });

  function unmount() {
    clearTimeout(teachTimer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', onPointerUp);
    audio.volume = baseVolume;
    bowl.dispose();
    for (const o of disposables) o.dispose?.();
    for (const d of drifters.values()) d.mesh.dispose();
    composer?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
    style.remove();
  }

  return { update, unmount };
}
