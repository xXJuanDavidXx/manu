// Controles del vuelo libre. Unifica teclado (flechas/WASD + Shift) y un
// joystick táctil que aparece donde se apoya el dedo (o el mouse). Expone
// `yaw` y `pitch` en -1..1 y `boost`.

const RADIUS = 56; // px de recorrido del joystick

export class FlightInput {
  constructor(surface, { joystickEl, boostEl }) {
    this.surface = surface;
    this.enabled = false;
    this.yaw = 0;
    this.pitch = 0;
    this.boost = false;

    this._keys = new Set();
    this._stick = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
    this._boostHeld = false;
    this.joystickEl = joystickEl;
    this.knobEl = joystickEl.querySelector('.knob');

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.closest?.('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift', ' '].includes(k)) {
        e.preventDefault();
        this._keys.add(k);
      }
    });
    window.addEventListener('keyup', (e) => this._keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this._keys.clear());

    surface.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this._stick.id !== null) return;
      const s = this._stick;
      s.id = e.pointerId;
      s.x0 = e.clientX;
      s.y0 = e.clientY;
      s.dx = s.dy = 0;
      surface.setPointerCapture(e.pointerId);
      joystickEl.style.left = `${e.clientX}px`;
      joystickEl.style.top = `${e.clientY}px`;
      joystickEl.classList.add('on');
      this._paintKnob();
    });
    surface.addEventListener('pointermove', (e) => {
      const s = this._stick;
      if (e.pointerId !== s.id) return;
      let dx = e.clientX - s.x0;
      let dy = e.clientY - s.y0;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      s.dx = dx;
      s.dy = dy;
      this._paintKnob();
    });
    const release = (e) => {
      if (e.pointerId !== this._stick.id) return;
      this._stick.id = null;
      this._stick.dx = this._stick.dy = 0;
      joystickEl.classList.remove('on');
    };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', release);

    const hold = (on) => (e) => { e.preventDefault(); this._boostHeld = on; boostEl.classList.toggle('held', on); };
    boostEl.addEventListener('pointerdown', hold(true));
    boostEl.addEventListener('pointerup', hold(false));
    boostEl.addEventListener('pointerleave', hold(false));
    boostEl.addEventListener('pointercancel', hold(false));
  }

  _paintKnob() {
    this.knobEl.style.transform = `translate(${this._stick.dx}px, ${this._stick.dy}px)`;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this._keys.clear();
      this._stick.id = null;
      this._stick.dx = this._stick.dy = 0;
      this._boostHeld = false;
      this.joystickEl.classList.remove('on');
    }
  }

  update() {
    const k = this._keys;
    const kx = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const ky = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
    // arrastrar hacia arriba = subir (como un avión de juguete, no invertido)
    const sx = this._stick.dx / RADIUS;
    const sy = this._stick.dy / RADIUS;
    this.yaw = Math.max(-1, Math.min(1, kx + sx));
    this.pitch = Math.max(-1, Math.min(1, ky + sy));
    this.boost = this._boostHeld || k.has('shift') || k.has(' ');
  }
}
