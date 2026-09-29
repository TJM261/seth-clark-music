/* Slow drifting fog. Large, very soft discs layered up; best on Screen or
   Add blend over something darker. */
Viz.scenes.mist = {
  name: "Mist",
  options: [
    { key: "drift", label: "Drift angle", type: "range", def: 0, min: -180, max: 180, step: 1, fmt: "deg" },
    { key: "speed", label: "Drift speed", type: "range", def: 0.4, min: 0, max: 2, step: 0.01, fmt: "x" },
    { key: "scale", label: "Cloud size", type: "range", def: 0.5, min: 0.1, max: 1.5, step: 0.01, fmt: "x" },
    { key: "density", label: "Density", type: "range", def: 0.5, min: 0.02, max: 1, step: 0.01, fmt: "pct" },
    { key: "react", label: "Swells with the music", type: "check", def: true }
  ],

  draw(ctx, w, h, a, s, t) {
    const p = s.params, o = s.opts;
    const unit = Math.max(w, h);
    const puffs = Viz.clamp(Math.round(p.count / 2), 10, 140);
    const rng = Viz.rng(97);
    const rad = (o.drift * Math.PI) / 180;
    const dx = Math.cos(rad), dy = Math.sin(rad);
    const travel = t * o.speed * unit * 0.03;
    const swell = o.react ? 0.55 + a.energy * 0.9 : 1;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < puffs; i++) {
      const hx = rng(), hy = rng();
      const phase = rng() * 6.283;
      const size = (0.35 + rng() * 0.65) * o.scale;

      /* Drift along the chosen angle and wrap, so the bank never runs out. */
      const wrap = (v, m) => ((v % m) + m) % m;
      const x = wrap(hx * w + dx * travel + Math.sin(t * 0.15 + phase) * w * 0.04, w * 1.4) - w * 0.2;
      const y = wrap(hy * h + dy * travel + Math.cos(t * 0.11 + phase) * h * 0.04, h * 1.4) - h * 0.2;

      const r = unit * 0.22 * size * (0.8 + Math.sin(t * 0.3 + phase) * 0.18);
      /* Soft, but not so faint it reads as nothing over a dark frame. */
      const alpha = o.density * 0.35 * swell * (0.5 + rng() * 0.5);
      const tone = 0.3 + rng() * 0.6;

      Viz.softDisc(ctx, x, y, r,
        Viz.rampColor(s.colors, tone, alpha),
        Viz.rampColor(s.colors, tone, 0));
    }
    ctx.restore();
  }
};
