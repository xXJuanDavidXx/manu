// Escucha una canción y encuentra sus golpes reales (onsets): decodifica el
// mp3 a baja resolución, lo recorre con una FFT y mide cuánto "aparece" de
// golpe en graves, medios y agudos (flujo espectral). Los picos de esa señal
// son los momentos donde caen las notas. Con eso se arma la partitura de cada
// dificultad, siempre sincronizada con la música de verdad.
//
// El resultado se guarda (memoria + localStorage) para no volver a analizar.

const SR = 11025;   // basta para ritmo y ahorra mucha memoria al decodificar
const WIN = 1024;   // ~93 ms
const HOP = 256;    // ~23 ms entre ventanas
const VERSION = 1;

const memo = new Map();

// --- FFT radix-2 en sitio ---
const bitrev = new Uint32Array(WIN);
const cosT = new Float32Array(WIN / 2), sinT = new Float32Array(WIN / 2);
const hann = new Float32Array(WIN);
{
  const bits = Math.log2(WIN);
  for (let i = 0; i < WIN; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    bitrev[i] = r;
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN - 1));
  }
  for (let i = 0; i < WIN / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / WIN); sinT[i] = -Math.sin((2 * Math.PI * i) / WIN); }
}
function fft(re, im) {
  for (let i = 0; i < WIN; i++) {
    const j = bitrev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let size = 2; size <= WIN; size <<= 1) {
    const half = size >> 1, step = WIN / size;
    for (let i = 0; i < WIN; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j, b = a + half;
        const tr = re[b] * cosT[k] - im[b] * sinT[k];
        const ti = re[b] * sinT[k] + im[b] * cosT[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

const BANDS = [[1, 19], [19, 186], [186, WIN / 2]]; // <200 Hz · 200–2000 Hz · >2000 Hz
const pause = () => new Promise((r) => setTimeout(r, 0));

function storeKey(src) { return `galaxia:ritmo:onsets:v${VERSION}:${src}`; }

export async function analyze(src, onProgress = () => {}) {
  if (memo.has(src)) return memo.get(src);
  try {
    const cached = JSON.parse(localStorage.getItem(storeKey(src)));
    if (cached) {
      const res = { duration: cached.d, onsets: cached.o.map(([t, s, c, b]) => ({ t, s, c, b })) };
      memo.set(src, res);
      return res;
    }
  } catch { /* sin caché */ }

  onProgress(0.02);
  const data = await (await fetch(src)).arrayBuffer();
  onProgress(0.12);
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const decoded = await new Off(1, 1, SR).decodeAudioData(data);
  onProgress(0.3);

  // a mono
  const n = decoded.length, chs = decoded.numberOfChannels;
  const mono = new Float32Array(n);
  for (let c = 0; c < chs; c++) {
    const d = decoded.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / chs;
  }

  // flujo espectral por banda + centroide (lo "agudo" del sonido)
  const frames = Math.max(0, Math.floor((n - WIN) / HOP));
  const flux = BANDS.map(() => new Float32Array(frames));
  const cent = new Float32Array(frames);
  const re = new Float32Array(WIN), im = new Float32Array(WIN);
  let prev = new Float32Array(WIN / 2), cur = new Float32Array(WIN / 2);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < WIN; i++) { re[i] = mono[o + i] * hann[i]; im[i] = 0; }
    fft(re, im);
    let num = 0, den = 0;
    for (let k = 1; k < WIN / 2; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]));
      cur[k] = m;
      num += k * m; den += m;
    }
    cent[f] = den ? num / den / (WIN / 2) : 0;
    BANDS.forEach(([a, b], bi) => {
      let s = 0;
      for (let k = a; k < b; k++) { const d = cur[k] - prev[k]; if (d > 0) s += d; }
      flux[bi][f] = s / (b - a);
    });
    [prev, cur] = [cur, prev];
    if (f % 600 === 0) { onProgress(0.3 + 0.6 * (f / frames)); await pause(); }
  }

  // cada banda normalizada por su media, y combinadas (los graves pesan más)
  const weights = [0.45, 0.35, 0.2];
  const odf = new Float32Array(frames);
  const norm = flux.map((fl) => {
    let m = 0;
    for (let i = 0; i < frames; i++) m += fl[i];
    return m / Math.max(1, frames) || 1;
  });
  for (let i = 0; i < frames; i++) {
    for (let b = 0; b < 3; b++) odf[i] += (weights[b] * flux[b][i]) / norm[b];
  }

  // picos sobre un umbral que se adapta a la sección de la canción
  const W = 10; // ±230 ms
  let global = 0;
  for (let i = 0; i < frames; i++) global += odf[i];
  global /= Math.max(1, frames);
  const onsets = [];
  const acc = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) acc[i + 1] = acc[i] + odf[i];
  for (let i = 0; i < frames; i++) {
    const lo = Math.max(0, i - W), hi = Math.min(frames, i + W + 1);
    const thr = ((acc[hi] - acc[lo]) / (hi - lo)) * 1.3 + global * 0.2;
    const v = odf[i];
    if (v <= thr) continue;
    let peak = true;
    for (let k = 1; k <= 3 && peak; k++) if (odf[i - k] > v || odf[i + k] >= v) peak = false;
    if (!peak) continue;
    let band = 0;
    for (let b = 1; b < 3; b++) if (flux[b][i] / norm[b] > flux[band][i] / norm[band]) band = b;
    onsets.push({
      t: +((i * HOP + WIN * 0.4) / SR).toFixed(3),
      s: +(v / thr).toFixed(2),
      c: +cent[i].toFixed(3),
      b: band,
    });
  }

  const res = { duration: n / SR, onsets };
  memo.set(src, res);
  try {
    localStorage.setItem(storeKey(src), JSON.stringify({ d: +res.duration.toFixed(2), o: onsets.map((x) => [x.t, x.s, x.c, x.b]) }));
  } catch { /* si no cabe, se analizará de nuevo otra vez */ }
  onProgress(1);
  return res;
}

// --- de los golpes a una partitura de 4 carriles ---
export const DIFFICULTIES = {
  facil: { label: 'Fácil', gap: 0.45, approach: 1.75, chords: 0 },
  normal: { label: 'Normal', gap: 0.26, approach: 1.4, chords: 0.04 },
  dificil: { label: 'Difícil', gap: 0.15, approach: 1.1, chords: 0.12 },
};

export function buildChart({ duration, onsets }, diffKey) {
  const D = DIFFICULTIES[diffKey];
  const usable = onsets.filter((o) => o.t >= 2 && o.t <= duration - 0.6);
  // primero los golpes más fuertes, sin dejar dos más cerca que `gap`
  const byStrength = [...usable].sort((a, b) => b.s - a.s);
  const taken = [];
  const near = (t) => {
    let lo = 0, hi = taken.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (taken[m] < t) lo = m + 1; else hi = m; }
    return Math.min(lo < taken.length ? taken[lo] - t : Infinity, lo > 0 ? t - taken[lo - 1] : Infinity);
  };
  const chosen = [];
  for (const o of byStrength) {
    if (near(o.t) < D.gap) continue;
    let lo = 0, hi = taken.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (taken[m] < o.t) lo = m + 1; else hi = m; }
    taken.splice(lo, 0, o.t);
    chosen.push(o);
  }
  chosen.sort((a, b) => a.t - b.t);

  // carril según lo agudo del sonido (cuartiles de la canción): la melodía
  // sube y baja por los carriles
  const cs = chosen.map((o) => o.c).sort((a, b) => a - b);
  const q = [0.25, 0.5, 0.75].map((p) => cs[Math.floor(p * (cs.length - 1))] ?? 0.5);
  const notes = [];
  let last = -1, lastT = -9;
  for (const o of chosen) {
    let lane = o.c < q[0] ? 0 : o.c < q[1] ? 1 : o.c < q[2] ? 2 : 3;
    // sin repetir carril en notas muy seguidas (incómodo con un dedo)
    if (lane === last && o.t - lastT < 0.32) lane = lane === 3 ? 2 : lane === 0 ? 1 : lane + (Math.random() < 0.5 ? -1 : 1);
    notes.push({ t: o.t, lane, s: o.s });
    last = lane;
    lastT = o.t;
  }
  // acordes: los golpes graves más fuertes se tocan con dos dedos
  if (D.chords) {
    const strong = notes.filter((nt) => nt.s > 0).sort((a, b) => b.s - a.s).slice(0, Math.floor(notes.length * D.chords));
    for (const nt of strong) notes.push({ t: nt.t, lane: (nt.lane + 2) % 4, s: nt.s, chord: true });
    notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  }
  return { notes, approach: D.approach, duration };
}
