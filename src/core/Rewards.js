import { phrases, centerPhrases } from '../data.js';

// Recompensas: las frases de él para ella se ganan jugando en los planetas.
// Cada frase nueva aparece en una tarjeta, se guarda en el frasco (visible
// desde la galaxia) y vuelve a orbitar la galaxia. Se recuerdan por su texto,
// así que reordenar o agregar frases en data.js no rompe lo ya ganado.

const POOL = [...new Set([...phrases, ...centerPhrases])];
const STORE = 'galaxia:frases';

const CSS = `
.reward { position: fixed; left: 50%; top: 18px; z-index: 130; width: min(440px, calc(100vw - 32px));
  transform: translate(-50%, -140%); opacity: 0; pointer-events: none; text-align: center;
  padding: 12px 18px 14px; border-radius: 6px; background: rgba(10,8,22,.9); border: 1px solid rgba(246,161,90,.6);
  box-shadow: 0 0 30px rgba(246,161,90,.35), 0 12px 40px rgba(0,0,0,.5);
  transition: transform .7s cubic-bezier(.2,.9,.25,1.2), opacity .5s ease; }
.reward.show { transform: translate(-50%, 0); opacity: 1; }
.reward .k { font-family: 'Cinzel', serif; font-size: .56rem; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: var(--torch); }
.reward .t { margin-top: 4px; font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: clamp(1.2rem, 4.4vw, 1.5rem);
  line-height: 1.25; color: #fff; }

.jar-btn { position: fixed; left: 62px; bottom: 30px; z-index: 100; display: none; width: 34px; height: 34px; padding: 5px;
  border: none; border-radius: 50%; background: none; color: var(--selene); cursor: pointer; opacity: .45; line-height: 0;
  transition: opacity .3s, color .3s, filter .3s; }
body[data-state="galaxy"] .jar-btn { display: block; }
.jar-btn:hover, .jar-btn:focus-visible { opacity: .95; outline: none; }
.jar-btn.new { opacity: .95; color: var(--torch); filter: drop-shadow(0 0 7px rgba(246,161,90,.7)); }
.jar-btn .dot { position: absolute; right: 2px; top: 2px; width: 8px; height: 8px; border-radius: 50%; background: var(--ember);
  box-shadow: 0 0 8px var(--ember); display: none; }
.jar-btn.new .dot { display: block; }

.jar { position: fixed; inset: 0; z-index: 125; display: flex; align-items: center; justify-content: center; padding: 24px 16px 130px;
  background: rgba(4,5,12,.72); opacity: 0; pointer-events: none; transition: opacity .4s ease; }
.jar.show { opacity: 1; pointer-events: auto; }
.jar .box { width: min(560px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 6px;
  background: rgba(10,8,22,.94); border: 1px solid var(--hair); box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.jar header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid var(--hair); }
.jar h2 { margin: 0; font-family: 'Cinzel', serif; font-size: .78rem; letter-spacing: .3em; text-transform: uppercase; color: var(--selene); }
.jar .n { font-family: 'Cinzel', serif; font-size: .62rem; letter-spacing: .14em; color: var(--torch); }
.jar .close { background: none; border: none; color: rgba(236,232,245,.7); cursor: pointer; font-size: 1.4rem; line-height: 1; padding: 0 2px; }
.jar ul { list-style: none; margin: 0; padding: 8px 0; overflow-y: auto; overscroll-behavior: contain; }
.jar li { padding: 9px 20px; font-family: 'Cormorant Garamond', serif; font-size: 1.12rem; color: rgba(236,232,245,.9); }
.jar li + li { border-top: 1px solid rgba(201,179,255,.08); }
.jar li.fresh { color: #fff; font-style: italic; }
.jar .empty, .jar .more { padding: 14px 20px 18px; font-style: italic; color: rgba(236,232,245,.55); text-align: center; }
@media (max-width: 560px) { .jar-btn { left: auto; right: 12px; bottom: auto; top: 150px; } }
`;

const JAR_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
  <path d="M8 3h8M9 3v3.2C6.6 7.3 5 9.5 5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6c0-2.5-1.6-4.7-4-5.8V3"/>
  <path d="M12 16.4s-2.6-1.6-2.6-3.2a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.6-2.6 3.2-2.6 3.2z" fill="currentColor" stroke="none"/></svg>`;

function load() {
  try { return JSON.parse(localStorage.getItem(`${STORE}:ganadas`)) || []; } catch { return []; }
}

export class Rewards {
  constructor({ onUnlock } = {}) {
    this.onUnlock = onUnlock;
    this.won = load().filter((t) => POOL.includes(t));
    this.fresh = new Set();
    this.queue = [];
    this.showing = false;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);

    this.card = document.createElement('div');
    this.card.className = 'reward';
    this.card.setAttribute('role', 'status');
    this.card.innerHTML = '<div class="k"></div><div class="t"></div>';

    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'jar-btn';
    this.btn.title = 'Frasco de frases';
    this.btn.setAttribute('aria-label', 'Abrir el frasco de frases');
    this.btn.innerHTML = `${JAR_ICON}<span class="dot"></span>`;
    this.btn.onclick = () => this.open();

    this.jar = document.createElement('div');
    this.jar.className = 'jar';
    this.jar.setAttribute('role', 'dialog');
    this.jar.setAttribute('aria-modal', 'true');
    this.jar.setAttribute('aria-label', 'Frasco de frases');
    this.jar.innerHTML = `<div class="box"><header><h2>Frasco de frases</h2><span class="n"></span>
      <button class="close" type="button" aria-label="Cerrar">×</button></header><ul></ul></div>`;
    this.jar.querySelector('.close').onclick = () => this.close();
    this.jar.addEventListener('click', (e) => { if (e.target === this.jar) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.jar.classList.contains('show')) this.close(); });

    document.body.append(this.card, this.btn, this.jar);
  }

  get total() { return POOL.length; }
  get count() { return this.won.length; }

  _save() {
    try { localStorage.setItem(`${STORE}:ganadas`, JSON.stringify(this.won)); } catch { /* sin almacenamiento */ }
  }

  // Desbloquea `n` frases nuevas al azar. `reason`: por qué se ganaron.
  grant(n = 1, reason = '') {
    const locked = POOL.filter((t) => !this.won.includes(t));
    const got = [];
    for (let i = 0; i < n && locked.length; i++) {
      const t = locked.splice(Math.floor(Math.random() * locked.length), 1)[0];
      this.won.push(t);
      this.fresh.add(t);
      got.push(t);
    }
    if (!got.length) return got;
    this._save();
    got.forEach((t, i) => {
      this.queue.push({ text: t, label: `${reason ? `${reason} · ` : ''}Frase ${this.won.length - got.length + i + 1} de ${POOL.length}` });
      this.onUnlock?.(t);
    });
    this.btn.classList.add('new');
    if (!this.showing) this._next();
    return got;
  }

  _next() {
    const item = this.queue.shift();
    if (!item) { this.showing = false; return; }
    this.showing = true;
    this.card.querySelector('.k').textContent = `✨ ${item.label}`;
    this.card.querySelector('.t').textContent = item.text;
    this.card.classList.add('show');
    setTimeout(() => {
      this.card.classList.remove('show');
      setTimeout(() => this._next(), 700);
    }, 4200);
  }

  open() {
    const list = this.jar.querySelector('ul');
    const items = [...this.won].reverse().map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      if (this.fresh.has(t)) li.className = 'fresh';
      return li;
    });
    const tail = document.createElement('li');
    tail.className = this.won.length ? 'more' : 'empty';
    const left = POOL.length - this.won.length;
    tail.textContent = !this.won.length
      ? 'Aún está vacío. Juega en los planetas para ir llenándolo 💖'
      : left ? `Faltan ${left} por descubrir en los planetas…` : '¡Las tienes todas! Cada una es tuya 💖';
    list.replaceChildren(...items, tail);
    list.scrollTop = 0;
    this.jar.querySelector('.n').textContent = `${this.won.length} / ${POOL.length}`;
    this.jar.classList.add('show');
    this.btn.classList.remove('new');
    this.jar.querySelector('.close').focus({ preventScroll: true });
  }

  close() {
    this.jar.classList.remove('show');
    this.fresh.clear();
    this.btn.focus({ preventScroll: true });
  }
}
