/* Particle field. The emitter can sit anywhere in the layer and throw
   particles in a chosen direction. State lives on the per-layer store so
   two particle layers never share one pool. */
Viz.scenes.particles = {
  name: "Particles",
  options: [
    { key: "origin", label: "Emit from", type: "select", def: "center", choices: [
      ["center", "Centre"], ["top", "Top edge"], ["bottom", "Bottom edge"],
      ["left", "Left edge"], ["right", "Right edge"], ["edges", "All edges"]
    ]},
    { key: "flow", label: "Direction", type: "select", def: "natural", choices: [
      ["natural", "Away from emitter"], ["in", "Toward the centre"], ["angle", "Fixed angle"]
    ]},
    { key: "angle", label: "Angle", type: "range", def: -90, min: -180, max: 180, step: 1, fmt: "deg" },
    { key: "spread", label: "Spread", type: "range", def: 0.25, min: 0, max: 1, step: 0.01, fmt: "pct" },
    { key: "speed", label: "Speed", type: "range", def: 1, min: 0.2, max: 3, step: 0.01, fmt: "x" },
    { key: "emit", label: "Emitter size", type: "range", def: 0.08, min: 0, max: 1, step: 0.01, fmt: "pct" },
    { key: "core", label: "Glowing core", type: "check", def: true }
  ],

  /* Where a new particle starts, and which way it is heading. */
  _seed(w, h, o) {
    const cx = w / 2, cy = h / 2;
    const unit = Math.min(w, h);
    let x, y, bx, by;

    let edge = o.origin;
    if (edge === "edges") edge = ["top", "bottom", "left", "right"][(Math.random() * 4) | 0];

    if (edge === "top")         { x = Math.random() * w; y = 0; bx = 0;  by = 1; }
    else if (edge === "bottom") { x = Math.random() * w; y = h; bx = 0;  by = -1; }
    else if (edge === "left")   { x = 0; y = Math.random() * h; bx = 1;  by = 0; }
    else if (edge === "right")  { x = w; y = Math.random() * h; bx = -1; by = 0; }
    else {
      const ang = Math.random() * Math.PI * 2;
      const r = unit * o.emit * 0.5 * Math.sqrt(Math.random());
      x = cx + Math.cos(ang) * r;
      y = cy + Math.sin(ang) * r;
      bx = Math.cos(ang);
      by = Math.sin(ang);
    }

    /* Scatter edge emitters along their edge by the emitter size. */
    if (edge !== "center" && o.emit > 0) {
      const j = (Math.random() - 0.5) * unit * o.emit;
      if (bx === 0) x += j; else y += j;
    }

    if (o.flow === "in") { bx = (cx - x); by = (cy - y); }
    else if (o.flow === "angle") {
      const rad = (o.angle * Math.PI) / 180;
      bx = Math.cos(rad); by = Math.sin(rad);
    }

    const len = Math.hypot(bx, by) || 1;
    let ang = Math.atan2(by / len, bx / len);
    ang += (Math.random() - 0.5) * Math.PI * 2 * o.spread;
    return { x, y, ang };
  },

  draw(ctx, w, h, a, s, t, dt) {
    const p = s.params, o = s.opts;
    const store = s.store;
    const parts = store.parts || (store.parts = []);
    const unit = Math.min(w, h);
    const max = Math.round(p.count * 6);

    const trickle = Math.round(1 + a.energy * 8);
    const burst = a.beat ? Math.round(12 + a.bass * 60) : 0;
    for (let i = 0; i < trickle + burst; i++) {
      if (parts.length >= max) break;
      const seed = this._seed(w, h, o);
      const speed = unit * (0.0015 + Math.random() * 0.004) * o.speed
        * (0.6 + a.energy * 2.2) * (a.beat ? 1.9 : 1);
      parts.push({
        x: seed.x, y: seed.y,
        vx: Math.cos(seed.ang) * speed,
        vy: Math.sin(seed.ang) * speed,
        life: 1,
        decay: 0.004 + Math.random() * 0.010,
        size: unit * (0.002 + Math.random() * 0.006),
        frac: Math.random()
      });
    }

    const swirl = p.spin * 0.05;
    const drag = 0.992;
    const step = Viz.clamp(dt / (1 / 60), 0.2, 3);
    const margin = unit * 0.15;

    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      const cos = Math.cos(swirl * step), sin = Math.sin(swirl * step);
      const vx = q.vx * cos - q.vy * sin;
      const vy = q.vx * sin + q.vy * cos;
      q.vx = vx * drag;
      q.vy = vy * drag;
      q.x += q.vx * step;
      q.y += q.vy * step;
      q.life -= q.decay * step;

      if (q.life <= 0 || q.x < -margin || q.x > w + margin || q.y < -margin || q.y > h + margin) {
        parts.splice(i, 1);
        continue;
      }

      const size = q.size * p.thickness * 3 * (0.6 + a.treble * 0.9);
      ctx.fillStyle = Viz.rampColor(s.colors, q.frac, q.life);
      Viz.setGlow(ctx, p.glow * q.life, Viz.rampColor(s.colors, q.frac), s.scale);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.5, size), 0, Math.PI * 2);
      ctx.fill();

      if (p.mirror) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.5;
        ctx.beginPath();
        ctx.arc(w - q.x, h - q.y, Math.max(0.5, size * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = prev;
      }
    }

    Viz.clearGlow(ctx);

    if (o.core && o.origin === "center") {
      const cx = w / 2, cy = h / 2;
      const r = unit * (0.02 + a.bass * 0.05 + a.beatEnv * 0.03);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
      g.addColorStop(0, Viz.rampColor(s.colors, 0.85, 0.55));
      g.addColorStop(0.35, Viz.rampColor(s.colors, 0.4, 0.18));
      g.addColorStop(1, Viz.rampColor(s.colors, 0, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
