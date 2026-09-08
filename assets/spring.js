/* 零依賴 spring 動畫引擎。
 * 參數沿用 Apple 的兩個設計參數：damping（阻尼比，1.0 不過衝、0.8 微彈）與 response（秒，越小越快）。
 * 每個 spring 都可在飛行中 retarget()，會從目前值與目前速度接續，不會跳格。 */
(function () {
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Spring(value, opts) {
    this.v = value; this.vel = 0; this.target = value;
    this.set(opts || {});
    this._raf = 0; this._last = 0;
  }
  Spring.prototype.set = function (o) {
    this.damping = o.damping ?? 1.0;
    this.response = o.response ?? 0.35;
    this.onUpdate = o.onUpdate || this.onUpdate;
    this.onDone = o.onDone || this.onDone;
    // Apple: stiffness = (2π/response)^2, damping coeff = 4π·ζ/response（mass = 1）
    this.k = Math.pow(2 * Math.PI / this.response, 2);
    this.c = 4 * Math.PI * this.damping / this.response;
    return this;
  };
  Spring.prototype.retarget = function (target, velocity) {
    this.target = target;
    if (velocity !== undefined) this.vel = velocity;
    if (reduced()) { this.v = target; this.vel = 0; this.onUpdate && this.onUpdate(this.v); this.onDone && this.onDone(); return this; }
    if (!this._raf) { this._last = performance.now(); this._raf = requestAnimationFrame(this._tick.bind(this)); }
    return this;
  };
  Spring.prototype.jump = function (value) { this.v = this.target = value; this.vel = 0; this.onUpdate && this.onUpdate(this.v); return this; };
  Spring.prototype.stop = function () { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; };
  Spring.prototype._tick = function (now) {
    let dt = Math.min((now - this._last) / 1000, 0.064); this._last = now;
    // 半隱式 Euler，切成小步避免高 stiffness 不穩
    const steps = Math.ceil(dt / 0.004); const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -this.k * (this.v - this.target) - this.c * this.vel;
      this.vel += a * h; this.v += this.vel * h;
    }
    const settled = Math.abs(this.v - this.target) < 0.01 && Math.abs(this.vel) < 0.01;
    if (settled) { this.v = this.target; this.vel = 0; }
    this.onUpdate && this.onUpdate(this.v);
    if (settled) { this._raf = 0; this.onDone && this.onDone(); }
    else this._raf = requestAnimationFrame(this._tick.bind(this));
  };

  /* 便利函式：把 spring 套在元素的 scale（pop）或 height（展開）上 */
  const store = new WeakMap();
  function pop(el, opts) {
    // 從 0.86 彈到 1；連續觸發時從目前值接續
    let s = store.get(el);
    if (!s) {
      s = new Spring(0.86, { damping: opts?.damping ?? 0.8, response: opts?.response ?? 0.32,
        onUpdate: (v) => { el.style.transform = `scale(${v})`; },
        onDone: () => { el.style.transform = ''; } });
      store.set(el, s);
    } else { s.jump(Math.min(s.v, 0.92)); }
    s.retarget(1);
    return s;
  }
  function expand(box, open, opts) {
    // box 的高度用 spring 從目前值到目標值；transform-origin 在上方（從題目處展開）
    let s = store.get(box);
    const target = open ? box.scrollHeight : 0;
    if (!s) {
      s = new Spring(open ? 0 : box.scrollHeight, { damping: 1.0, response: opts?.response ?? 0.32,
        onUpdate: (v) => { box.style.height = v + 'px'; box.style.opacity = Math.max(0, Math.min(1, v / Math.max(1, box.scrollHeight))); },
        onDone: () => { if (box.style.height !== '0px') box.style.height = 'auto'; } });
      store.set(box, s);
    } else if (box.style.height === 'auto' || box.style.height === '') { s.jump(box.scrollHeight); }
    box.style.overflow = 'hidden';
    s.retarget(target);
    return s;
  }
  window.Spring = Spring; window.springPop = pop; window.springExpand = expand;
})();
