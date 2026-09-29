/* Rolling swell: stacked travelling waves, filled front to back, with an
   optional foam line along each crest. */
Viz.scenes.ocean = {
  name: "Ocean wave",
  options: [
    { key: "swells", label: "Swells", type: "range", def: 4, min: 1, max: 8, step: 1 },
    { key: "speed", label: "Roll speed", type: "range", def: 1, min: -3, max: 3, step: 0.01, fmt: "x" },
    { key: "height", label: "Swell height", type: "range", def: 0.5, min: 0.05, max: 1.5, step: 0.01, fmt: "pct" },
    { key: "level", label: "Water line", type: "range", def: 0.6, min: 0, max: 1, step: 0.01, fmt: "pct" },
    { key: "crest", label: "Foam on the crests", type: "check", def: true }
  ],

  draw(ctx, w, h, a, s, t) {
    const p = s.params, o = s.opts;
    const swells = Math.max(1, Math.round(o.swells));
    const base = h * o.level;
    const amp = h * 0.16 * o.height * (0.45 + a.bass * 1.3);

    for (let L = 0; L < swells; L++) {
      /* Back swells sit higher, move slower and sit darker — cheap depth. */
      const depth = swells === 1 ? 0 : L / (swells - 1);
      const y0 = base - (1 - depth) * h * 0.22 * o.height;
      const speed = (0.35 + depth * 0.9) * o.speed;
      const wl = w / (0.8 + depth * 1.9);
      const la = amp * (0.45 + depth * 0.85);
      const tone = 0.15 + depth * 0.8;

      const pts = [];
      const steps = Viz.clamp(Math.round(p.count), 24, 256);
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        const ph = (x / wl) * Math.PI * 2 + t * speed * 1.6;
        /* Two components at different rates keep it from looking like a
           single sine wave sliding past. */
        const y = y0
          + Math.sin(ph) * la
          + Math.sin(ph * 2.3 + t * speed) * la * 0.3
          + Math.sin(ph * 0.5 - t * speed * 0.6) * la * 0.25;
        pts.push([x, y]);
      }

      /* Hold a solid body of water instead of fading out to the frame,
         which read as muddy hills rather than a swell. */
      const g = ctx.createLinearGradient(0, y0 - la, 0, Math.min(h, y0 + h * 0.55));
      g.addColorStop(0, Viz.rampColor(s.colors, tone, 0.96));
      g.addColorStop(0.3, Viz.rampColor(s.colors, Math.max(0, tone - 0.15), 0.88));
      g.addColorStop(1, Viz.rampColor(s.colors, Math.max(0, tone - 0.3), 0.66));

      ctx.beginPath();
      ctx.moveTo(0, h);
      pts.forEach(([x, y], i) => (i === 0 ? ctx.lineTo(x, y) : ctx.lineTo(x, y)));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = g;
      Viz.setGlow(ctx, p.glow * 0.3 * depth, Viz.rampColor(s.colors, tone), s.scale);
      ctx.fill();
      Viz.clearGlow(ctx);

      if (o.crest) {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.strokeStyle = Viz.rampColor(s.colors, Math.min(1, tone + 0.4), 0.75 + a.treble * 0.25);
        ctx.lineWidth = Math.max(1.2, 5 * p.thickness * (0.5 + depth) * s.scale);
        Viz.setGlow(ctx, p.glow * (0.4 + depth * 0.6), Viz.rampColor(s.colors, 1), s.scale);
        ctx.stroke();
        Viz.clearGlow(ctx);
      }
    }
  }
};
