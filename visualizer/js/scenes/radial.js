/* Spectrum radiating out from a ring. `arc` lets it cover part of a circle
   rather than the whole thing, for fans and half-rings. */
Viz.scenes.radial = {
  name: "Radial",
  options: [
    { key: "arc", label: "Arc", type: "range", def: 1, min: 0.1, max: 1, step: 0.01, fmt: "pct" },
    { key: "start", label: "Start angle", type: "range", def: 0, min: -180, max: 180, step: 1, fmt: "deg" },
    { key: "inner", label: "Inner radius", type: "range", def: 0.34, min: 0.05, max: 0.8, step: 0.01, fmt: "pct" },
    { key: "ring", label: "Centre ring", type: "check", def: true }
  ],

  draw(ctx, w, h, a, s, t) {
    const p = s.params, o = s.opts;
    const n = a.bands.length;
    if (!n) return;

    const cx = w / 2, cy = h / 2;
    const unit = Math.min(w, h) / 2;
    const r0 = unit * (o.inner + a.bass * 0.08 + a.beatEnv * 0.05);
    const maxLen = (unit - r0) * 0.95;
    const spin = t * p.spin * 0.35 + (o.start * Math.PI) / 180;

    const reps = p.mirror ? 2 : 1;
    const span = (Math.PI * 2 * o.arc) / reps;
    const barW = Math.max(1, (span * r0 / n) * p.thickness * 1.6);

    ctx.lineCap = "round";

    for (let rep = 0; rep < reps; rep++) {
      for (let i = 0; i < n; i++) {
        const v = a.bands[i];
        const frac = i / (n - 1 || 1);
        /* Both repetitions start at the same angle and sweep opposite ways,
           so the halves mirror instead of overlapping. */
        const dir = rep % 2 === 0 ? 1 : -1;
        const ang = spin - Math.PI / 2 + dir * frac * span;
        const len = Math.max(barW * 0.5, v * maxLen);
        const color = Viz.rampColor(s.colors, frac);

        ctx.strokeStyle = color;
        ctx.lineWidth = barW;
        Viz.setGlow(ctx, p.glow * (0.3 + v * 0.7), color, s.scale);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len));
        ctx.stroke();
      }
    }

    Viz.clearGlow(ctx);

    if (o.ring) {
      ctx.strokeStyle = Viz.rampColor(s.colors, 0.5, 0.32 + a.beatEnv * 0.5);
      ctx.lineWidth = Math.max(1, 2 * s.scale);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, r0 - barW), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
};
