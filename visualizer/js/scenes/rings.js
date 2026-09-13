/* A spectrum-deformed blob shedding ripple rings on the beat. Ripple state
   lives on the per-layer store, so several ring layers stay independent. */
Viz.scenes.rings = {
  name: "Rings",
  options: [
    { key: "blob", label: "Centre blob", type: "check", def: true },
    { key: "ripples", label: "Ripples", type: "check", def: true },
    { key: "speed", label: "Ripple speed", type: "range", def: 1, min: 0.2, max: 3, step: 0.01, fmt: "x" },
    { key: "base", label: "Base size", type: "range", def: 0.34, min: 0.05, max: 0.9, step: 0.01, fmt: "pct" }
  ],

  draw(ctx, w, h, a, s, t, dt) {
    const p = s.params, o = s.opts;
    const store = s.store;
    const rings = store.rings || (store.rings = []);
    const n = a.bands.length;
    if (!n) return;

    const cx = w / 2, cy = h / 2;
    const unit = Math.min(w, h) / 2;
    const step = Viz.clamp(dt / (1 / 60), 0.2, 3);

    if (o.ripples && a.beat && rings.length < 40) {
      rings.push({ r: unit * o.base * 0.8, life: 1, frac: Viz.clamp(a.treble * 1.4, 0, 1) });
    }

    ctx.lineCap = "round";
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.r += unit * 0.011 * o.speed * step;
      ring.life -= 0.011 * o.speed * step;
      if (ring.life <= 0) { rings.splice(i, 1); continue; }
      const color = Viz.rampColor(s.colors, ring.frac);
      ctx.strokeStyle = Viz.rampColor(s.colors, ring.frac, ring.life * 0.8);
      ctx.lineWidth = Math.max(1, 6 * p.thickness * ring.life * s.scale);
      Viz.setGlow(ctx, p.glow * ring.life * 0.7, color, s.scale);
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!o.blob) { Viz.clearGlow(ctx); return; }

    const segs = Math.max(24, n);
    const base = unit * (o.base + a.bass * 0.1 + a.beatEnv * 0.05);
    const reach = unit * 0.32 * (0.5 + p.thickness);
    const spin = t * p.spin * 0.4;
    const pts = [];

    for (let i = 0; i <= segs; i++) {
      const frac = i / segs;
      const ang = spin + frac * Math.PI * 2;
      /* Mirrored reads the spectrum out and back, so the blob is symmetric. */
      const bi = p.mirror
        ? Math.floor(Math.abs(0.5 - frac) * 2 * (n - 1))
        : Math.floor(frac * (n - 1));
      const r = base + (a.bands[bi] || 0) * reach;
      pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
    }

    const fill = ctx.createRadialGradient(cx, cy, base * 0.2, cx, cy, base + reach);
    fill.addColorStop(0, Viz.rampColor(s.colors, 0.9, 0.30));
    fill.addColorStop(1, Viz.rampColor(s.colors, 0.1, 0.06));

    ctx.strokeStyle = Viz.rampColor(s.colors, 0.7, 0.95);
    ctx.lineWidth = Math.max(1, 4 * p.thickness * s.scale);
    Viz.setGlow(ctx, p.glow, Viz.rampColor(s.colors, 0.7), s.scale);

    ctx.beginPath();
    ctx.moveTo((pts[0][0] + pts[segs - 1][0]) / 2, (pts[0][1] + pts[segs - 1][1]) / 2);
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i], next = pts[(i + 1) % pts.length];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();

    Viz.clearGlow(ctx);
  }
};
