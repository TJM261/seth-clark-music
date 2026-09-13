/* A spectrum-deformed blob with ripple rings thrown off on each beat. */
Viz.scenes.rings = {
  name: "Rings",
  _rings: [],

  reset() { this._rings.length = 0; },

  draw(ctx, w, h, a, s, t, dt) {
    const p = s.params;
    const n = a.bands.length;
    if (!n) return;

    const cx = w / 2, cy = h / 2;
    const unit = Math.min(w, h);
    const step = Viz.clamp(dt / (1 / 60), 0.2, 3);

    if (a.beat && this._rings.length < 40) {
      this._rings.push({ r: unit * 0.14, life: 1, frac: Viz.clamp(a.treble * 1.4, 0, 1) });
    }

    /* Expanding ripples. */
    ctx.lineCap = "round";
    for (let i = this._rings.length - 1; i >= 0; i--) {
      const ring = this._rings[i];
      ring.r += unit * 0.0055 * step;
      ring.life -= 0.011 * step;
      if (ring.life <= 0) { this._rings.splice(i, 1); continue; }
      const color = Viz.rampColor(s.colors, ring.frac, ring.life * 0.8);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 6 * p.thickness * ring.life * s.scale);
      Viz.setGlow(ctx, p.glow * ring.life * 0.7, Viz.rampColor(s.colors, ring.frac), s.scale);
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* Blob: a closed curve whose radius is driven by the spectrum. Both
       halves use the same bands so the shape stays symmetrical. */
    const segs = Math.max(24, n);
    const base = unit * (0.16 + a.bass * 0.05 + a.beatEnv * 0.025);
    const reach = unit * 0.16 * (0.5 + p.thickness);
    const spin = t * p.rotate * 0.4;
    const pts = [];

    for (let i = 0; i <= segs; i++) {
      const frac = i / segs;
      const ang = spin + frac * Math.PI * 2;
      const bi = p.mirror
        ? Math.floor(Math.abs(0.5 - frac) * 2 * (n - 1))
        : Math.floor(frac * (n - 1));
      const v = a.bands[bi] || 0;
      const r = base + v * reach;
      pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
    }

    const fill = ctx.createRadialGradient(cx, cy, base * 0.2, cx, cy, base + reach);
    fill.addColorStop(0, Viz.rampColor(s.colors, 0.9, 0.30));
    fill.addColorStop(1, Viz.rampColor(s.colors, 0.1, 0.06));

    ctx.strokeStyle = Viz.rampColor(s.colors, 0.7, 0.95);
    ctx.lineWidth = Math.max(1, 4 * p.thickness * s.scale);
    Viz.setGlow(ctx, p.glow, Viz.rampColor(s.colors, 0.7), s.scale);

    ctx.beginPath();
    /* Midpoint quadratics keep the outline smooth between band samples. */
    ctx.moveTo((pts[0][0] + pts[segs - 1][0]) / 2, (pts[0][1] + pts[segs - 1][1]) / 2);
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const next = pts[(i + 1) % pts.length];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();

    Viz.clearGlow(ctx);
  }
};
