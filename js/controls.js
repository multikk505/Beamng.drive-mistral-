/* Sterowanie: przyciski dotykowe (multi-touch) + klawiatura (test na desktopie) */
export class Controls {
  constructor() {
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.keys = {};
    this._touch = { left: false, right: false, gas: false, brake: false, hand: false };
    this._bindTouch();
    this._bindKeys();
  }

  _bindTouch() {
    const map = {
      'btn-left': 'left', 'btn-right': 'right',
      'btn-gas': 'gas', 'btn-brake': 'brake', 'btn-hand': 'hand',
    };
    for (const [id, name] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      const on = (e) => { e.preventDefault(); this._touch[name] = true; el.classList.add('pressed'); };
      const off = (e) => { e.preventDefault(); this._touch[name] = false; el.classList.remove('pressed'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    }
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  poll() {
    const k = this.keys, t = this._touch;
    const kUp = k.ArrowUp || k.KeyW, kDown = k.ArrowDown || k.KeyS;
    const kL = k.ArrowLeft || k.KeyA, kR = k.ArrowRight || k.KeyD;
    this.state.throttle = (t.gas || kUp) ? 1 : 0;
    this.state.brake = (t.brake || kDown) ? 1 : 0;
    this.state.steer = ((t.left || kL) ? 1 : 0) + ((t.right || kR) ? -1 : 0);
    this.state.handbrake = (t.hand || k.Space) ? 1 : 0;
    return this.state;
  }
}
