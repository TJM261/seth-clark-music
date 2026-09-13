/* Spectrum radiating out from a pulsing centre ring. */
Viz.scenes.radial = {
  name: "Radial",

  draw(ctx, w, h, a, s, t) {
    const p = s.params;
    const n = a.bands.length;
    if (!n) return;

    const cx = w / 2, cy = h / 2;
    const unit = Math.min(w, h);
    const r0 = unit * (0.15 + a.bass * 0.035 + a.beatEnv * 0.02);
    const maxLen = unit * 0.3;
    const spin = t * p.rotate * 0.35;

    /* Mirrored draws the spectrum twice around the circle so the shape is
       symmetrical; otherwise it sweeps once through 360 degrees. */
    const reps = p.mirror ? 2 : 1;
    const span = (Math.PI * 2) / reps;
    const barW = Math.max(1, (span * r0 / n) * p.thickness * 1.6);

    ctx.lineCap = "round";

    for (let rep = 0; rep < reps; rep++) {
      for (let i = 0; i < n; i++) {
        const v = a.bands[i];
        const frac = i / (n - 1 || 1);
        /* Both repetitions start at 12 o'clock and sweep opposite ways, so
           the two halves mirror instead of landing on top of each other. */
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

    /* Centre ring. */
    ctx.strokeStyle = Viz.rampColor(s.colors, 0.5, 0.32 + a.beatEnv * 0.5);
    ctx.lineWidth = Math.max(1, 2 * s.scale);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r0 - barW), 0, Math.PI * 2);
    ctx.stroke();
  }
};
