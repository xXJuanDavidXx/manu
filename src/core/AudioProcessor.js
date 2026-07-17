// Analiza el audio en tiempo real y expone métricas suaves (bass/mid/treble),
// energía acumulada y detección de golpes (beat) para los efectos reactivos.

const lerp = (a, b, f) => a + (b - a) * f;

export class AudioProcessor {
  constructor(audioElement) {
    this.audio = audioElement;
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.isSetup = false;

    // Métricas suavizadas
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0; // acumulada, para rotaciones lentas

    // Métricas instantáneas (para picos)
    this.rawBass = 0;
    this.rawMid = 0;
    this.rawTreble = 0;

    // Detección de golpes
    this.bassAvg = 0;      // media móvil de graves
    this.beat = false;     // true solo en el frame del golpe
    this.beatHold = 0;     // impulso que decae (0..1) para efectos visuales
    this._cooldown = 0;    // evita golpes en ráfaga
  }

  setup() {
    if (this.isSetup) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      const source = this.audioCtx.createMediaElementSource(this.audio);
      source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.analyser.fftSize = 512;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isSetup = true;
    } catch (e) {
      console.error('AudioContext setup failed:', e);
    }
  }

  update() {
    if (!this.isSetup) return;

    this.beat = false;
    this.beatHold *= 0.9;
    if (this._cooldown > 0) this._cooldown--;

    if (this.audio.paused) {
      this.bass = lerp(this.bass, 0, 0.02);
      this.mid = lerp(this.mid, 0, 0.02);
      this.treble = lerp(this.treble, 0, 0.02);
      this.rawBass = this.rawMid = this.rawTreble = 0;
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    let b = 0, m = 0, t = 0;
    for (let i = 0; i < 15; i++) b += this.dataArray[i];      // graves
    for (let i = 15; i < 70; i++) m += this.dataArray[i];     // medios
    for (let i = 70; i < 180; i++) t += this.dataArray[i];    // agudos

    this.rawBass = b / 15 / 255;
    this.rawMid = m / 55 / 255;
    this.rawTreble = t / 110 / 255;

    this.bass = lerp(this.bass, this.rawBass, 0.1);
    this.mid = lerp(this.mid, this.rawMid, 0.1);
    this.treble = lerp(this.treble, this.rawTreble, 0.1);

    const totalVolume = this.rawBass * 0.6 + this.rawMid * 0.3 + this.rawTreble * 0.1;
    this.energy += totalVolume * 0.05;

    // Golpe: un grave que supera claramente su media reciente
    this.bassAvg = lerp(this.bassAvg, this.rawBass, 0.05);
    if (this.rawBass > this.bassAvg * 1.35 + 0.12 && this._cooldown <= 0) {
      this.beat = true;
      this.beatHold = 1;
      this._cooldown = 8;
    }
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }
}
