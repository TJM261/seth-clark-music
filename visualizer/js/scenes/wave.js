/* Layered oscilloscope. Each layer is the same waveform at a different
   scale and offset, which reads as depth without costing much. */
Viz.scenes.wave = {
  name: "Wave",

  draw(ctx, w, h, a, s, t) {
    const p = s.params;
    const points = Viz.clamp(Math.round(p.count * 4), 128, 1024);
    const wave = Viz.waveform(a.wave, points);
    const cy = h / 2;
    const layers = 3;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let L = layers - 1; L >= 0; L--) {
      const depth = L / (layers - 1 || 1);
      const amp = h * 0.3 * (1 - depth * 0.45) * (0.35 + a.energy * 1.5);
      const yOff = p.mirror ? 0 : (depth - 0.5) * h * 0.16;
      const drift = Math.sin(t * (0.3 + depth * 0.4) + depth * 3) * h * 0.02 * p.rotate * 4;
      const color = Viz.rampColor(s.colors, depth);
      const alpha = 1 - depth * 0.6;

      ctx.strokeStyle = Viz.rampColor(s.colors, depth, alpha);
      ctx.lineWidth = Math.max(1, 10 * p.thickness * (1 - depth * 0.5) * s.scale);
      Viz.setGlow(ctx, p.glow * (1 - depth * 0.5), color, s.scale);

      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const x = (i / (points - 1)) * w;
        /* Taper the ends so the line does not clip against the frame. */
        const taper = Math.sin((i / (points - 1)) * Math.PI);
        const y = cy + yOff + drift + wave[i] * amp * taper;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (p.mirror) {
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const x = (i / (points - 1)) * w;
          const taper = Math.sin((i / (points - 1)) * Math.PI);
          const y = cy + yOff + drift - wave[i] * amp * taper;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    Viz.clearGlow(ctx);
  }
};
