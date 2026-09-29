/* Sea foam: a churning mass of overlapping soft discs. Drawn with a
   lightening blend inside the layer so overlaps read as thicker foam. */
Viz.scenes.froth = {
  name: "Froth",
  options: [
    { key: "where", label: "Sits", type: "select", def: "bottom", choices: [
      ["bottom", "Along the bottom"], ["top", "Along the top"], ["middle", "Across the middle"], ["fill", "Fills the layer"]
    ]},
    { key: "band", label: "Band depth", type: "range", def: 0.3, min: 0.05, max: 1, step: 0.01, fmt: "pct" },
    { key: "churn", label: "Churn", type: "range", def: 1, min: 0.1, max: 3, step: 0.01, fmt: "x" },
    { key: "bite", label: "Crispness", type: "range", def: 0.4, min: 0, max: 1, step: 0.01, fmt: "pct" }
  ],

  draw(ctx, w, h, a, s, t) {
    const p = s.params, o = s.opts;
    const unit = Math.min(w, h);
    const count = Math.round(p.count * 1.6);
    const rng = Viz.rng(1337);

    const bandH = h * o.band;
    let top;
    if (o.where === "bottom") top = h - bandH;
    else if (o.where === "top") top = 0;
    else if (o.where === "middle") top = (h - bandH) / 2;
    else { top = 0; }
    const span = o.where === "fill" ? h : bandH;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < count; i++) {
      /* Each bubble keeps a fixed home and wanders around it, so the mass
         churns in place instead of sliding across the frame. */
      const hx = rng();
      const hy = rng();
      const phase = rng() * 6.283;
      const scale = 0.4 + rng() * 0.6;

      const n = Viz.noise2(hx * 6, hy * 6, t * 0.6 * o.churn + phase);
      const lift = a.energy * 0.35 + a.beatEnv * 0.25;
      const x = (hx + n * 0.035) * w;
      const y = top + (hy * span) - lift * span * 0.25 +
        Math.sin(t * o.churn + phase) * span * 0.06;

      const r = unit * 0.035 * scale * p.thickness * (0.7 + a.energy * 0.8);
      const edge = Viz.clamp(1 - Math.abs((y - top) / span - 0.5) * 1.6, 0, 1);
      const alpha = (0.16 + edge * 0.42) * (0.5 + a.energy * 0.9);
      const tone = Viz.clamp(0.55 + rng() * 0.45, 0, 1);

      Viz.softDisc(ctx, x, y, r,
        Viz.rampColor(s.colors, tone, alpha * (0.4 + o.bite * 0.9)),
        Viz.rampColor(s.colors, tone, 0));

      /* A few crisp rims give the foam some definition. */
      if (o.bite > 0 && rng() < o.bite * 0.35) {
        ctx.strokeStyle = Viz.rampColor(s.colors, 1, alpha * 0.9);
        ctx.lineWidth = Math.max(0.4, 1.2 * s.scale);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
};
