/* Frost and cracked ice. The crack network is generated once from a seed so
   it stays put, then glints travel along it and beats jolt it. */
Viz.scenes.ice = {
  name: "Ice",
  options: [
    { key: "mode", label: "Look", type: "select", def: "both", choices: [
      ["both", "Cracks and shimmer"], ["cracks", "Cracked ice"], ["shimmer", "Frost shimmer"]
    ]},
    { key: "seed", label: "Pattern", type: "range", def: 7, min: 1, max: 40, step: 1 },
    { key: "shards", label: "Crack density", type: "range", def: 0.5, min: 0.1, max: 1, step: 0.01, fmt: "pct" },
    { key: "jitter", label: "Shift on the beat", type: "range", def: 0.5, min: 0, max: 2, step: 0.01, fmt: "x" },
    { key: "glint", label: "Glint speed", type: "range", def: 1, min: 0, max: 3, step: 0.01, fmt: "x" }
  ],

  /* Cracks radiate from a handful of nuclei and fork as they go. */
  _build(w, h, o) {
    const rng = Viz.rng(Math.round(o.seed) * 7919 + 13);
    const unit = Math.min(w, h);
    const nuclei = Math.round(5 + o.shards * 16);
    const lines = [];

    for (let n = 0; n < nuclei; n++) {
      const ox = rng() * w, oy = rng() * h;
      const arms = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < arms; k++) {
        let x = ox, y = oy;
        let ang = rng() * Math.PI * 2;
        const segs = 3 + Math.floor(rng() * 4);
        const pts = [[x, y]];
        for (let sgm = 0; sgm < segs; sgm++) {
          ang += (rng() - 0.5) * 0.9;
          const len = unit * (0.015 + rng() * 0.055);
          x += Math.cos(ang) * len;
          y += Math.sin(ang) * len;
          pts.push([x, y]);
        }
        lines.push({ pts, weight: 0.35 + rng() * 0.65, offset: rng() });
      }
    }

    const sparks = [];
    const count = Math.round(40 + o.shards * 120);
    for (let i = 0; i < count; i++) {
      sparks.push({ x: rng() * w, y: rng() * h, r: 0.3 + rng() * 1.4, phase: rng() * 6.283, rate: 0.5 + rng() * 2.5 });
    }
    return { lines, sparks, key: [w, h, o.seed, o.shards].join("|") };
  },

  draw(ctx, w, h, a, s, t) {
    const p = s.params, o = s.opts;
    const key = [w, h, o.seed, o.shards].join("|");
    let built = s.store.ice;
    if (!built || built.key !== key) built = s.store.ice = this._build(w, h, o);

    const unit = Math.min(w, h);
    const shift = a.beatEnv * o.jitter * unit * 0.006;

    if (o.mode !== "shimmer") {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      built.lines.forEach((ln, i) => {
        /* Each crack jolts a little on the beat, in its own direction. */
        const jx = Math.cos(i * 2.4) * shift;
        const jy = Math.sin(i * 2.4) * shift;
        /* A glint runs along the network; cracks light up as it passes. */
        const sweep = (t * 0.18 * o.glint + ln.offset) % 1;
        const hot = Math.max(0, 1 - Math.abs(sweep - 0.5) * 3.2);
        const alpha = 0.3 + ln.weight * 0.3 + hot * 0.5 + a.treble * 0.2;
        const tone = Viz.clamp(0.45 + hot * 0.55, 0, 1);
        const color = Viz.rampColor(s.colors, tone);

        ctx.strokeStyle = Viz.rampColor(s.colors, tone, Math.min(1, alpha));
        /* Thin cracks vanished below a pixel; keep a real floor. */
        ctx.lineWidth = Math.max(1, 3.4 * p.thickness * (0.5 + ln.weight) * (0.8 + hot * 0.9) * s.scale);
        Viz.setGlow(ctx, p.glow * (0.25 + hot * 0.75), color, s.scale);
        ctx.beginPath();
        ln.pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x + jx, y + jy) : ctx.lineTo(x + jx, y + jy)));
        ctx.stroke();
      });
      Viz.clearGlow(ctx);
    }

    if (o.mode !== "cracks") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      built.sparks.forEach((sp) => {
        /* Frost grains twinkle out of phase, faster with the high end. */
        const tw = Math.sin(t * sp.rate * (1 + o.glint) + sp.phase) * 0.5 + 0.5;
        const bright = tw * tw * (0.35 + a.treble * 1.1);
        if (bright < 0.03) return;
        const r = sp.r * s.scale * (1.4 + p.thickness * 2.4) * (0.6 + bright);
        ctx.fillStyle = Viz.rampColor(s.colors, 1, Math.min(1, bright));
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (bright > 0.55) {
          ctx.strokeStyle = Viz.rampColor(s.colors, 1, (bright - 0.55) * 0.8);
          ctx.lineWidth = Math.max(0.3, r * 0.35);
          ctx.beginPath();
          ctx.moveTo(sp.x - r * 3, sp.y); ctx.lineTo(sp.x + r * 3, sp.y);
          ctx.moveTo(sp.x, sp.y - r * 3); ctx.lineTo(sp.x, sp.y + r * 3);
          ctx.stroke();
        }
      });
      ctx.restore();
    }
  }
};
