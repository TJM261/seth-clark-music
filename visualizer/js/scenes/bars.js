/* Frequency bars along the bottom, or mirrored around the centre line. */
Viz.scenes.bars = {
  name: "Bars",

  draw(ctx, w, h, a, s) {
    const p = s.params;
    const n = a.bands.length;
    if (!n) return;

    const slot = w / n;
    const bw = Math.max(1, slot * p.thickness);
    const radius = bw * 0.5;
    const baseY = p.mirror ? h * 0.5 : h * 0.88;
    const maxH = p.mirror ? h * 0.4 : h * 0.72;

    for (let i = 0; i < n; i++) {
      const v = a.bands[i];
      const bh = Math.max(bw * 0.35, v * maxH);
      const x = i * slot + (slot - bw) / 2;
      const color = Viz.rampColor(s.colors, i / (n - 1 || 1));

      Viz.setGlow(ctx, p.glow * (0.35 + v * 0.65), color, s.scale);
      ctx.fillStyle = color;

      if (p.mirror) {
        Viz.roundRect(ctx, x, baseY - bh, bw, bh, radius);
        ctx.fill();
        ctx.globalAlpha = 0.55;
        Viz.roundRect(ctx, x, baseY, bw, bh, radius);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        Viz.roundRect(ctx, x, baseY - bh, bw, bh, radius);
        ctx.fill();
        /* Reflection under the baseline. */
        ctx.globalAlpha = 0.22;
        Viz.clearGlow(ctx);
        Viz.roundRect(ctx, x, baseY + bw * 0.4, bw, bh * 0.4, radius);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    Viz.clearGlow(ctx);

    /* Baseline that brightens with overall level. */
    if (!p.mirror) {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, Viz.rampColor(s.colors, 0, 0.05));
      g.addColorStop(0.5, Viz.rampColor(s.colors, 0.6, 0.12 + a.energy * 0.5));
      g.addColorStop(1, Viz.rampColor(s.colors, 1, 0.05));
      ctx.fillStyle = g;
      ctx.fillRect(0, baseY + bw * 0.2, w, Math.max(1, 2 * s.scale));
    }
  }
};
