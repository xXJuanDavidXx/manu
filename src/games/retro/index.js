import { listCartridges, saveCartridge, deleteCartridge } from './romStore.js';

// Planeta Retro: un salón arcade cósmico. En la repisa brillan los cartuchos;
// al tocar uno se enciende una TV antigua con el juego (EmulatorJS). Las ROMs
// las carga ella desde su dispositivo y quedan guardadas solo en su navegador:
// nunca se suben al repositorio.
//
// El emulador corre dentro de un iframe propio: cerrarlo lo apaga del todo y
// permite cambiar de juego sin recargar la página.
//
// Interfaz de juego (la misma para todos los planetas):
//   mount(stage, ctx) -> { update(dt, time), unmount() }

const EJS_DATA = 'https://cdn.emulatorjs.org/stable/data/';

const SYSTEMS = {
  nes: { label: 'NES', ext: ['nes', 'fds'] },
  snes: { label: 'Super Nintendo', ext: ['sfc', 'smc'] },
  gb: { label: 'Game Boy', ext: ['gb', 'gbc'] },
  gba: { label: 'Game Boy Advance', ext: ['gba'] },
  n64: { label: 'Nintendo 64', ext: ['n64', 'z64', 'v64'] },
  nds: { label: 'Nintendo DS', ext: ['nds'] },
};
const ACCEPT = Object.values(SYSTEMS).flatMap((s) => s.ext.map((e) => `.${e}`)).concat('.zip').join(',');

// Espacios reservados en la repisa (se llenan cuando ella carga cada ROM).
const SLOTS = [
  { id: 'smb1', title: 'Super Mario Bros.', system: 'nes', color: '#e63946' },
  { id: 'smb2', title: 'Super Mario Bros. 2', system: 'nes', color: '#4cc9f0' },
  { id: 'smb3', title: 'Super Mario Bros. 3', system: 'nes', color: '#ffd166' },
];
const EXTRA_COLORS = ['#ff5d8f', '#38b000', '#c77dff', '#fb5607', '#00b4d8', '#ffafcc'];

const CSS = `
.retro { position: absolute; inset: 0; overflow: hidden; color: var(--moon);
  background: linear-gradient(180deg, #04050c 0%, #140a26 52%, #2a0c33 100%); }
.retro .sun { position: absolute; left: 50%; top: 64%; width: min(38vmin, 300px); aspect-ratio: 1; opacity: .9;
  transform: translate(-50%, -62%); border-radius: 50%; pointer-events: none;
  background: linear-gradient(180deg, #ffd166 0%, #f6a15a 45%, #c1121f 100%);
  filter: drop-shadow(0 0 40px rgba(246,161,90,.45));
  -webkit-mask-image: linear-gradient(180deg, #000 52%, transparent 52%), repeating-linear-gradient(180deg, transparent 0 9px, #000 9px 20px);
          mask-image: linear-gradient(180deg, #000 52%, transparent 52%), repeating-linear-gradient(180deg, transparent 0 9px, #000 9px 20px); }
.retro .floor { position: absolute; left: -60%; right: -60%; top: 64%; bottom: -60%; pointer-events: none;
  background-image: linear-gradient(rgba(255,93,143,.5) 2px, transparent 2px), linear-gradient(90deg, rgba(255,93,143,.5) 2px, transparent 2px);
  background-size: 64px 64px; transform: perspective(320px) rotateX(64deg); transform-origin: top center;
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 35%); mask-image: linear-gradient(180deg, transparent, #000 35%);
  animation: retro-floor 2.6s linear infinite; }
.retro .horizon { position: absolute; left: 0; right: 0; top: 64%; height: 2px; pointer-events: none;
  background: linear-gradient(90deg, transparent, #ff5d8f 20%, #ffd166 50%, #ff5d8f 80%, transparent);
  box-shadow: 0 0 18px #ff5d8f; }
@keyframes retro-floor { to { background-position: 0 64px; } }
@media (prefers-reduced-motion: reduce) { .retro .floor { animation: none; } }

.retro .hud { position: absolute; top: 20px; left: 20px; z-index: 3; }

.retro .hall { position: absolute; inset: 0; z-index: 2; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; align-items: center; padding: 84px 20px 160px; }
.retro h1 { margin: 0; font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: .3em; text-transform: uppercase;
  font-size: clamp(1.3rem, 5vw, 2.1rem); color: #fff4dc; text-align: center;
  text-shadow: 0 0 8px #ff5d8f, 0 0 24px rgba(255,93,143,.6), 0 2px 0 #5a189a; }
.retro .lead { margin: 6px 0 30px; font-style: italic; font-size: 1.15rem; color: rgba(236,232,245,.75); text-align: center; }
.retro .shelf { display: flex; flex-wrap: wrap; justify-content: center; gap: 26px 22px; max-width: 760px; }
.retro .note { margin-top: 34px; text-shadow: 0 0 6px #04050c, 0 0 14px #04050c; font-style: italic; font-size: .95rem; color: rgba(236,232,245,.5); text-align: center; max-width: 30rem; }

.retro .cart-wrap { position: relative; }
.retro .cart { --c: #c9b3ff; position: relative; display: flex; flex-direction: column; align-items: stretch;
  width: 128px; height: 150px; padding: 16px 10px 0; border: none; cursor: pointer; color: inherit;
  background: linear-gradient(180deg, #4b4a5e, #2b2a39); border-radius: 4px 4px 6px 6px;
  clip-path: polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
  transition: transform .3s ease, filter .3s ease; }
.retro .cart:hover, .retro .cart:focus-visible { transform: translateY(-6px); filter: drop-shadow(0 0 16px var(--c)); outline: none; }
.retro .cart .label { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 8px 7px;
  border-radius: 3px; text-align: left;
  background: linear-gradient(140deg, var(--c), color-mix(in srgb, var(--c) 35%, #10002b)); }
.retro .cart .title { font-family: 'Cinzel', serif; font-weight: 700; font-size: .78rem; line-height: 1.2; color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,.6); overflow-wrap: anywhere; }
.retro .cart .sys { font-family: 'Cinzel', serif; font-size: .55rem; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.85); }
.retro .cart .ridges { height: 26px; margin: 8px -10px 0;
  background: repeating-linear-gradient(180deg, rgba(255,255,255,.07) 0 2px, transparent 2px 5px); }
.retro .cart.empty { background: linear-gradient(180deg, #2e2c3c, #1d1b28); }
.retro .cart.empty .label { background: transparent; border: 1px dashed color-mix(in srgb, var(--c) 70%, transparent); }
.retro .cart.empty .title { color: color-mix(in srgb, var(--c) 80%, #fff); text-shadow: none; }
.retro .cart .hint { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: .85rem; color: rgba(236,232,245,.75); }
.retro .cart.add { background: transparent; border: 1px dashed var(--hair); clip-path: none; border-radius: 6px;
  align-items: center; justify-content: center; padding: 0; gap: 6px; }
.retro .cart.add .plus { font-size: 2.2rem; line-height: 1; color: var(--selene); }
.retro .cart.add .hint { text-align: center; padding: 0 8px; }
.retro .eject { position: absolute; top: -10px; right: -10px; width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid var(--hair); background: rgba(8,8,16,.9); color: rgba(236,232,245,.7); cursor: pointer;
  font-size: 1rem; line-height: 1; display: flex; align-items: center; justify-content: center; transition: color .2s, border-color .2s; }
.retro .eject:hover, .retro .eject:focus-visible { color: var(--ember); border-color: var(--ember); outline: none; }

.retro .tv { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; padding: 72px 16px 20px; }
.retro .tv[hidden], .retro .hall[hidden] { display: none; }
.retro .tv-bar { display: flex; align-items: center; gap: 12px; width: min(960px, 100%); }
.retro .tv-bar .now { flex: 1; min-width: 0; font-style: italic; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.retro .tv-btn { background: rgba(8,8,16,.7); border: 1px solid var(--hair); border-radius: 3px; cursor: pointer; color: var(--selene);
  padding: 7px 12px; font-family: 'Cinzel', serif; font-size: .6rem; font-weight: 600; letter-spacing: .18em; text-transform: uppercase;
  transition: color .3s, border-color .3s; }
.retro .tv-btn:hover, .retro .tv-btn:focus-visible { color: var(--moon); border-color: var(--selene); outline: none; }
.retro .bezel { width: min(960px, 100%, calc((100dvh - 130px) * 4 / 3)); aspect-ratio: 4 / 3; padding: 20px;
  background: linear-gradient(180deg, #2c2436, #15111c); border-radius: 28px;
  box-shadow: 0 0 0 2px #3a3046, 0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(201,179,255,.15); }
.retro .screen { position: relative; width: 100%; height: 100%; border-radius: 16px; overflow: hidden; background: #000; }
.retro .screen iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.retro .screen::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(180deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px),
              radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,.45) 100%); }
@media (max-width: 560px), (pointer: coarse) {
  .retro .tv { padding: 64px 8px 8px; }
  .retro .bezel { width: 100%; flex: 1; aspect-ratio: auto; padding: 8px; border-radius: 16px; }
  .retro .tv-bar .full { display: none; }
}
@media (max-width: 560px) { .retro .hud { top: 14px; left: 14px; } }

/* con un juego encendido, la consola de música se esconde (el juego trae la suya) */
body.retro-playing .console, body.retro-playing .track-info, body.retro-playing .grimoire { display: none; }

.retro .toast { position: absolute; left: 50%; bottom: 150px; z-index: 4; transform: translate(-50%, 8px);
  width: min(460px, calc(100vw - 40px)); text-align: center; pointer-events: none;
  padding: 10px 16px; background: rgba(8,8,16,.88); border: 1px solid var(--hair); border-radius: 3px;
  font-style: italic; font-size: 1.05rem; opacity: 0; transition: opacity .4s, transform .4s; }
.retro .toast.show { opacity: 1; transform: translate(-50%, 0); }
`;

const extOf = (name) => (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

function systemFromFile(name, fallback) {
  const ext = extOf(name);
  for (const [key, s] of Object.entries(SYSTEMS)) if (s.ext.includes(ext)) return key;
  return ext === 'zip' ? fallback : null; // un .zip solo sirve si el espacio ya dice qué consola es
}

// "Super Mario World (USA).sfc" -> "Super Mario World"
const cleanTitle = (name) => name.replace(/\.[^.]+$/, '').replace(/\s*[([].*?[)\]]/g, '').replace(/[_]+/g, ' ').trim() || name;

// JSON seguro para incrustar dentro de <script>
const J = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

function emulatorPage(cart, url) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#game{width:100%;height:100%}</style>
</head><body><div id="game"></div>
<script>
window.EJS_player = '#game';
window.EJS_core = ${J(cart.system)};
window.EJS_gameUrl = ${J(url)};
window.EJS_gameName = ${J(cart.title)};
window.EJS_pathtodata = ${J(EJS_DATA)};
window.EJS_language = 'es-ES';
window.EJS_color = '#c9b3ff';
window.EJS_backgroundColor = '#04050c';
</script>
<script src="${EJS_DATA}loader.js"></script>
</body></html>`;
}

export function mount(stage, ctx) {
  const { audio, exit } = ctx;

  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'retro';
  root.innerHTML = `
    <div class="sun"></div><div class="floor"></div><div class="horizon"></div>
    <div class="hud">
      <button class="planet-exit exit" type="button" aria-label="Volver a la galaxia">
        <svg width="18" height="18" viewBox="0 0 40 40" aria-hidden="true">
          <defs><mask id="retro-exit-moon"><circle cx="20" cy="20" r="15" fill="#fff"/><circle cx="29" cy="20" r="13.5" fill="#000"/></mask></defs>
          <circle cx="20" cy="20" r="15" fill="currentColor" mask="url(#retro-exit-moon)"/>
        </svg>
        Volver a la galaxia
      </button>
    </div>
    <section class="hall">
      <h1>Planeta Retro</h1>
      <p class="lead">Elige un cartucho</p>
      <div class="shelf" role="list"></div>
      <p class="note">Los cartuchos se guardan solo en este dispositivo. Se cargan una vez y quedan aquí.</p>
    </section>
    <section class="tv" hidden aria-label="Televisor">
      <div class="tv-bar">
        <button class="tv-btn back" type="button">← Repisa</button>
        <span class="now"></span>
        <button class="tv-btn full" type="button">Pantalla completa</button>
      </div>
      <div class="bezel"><div class="screen"></div></div>
    </section>
    <input type="file" hidden accept="${ACCEPT}">
    <div class="toast" role="status"></div>`;
  stage.append(style, root);

  const shelf = root.querySelector('.shelf');
  const hall = root.querySelector('.hall');
  const tv = root.querySelector('.tv');
  const screen = root.querySelector('.screen');
  const nowEl = root.querySelector('.now');
  const fileInput = root.querySelector('input[type=file]');
  const toastEl = root.querySelector('.toast');

  let carts = new Map();   // id -> cartucho guardado
  let pendingSlot = null;  // espacio que se está llenando
  let game = null;         // { iframe, url, wasPlaying }
  let toastTimer = null;

  function toast(text, ms = 3200) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function cartButton({ title, system, color, empty, hint }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cart' + (empty ? ' empty' : '');
    btn.style.setProperty('--c', color);
    const label = document.createElement('span');
    label.className = 'label';
    const t = document.createElement('span');
    t.className = 'title';
    t.textContent = title;
    const s = document.createElement('span');
    s.className = empty ? 'hint' : 'sys';
    s.textContent = empty ? hint : SYSTEMS[system]?.label ?? system;
    label.append(t, s);
    const ridges = document.createElement('span');
    ridges.className = 'ridges';
    btn.append(label, ridges);
    btn.setAttribute('aria-label', empty ? `${title}: ${hint}` : `Jugar ${title}`);
    return btn;
  }

  function render() {
    const items = [];
    const extras = [...carts.values()].filter((c) => !SLOTS.some((s) => s.id === c.id))
      .sort((a, b) => a.addedAt - b.addedAt);

    for (const slot of SLOTS) {
      const cart = carts.get(slot.id);
      items.push({ slot, cart, color: slot.color });
    }
    extras.forEach((cart, i) => items.push({ cart, color: EXTRA_COLORS[i % EXTRA_COLORS.length] }));

    shelf.replaceChildren(...items.map(({ slot, cart, color }) => {
      const wrap = document.createElement('div');
      wrap.className = 'cart-wrap';
      wrap.setAttribute('role', 'listitem');
      const title = cart?.title ?? slot.title;
      const btn = cartButton({
        title, system: cart?.system ?? slot.system, color,
        empty: !cart, hint: 'Toca para cargar la ROM',
      });
      btn.onclick = () => (cart ? play(cart) : pick(slot));
      wrap.append(btn);
      if (cart) {
        const eject = document.createElement('button');
        eject.type = 'button';
        eject.className = 'eject';
        eject.textContent = '×';
        eject.setAttribute('aria-label', `Quitar ${title} de este dispositivo`);
        eject.onclick = async () => {
          if (!confirm(`¿Quitar «${title}» de este dispositivo?`)) return;
          await deleteCartridge(cart.id);
          carts.delete(cart.id);
          render();
        };
        wrap.append(eject);
      }
      return wrap;
    }));

    // tarjeta para añadir cualquier otro juego
    const wrap = document.createElement('div');
    wrap.className = 'cart-wrap';
    wrap.setAttribute('role', 'listitem');
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'cart add';
    add.innerHTML = '<span class="plus" aria-hidden="true">+</span><span class="hint">Añadir otro cartucho</span>';
    add.setAttribute('aria-label', 'Añadir otro cartucho');
    add.onclick = () => pick(null);
    wrap.append(add);
    shelf.append(wrap);
  }

  function pick(slot) {
    pendingSlot = slot;
    fileInput.value = '';
    fileInput.click();
  }

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const slot = pendingSlot;
    const system = systemFromFile(file.name, slot?.system);
    if (!system) {
      toast(extOf(file.name) === 'zip'
        ? 'Para un .zip, cárgalo en uno de los espacios de Mario (o descomprímelo primero)'
        : 'No reconozco ese tipo de archivo 🙈 (sirven .nes, .sfc, .smc, .gb, .gbc, .gba, .n64, .z64, .nds)', 5000);
      return;
    }
    const cart = {
      id: slot?.id ?? `c-${Date.now()}`,
      title: slot?.title ?? cleanTitle(file.name),
      system,
      fileName: file.name,
      blob: file,
      addedAt: Date.now(),
    };
    try {
      await saveCartridge(cart);
    } catch (err) {
      console.error('No se pudo guardar el cartucho:', err);
      toast('No se pudo guardar el cartucho en este navegador 😕', 4000);
      return;
    }
    carts.set(cart.id, cart);
    render();
    toast(`«${cart.title}» está listo ✨ tócalo para jugar`);
  };

  function play(cart) {
    stopGame(false);
    const wasPlaying = !audio.paused;
    audio.pause(); // el juego trae su propia música
    const url = URL.createObjectURL(cart.blob);
    const iframe = document.createElement('iframe');
    iframe.title = cart.title;
    iframe.allow = 'fullscreen; gamepad; autoplay';
    iframe.allowFullscreen = true;
    iframe.srcdoc = emulatorPage(cart, url);
    screen.append(iframe);
    game = { iframe, url, wasPlaying };
    nowEl.textContent = cart.title;
    hall.hidden = true;
    tv.hidden = false;
    document.body.classList.add('retro-playing');
    iframe.focus();
  }

  // Apaga la TV. `resumeMusic`: si nuestra música sonaba antes, vuelve.
  function stopGame(resumeMusic = true) {
    if (!game) return;
    game.iframe.remove();
    URL.revokeObjectURL(game.url);
    if (resumeMusic && game.wasPlaying) audio.play().catch(() => {});
    game = null;
    document.body.classList.remove('retro-playing');
    tv.hidden = true;
    hall.hidden = false;
  }

  root.querySelector('.back').onclick = () => stopGame();
  root.querySelector('.full').onclick = () => game?.iframe.requestFullscreen?.().catch(() => {});
  root.querySelector('.exit').onclick = () => { stopGame(); exit(); };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (game) stopGame(); else exit();
  };
  window.addEventListener('keydown', onKey);

  render();
  listCartridges()
    .then((list) => { carts = new Map(list.map((c) => [c.id, c])); render(); })
    .catch((err) => {
      console.error('No se pudieron leer los cartuchos:', err);
      toast('Este navegador no deja guardar cartuchos (¿modo privado?)', 5000);
    });

  return {
    update() {},
    unmount() {
      stopGame();
      clearTimeout(toastTimer);
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('retro-playing');
      root.remove();
      style.remove();
    },
  };
}
