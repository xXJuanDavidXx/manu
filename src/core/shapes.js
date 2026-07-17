// Generadores de nubes de puntos (Float32Array de count*3) usadas como
// objetivos de "morph" para la galaxia. Todo centrado en el origen y a una
// escala comparable al diámetro de la galaxia (~10 unidades).

// Muestrea un dibujo 2D (canvas) y lo convierte en una nube de puntos 3D,
// preservando el aspecto. `scale` = ancho aproximado en unidades de mundo.
function sampleCanvas(count, drawFn, { width = 1024, height = 512, scale = 10, depth = 0.5, step = 3 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  drawFn(ctx, width, height);

  const data = ctx.getImageData(0, 0, width, height).data;
  const pts = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 128) pts.push(x, y);
    }
  }

  const out = new Float32Array(count * 3);
  if (pts.length === 0) return out;
  const n = pts.length / 2;
  for (let i = 0; i < count; i++) {
    const p = ((Math.random() * n) | 0) * 2;
    out[i * 3] = ((pts[p] - width / 2) / width) * scale;
    out[i * 3 + 1] = (-(pts[p + 1] - height / 2) / width) * scale;
    out[i * 3 + 2] = (Math.random() - 0.5) * depth;
  }
  return out;
}

// Corazón relleno (fórmula paramétrica clásica).
export function heartShape(count, scale = 0.34) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const f = Math.sqrt(Math.random()); // relleno uniforme desde el centro
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out[i * 3] = x * f * scale + (Math.random() - 0.5) * 0.15;
    out[i * 3 + 1] = y * f * scale + (Math.random() - 0.5) * 0.15;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
  }
  return out;
}

// Lemniscata (símbolo de infinito), rellena con grosor.
export function infinityShape(count, scale = 5.2) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const d = 1 + Math.sin(t) * Math.sin(t);
    const r = 0.7 + Math.random() * 0.3;
    out[i * 3] = (scale * Math.cos(t) / d) * r + (Math.random() - 0.5) * 0.3;
    out[i * 3 + 1] = (scale * Math.sin(t) * Math.cos(t) / d) * r + (Math.random() - 0.5) * 0.3;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
  }
  return out;
}

// Nombre en 3D (nube de puntos a partir del texto).
export function textShape(count, text, { scale = 11, font = 'bold 190px Georgia' } = {}) {
  return sampleCanvas(count, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  }, { width: 1400, height: 384, scale, depth: 0.6, step: 2 });
}

// Sigilo de Hécate (Strophalos / "rueda de Hécate"): tres brazos serpentinos en
// simetría triple dentro de un círculo, con un núcleo central. Es el sigilo
// clásico de la triple diosa. Se dibuja con trazos para que, al muestrearlo,
// quede una constelación de puntos. Reutilizable para el sigilo de fondo.
export function drawHecateSigil(ctx, w, h, lineWidth) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.44;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // círculo exterior
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // tres brazos serpentinos a 120°
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((k * Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(R * 0.10, -R * 0.32, R * 0.48, -R * 0.30, R * 0.42, R * 0.02);
    ctx.bezierCurveTo(R * 0.38, R * 0.28, R * 0.08, R * 0.30, R * 0.16, R * 0.55);
    ctx.bezierCurveTo(R * 0.20, R * 0.72, R * 0.55, R * 0.66, R * 0.62, R * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  // núcleo central
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.10, 0, Math.PI * 2);
  ctx.stroke();
}

// Sigilo de Hécate como nube de puntos (forma de morph).
export function hecateWheelShape(count, scale = 9.5) {
  return sampleCanvas(count, (ctx, w, h) => {
    drawHecateSigil(ctx, w, h, Math.min(w, h) * 0.018);
  }, { width: 768, height: 768, scale, depth: 0.5, step: 2 });
}

// Luna triple de Hécate: creciente — llena — creciente. Símbolo de la triple
// diosa y, además, 100% espacial (tres lunas).
export function tripleMoonShape(count, scale = 9.5) {
  const crescent = (ctx, cx, cy, R, dir) => {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    const off = dir === 'left' ? R * 0.72 : -R * 0.72;
    ctx.beginPath();
    ctx.arc(cx + off, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  return sampleCanvas(count, (ctx, w, h) => {
    const cy = h / 2;
    const R = h * 0.26;
    // luna llena al centro
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // crecientes a los lados, dando la espalda a la luna central
    crescent(ctx, w / 2 - R * 2.15, cy, R, 'left');
    crescent(ctx, w / 2 + R * 2.15, cy, R, 'right');
  }, { width: 1200, height: 384, scale, depth: 0.7, step: 2 });
}

// Devuelve la lista ordenada de formas disponibles para ciclar.
export function buildShapes(count, name = 'MANUELA') {
  return [
    { key: 'heart', label: 'Corazón 💖', positions: heartShape(count) },
    { key: 'name', label: `${name} ✨`, positions: textShape(count, name) },
    { key: 'moon', label: 'Luna triple 🌙', positions: tripleMoonShape(count) },
    { key: 'sigil', label: 'Sigilo de Hécate 🜛', positions: hecateWheelShape(count) },
    { key: 'infinity', label: 'Infinito ♾️', positions: infinityShape(count) },
  ];
}
