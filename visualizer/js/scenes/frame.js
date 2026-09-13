/* Spectrum along every edge of the layer at once, pointing inward or
   outward — a reactive border around the whole composition. */
Viz.scenes.frame = {
  name: "Frame",
  options: [
    { key: "sides", label: "Sides", type: "select", def: "all", choices: [
      ["all", "All four"], ["lr", "Left & right"], ["tb", "Top & bottom"]
    ]},
    { key: "face", label: "Facing", type: "select", def: "in", choices: [
      ["in", "Inward"], ["out", "Outward"]
    ]},
    { key: "inset", label: "Inset", type: "range", def: 0, min: 0, max: 0.4, step: 0.005, fmt: "pct" },
    { key: "depth", label: "Reach", type: "range", def: 0.22, min: 0.02, max: 0.5, step: 0.01, fmt: "pct" }
  ],

  draw(ctx, w, h, a, s) {
    const p = s.params, o = s.opts;
    const n = a.bands.length;
    if (!n) return;

    const inset = Math.min(w, h) * o.inset;
    const sides = o.sides === "lr" ? ["left", "right"]
      : o.sides === "tb" ? ["top", "bottom"]
      : ["top", "right", "bottom", "left"];
    const outward = o.face === "out";

    sides.forEach((side) => {
      const horizontal = side === "top" || side === "bottom";
      const along = horizontal ? w - inset * 2 : h - inset * 2;
      const reach = Math.min(w, h) * o.depth;
      if (along <= 0) return;

      const slot = along / n;
      const bw = Math.max(1, slot * p.thickness);

      ctx.save();
      /* Move to the edge and point the bars into the frame, so one loop
         body serves all four sides. */
      if (side === "top")    { ctx.translate(inset, inset); ctx.rotate(0); }
      if (side === "bottom") { ctx.translate(w - inset, h - inset); ctx.rotate(Math.PI); }
      if (side === "left")   { ctx.translate(inset, h - inset); ctx.rotate(-Math.PI / 2); }
      if (side === "right")  { ctx.translate(w - inset, inset); ctx.rotate(Math.PI / 2); }

      for (let i = 0; i < n; i++) {
        const v = a.bands[i];
        const len = Math.max(bw * 0.35, v * reach);
        const x = i * slot + (slot - bw) / 2;
        const color = Viz.rampColor(s.colors, i / (n - 1 || 1));
        ctx.fillStyle = color;
        Viz.setGlow(ctx, p.glow * (0.35 + v * 0.65), color, s.scale);
        Viz.roundRect(ctx, x, outward ? -len : 0, bw, len, bw * 0.5);
        ctx.fill();
      }
      ctx.restore();
    });

    Viz.clearGlow(ctx);
  }
};
