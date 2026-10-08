import { analyze, buildChart, DIFFICULTIES } from './analysis.js';

// Planeta Ritmo: un juego de ritmo de verdad. Se elige una de nuestras
// canciones, se "escucha" (analysis.js encuentra sus golpes reales) y por
// cuatro carriles bajan corazones que hay que tocar justo cuando llegan a la
// línea, al compás de la música. Precisión (Perfecto · Genial · Bien), combo,
// rango al final y frases de él como premio.
//
// Interfaz de juego (la misma para todos los planetas):
//   mount(stage, ctx) -> { update(dt, time), unmount() }

const LANE_COLORS = ['#ff5d8f', '#c77dff', '#4cc9f0', '#f6a15a'];
const KEYS = { d: 0, f: 1, j: 2, k: 3, arrowleft: 0, arrowdown: 1, arrowup: 2, arrowright: 3 };
const KEY_LABELS = ['D', 'F', 'J', 'K'];
const WINDOWS = { perfect: 0.045, great: 0.09, good: 0.14 }; // segundos, a cada lado
const POINTS = { perfect: 300, great: 200, good: 100, miss: 0 };
const JUDGE_TEXT = { perfect: '¡Perfecto!', great: 'Genial', good: 'Bien', miss: 'Fallo' };
const JUDGE_COLOR = { perfect: '#fff4dc', great: '#8fd8f5', good: '#c9b3ff', miss: '#7a6f8f' };
const COMBO_PRIZES = [50, 120, 250, 500]; // frase a mitad de canción
const RANKS = [['S', 0.95], ['A', 0.88], ['B', 0.75], ['C', 0.6], ['D', 0]];

const CSS = `
.ritmo { position: absolute; inset: 0; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; color: var(--moon); }
.ritmo canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.ritmo button { font: inherit; }
.ritmo .hud { position: absolute; top: 20px; left: 20px; z-index: 5; }
.ritmo .score { position: absolute; top: 18px; right: 20px; z-index: 4; text-align: right; font-family: 'Cinzel', serif; pointer-events: none;
  text-shadow: 0 0 12px rgba(4,5,12,.95); }
.ritmo .score .big { font-size: 1.9rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.05; }
.ritmo .score .acc { font-size: .66rem; letter-spacing: .2em; color: #8fd8f5; }
.ritmo .stop { position: absolute; top: 84px; right: 20px; z-index: 5; display: none; cursor: pointer; border-radius: 3px; padding: 6px 10px;
  background: rgba(8,8,16,.6); border: 1px solid var(--hair); color: rgba(236,232,245,.7);
  font-family: 'Cinzel', serif; font-size: .55rem; letter-spacing: .18em; text-transform: uppercase; }
.ritmo[data-mode="play"] .stop { display: block; }
.ritmo:not([data-mode="play"]) .score { display: none; }

.ritmo .panel { position: absolute; inset: 0; z-index: 6; display: none; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y;
  flex-direction: column; align-items: center; padding: 78px 20px 170px; background: rgba(4,5,12,.55); }
.ritmo[data-mode="menu"] .menu, .ritmo[data-mode="loading"] .loading, .ritmo[data-mode="results"] .results { display: flex; }
.ritmo h1 { margin: 0; font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; text-align: center;
  font-size: clamp(1.3rem, 5.4vw, 2.1rem); color: #fff; text-shadow: 0 0 10px #ff5d8f, 0 0 30px rgba(255,93,143,.5); }
.ritmo .lead { margin: 6px 0 14px; text-align: center; font-style: italic; font-size: 1.1rem; color: rgba(236,232,245,.8); max-width: 30rem; }
.ritmo .menu { overflow: hidden; }
.ritmo .songs { width: min(460px, 100%); flex: 1 1 auto; min-height: 96px; overflow-y: auto; overscroll-behavior: contain;
  border: 1px solid var(--hair); border-radius: 6px; background: rgba(8,8,16,.7); padding: 4px 0;
  scrollbar-width: thin; scrollbar-color: rgba(201,179,255,.3) transparent; }
.ritmo .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 18px; margin: 0 0 14px; }
.ritmo .controls .seg, .ritmo .controls .go { margin: 0; }
.ritmo .songs button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 14px; border: none; background: none; cursor: pointer;
  text-align: left; color: rgba(236,232,245,.82); font-family: 'Cormorant Garamond', serif; font-size: 1.05rem; }
.ritmo .songs button:hover, .ritmo .songs button:focus-visible { background: rgba(255,93,143,.08); outline: none; }
.ritmo .songs button[aria-selected="true"] { color: #fff; background: rgba(255,93,143,.16); box-shadow: inset 3px 0 0 #ff5d8f; }
.ritmo .songs .dot { flex: none; width: 9px; height: 9px; border-radius: 50%; }
.ritmo .songs .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ritmo .songs .rk { flex: none; font-family: 'Cinzel', serif; font-weight: 700; font-size: .8rem; color: var(--torch); }
.ritmo .seg { display: flex; gap: 4px; margin: 16px 0 10px; padding: 4px; border: 1px solid var(--hair); border-radius: 999px; background: rgba(8,8,16,.6); }
.ritmo .seg button { border: none; background: none; cursor: pointer; border-radius: 999px; padding: 7px 16px; color: rgba(236,232,245,.7);
  font-family: 'Cinzel', serif; font-size: .62rem; letter-spacing: .16em; text-transform: uppercase; }
.ritmo .seg button[aria-pressed="true"] { background: rgba(255,93,143,.2); color: #fff; box-shadow: inset 0 0 0 1px rgba(255,93,143,.6); }
.ritmo .sync { flex: none; margin-top: 8px; display: flex; align-items: center; gap: 8px; font-family: 'Cinzel', serif; font-size: .58rem; letter-spacing: .16em;
  text-transform: uppercase; color: rgba(236,232,245,.6); }
.ritmo .sync button { width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--hair); background: rgba(8,8,16,.6); color: var(--moon); cursor: pointer; }
.ritmo .sync output { min-width: 4.5em; text-align: center; color: var(--moon); font-variant-numeric: tabular-nums; }
.ritmo .go { margin-top: 18px; cursor: pointer; padding: 11px 28px; border-radius: 999px; color: #fff; background: rgba(8,8,16,.6);
  border: 1px solid #ff5d8f; box-shadow: 0 0 24px rgba(255,93,143,.45);
  font-family: 'Cinzel', serif; font-size: .74rem; font-weight: 600; letter-spacing: .24em; text-transform: uppercase; }
.ritmo .go.alt { border-color: var(--hair); box-shadow: none; color: rgba(236,232,245,.85); }
.ritmo .go:focus-visible { outline: 1px solid #fff; outline-offset: 3px; }
.ritmo .help { margin: 10px 0 0; flex: none; text-align: center; font-style: italic; font-size: .95rem; color: rgba(236,232,245,.55); max-width: 30rem; }

.ritmo .loading { justify-content: center; }
.ritmo .loading .bar { width: min(320px, 80%); height: 3px; margin-top: 16px; border-radius: 3px; background: rgba(255,255,255,.1); overflow: hidden; }
.ritmo .loading .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #ff5d8f, #c77dff, #4cc9f0); transition: width .2s; }

.ritmo .results .rank { font-family: 'Cinzel', serif; font-weight: 700; font-size: clamp(4rem, 18vw, 7rem); line-height: 1; margin: 8px 0 4px;
  color: #fff; text-shadow: 0 0 20px var(--rc, #ff5d8f), 0 0 60px var(--rc, #ff5d8f); }
.ritmo .results .song { font-style: italic; font-size: 1.15rem; color: rgba(236,232,245,.85); text-align: center; }
.ritmo .results dl { display: grid; grid-template-columns: auto auto; gap: 4px 18px; margin: 16px 0 6px; font-family: 'Cinzel', serif; font-size: .72rem; letter-spacing: .1em; }
.ritmo .results dt { color: rgba(236,232,245,.6); text-transform: uppercase; }
.ritmo .results dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.ritmo .results .best { font-style: italic; color: var(--torch); min-height: 1.3em; }
.ritmo .results .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.ritmo .toast { position: absolute; left: 50%; top: 40%; z-index: 7; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 48px));
  text-align: center; pointer-events: none; font-style: italic; font-size: clamp(1.2rem, 4.2vw, 1.7rem); line-height: 1.3; color: var(--moon);
  text-shadow: 0 0 6px #04050c, 0 0 18px #04050c, 0 0 30px rgba(255,93,143,.45); opacity: 0; transition: opacity .6s ease; }
.ritmo .toast.show { opacity: 1; }
@media (max-width: 560px) {
  .ritmo .hud { top: 14px; left: 14px; }
  .ritmo .score { top: 62px; right: 14px; }
  .ritmo .score .big { font-size: 1.5rem; }
  .ritmo .stop { top: 116px; right: 14px; }
}
`;

const loadJSON = (k, f) => { try { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch { return f; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const bestKey = (name, diff) => `galaxia:ritmo:mejor:${diff}:${name}`;

export function mount(stage, ctx) {
  const { audioProcessor: ap, audio, getConsoleTop, exit, playlist, playTrack, getTrackIndex, reward } = ctx;

  // --- DOM ---
  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'ritmo';
  root.innerHTML = `
    <canvas></canvas>
    <div class="hud">
      <button class="planet-exit exit" type="button" aria-label="Volver a la galaxia">
        <svg width="18" height="18" viewBox="0 0 40 40" aria-hidden="true">
          <defs><mask id="ritmo-exit-moon"><circle cx="20" cy="20" r="15" fill="#fff"/><circle cx="29" cy="20" r="13.5" fill="#000"/></mask></defs>
          <circle cx="20" cy="20" r="15" fill="currentColor" mask="url(#ritmo-exit-moon)"/>
        </svg>
        Volver a la galaxia
      </button>
    </div>
    <div class="score" aria-live="off"><div class="big">0</div><div class="acc"></div></div>
    <button class="stop" type="button">Terminar</button>
    <section class="panel menu">
      <h1>Planeta Ritmo</h1>
      <p class="lead">Toca los corazones justo cuando lleguen a la línea, al ritmo de nuestra música</p>
      <div class="controls">
        <div class="seg" role="group" aria-label="Dificultad"></div>
        <button class="go play" type="button">¡A jugar!</button>
      </div>
      <div class="songs" role="listbox" aria-label="Canción"></div>
      <p class="help"></p>
      <div class="sync" title="Si los corazones se sienten adelantados o atrasados respecto a la música, ajústalo aquí">
        Sincronía <button type="button" class="minus" aria-label="Antes">−</button><output></output><button type="button" class="plus" aria-label="Después">+</button>
      </div>
    </section>
    <section class="panel loading" aria-live="polite">
      <h1>Escuchando…</h1>
      <p class="lead">Buscando los latidos de la canción</p>
      <div class="bar"><i></i></div>
    </section>
    <section class="panel results">
      <p class="song"></p>
      <div class="rank"></div>
      <p class="best"></p>
      <dl></dl>
      <div class="row">
        <button class="go again" type="button">Otra vez</button>
        <button class="go alt pick" type="button">Elegir canción</button>
      </div>
    </section>
    <div class="toast" role="status"></div>`;
  stage.append(style, root);

  const $ = (s) => root.querySelector(s);
  const canvas = $('canvas');
  const g = canvas.getContext('2d');
  const songsEl = $('.songs'), segEl = $('.seg'), syncOut = $('.sync output');
  const elScore = $('.score .big'), elAcc = $('.score .acc'), elToast = $('.toast'), loadBar = $('.loading .bar i');
  $('.exit').onclick = () => exit();
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  $('.help').textContent = coarse
    ? 'Toca cada carril cuando su corazón cruce la línea. Puedes usar varios dedos.'
    : 'Teclas D · F · J · K (o las flechas), una por carril. También puedes hacer clic en los carriles.';

  let toastTimer = null;
  function toast(text, ms = 3200) {
    elToast.textContent = text;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elToast.classList.remove('show'), ms);
  }

  // --- menú ---
  let mode = 'menu';
  let selected = Math.max(0, getTrackIndex?.() ?? 0);
  let diff = loadJSON('galaxia:ritmo:dificultad', 'normal');
  if (!DIFFICULTIES[diff]) diff = 'normal';
  let offsetMs = loadJSON('galaxia:ritmo:sincronia', 0);
  function setMode(m) { mode = m; root.dataset.mode = m; }

  function renderMenu() {
    songsEl.replaceChildren(...playlist.map((tr, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === selected);
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = tr.colors?.in || '#c9b3ff';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = tr.name;
      const rk = document.createElement('span');
      rk.className = 'rk';
      rk.textContent = loadJSON(bestKey(tr.name, diff), null)?.rank ?? '';
      b.append(dot, nm, rk);
      b.onclick = () => { selected = i; renderMenu(); };
      b.ondblclick = () => start();
      return b;
    }));
    segEl.replaceChildren(...Object.entries(DIFFICULTIES).map(([k, d]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = d.label;
      b.setAttribute('aria-pressed', k === diff);
      b.onclick = () => { diff = k; saveJSON('galaxia:ritmo:dificultad', k); renderMenu(); };
      return b;
    }));
    syncOut.textContent = `${offsetMs > 0 ? '+' : ''}${offsetMs} ms`;
    songsEl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  const nudgeSync = (d) => { offsetMs = Math.max(-300, Math.min(300, offsetMs + d)); saveJSON('galaxia:ritmo:sincronia', offsetMs); renderMenu(); };
  $('.minus').onclick = () => nudgeSync(-10);
  $('.plus').onclick = () => nudgeSync(10);
  $('.play').onclick = () => start();
  $('.again').onclick = () => start();
  $('.pick').onclick = () => { setMode('menu'); renderMenu(); };
  $('.stop').onclick = () => finish(true);

  // --- tamaño y geometría de la pista ---
  let W = 0, H = 0, DPR = 1;
  const L = { hitY: 0, horizonY: 0, hw: 0, top: 0, note: 0 };
  let sky = [];
  const sprites = [];
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth;
    H = root.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    L.hitY = Math.min(H * 0.86, getConsoleTop() - 64);
    L.horizonY = Math.max(W < 560 ? 150 : 96, H * 0.14);
    L.hw = Math.min(W * 0.96, 540);
    L.top = L.hw * 0.26;
    L.note = (L.hw / 4) * 0.62;
    // los menús terminan justo encima de la consola de música
    root.querySelectorAll('.panel').forEach((el) => { el.style.paddingBottom = `${Math.max(24, H - getConsoleTop() + 16)}px`; });
    sky = Array.from({ length: Math.round((W * H) / 8000) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28 }));
    buildSprites();
  }
  // pista en perspectiva: f = 0 en el horizonte, 1 en la línea
  const widthAt = (f) => L.top + (L.hw - L.top) * f;
  const yAt = (f) => L.horizonY + (L.hitY - L.horizonY) * f;
  const laneX = (lane, f) => W / 2 + (lane - 1.5) * (widthAt(f) / 4);
  const persp = (p) => (p <= 0 ? 0 : Math.pow(p, 1.9));

  function heartPath(x, s) {
    const k = s / 2;
    x.beginPath();
    x.moveTo(0, k * 0.75);
    x.bezierCurveTo(-k * 1.25, -k * 0.05, -k * 0.75, -k * 1.05, 0, -k * 0.45);
    x.bezierCurveTo(k * 0.75, -k * 1.05, k * 1.25, -k * 0.05, 0, k * 0.75);
    x.closePath();
  }
  function buildSprites() {
    const s = L.note, pad = s * 0.5;
    LANE_COLORS.forEach((c, i) => {
      const cv = sprites[i] ?? document.createElement('canvas');
      cv.width = cv.height = Math.ceil((s + pad * 2) * DPR);
      const x = cv.getContext('2d');
      x.setTransform(DPR, 0, 0, DPR, 0, 0);
      x.translate(pad + s / 2, pad + s / 2);
      const gr = x.createLinearGradient(0, -s / 2, 0, s / 2);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, c);
      gr.addColorStop(1, c);
      x.shadowColor = c;
      x.shadowBlur = s * 0.4;
      heartPath(x, s);
      x.fillStyle = gr;
      x.fill();
      x.shadowBlur = 0;
      x.lineWidth = Math.max(1, s * 0.05);
      x.strokeStyle = 'rgba(255,255,255,0.8)';
      x.stroke();
      sprites[i] = cv;
    });
    sprites.size = s + pad * 2;
  }

  // --- reloj de la canción (suave y compensando la latencia de salida) ---
  const clock = { media: -1, at: 0, est: 0, last: 0 };
  function songTime() {
    const ct = audio.currentTime;
    const now = performance.now() / 1000;
    if (ct !== clock.media) { clock.media = ct; clock.at = now; }
    const running = !audio.paused && !audio.seeking && audio.readyState >= 3;
    const target = running ? clock.media + Math.min(0.25, now - clock.at) : ct;
    if (!running || Math.abs(target - clock.est) > 0.08) clock.est = target;
    else clock.est += (target - clock.est) * 0.2;
    const latency = ap.audioCtx?.outputLatency || ap.audioCtx?.baseLatency || 0;
    return clock.est - latency + offsetMs / 1000;
  }

  // --- partida ---
  let run = null;
  const pressed = [0, 0, 0, 0];   // brillo de cada receptor
  const held = new Map();         // pointerId -> carril
  const fx = [];                  // anillos de impacto
  const sparks = [];
  let judge = null;               // { kind, life }
  let loadingToken = 0;

  async function start() {
    const track = playlist[selected];
    if (!track) return;
    const token = ++loadingToken;
    setMode('loading');
    loadBar.style.width = '0%';
    let analysis;
    try {
      analysis = await analyze(track.src, (p) => { loadBar.style.width = `${Math.round(p * 100)}%`; });
    } catch (err) {
      console.error('No se pudo analizar la canción:', err);
      if (token !== loadingToken) return;
      setMode('menu');
      toast('No pude escuchar esa canción 😢 prueba con otra');
      return;
    }
    if (token !== loadingToken || mode !== 'loading') return;
    const chart = buildChart(analysis, diff);
    if (chart.notes.length < 8) { setMode('menu'); toast('Esa canción es demasiado suave para jugar 🌙'); return; }
    playTrack(selected); // la canción desde el principio
    clock.media = -1;
    clock.est = 0;
    run = {
      track, diff, chart,
      notes: chart.notes.map((n) => ({ ...n, done: false })),
      head: 0, score: 0, combo: 0, maxCombo: 0,
      stats: { perfect: 0, great: 0, good: 0, miss: 0 },
      prizes: 0, trackIdx: selected, lastT: 0,
      win: diff === 'facil' ? 1.25 : 1,
    };
    fx.length = sparks.length = 0;
    judge = null;
    paintScore();
    setMode('play');
  }

  function accuracy() {
    const s = run.stats;
    const n = s.perfect + s.great + s.good + s.miss;
    return n ? (s.perfect + s.great * 0.7 + s.good * 0.4) / n : 1;
  }
  function paintScore() {
    elScore.textContent = run.score.toLocaleString('es');
    elAcc.textContent = `${(accuracy() * 100).toFixed(1)}%`;
  }

  function hit(lane, t) {
    if (mode !== 'play' || !run) return;
    pressed[lane] = 1;
    const win = WINDOWS.good * run.win;
    let best = null;
    for (let i = run.head; i < run.notes.length; i++) {
      const n = run.notes[i];
      if (n.t > t + win) break;
      if (n.done || n.lane !== lane) continue;
      const err = Math.abs(n.t - t);
      if (err <= win && (!best || err < Math.abs(best.t - t))) best = n;
    }
    if (!best) return; // tocar de más no castiga
    const err = Math.abs(best.t - t);
    const kind = err <= WINDOWS.perfect * run.win ? 'perfect' : err <= WINDOWS.great * run.win ? 'great' : 'good';
    best.done = true;
    score(kind, lane);
  }

  function score(kind, lane) {
    run.stats[kind]++;
    judge = { kind, life: 1 };
    if (kind === 'miss') {
      run.combo = 0;
    } else {
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.score += POINTS[kind] * Math.min(4, 1 + Math.floor(run.combo / 10));
      fx.push({ lane, life: 1, kind });
      const x = laneX(lane, 1), y = L.hitY;
      const n = kind === 'perfect' ? 16 : 9;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 200;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 1, c: LANE_COLORS[lane] });
      }
      if (run.prizes < COMBO_PRIZES.length && run.combo === COMBO_PRIZES[run.prizes]) {
        run.prizes++;
        reward?.(1, `Combo de ${run.combo}`);
      }
    }
    paintScore();
  }

  function finish(early = false) {
    if (!run) return;
    const r = run;
    run = null;
    const acc = (() => { const s = r.stats; const n = s.perfect + s.great + s.good + s.miss; return n ? (s.perfect + s.great * 0.7 + s.good * 0.4) / n : 0; })();
    const played = r.stats.perfect + r.stats.great + r.stats.good + r.stats.miss;
    const rank = RANKS.find(([, min]) => acc >= min)[0];
    const fullCombo = !early && r.stats.miss === 0 && played > 0;
    const prev = loadJSON(bestKey(r.track.name, r.diff), null);
    const isBest = !early && (!prev || r.score > prev.score);
    if (isBest) saveJSON(bestKey(r.track.name, r.diff), { score: r.score, rank, acc: +acc.toFixed(4) });

    $('.results .song').textContent = `${r.track.name} · ${DIFFICULTIES[r.diff].label}`;
    const rankEl = $('.results .rank');
    rankEl.textContent = early ? '—' : rank;
    rankEl.style.setProperty('--rc', { S: '#ffd166', A: '#ff5d8f', B: '#c77dff', C: '#4cc9f0', D: '#7a6f8f' }[rank]);
    $('.results .best').textContent = early ? 'Partida sin terminar' : fullCombo ? '¡Combo perfecto! Ningún corazón se escapó 💖' : isBest ? '¡Nuevo récord!' : prev ? `Récord: ${prev.score.toLocaleString('es')} (${prev.rank})` : '';
    const dl = $('.results dl');
    dl.replaceChildren();
    const row = (k, v) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); };
    row('Puntos', r.score.toLocaleString('es'));
    row('Precisión', `${(acc * 100).toFixed(1)}%`);
    row('Combo máximo', r.maxCombo);
    row('Perfecto', r.stats.perfect);
    row('Genial', r.stats.great);
    row('Bien', r.stats.good);
    row('Fallo', r.stats.miss);
    setMode('results');
    $('.again').focus({ preventScroll: true });

    if (!early) {
      const prize = ({ S: 3, A: 2, B: 1 }[rank] ?? 0) + (fullCombo ? 1 : 0);
      if (prize) setTimeout(() => reward?.(prize, `Rango ${rank}`), 900);
      else toast('Sigue intentando: las frases esperan en el rango B o mejor 💫', 3600);
    }
  }

  // --- entrada ---
  const laneAtX = (x) => Math.max(0, Math.min(3, Math.floor((x - (W / 2 - L.hw / 2)) / (L.hw / 4))));
  const onPointerDown = (e) => {
    if (mode !== 'play' || e.target.closest('button')) return;
    const r = root.getBoundingClientRect();
    const lane = laneAtX(e.clientX - r.left);
    held.set(e.pointerId, lane);
    hit(lane, songTime());
  };
  const onPointerUp = (e) => held.delete(e.pointerId);
  root.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  const keysDown = new Set();
  const onKey = (e) => {
    if (e.type === 'keydown' && e.key === 'Escape') {
      if (mode === 'play') finish(true);
      else if (mode === 'menu') exit();
      else setMode('menu');
      return;
    }
    if (mode !== 'play') return;
    const lane = KEYS[e.key.toLowerCase()];
    if (lane === undefined) return;
    e.preventDefault();
    if (e.type === 'keydown') {
      if (e.repeat) return;
      keysDown.add(lane);
      hit(lane, songTime());
    } else keysDown.delete(lane);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('resize', resize);

  // --- dibujo ---
  function draw(time, now) {
    const tr = run?.track ?? playlist[selected];
    const cin = tr?.colors?.in || '#ff5d8f', cout = tr?.colors?.out || '#5a189a';
    const beat = ap.beatHold || 0;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);

    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04050c');
    bg.addColorStop(0.65, '#0a0718');
    bg.addColorStop(1, cout);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (beat > 0.02) {
      const pg = g.createRadialGradient(W / 2, L.horizonY, 0, W / 2, L.horizonY, Math.max(W, H) * 0.8);
      pg.addColorStop(0, cin);
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = beat * 0.16;
      g.fillStyle = pg;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    g.fillStyle = '#ece8f5';
    for (const s of sky) {
      g.globalAlpha = 0.2 + 0.45 * (0.5 + 0.5 * Math.sin(time * 1.5 + s.p)) * (0.7 + (ap.treble || 0));
      g.fillRect(s.x, s.y, s.r, s.r);
    }
    g.globalAlpha = 1;

    // la luna en el horizonte, de donde nacen los corazones
    const mr = L.top * 0.55 * (1 + beat * 0.08);
    const moon = g.createRadialGradient(W / 2, L.horizonY, 0, W / 2, L.horizonY, mr * 2.4);
    moon.addColorStop(0, 'rgba(255,244,220,0.95)');
    moon.addColorStop(0.4, 'rgba(255,244,220,0.5)');
    moon.addColorStop(0.42, `${cin}55`);
    moon.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = moon;
    g.beginPath();
    g.arc(W / 2, L.horizonY, mr * 2.4, 0, Math.PI * 2);
    g.fill();

    // pista
    const x0t = W / 2 - L.top / 2, x1t = W / 2 + L.top / 2, x0b = W / 2 - L.hw / 2, x1b = W / 2 + L.hw / 2;
    const road = g.createLinearGradient(0, L.horizonY, 0, L.hitY);
    road.addColorStop(0, 'rgba(10,7,24,0.2)');
    road.addColorStop(1, 'rgba(10,7,24,0.75)');
    g.fillStyle = road;
    g.beginPath();
    g.moveTo(x0t, L.horizonY); g.lineTo(x1t, L.horizonY); g.lineTo(x1b + 20, H); g.lineTo(x0b - 20, H);
    g.closePath();
    g.fill();
    // carriles iluminados al tocar
    for (let lane = 0; lane < 4; lane++) {
      const on = Math.max(pressed[lane], [...held.values()].includes(lane) || keysDown.has(lane) ? 0.6 : 0);
      if (on <= 0.01) continue;
      const a = (k) => W / 2 + (k - 2) * (widthAt(0) / 4), b = (k) => W / 2 + (k - 2) * (widthAt(1) / 4);
      const lg = g.createLinearGradient(0, L.horizonY, 0, L.hitY);
      lg.addColorStop(0, 'rgba(0,0,0,0)');
      lg.addColorStop(1, LANE_COLORS[lane]);
      g.globalAlpha = on * 0.28;
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(a(lane), L.horizonY); g.lineTo(a(lane + 1), L.horizonY); g.lineTo(b(lane + 1), L.hitY); g.lineTo(b(lane), L.hitY);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }
    // líneas de los carriles
    g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      g.strokeStyle = k === 0 || k === 4 ? `${cin}aa` : 'rgba(201,179,255,0.16)';
      g.beginPath();
      g.moveTo(W / 2 + (k - 2) * (widthAt(0) / 4), L.horizonY);
      g.lineTo(W / 2 + (k - 2) * (widthAt(1) / 4), L.hitY);
      g.stroke();
    }
    // marcas de compás que corren hacia nosotros con la música
    const appr = run?.chart.approach ?? 1.4;
    if (run) {
      for (let k = 0; k < 6; k++) {
        const p = ((now / 0.5 + k / 6) % 1);
        const f = persp(p);
        g.strokeStyle = `rgba(201,179,255,${0.06 * f})`;
        g.beginPath();
        g.moveTo(laneX(-0.5, f), yAt(f));
        g.lineTo(laneX(3.5, f), yAt(f));
        g.stroke();
      }
    }

    // línea de golpe y receptores
    g.strokeStyle = 'rgba(255,244,220,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0b, L.hitY);
    g.lineTo(x1b, L.hitY);
    g.stroke();
    for (let lane = 0; lane < 4; lane++) {
      const x = laneX(lane, 1);
      g.save();
      g.translate(x, L.hitY);
      g.lineWidth = 2;
      g.strokeStyle = LANE_COLORS[lane];
      g.globalAlpha = 0.55 + pressed[lane] * 0.45;
      g.shadowColor = LANE_COLORS[lane];
      g.shadowBlur = 8 + pressed[lane] * 18;
      heartPath(g, L.note * (1 + pressed[lane] * 0.12));
      g.stroke();
      if (pressed[lane] > 0.05) { g.globalAlpha = pressed[lane] * 0.35; g.fillStyle = LANE_COLORS[lane]; g.fill(); }
      g.restore();
      if (!coarse) {
        g.globalAlpha = 0.45;
        g.fillStyle = '#ece8f5';
        g.font = "600 11px 'Cinzel', serif";
        g.textAlign = 'center';
        g.fillText(KEY_LABELS[lane], x, L.hitY + L.note * 0.75 + 12);
        g.globalAlpha = 1;
      }
    }

    // notas
    if (run) {
      const ss = sprites.size;
      for (let i = run.head; i < run.notes.length; i++) {
        const n = run.notes[i];
        const ahead = n.t - now;
        if (ahead > appr) break;
        if (n.done) continue;
        const p = 1 - ahead / appr;
        const f = persp(Math.min(p, 1.15));
        const sc = (widthAt(f) / L.hw) * (0.95 + beat * 0.08);
        const s = ss * sc;
        const x = laneX(n.lane, f), y = yAt(f);
        g.globalAlpha = Math.min(1, p * 4) * (p > 1 ? Math.max(0, 1 - (p - 1) * 6) : 1);
        g.drawImage(sprites[n.lane], x - s / 2, y - s / 2, s, s);
      }
      g.globalAlpha = 1;
    }

    // anillos de impacto y chispas
    for (const e of fx) {
      const x = laneX(e.lane, 1);
      g.globalAlpha = e.life;
      g.strokeStyle = LANE_COLORS[e.lane];
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, L.hitY, L.note * (0.6 + (1 - e.life) * (e.kind === 'perfect' ? 1.4 : 0.9)), 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of sparks) {
      g.globalAlpha = p.life;
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, 1 + 2.2 * p.life, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // juicio y combo
    if (run || judge) {
      const cy = L.horizonY + (L.hitY - L.horizonY) * 0.42;
      g.textAlign = 'center';
      if (run && run.combo >= 5) {
        g.globalAlpha = 0.85;
        g.fillStyle = '#fff';
        g.font = `700 ${Math.round(Math.min(56, W * 0.11))}px 'Cinzel', serif`;
        g.fillText(run.combo, W / 2, cy);
        g.font = "600 11px 'Cinzel', serif";
        g.fillStyle = '#f6a15a';
        g.fillText(`COMBO${run.combo >= 10 ? ` · x${Math.min(4, 1 + Math.floor(run.combo / 10))}` : ''}`, W / 2, cy + 18);
      }
      if (judge && judge.life > 0) {
        g.globalAlpha = Math.min(1, judge.life * 1.6);
        g.fillStyle = JUDGE_COLOR[judge.kind];
        g.shadowColor = judge.kind === 'perfect' ? '#ffd166' : 'rgba(0,0,0,0.8)';
        g.shadowBlur = 14;
        g.font = `italic 600 ${Math.round(Math.min(34, W * 0.075) * (1 + (1 - judge.life) * 0.15))}px 'Cormorant Garamond', serif`;
        g.fillText(JUDGE_TEXT[judge.kind], W / 2, cy + 52);
        g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
    }

    // progreso de la canción
    if (run) {
      const dur = audio.duration || run.chart.duration;
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, 0, W, 3);
      g.fillStyle = cin;
      g.fillRect(0, 0, W * Math.min(1, Math.max(0, now / dur)), 3);
      if (audio.paused) {
        g.fillStyle = 'rgba(4,5,12,0.55)';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.font = "italic 500 24px 'Cormorant Garamond', serif";
        g.fillText('En pausa · toca la luna llena para seguir 🌕', W / 2, H * 0.45);
      }
    }
  }

  // --- bucle (lo llama main.js) ---
  function update(dt, time) {
    let now = 0;
    if (mode === 'play' && run) {
      now = songTime();
      // ¿cambió la canción o se saltó dentro de ella?
      if (getTrackIndex() !== run.trackIdx) {
        const left = run.notes.some((n) => !n.done && n.t > now);
        if (left && run.notes.length - run.head > 3) { run = null; setMode('menu'); renderMenu(); toast('La canción cambió: elige de nuevo 🎶'); }
        else finish();
      } else if (!audio.paused && Math.abs(now - run.lastT) > 1.5 && run.lastT > 0) {
        run = null;
        setMode('menu');
        renderMenu();
        toast('Saltaste dentro de la canción: empecemos otra vez 🎶');
      }
    }
    if (mode === 'play' && run) {
      run.lastT = now;
      // fallos: corazones que pasaron de largo
      const win = WINDOWS.good * run.win;
      while (run.head < run.notes.length) {
        const n = run.notes[run.head];
        if (n.done) { run.head++; continue; }
        if (now - n.t > win) { n.done = true; score('miss', n.lane); run.head++; continue; }
        break;
      }
      if (run.head >= run.notes.length && now > run.notes[run.notes.length - 1].t + 1.2) finish();
    }

    for (let i = 0; i < 4; i++) pressed[i] = Math.max(0, pressed[i] - dt * 5);
    for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt * 3; if (fx[i].life <= 0) fx.splice(i, 1); }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.life -= dt * 1.8;
      if (p.life <= 0) sparks.splice(i, 1);
    }
    if (judge) { judge.life -= dt * 1.4; if (judge.life <= 0) judge = null; }
    draw(time, now);
  }

  resize();
  setMode('menu');
  renderMenu();

  function unmount() {
    loadingToken++;
    clearTimeout(toastTimer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    root.remove();
    style.remove();
  }

  return { update, unmount };
}
