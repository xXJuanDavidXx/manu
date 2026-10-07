// Planeta Ritmo: caen corazones al ritmo de la canción que suena y ella los
// atrapa con una luna creciente. Las estrellas doradas valen más; las espinas
// rompen la racha. Cada canción guarda su propio récord.
//
// Interfaz de juego (la misma para todos los planetas):
//   mount(stage, ctx) -> { update(dt, time), unmount() }
// El bucle principal llama a update() justo después de analizar el audio, así
// que `ctx.audioProcessor.beat` es fiable en cada frame.

const CSS = `
.ritmo { position: absolute; inset: 0; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
.ritmo canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.ritmo .hud { position: absolute; top: 20px; left: 20px; display: flex; flex-direction: column; gap: 12px; pointer-events: none; }
.ritmo .exit {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 10px; align-self: flex-start;
  background: rgba(8,8,16,0.7); border: 1px solid var(--hair); border-radius: 3px; cursor: pointer;
  padding: 8px 14px 8px 10px; color: var(--selene);
  font-family: 'Cinzel', serif; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
  transition: color .3s, border-color .3s, box-shadow .3s;
}
.ritmo .exit:hover, .ritmo .exit:focus-visible { color: var(--moon); border-color: var(--selene); box-shadow: 0 0 16px rgba(201,179,255,.3); outline: none; }
.ritmo .score { font-family: 'Cinzel', serif; line-height: 1.1; text-shadow: 0 0 12px rgba(4,5,12,.9); }
.ritmo .score .big { font-size: 2.2rem; font-weight: 700; color: var(--moon); font-variant-numeric: tabular-nums; }
.ritmo .score .combo { font-size: .7rem; letter-spacing: .2em; color: var(--torch); text-transform: uppercase; min-height: 1em; }
.ritmo .score .best { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: .95rem; color: rgba(236,232,245,.6); margin-top: 6px; }
.ritmo .toast {
  position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%) scale(.96);
  width: min(560px, calc(100vw - 48px)); text-align: center; pointer-events: none;
  font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: clamp(1.4rem, 4.6vw, 2.1rem); line-height: 1.3;
  color: var(--moon); text-shadow: 0 0 6px rgba(4,5,12,1), 0 0 18px rgba(4,5,12,.95), 0 0 30px rgba(255,93,143,.45);
  opacity: 0; transition: opacity .6s ease, transform .6s ease;
}
.ritmo .toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
@media (max-width: 560px) { .ritmo .hud { top: 14px; left: 14px; } .ritmo .score .big { font-size: 1.8rem; } }
`;

const NOTE_EVERY = 40; // puntos entre notas de amor

export function mount(stage, ctx) {
  const { audioProcessor, audio, getTrack, getConsoleTop, exit, loveNotes = [] } = ctx;

  // --- DOM ---
  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'ritmo';
  root.innerHTML = `
    <canvas></canvas>
    <div class="hud">
      <button class="exit" type="button" aria-label="Volver a la galaxia">
        <svg width="18" height="18" viewBox="0 0 40 40" aria-hidden="true">
          <defs><mask id="ritmo-exit-moon"><circle cx="20" cy="20" r="15" fill="#fff"/><circle cx="29" cy="20" r="13.5" fill="#000"/></mask></defs>
          <circle cx="20" cy="20" r="15" fill="currentColor" mask="url(#ritmo-exit-moon)"/>
        </svg>
        Volver a la galaxia
      </button>
      <div class="score" aria-live="polite">
        <div class="big">0</div>
        <div class="combo"></div>
        <div class="best"></div>
      </div>
    </div>
    <div class="toast" role="status"></div>`;
  stage.append(style, root);

  const canvas = root.querySelector('canvas');
  const g = canvas.getContext('2d');
  const elScore = root.querySelector('.big');
  const elCombo = root.querySelector('.combo');
  const elBest = root.querySelector('.best');
  const elToast = root.querySelector('.toast');
  root.querySelector('.exit').onclick = () => exit();

  // --- tamaño ---
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth;
    H = root.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    makeSky();
  }

  // --- cielo: estrellas fijas que titilan ---
  let sky = [];
  function makeSky() {
    const n = Math.round((W * H) / 9000);
    sky = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.3, p: Math.random() * 6.28,
    }));
  }

  // --- sprites pre-renderizados (dibujar con glow cada frame es caro) ---
  let colors = null;
  const sprites = {};
  function sprite(size, draw) {
    const pad = 16;
    const c = document.createElement('canvas');
    c.width = c.height = Math.round((size + pad * 2) * DPR);
    const x = c.getContext('2d');
    x.scale(DPR, DPR);
    x.translate(pad + size / 2, pad + size / 2);
    draw(x, size);
    return { canvas: c, size: size + pad * 2 };
  }
  function heartPath(x, s) {
    const k = s / 2;
    x.beginPath();
    x.moveTo(0, k * 0.75);
    x.bezierCurveTo(-k * 1.25, -k * 0.05, -k * 0.75, -k * 1.05, 0, -k * 0.45);
    x.bezierCurveTo(k * 0.75, -k * 1.05, k * 1.25, -k * 0.05, 0, k * 0.75);
    x.closePath();
  }
  function buildSprites(track) {
    const cin = track?.colors?.in || '#ff5d8f';
    const cout = track?.colors?.out || '#c9b3ff';
    colors = { in: cin, out: cout };
    sprites.heart = sprite(34, (x, s) => {
      const grad = x.createLinearGradient(0, -s / 2, 0, s / 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, cin);
      grad.addColorStop(1, cout);
      x.shadowColor = cin;
      x.shadowBlur = 14;
      heartPath(x, s);
      x.fillStyle = grad;
      x.fill();
    });
    sprites.star = sprite(34, (x, s) => {
      x.shadowColor = '#ffd166';
      x.shadowBlur = 16;
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.22 : s * 0.5;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      x.closePath();
      x.fillStyle = '#ffe29a';
      x.fill();
    });
    sprites.thorn = sprite(30, (x, s) => {
      x.shadowColor = '#7b2cbf';
      x.shadowBlur = 10;
      x.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? s * 0.22 : s * 0.5;
        const a = (i * Math.PI) / 8;
        x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      x.closePath();
      x.fillStyle = '#1a1026';
      x.fill();
      x.lineWidth = 1.5;
      x.strokeStyle = 'rgba(255,93,143,0.75)';
      x.stroke();
    });
  }

  // --- estado del juego ---
  const notes = [];      // { x, y, vy, kind, size, sway, phase }
  const sparks = [];     // { x, y, vx, vy, life, color }
  const popups = [];     // { x, y, text, life }
  const catcher = { x: 0, target: 0, w: 120 };
  let score = 0, combo = 0, best = 0;
  let sinceSpawn = 0, lastX = -1, shake = 0, flash = 0;
  let noteIdx = 0, nextNoteAt = NOTE_EVERY;
  let trackName = null;
  let pausedHintShown = false;
  let toastTimer = null;
  const keys = new Set();

  const bestKey = (name) => `galaxia:ritmo:best:${name}`;
  function loadBest(name) {
    try { return Number(localStorage.getItem(bestKey(name))) || 0; } catch { return 0; }
  }
  function saveBest(name, v) {
    try { localStorage.setItem(bestKey(name), String(v)); } catch { /* sin almacenamiento: no pasa nada */ }
  }

  function toast(text, ms = 3200) {
    elToast.textContent = text;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elToast.classList.remove('show'), ms);
  }

  function paintHud() {
    elScore.textContent = score;
    const mult = multiplier();
    elCombo.textContent = combo >= 5 ? `racha ${combo}${mult > 1 ? ` · x${mult}` : ''}` : '';
    elBest.textContent = best ? `Récord en esta canción: ${best}` : 'Primera vez con esta canción';
  }

  const multiplier = () => Math.min(5, 1 + Math.floor(combo / 10));

  function onTrackChange(track) {
    if (trackName !== null && score > 0) toast(`«${trackName}»: ${score} puntos 💖`, 2800);
    trackName = track?.name ?? '';
    best = loadBest(trackName);
    score = 0;
    combo = 0;
    nextNoteAt = NOTE_EVERY;
    buildSprites(track);
    paintHud();
  }

  function spawn(kind) {
    const margin = Math.max(30, W * 0.08);
    let x;
    do { x = margin + Math.random() * (W - margin * 2); } while (lastX >= 0 && Math.abs(x - lastX) < W * 0.12 && Math.random() < 0.8);
    lastX = x;
    const level = Math.floor(score / 60);
    const base = H / (3.4 - Math.min(1.2, level * 0.12));
    notes.push({
      x, y: -30, kind,
      vy: base * (kind === 'star' ? 1.15 : 1) * (0.9 + Math.random() * 0.2),
      size: kind === 'thorn' ? 30 : 34,
      sway: kind === 'heart' ? 10 + Math.random() * 18 : 6,
      phase: Math.random() * 6.28,
    });
    sinceSpawn = 0;
  }

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 160;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1, color });
    }
  }

  function catchNote(n) {
    if (n.kind === 'thorn') {
      combo = 0;
      score = Math.max(0, score - 5);
      shake = 0.35;
      burst(n.x, catcherY(), '#7b2cbf', 10);
      popups.push({ x: n.x, y: catcherY() - 30, text: '−5', life: 1 });
    } else {
      combo++;
      const pts = (n.kind === 'star' ? 5 : 1) * multiplier();
      score += pts;
      flash = Math.min(1, flash + (n.kind === 'star' ? 0.6 : 0.25));
      burst(n.x, catcherY(), n.kind === 'star' ? '#ffd166' : colors.in, n.kind === 'star' ? 22 : 12);
      popups.push({ x: n.x, y: catcherY() - 30, text: `+${pts}`, life: 1 });
      if (score > best) { best = score; saveBest(trackName, best); }
      if (score >= nextNoteAt && loveNotes.length) {
        toast(loveNotes[noteIdx % loveNotes.length]);
        noteIdx++;
        nextNoteAt += NOTE_EVERY;
      }
    }
    paintHud();
  }

  const catcherY = () => Math.min(H * 0.86, getConsoleTop() - 54);

  // --- entrada ---
  const setTarget = (clientX) => { catcher.target = clientX - root.getBoundingClientRect().left; };
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) setTarget(e.clientX); });
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) setTarget(e.clientX);
  });
  const onKey = (e) => {
    if (e.key === 'Escape') { exit(); return; }
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
      e.preventDefault();
      if (e.type === 'keydown') keys.add(k); else keys.delete(k);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('resize', resize);

  resize();
  catcher.x = catcher.target = W / 2;
  onTrackChange(getTrack());
  toast('Atrapa los corazones con la luna 🌙', 2600);

  // --- dibujo ---
  function drawCatcher(x, y, w) {
    // luna creciente con las puntas hacia arriba: un cuenco de luz
    const r = w / 2;
    g.save();
    g.translate(x, y);
    g.shadowColor = 'rgba(246,161,90,0.9)';
    g.shadowBlur = 18 + flash * 20;
    g.beginPath();
    g.arc(0, -r * 0.55, r, Math.PI * 0.1, Math.PI * 0.9);
    g.arc(0, -r * 0.95, r * 0.92, Math.PI * 0.86, Math.PI * 0.14, true);
    g.closePath();
    const grad = g.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, '#c9b3ff');
    grad.addColorStop(0.5, '#fff4dc');
    grad.addColorStop(1, '#f6a15a');
    g.fillStyle = grad;
    g.fill();
    g.restore();
  }

  function draw(time) {
    const ap = audioProcessor;
    const beat = ap.beatHold || 0;
    const sx = shake > 0 ? (Math.random() - 0.5) * 12 * shake : 0;
    g.save();
    g.translate(sx, 0);

    // fondo: noche del planeta teñida por la canción
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04050c');
    bg.addColorStop(0.7, '#0a0718');
    bg.addColorStop(1, colors.out);
    g.globalAlpha = 1;
    g.fillStyle = bg;
    g.fillRect(-20, 0, W + 40, H);

    // pulso del golpe
    if (beat > 0.02) {
      const pg = g.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.7);
      pg.addColorStop(0, colors.in);
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = beat * 0.12;
      g.fillStyle = pg;
      g.fillRect(0, 0, W, H);
    }

    // estrellas
    g.fillStyle = '#ece8f5';
    for (const s of sky) {
      g.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time * 1.6 + s.p)) * (0.7 + (ap.treble || 0));
      g.fillRect(s.x, s.y, s.r, s.r);
    }

    // horizonte del planeta
    const cy = catcherY();
    const R = W * 1.4;
    const horizonY = cy + 34;
    g.globalAlpha = 1;
    const pl = g.createLinearGradient(0, horizonY, 0, H);
    pl.addColorStop(0, colors.out);
    pl.addColorStop(1, '#04050c');
    g.fillStyle = pl;
    g.beginPath();
    g.arc(W / 2, horizonY + R, R, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = colors.in;
    g.shadowBlur = 24 + (ap.bass || 0) * 30;
    g.strokeStyle = colors.in;
    g.lineWidth = 2;
    g.globalAlpha = 0.7;
    g.beginPath();
    g.arc(W / 2, horizonY + R, R, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    g.shadowBlur = 0;

    // notas
    g.globalAlpha = 1;
    for (const n of notes) {
      const sp = sprites[n.kind];
      const x = n.x + Math.sin(time * 2 + n.phase) * n.sway;
      const sc = n.kind === 'heart' ? 1 + beat * 0.18 : 1;
      const s = sp.size * sc;
      g.drawImage(sp.canvas, x - s / 2, n.y - s / 2, s, s);
    }

    // catcher
    drawCatcher(catcher.x, cy, catcher.w);

    // chispas
    for (const p of sparks) {
      g.globalAlpha = p.life;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, 2.2 * p.life + 0.6, 0, Math.PI * 2);
      g.fill();
    }

    // +puntos
    g.font = "600 18px 'Cinzel', serif";
    g.textAlign = 'center';
    for (const p of popups) {
      g.globalAlpha = p.life;
      g.fillStyle = p.text.startsWith('−') ? '#c77dff' : '#fff4dc';
      g.fillText(p.text, p.x, p.y);
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // --- bucle (lo llama main.js) ---
  function update(dt, time) {
    const track = getTrack();
    if ((track?.name ?? '') !== trackName) onTrackChange(track);

    const playing = !audio.paused;
    if (!playing) {
      if (!pausedHintShown) { toast('La música trae los corazones: toca la luna llena 🌕', 4000); pausedHintShown = true; }
    } else {
      pausedHintShown = false;
      sinceSpawn += dt;
      const ap = audioProcessor;
      const level = Math.floor(score / 60);
      if (ap.beat) {
        spawn('heart');
        if (Math.random() < 0.1) spawn('star');
        if (Math.random() < Math.min(0.28, 0.08 + level * 0.03)) spawn('thorn');
      } else if (sinceSpawn > 1.15) {
        // canciones suaves, con pocos golpes: que igual caigan corazones
        spawn(Math.random() < 0.06 ? 'star' : 'heart');
      }
    }

    // mover catcher
    catcher.w = Math.min(150, Math.max(96, W * 0.2));
    const kdir = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
    if (kdir) catcher.target += kdir * W * 1.1 * dt;
    catcher.target = Math.max(catcher.w / 2, Math.min(W - catcher.w / 2, catcher.target));
    catcher.x += (catcher.target - catcher.x) * Math.min(1, dt * 14);

    // mover notas y colisiones (en pausa, todo queda suspendido)
    const cy = catcherY();
    if (playing) {
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        const prevY = n.y;
        n.y += n.vy * dt;
        const x = n.x + Math.sin(time * 2 + n.phase) * n.sway;
        const crossing = prevY < cy - 14 && n.y >= cy - 14;
        if (crossing && Math.abs(x - catcher.x) < catcher.w / 2 + n.size * 0.25) {
          n.x = x;
          catchNote(n);
          notes.splice(i, 1);
        } else if (n.y > H + 40) {
          if (n.kind !== 'thorn' && combo > 0) { combo = 0; paintHud(); }
          notes.splice(i, 1);
        }
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt * 1.4;
      if (p.life <= 0) sparks.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].y -= 40 * dt;
      popups[i].life -= dt * 1.2;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt * 1.5);

    draw(time);
  }

  function unmount() {
    clearTimeout(toastTimer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('resize', resize);
    root.remove();
    style.remove();
  }

  return { update, unmount };
}
