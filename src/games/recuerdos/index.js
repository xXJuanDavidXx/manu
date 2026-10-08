import { memories, memoriesFinale } from '../../data.js';

// Planeta Recuerdos: un álbum de fotos nuestras que duermen borrosas hasta que
// ella las arma como rompecabezas. Las piezas tienen la forma clásica (con
// pestañas y huecos), encajan solas cuando caen cerca de su sitio y, al
// completar la foto, se revela con su fecha y una nota. El avance de cada
// rompecabezas se guarda en el navegador para seguir otro día.
//
// Interfaz de juego (la misma para todos los planetas):
//   mount(stage, ctx) -> { update(dt, time), unmount() }

const CSS = `
.recuerdos { position: absolute; inset: 0; overflow: hidden; color: var(--moon); touch-action: none;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(76,201,240,.16), transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(201,179,255,.12), transparent 70%),
    linear-gradient(180deg, #04050c 0%, #0a1426 60%, #10203a 100%); }
.recuerdos::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .55;
  background-image:
    radial-gradient(1px 1px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 72% 12%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 38% 64%, #cfe9ff, transparent), radial-gradient(1px 1px at 88% 46%, #fff, transparent),
    radial-gradient(1px 1px at 22% 82%, #fff, transparent), radial-gradient(1.5px 1.5px at 58% 32%, #e9dcff, transparent),
    radial-gradient(1px 1px at 8% 52%, #fff, transparent), radial-gradient(1px 1px at 94% 84%, #fff, transparent);
  background-size: 420px 420px; animation: rec-twinkle 6s ease-in-out infinite alternate; }
@keyframes rec-twinkle { to { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .recuerdos::before { animation: none; } }

.recuerdos .hud { position: absolute; top: 20px; left: 20px; z-index: 5; }
.recuerdos button { font: inherit; }

/* --- álbum --- */
.recuerdos .album { position: absolute; inset: 0; z-index: 2; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y;
  display: flex; flex-direction: column; align-items: center; padding: 84px 20px 180px;
  scrollbar-width: thin; scrollbar-color: rgba(143,216,245,.3) transparent; }
.recuerdos h1 { margin: 0; font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: .3em; text-transform: uppercase;
  font-size: clamp(1.25rem, 5vw, 2rem); color: #eaf6ff; text-align: center;
  text-shadow: 0 0 10px rgba(76,201,240,.7), 0 0 30px rgba(76,201,240,.35); }
.recuerdos .lead { margin: 6px 0 4px; font-style: italic; font-size: 1.15rem; color: rgba(236,232,245,.78); text-align: center; }
.recuerdos .progress-line { margin: 0 0 18px; font-family: 'Cinzel', serif; font-size: .62rem; letter-spacing: .26em;
  text-transform: uppercase; color: #8fd8f5; text-align: center; }
.recuerdos .levels { display: flex; gap: 6px; margin-bottom: 28px; padding: 4px; border: 1px solid var(--hair); border-radius: 999px;
  background: rgba(8,8,16,.55); }
.recuerdos .levels button { border: none; background: none; color: rgba(236,232,245,.7); cursor: pointer; border-radius: 999px;
  padding: 6px 14px; font-family: 'Cinzel', serif; font-size: .62rem; letter-spacing: .16em; text-transform: uppercase; }
.recuerdos .levels button[aria-pressed="true"] { background: rgba(76,201,240,.18); color: #eaf6ff; box-shadow: inset 0 0 0 1px rgba(76,201,240,.5); }
.recuerdos .levels button:focus-visible { outline: 1px solid var(--selene); }
.recuerdos .grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 30px 26px; max-width: 900px; }

.recuerdos .polaroid { --tilt: 0deg; position: relative; width: 170px; padding: 10px 10px 0; border: none; cursor: pointer;
  background: #f4efe6; border-radius: 3px; color: #2b2340; transform: rotate(var(--tilt));
  box-shadow: 0 10px 30px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06);
  transition: transform .35s ease, box-shadow .35s ease; }
.recuerdos .polaroid:hover, .recuerdos .polaroid:focus-visible { transform: rotate(0deg) translateY(-6px) scale(1.03); outline: none;
  box-shadow: 0 16px 40px rgba(0,0,0,.55), 0 0 26px rgba(76,201,240,.45); }
.recuerdos .polaroid .ph { position: relative; display: block; aspect-ratio: 1; overflow: hidden; background: #10203a; }
.recuerdos .polaroid img { width: 100%; height: 100%; object-fit: cover; display: block; transition: filter .6s ease; }
.recuerdos .polaroid.locked img { filter: blur(9px) saturate(.5) brightness(.75); transform: scale(1.15); }
.recuerdos .polaroid .badge { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  color: #fff; text-shadow: 0 1px 8px rgba(0,0,0,.8); font-family: 'Cinzel', serif; font-size: .58rem; letter-spacing: .2em; text-transform: uppercase; }
.recuerdos .polaroid .badge svg { opacity: .9; }
.recuerdos .polaroid .cap { display: block; padding: 10px 2px 12px; text-align: center; font-family: 'Cormorant Garamond', serif;
  font-style: italic; font-size: 1.05rem; line-height: 1.15; }
.recuerdos .polaroid .date { display: block; margin-top: 2px; font-style: normal; font-family: 'Cinzel', serif; font-size: .55rem; letter-spacing: .16em; color: #7a6f8f; }
.recuerdos .polaroid .bar { position: absolute; left: 10px; right: 10px; bottom: 6px; height: 2px; background: rgba(43,35,64,.12); border-radius: 2px; overflow: hidden; }
.recuerdos .polaroid .bar i { display: block; height: 100%; background: #4cc9f0; }
.recuerdos .note { margin-top: 34px; font-style: italic; font-size: .95rem; color: rgba(236,232,245,.5); text-align: center; max-width: 30rem; }
.recuerdos .letter-btn { margin-top: 30px; padding: 10px 22px; cursor: pointer; border-radius: 3px; color: #fff4dc;
  background: rgba(8,8,16,.7); border: 1px solid var(--torch); box-shadow: 0 0 24px rgba(246,161,90,.35);
  font-family: 'Cinzel', serif; font-size: .68rem; letter-spacing: .22em; text-transform: uppercase; animation: rec-breathe 2.6s ease-in-out infinite; }
@keyframes rec-breathe { 50% { box-shadow: 0 0 40px rgba(246,161,90,.6); } }

/* --- mesa del rompecabezas --- */
.recuerdos .table { position: absolute; inset: 0; z-index: 3; }
.recuerdos .table canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.recuerdos .bar-top { position: absolute; top: 20px; right: 20px; z-index: 4; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.recuerdos .tbtn { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; border-radius: 3px; padding: 8px 12px;
  background: rgba(8,8,16,.7); border: 1px solid var(--hair); color: var(--selene);
  font-family: 'Cinzel', serif; font-size: .6rem; font-weight: 600; letter-spacing: .18em; text-transform: uppercase;
  transition: color .3s, border-color .3s; }
.recuerdos .tbtn:hover, .recuerdos .tbtn:focus-visible, .recuerdos .tbtn[aria-pressed="true"] { color: var(--moon); border-color: #4cc9f0; outline: none; }
.recuerdos .count { position: absolute; left: 50%; top: 24px; transform: translateX(-50%); z-index: 4; pointer-events: none; text-align: center;
  font-family: 'Cinzel', serif; text-shadow: 0 0 10px #04050c; }
.recuerdos .count .t { font-size: .6rem; letter-spacing: .26em; text-transform: uppercase; color: #8fd8f5; }
.recuerdos .count .n { font-size: 1.1rem; color: var(--moon); font-variant-numeric: tabular-nums; }

/* --- revelación de un recuerdo --- */
.recuerdos .reveal { position: absolute; inset: 0; z-index: 6; display: flex; align-items: center; justify-content: center; padding: 70px 20px 150px;
  background: rgba(4,5,12,.72); opacity: 0; pointer-events: none; transition: opacity .8s ease; }
.recuerdos .reveal.show { opacity: 1; pointer-events: auto; }
.recuerdos .reveal .card { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: min(560px, 100%); max-height: 100%;
  transform: translateY(14px) scale(.97); transition: transform .9s cubic-bezier(.2,.8,.2,1); }
.recuerdos .reveal.show .card { transform: none; }
.recuerdos .reveal .frame { background: #f4efe6; padding: 10px 10px 0; border-radius: 3px; box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 60px rgba(76,201,240,.3);
  min-height: 0; display: flex; flex-direction: column; }
.recuerdos .reveal img, .recuerdos .reveal video { display: block; max-width: 100%; max-height: 46vh; object-fit: contain; }
.recuerdos .reveal .alive { font-family: 'Cinzel', serif; font-size: .55rem; letter-spacing: .26em; text-transform: uppercase; color: #8fd8f5; }
.recuerdos .reveal .frame .cap { color: #2b2340; text-align: center; font-style: italic; font-size: 1.2rem; padding: 10px 4px 12px; }
.recuerdos .reveal .frame .date { display: block; font-style: normal; font-family: 'Cinzel', serif; font-size: .58rem; letter-spacing: .18em; color: #7a6f8f; }
.recuerdos .reveal .msg { margin: 0; text-align: center; font-style: italic; font-size: clamp(1.15rem, 3.8vw, 1.5rem); line-height: 1.35; color: var(--moon);
  text-shadow: 0 0 12px #04050c, 0 0 30px rgba(76,201,240,.4); white-space: pre-line; }
.recuerdos .reveal .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.recuerdos .reveal.letter .card { max-width: min(620px, 100%); overflow-y: auto; }
.recuerdos .reveal.letter .msg { font-size: clamp(1.1rem, 3.4vw, 1.35rem); text-align: left; padding: 24px 26px; border-radius: 4px;
  background: rgba(244,239,230,.06); border: 1px solid var(--hair); }

.recuerdos .toast { position: absolute; left: 50%; top: 30%; z-index: 7; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 48px));
  text-align: center; pointer-events: none; font-style: italic; font-size: clamp(1.2rem, 4vw, 1.7rem); color: var(--moon);
  text-shadow: 0 0 6px #04050c, 0 0 18px #04050c, 0 0 30px rgba(76,201,240,.5); opacity: 0; transition: opacity .6s ease; }
.recuerdos .toast.show { opacity: 1; }

@media (max-width: 560px) {
  .recuerdos .hud { top: 14px; left: 14px; }
  .recuerdos .bar-top { top: 62px; right: 12px; left: 12px; justify-content: center; }
  .recuerdos .count { top: auto; bottom: 0; }
  .recuerdos .grid { gap: 22px 14px; }
  .recuerdos .polaroid { width: 142px; }
}
`;

const LEVELS = [
  { pieces: 12, label: 'Suave' },
  { pieces: 24, label: 'Medio' },
  { pieces: 48, label: 'Reto' },
];

const LOCK_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <path d="M4 5h6v3a2 2 0 1 0 4 0V5h6v6h-3a2 2 0 1 0 0 4h3v6h-6v-3a2 2 0 1 0-4 0v3H4v-6h3a2 2 0 1 0 0-4H4z"/></svg>`;

// --- almacenamiento local (puede no existir: modo privado, etc.) ---
const KEY = 'galaxia:recuerdos';
function load(key, fallback) {
  try { const v = localStorage.getItem(`${KEY}:${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(`${KEY}:${key}`);
    else localStorage.setItem(`${KEY}:${key}`, JSON.stringify(value));
  } catch { /* sin almacenamiento: no pasa nada */ }
}

// RNG con semilla: la forma de las piezas debe ser la misma al retomar.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Recuerdos de muestra (mientras no haya fotos en data.js): un pequeño
// paisaje lunar pintado a mano para poder probar el rompecabezas.
function demoMemories() {
  const paint = (hueA, hueB, seed) => {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 900;
    const x = c.getContext('2d');
    const rnd = mulberry32(seed);
    const sky = x.createLinearGradient(0, 0, 0, 900);
    sky.addColorStop(0, `hsl(${hueA} 70% 12%)`);
    sky.addColorStop(0.6, `hsl(${hueB} 60% 30%)`);
    sky.addColorStop(1, `hsl(${hueB + 30} 70% 55%)`);
    x.fillStyle = sky; x.fillRect(0, 0, 1200, 900);
    for (let i = 0; i < 400; i++) {
      x.fillStyle = `rgba(255,255,255,${rnd() * 0.8})`;
      x.fillRect(rnd() * 1200, rnd() * 600, rnd() * 2.4, rnd() * 2.4);
    }
    const moon = x.createRadialGradient(840, 260, 10, 840, 260, 260);
    moon.addColorStop(0, 'rgba(255,250,235,1)'); moon.addColorStop(0.42, 'rgba(255,240,220,.95)');
    moon.addColorStop(0.46, 'rgba(255,220,200,.25)'); moon.addColorStop(1, 'rgba(255,200,200,0)');
    x.fillStyle = moon; x.beginPath(); x.arc(840, 260, 260, 0, Math.PI * 2); x.fill();
    for (let layer = 0; layer < 3; layer++) {
      x.fillStyle = `hsl(${hueA + layer * 10} 40% ${8 + layer * 6}%)`;
      x.beginPath(); x.moveTo(0, 900);
      for (let px = 0; px <= 1200; px += 40) x.lineTo(px, 560 + layer * 90 + Math.sin(px * 0.006 + layer * 2 + seed) * 60 + rnd() * 30);
      x.lineTo(1200, 900); x.fill();
    }
    x.font = '120px serif'; x.textAlign = 'center';
    x.fillText('💞', 600, 760);
    return c.toDataURL('image/jpeg', 0.9);
  };
  return [
    { id: 'demo-1', src: paint(250, 290, 3), title: 'Aquí irá una foto nuestra', date: 'muestra', note: 'Cuando lleguen nuestras fotos, este lugar se llenará de nosotros 💙' },
    { id: 'demo-2', src: paint(200, 330, 7), title: 'Y aquí otra', date: 'muestra', note: 'Cada pieza, un momento. Cada momento, contigo.' },
  ];
}

// --- forma de las piezas ---
// Borde de una pieza desde (ax,ay) hasta (bx,by). s = 1 pestaña hacia fuera,
// -1 hueco hacia dentro, 0 recto. La pestaña mide ~25% del lado más corto.
const KNOB = [
  [0.35, 0, 0.42, 0, 0.44, 0.06, 0.40, 0.11],
  [0.40, 0.11, 0.34, 0.20, 0.40, 0.26, 0.50, 0.26],
  [0.50, 0.26, 0.60, 0.26, 0.66, 0.20, 0.60, 0.11],
  [0.60, 0.11, 0.56, 0.06, 0.58, 0, 0.65, 0],
];
function edge(p, ax, ay, bx, by, s, k) {
  if (!s) { p.lineTo(bx, by); return; }
  const dx = bx - ax, dy = by - ay;
  const nx = dy / Math.hypot(dx, dy), ny = -dx / Math.hypot(dx, dy); // normal hacia fuera (sentido horario)
  const P = (u, v) => [ax + dx * u + nx * v * s * k, ay + dy * u + ny * v * s * k];
  p.lineTo(...P(0.35, 0));
  for (const c of KNOB) p.bezierCurveTo(...P(c[2], c[3]), ...P(c[4], c[5]), ...P(c[6], c[7]));
  p.lineTo(bx, by);
}
function piecePath(w, h, [top, right, bottom, left]) {
  const p = new Path2D();
  const k = Math.min(w, h);
  p.moveTo(0, 0);
  edge(p, 0, 0, w, 0, top, k);
  edge(p, w, 0, w, h, right, k);
  edge(p, w, h, 0, h, bottom, k);
  edge(p, 0, h, 0, 0, left, k);
  p.closePath();
  return p;
}

export function mount(stage, ctx) {
  const { exit, getConsoleTop, loveNotes = [], reward } = ctx;
  const list = memories.length ? memories : demoMemories();
  const isDemo = !memories.length;

  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'recuerdos';
  root.innerHTML = `
    <div class="hud">
      <button class="planet-exit exit" type="button" aria-label="Volver a la galaxia">
        <svg width="18" height="18" viewBox="0 0 40 40" aria-hidden="true">
          <defs><mask id="rec-exit-moon"><circle cx="20" cy="20" r="15" fill="#fff"/><circle cx="29" cy="20" r="13.5" fill="#000"/></mask></defs>
          <circle cx="20" cy="20" r="15" fill="currentColor" mask="url(#rec-exit-moon)"/>
        </svg>
        Volver a la galaxia
      </button>
    </div>
    <section class="album">
      <h1>Planeta Recuerdos</h1>
      <p class="lead">Cada pieza es un momento nuestro</p>
      <p class="progress-line"></p>
      <div class="levels" role="group" aria-label="Número de piezas"></div>
      <div class="grid" role="list"></div>
      <p class="note"></p>
    </section>
    <section class="table" hidden>
      <canvas></canvas>
      <div class="bar-top">
        <button class="tbtn back" type="button">← Álbum</button>
        <button class="tbtn ghost" type="button" aria-pressed="false">Ver la foto</button>
        <button class="tbtn tidy" type="button">Ordenar piezas</button>
      </div>
      <div class="count" aria-live="polite"><div class="t"></div><div class="n"></div></div>
    </section>
    <div class="reveal" role="dialog" aria-modal="true"><div class="card"></div></div>
    <div class="toast" role="status"></div>`;
  stage.append(style, root);

  const $ = (s) => root.querySelector(s);
  const album = $('.album'), grid = $('.grid'), levelsEl = $('.levels'), progressEl = $('.progress-line');
  const table = $('.table'), canvas = $('.table canvas'), g = canvas.getContext('2d');
  const countT = $('.count .t'), countN = $('.count .n');
  const ghostBtn = $('.ghost'), revealEl = $('.reveal'), revealCard = $('.reveal .card'), toastEl = $('.toast');
  $('.exit').onclick = () => exit();
  $('.note').textContent = isDemo
    ? 'Recuerdos de muestra: las fotos de verdad se agregan en data.js.'
    : 'Tu avance se guarda solito: puedes dejar un rompecabezas a medias y volver otro día.';

  let toastTimer = null;
  function toast(text, ms = 3000) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  // --- álbum ---
  let solved = new Set(load('solved', []));
  let level = load('level', 1);

  function renderLevels() {
    levelsEl.replaceChildren(...LEVELS.map((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${l.label} · ${l.pieces}`;
      b.setAttribute('aria-pressed', i === level);
      b.onclick = () => { level = i; save('level', i); renderLevels(); };
      return b;
    }));
  }

  function renderAlbum() {
    const done = list.filter((m) => solved.has(m.id)).length;
    progressEl.textContent = `${done} de ${list.length} recuerdos armados`;
    grid.replaceChildren(...list.map((m, i) => {
      const isSolved = solved.has(m.id);
      const progress = load(`save:${m.id}`, null);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'polaroid' + (isSolved ? '' : ' locked');
      b.setAttribute('role', 'listitem');
      b.style.setProperty('--tilt', `${((i * 37) % 9) - 4}deg`);
      const ph = document.createElement('span');
      ph.className = 'ph';
      const img = document.createElement('img');
      img.src = m.src;
      img.alt = isSolved ? m.title : '';
      img.loading = 'lazy';
      img.draggable = false;
      ph.append(img);
      if (!isSolved) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.innerHTML = `${LOCK_ICON}<span>${progress ? 'Continuar' : 'Armar'}</span>`;
        ph.append(badge);
      }
      const cap = document.createElement('span');
      cap.className = 'cap';
      cap.textContent = isSolved ? m.title : 'Un recuerdo dormido';
      if (isSolved && m.date) {
        const d = document.createElement('span');
        d.className = 'date';
        d.textContent = m.date;
        cap.append(d);
      }
      b.append(ph, cap);
      if (progress && !isSolved) {
        const bar = document.createElement('span');
        bar.className = 'bar';
        const placed = progress.pos.filter((p) => p[2]).length;
        bar.innerHTML = `<i style="width:${(placed / progress.pos.length) * 100}%"></i>`;
        b.append(bar);
      }
      b.setAttribute('aria-label', isSolved ? `Ver ${m.title}` : `Armar el recuerdo ${i + 1}`);
      b.onclick = () => (isSolved ? showMemory(m, true) : openPuzzle(m));
      return b;
    }));
    // la carta final, cuando todos los recuerdos están armados
    album.querySelector('.letter-btn')?.remove();
    if (!isDemo && done === list.length && memoriesFinale) {
      const lb = document.createElement('button');
      lb.type = 'button';
      lb.className = 'letter-btn';
      lb.textContent = '✉ Una carta para ti';
      lb.onclick = showLetter;
      grid.after(lb);
    }
  }

  // --- revelación ---
  function closeReveal() {
    revealCard.querySelector('video')?.pause();
    revealEl.classList.remove('show', 'letter');
  }
  function button(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tbtn';
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }
  function showMemory(m, fromAlbum) {
    const frame = document.createElement('div');
    frame.className = 'frame';
    // si el recuerdo tiene movimiento, al revelarse cobra vida
    let img;
    if (m.live) {
      img = document.createElement('video');
      Object.assign(img, { src: m.live, poster: m.src, muted: true, loop: true, autoplay: true, playsInline: true });
      img.setAttribute('aria-label', m.title);
      img.play?.().catch(() => {});
    } else {
      img = document.createElement('img');
      img.src = m.src;
      img.alt = m.title;
    }
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = m.title;
    if (m.date) {
      const d = document.createElement('span');
      d.className = 'date';
      d.textContent = m.date;
      cap.append(d);
    }
    frame.append(img, cap);
    const msg = document.createElement('p');
    msg.className = 'msg';
    msg.textContent = m.note || loveNotes[list.indexOf(m) % Math.max(1, loveNotes.length)] || '';
    let alive = null;
    if (m.live) {
      alive = document.createElement('div');
      alive.className = 'alive';
      alive.textContent = '✦ el recuerdo cobró vida ✦';
    }
    const row = document.createElement('div');
    row.className = 'row';
    row.append(button('Volver al álbum', () => { closeReveal(); showAlbum(); }));
    if (fromAlbum) row.append(button('Armarlo otra vez', () => { closeReveal(); openPuzzle(m, true); }));
    revealCard.replaceChildren(...[frame, alive, msg, row].filter(Boolean));
    revealEl.classList.remove('letter');
    revealEl.classList.add('show');
    row.firstChild.focus({ preventScroll: true });
  }
  function showLetter() {
    const msg = document.createElement('p');
    msg.className = 'msg';
    msg.textContent = memoriesFinale;
    const row = document.createElement('div');
    row.className = 'row';
    row.append(button('Guardarla en el corazón 💙', closeReveal));
    revealCard.replaceChildren(msg, row);
    revealEl.classList.add('show', 'letter');
  }

  // =====================================================================
  // Rompecabezas
  // =====================================================================
  let P = null; // partida actual
  let W = 0, H = 0, DPR = 1;
  let dirty = true;
  let ghost = false;
  const sparks = [];
  let glow = 0; // brillo al completar

  function showAlbum() {
    if (P) persist();
    P = null;
    table.hidden = true;
    album.hidden = false;
    renderAlbum();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function openPuzzle(m, fresh = false) {
    let img;
    try { img = await loadImage(m.src); } catch {
      toast('No pude abrir esta foto 😢');
      return;
    }
    const saved = fresh ? null : load(`save:${m.id}`, null);
    const seed = saved?.seed ?? Math.floor(Math.random() * 1e9);
    const rnd = mulberry32(seed);

    // proporción del tablero: la de la foto, sin extremos
    const aspect = Math.min(1.5, Math.max(0.75, img.naturalWidth / img.naturalHeight));
    let cols, rows;
    if (saved) ({ cols, rows } = saved);
    else {
      const n = LEVELS[level].pieces;
      cols = Math.max(2, Math.round(Math.sqrt(n * aspect)));
      rows = Math.max(2, Math.round(n / cols));
    }
    // recorte "cover" de la foto a esa proporción
    const ia = img.naturalWidth / img.naturalHeight;
    const crop = ia > aspect
      ? { sw: img.naturalHeight * aspect, sh: img.naturalHeight, sx: (img.naturalWidth - img.naturalHeight * aspect) / 2, sy: 0 }
      : { sw: img.naturalWidth, sh: img.naturalWidth / aspect, sx: 0, sy: (img.naturalHeight - img.naturalWidth / aspect) / 2 };

    // pestañas compartidas entre vecinos (h: entre filas, v: entre columnas)
    const hT = [], vT = [];
    for (let r = 0; r <= rows; r++) { hT[r] = []; for (let c = 0; c < cols; c++) hT[r][c] = r === 0 || r === rows ? 0 : (rnd() < 0.5 ? 1 : -1); }
    for (let r = 0; r < rows; r++) { vT[r] = []; for (let c = 0; c <= cols; c++) vT[r][c] = c === 0 || c === cols ? 0 : (rnd() < 0.5 ? 1 : -1); }

    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const sp = saved?.pos[i];
        pieces.push({
          i, r, c,
          edges: [-hT[r][c], vT[r][c + 1], hT[r + 1][c], -vT[r][c]],
          nx: sp ? sp[0] : 0, ny: sp ? sp[1] : 0, // esquina de la celda, en unidades del tablero (0..1)
          placed: sp ? Boolean(sp[2]) : false,
          sprite: null, path: null,
        });
      }
    }
    P = { m, img, crop, aspect, cols, rows, seed, pieces, order: [...pieces], drag: null, done: false };
    // las colocadas abajo, las sueltas encima
    P.order.sort((a, b) => b.placed - a.placed);

    album.hidden = true;
    table.hidden = false;
    closeReveal();
    ghost = false;
    ghostBtn.setAttribute('aria-pressed', 'false');
    glow = 0;
    sparks.length = 0;
    resize();
    if (!saved) scatter(pieces, rnd);
    paintCount();
    dirty = true;
    if (!saved) toast('Arrastra las piezas a su lugar ✨', 2600);
  }

  // --- geometría de la mesa ---
  const layout = { bx: 0, by: 0, bw: 0, bh: 0, top: 0, bottom: 0, cw: 0, ch: 0, pad: 0 };
  function computeLayout() {
    const narrow = W < 560;
    const top = narrow ? 112 : 76;
    const bottom = Math.max(top + 200, Math.min(H - 12, getConsoleTop() - 14));
    const aw = W - 24, ah = bottom - top;
    const portrait = aw / ah < 1.05;
    // espacio libre para las piezas: a los lados en horizontal, abajo en vertical
    const maxW = portrait ? aw * 0.94 : aw * 0.6;
    const maxH = portrait ? ah * 0.56 : ah * 0.86;
    let bw = maxW, bh = bw / P.aspect;
    if (bh > maxH) { bh = maxH; bw = bh * P.aspect; }
    Object.assign(layout, {
      bw, bh, top, bottom,
      bx: (W - bw) / 2,
      by: portrait ? top + 8 : top + (ah - bh) / 2,
      cw: bw / P.cols, ch: bh / P.rows,
    });
    layout.pad = Math.ceil(Math.min(layout.cw, layout.ch) * 0.3);
  }

  // reparte las piezas sueltas fuera del tablero (si caben)
  function scatter(pieces, rnd = Math.random) {
    const { bx, by, bw, bh, top, bottom, cw, ch } = layout;
    for (const p of pieces) {
      if (p.placed) continue;
      let x = 0, y = 0;
      for (let tries = 0; tries < 40; tries++) {
        x = 8 + rnd() * (W - cw - 16);
        y = top + rnd() * (bottom - top - ch);
        const overlaps = x + cw > bx - 6 && x < bx + bw + 6 && y + ch > by - 6 && y < by + bh + 6;
        if (!overlaps) break;
      }
      p.nx = (x - bx) / bw;
      p.ny = (y - by) / bh;
    }
    persist();
    dirty = true;
  }

  function renderSprites() {
    const { cw, ch, pad, bw, bh } = layout;
    const { img, crop } = P;
    for (const p of P.pieces) {
      p.path = piecePath(cw, ch, p.edges);
      const c = p.sprite ?? document.createElement('canvas');
      c.width = Math.ceil((cw + pad * 2) * DPR);
      c.height = Math.ceil((ch + pad * 2) * DPR);
      const x = c.getContext('2d');
      x.setTransform(DPR, 0, 0, DPR, pad * DPR, pad * DPR);
      x.save();
      x.clip(p.path);
      x.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, -p.c * cw, -p.r * ch, bw, bh);
      // relieve: luz arriba-izquierda, sombra abajo-derecha
      x.lineWidth = 3;
      x.strokeStyle = 'rgba(0,0,0,0.35)';
      x.translate(-1, -1);
      x.stroke(p.path);
      x.translate(2, 2);
      x.strokeStyle = 'rgba(255,255,255,0.32)';
      x.stroke(p.path);
      x.restore();
      x.lineWidth = 1;
      x.strokeStyle = 'rgba(234,246,255,0.35)';
      x.stroke(p.path);
      p.sprite = c;
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth;
    H = root.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    album.style.paddingBottom = `${Math.max(40, H - getConsoleTop() + 30)}px`; // que nada quede bajo la consola
    if (!P) return;
    computeLayout();
    renderSprites();
    // que nada quede fuera de la pantalla tras girar el celular
    const { bx, by, bw, bh, cw, ch, top, bottom } = layout;
    for (const p of P.pieces) {
      if (p.placed) continue;
      const x = Math.min(W - cw * 0.6, Math.max(-cw * 0.4, bx + p.nx * bw));
      const y = Math.min(bottom - ch * 0.6, Math.max(top - ch * 0.2, by + p.ny * bh));
      p.nx = (x - bx) / bw;
      p.ny = (y - by) / bh;
    }
    dirty = true;
  }

  function persist() {
    if (!P || P.done) return;
    save(`save:${P.m.id}`, {
      seed: P.seed, cols: P.cols, rows: P.rows,
      pos: P.pieces.map((p) => [+p.nx.toFixed(4), +p.ny.toFixed(4), p.placed ? 1 : 0]),
    });
  }

  function paintCount() {
    const placed = P.pieces.filter((p) => p.placed).length;
    countT.textContent = 'piezas';
    countN.textContent = `${placed} / ${P.pieces.length}`;
  }

  const screenX = (p) => layout.bx + p.nx * layout.bw;
  const screenY = (p) => layout.by + p.ny * layout.bh;
  const homeX = (p) => p.c / P.cols;
  const homeY = (p) => p.r / P.rows;

  function pieceAt(x, y) {
    for (let k = P.order.length - 1; k >= 0; k--) {
      const p = P.order[k];
      if (p.placed) continue;
      const lx = x - screenX(p), ly = y - screenY(p);
      const { cw, ch, pad } = layout;
      if (lx < -pad || ly < -pad || lx > cw + pad || ly > ch + pad) continue;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      const inside = g.isPointInPath(p.path, lx, ly);
      g.restore();
      if (inside) return p;
    }
    return null;
  }

  // --- arrastre ---
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function onDown(e) {
    if (!P || P.done || P.drag) return;
    const [x, y] = local(e);
    const p = pieceAt(x, y);
    if (!p) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    P.drag = { p, id: e.pointerId, ox: x - screenX(p), oy: y - screenY(p) };
    P.order.splice(P.order.indexOf(p), 1);
    P.order.push(p);
    dirty = true;
  }
  function onMove(e) {
    if (!P?.drag || e.pointerId !== P.drag.id) {
      if (P && !P.drag && e.pointerType === 'mouse') {
        const [x, y] = local(e);
        canvas.style.cursor = pieceAt(x, y) ? 'grab' : '';
      }
      return;
    }
    const [x, y] = local(e);
    const { p, ox, oy } = P.drag;
    p.nx = (x - ox - layout.bx) / layout.bw;
    p.ny = (y - oy - layout.by) / layout.bh;
    canvas.style.cursor = 'grabbing';
    dirty = true;
  }
  function onUp(e) {
    if (!P?.drag || e.pointerId !== P.drag.id) return;
    const { p } = P.drag;
    P.drag = null;
    canvas.style.cursor = '';
    // ¿cerca de su sitio? encaja
    const dx = (p.nx - homeX(p)) * layout.bw, dy = (p.ny - homeY(p)) * layout.bh;
    if (Math.hypot(dx, dy) < Math.min(layout.cw, layout.ch) * 0.32) {
      p.nx = homeX(p);
      p.ny = homeY(p);
      p.placed = true;
      P.order.splice(P.order.indexOf(p), 1);
      P.order.unshift(p);
      burst(screenX(p) + layout.cw / 2, screenY(p) + layout.ch / 2, 10);
      navigator.vibrate?.(12);
      paintCount();
      if (P.pieces.every((q) => q.placed)) complete();
    }
    persist();
    dirty = true;
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, hue: 180 + Math.random() * 90 });
    }
  }

  function complete() {
    P.done = true;
    save(`save:${P.m.id}`, null);
    // recompensa: más frases cuantas más piezas (y el doble la primera vez)
    const n = P.pieces.length;
    const prize = (n >= 40 ? 3 : n >= 20 ? 2 : 1) * (solved.has(P.m.id) ? 1 : 2);
    setTimeout(() => reward?.(prize, 'Recuerdo armado'), 600);
    solved.add(P.m.id);
    save('solved', [...solved]);
    glow = 0.001;
    const { bx, by, bw, bh } = layout;
    for (let i = 0; i < 6; i++) setTimeout(() => burst(bx + Math.random() * bw, by + Math.random() * bh, 18), i * 160);
    const m = P.m;
    setTimeout(() => { if (P?.m === m) showMemory(m, false); }, 2200);
  }

  $('.back').onclick = showAlbum;
  ghostBtn.onclick = () => {
    ghost = !ghost;
    ghostBtn.setAttribute('aria-pressed', ghost);
    dirty = true;
  };
  $('.tidy').onclick = () => { if (P && !P.done) scatter(P.pieces); };

  // --- dibujo ---
  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
  }
  function draw() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, H);
    const { bx, by, bw, bh, cw, ch, pad } = layout;

    // tablero: un marco de luz con la foto como sombra
    g.save();
    g.shadowColor = 'rgba(76,201,240,0.45)';
    g.shadowBlur = 24 + glow * 50;
    roundRect(bx - 6, by - 6, bw + 12, bh + 12, 6);
    g.fillStyle = 'rgba(8,14,30,0.85)';
    g.fill();
    g.restore();
    g.globalAlpha = ghost ? 0.38 : 0.08;
    g.drawImage(P.img, P.crop.sx, P.crop.sy, P.crop.sw, P.crop.sh, bx, by, bw, bh);
    g.globalAlpha = 1;
    // contorno de los huecos
    g.strokeStyle = 'rgba(143,216,245,0.12)';
    g.lineWidth = 1;
    for (const p of P.pieces) {
      if (p.placed) continue;
      g.save();
      g.translate(bx + homeX(p) * bw, by + homeY(p) * bh);
      g.stroke(p.path);
      g.restore();
    }

    // piezas
    for (const p of P.order) {
      const x = screenX(p) - pad, y = screenY(p) - pad;
      const w = cw + pad * 2, h = ch + pad * 2;
      if (P.drag?.p === p) {
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.6)';
        g.shadowBlur = 18;
        g.shadowOffsetY = 8;
        g.drawImage(p.sprite, x - w * 0.02, y - h * 0.02, w * 1.04, h * 1.04);
        g.restore();
      } else if (!p.placed) {
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.45)';
        g.shadowBlur = 6;
        g.shadowOffsetY = 2;
        g.drawImage(p.sprite, x, y, w, h);
        g.restore();
      } else {
        g.drawImage(p.sprite, x, y, w, h);
      }
    }

    // al completar: la foto entera aparece limpia, sin cortes
    if (glow > 0) {
      g.globalAlpha = Math.min(1, glow);
      g.drawImage(P.img, P.crop.sx, P.crop.sy, P.crop.sw, P.crop.sh, bx, by, bw, bh);
      g.globalAlpha = 1;
    }

    for (const s of sparks) {
      g.globalAlpha = s.life;
      g.fillStyle = `hsl(${s.hue} 90% 75%)`;
      g.beginPath();
      g.arc(s.x, s.y, 1 + 2.4 * s.life, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // --- bucle (lo llama main.js) ---
  function update(dt) {
    if (!P) return;
    if (glow > 0 && glow < 1) { glow = Math.min(1, glow + dt * 0.8); dirty = true; }
    if (sparks.length) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vx *= 0.96; s.vy *= 0.96;
        s.life -= dt * 1.3;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      dirty = true;
    }
    if (dirty) { draw(); dirty = false; }
  }

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (revealEl.classList.contains('show')) { closeReveal(); if (P?.done) showAlbum(); }
    else if (P) showAlbum();
    else exit();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', persist);

  renderLevels();
  renderAlbum();
  resize();

  function unmount() {
    persist();
    clearTimeout(toastTimer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', persist);
    root.remove();
    style.remove();
  }

  return { update, unmount };
}
