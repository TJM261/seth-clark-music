/* Frequency bars. The layer box is the drawing area, so size and position
   come from the layer; `dir` picks which edge they grow from. */
Viz.scenes.bars = {
  name: "Bars",
  options: [
    { key: "dir", label: "Direction", type: "select", def: "up", choices: [
      ["up", "Up from bottom"], ["down", "Down from top"],
      ["right", "Right from left"], ["left", "Left from right"]
    ]},
    { key: "baseline", label: "Baseline", type: "select", def: "edge", choices: [
      ["edge", "At the edge"], ["center", "Centred in layer"]
    ]},
    { key: "reflect", label: "Reflection", type: "check", def: true }
  ],

  draw(ctx, w, h, a, s) {
    const p = s.params, o = s.opts;
    const [W, H] = Viz.orient(ctx, w, h, o.dir || "up");
    const n = a.bands.length;
    if (!n) return;

    const slot = W / n;
    const bw = Math.max(1, slot * p.thickness);
    const radius = bw * 0.5;
    const centred = p.mirror || o.baseline === "center";
    const baseY = centred ? H / 2 : H;
    const maxH = centred ? H / 2 : H;

    for (let i = 0; i < n; i++) {
      const v = a.bands[i];
      const bh = Math.max(bw * 0.35, v * maxH);
      const x = i * slot + (slot - bw) / 2;
      const color = Viz.rampColor(s.colors, i / (n - 1 || 1));

      Viz.setGlow(ctx, p.glow * (0.35 + v * 0.65), color, s.scale);
      ctx.fillStyle = color;
      Viz.roundRect(ctx, x, baseY - bh, bw, bh, radius);
      ctx.fill();

      if (p.mirror) {
        ctx.globalAlpha *= 0.55;
        Viz.roundRect(ctx, x, baseY, bw, bh, radius);
        ctx.fill();
        ctx.globalAlpha /= 0.55;
      } else if (o.reflect) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.22;
        Viz.clearGlow(ctx);
        Viz.roundRect(ctx, x, baseY + bw * 0.4, bw, bh * 0.4, radius);
        ctx.fill();
        ctx.globalAlpha = prev;
      }
    }
    Viz.clearGlow(ctx);
  }
};
