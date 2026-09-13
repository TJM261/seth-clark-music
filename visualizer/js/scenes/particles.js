/* Particle field pushed outward from the centre; beats fire bursts. */
Viz.scenes.particles = {
  name: "Particles",
  _parts: [],

  reset() { this._parts.length = 0; },

  _spawn(cx, cy, unit, frac, speed) {
    const ang = Math.random() * Math.PI * 2;
    const r = unit * (0.04 + Math.random() * 0.06);
    return {
      x: cx + Math.cos(ang) * r,
      y: cy + Math.sin(ang) * r,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 1,
      decay: 0.004 + Math.random() * 0.010,
      size: unit * (0.002 + Math.random() * 0.006),
      frac
    };
  },

  draw(ctx, w, h, a, s, t, dt) {
    const p = s.params;
    const cx = w / 2, cy = h / 2;
    const unit = Math.min(w, h);
    const parts = this._parts;
    const max = Math.round(p.count * 6);

    /* Steady trickle scaled by loudness, plus a burst on each beat. */
    const trickle = Math.round(1 + a.energy * 8);
    const burst = a.beat ? Math.round(12 + a.bass * 60) : 0;
    for (let i = 0; i < trickle + burst; i++) {
      if (parts.length >= max) break;
      const speed = unit * (0.0015 + Math.random() * 0.004) * (0.6 + a.energy * 2.2) * (a.beat ? 1.9 : 1);
      parts.push(this._spawn(cx, cy, unit, Math.random(), speed));
    }

    const swirl = p.rotate * 0.05;
    const drag = 0.992;
    const step = Viz.clamp(dt / (1 / 60), 0.2, 3);

    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      /* Rotate the velocity a touch each frame for a swirling drift. */
      const cos = Math.cos(swirl * step), sin = Math.sin(swirl * step);
      const vx = q.vx * cos - q.vy * sin;
      const vy = q.vx * sin + q.vy * cos;
      q.vx = vx * drag;
      q.vy = vy * drag;
      q.x += q.vx * step;
      q.y += q.vy * step;
      q.life -= q.decay * step;

      if (q.life <= 0 || q.x < -unit * 0.1 || q.x > w + unit * 0.1 || q.y < -unit * 0.1 || q.y > h + unit * 0.1) {
        parts.splice(i, 1);
        continue;
      }

      const size = q.size * p.thickness * 3 * (0.6 + a.treble * 0.9);
      const color = Viz.rampColor(s.colors, q.frac, q.life);
      ctx.fillStyle = color;
      Viz.setGlow(ctx, p.glow * q.life, Viz.rampColor(s.colors, q.frac), s.scale);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.5, size), 0, Math.PI * 2);
      ctx.fill();

      if (p.mirror) {
        ctx.beginPath();
        ctx.arc(w - q.x, h - q.y, Math.max(0.5, size * 0.6), 0, Math.PI * 2);
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    Viz.clearGlow(ctx);

    /* Core that swells with the low end. */
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
};
