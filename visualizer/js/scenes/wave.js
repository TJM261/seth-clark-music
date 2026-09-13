/* Layered oscilloscope. Either a straight trace or the same waveform
   wrapped into a closed loop. */
Viz.scenes.wave = {
  name: "Wave",
  options: [
    { key: "wrap", label: "Shape", type: "select", def: "line", choices: [
      ["line", "Straight line"], ["circle", "Looped circle"]
    ]},
    { key: "layers", label: "Traces", type: "range", def: 3, min: 1, max: 6, step: 1 },
    { key: "amp", label: "Amplitude", type: "range", def: 1, min: 0.2, max: 3, step: 0.01, fmt: "x" }
  ],

  draw(ctx, w, h, a, s, t) {
    const p = s.params, o = s.opts;
    const points = Viz.clamp(Math.round(p.count * 4), 128, 1024);
    const wave = Viz.waveform(a.wave, points);
    const layers = Math.max(1, Math.round(o.layers));

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let L = layers - 1; L >= 0; L--) {
      const depth = layers === 1 ? 0 : L / (layers - 1);
      const color = Viz.rampColor(s.colors, depth);
      ctx.strokeStyle = Viz.rampColor(s.colors, depth, 1 - depth * 0.6);
      ctx.lineWidth = Math.max(1, 10 * p.thickness * (1 - depth * 0.5) * s.scale);
      Viz.setGlow(ctx, p.glow * (1 - depth * 0.5), color, s.scale);

      if (o.wrap === "circle") {
        const cx = w / 2, cy = h / 2, unit = Math.min(w, h) / 2;
        const base = unit * (0.62 - depth * 0.13);
        const amp = unit * 0.3 * o.amp * (0.3 + a.energy * 1.3) * (1 - depth * 0.4);
        const spin = t * p.spin * 0.4 + depth * 0.3;
        const pts = [];
        for (let i = 0; i < points; i++) {
          /* Blend the ends together so the loop closes without a seam. */
          const frac = i / points;
          const seam = Math.min(1, Math.min(frac, 1 - frac) * 8);
          const ang = spin + frac * Math.PI * 2;
          const r = base + wave[i] * amp * seam;
          pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
        }
        ctx.beginPath();
        const last = pts[pts.length - 1];
        ctx.moveTo((pts[0][0] + last[0]) / 2, (pts[0][1] + last[1]) / 2);
        for (let i = 0; i < pts.length; i++) {
          const cur = pts[i], next = pts[(i + 1) % pts.length];
          ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        const cy = h / 2;
        const amp = h * 0.45 * o.amp * (1 - depth * 0.45) * (0.35 + a.energy * 1.5);
        const yOff = p.mirror ? 0 : (depth - 0.5) * h * 0.16;
        const drift = Math.sin(t * (0.3 + depth * 0.4) + depth * 3) * h * 0.02 * p.spin * 4;

        const trace = (sign) => {
          ctx.beginPath();
          for (let i = 0; i < points; i++) {
            const x = (i / (points - 1)) * w;
            /* Taper the ends so the line does not clip against the edge. */
            const taper = Math.sin((i / (points - 1)) * Math.PI);
            const y = cy + yOff + drift + sign * wave[i] * amp * taper;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        };
        trace(1);
        if (p.mirror) {
          const prev = ctx.globalAlpha;
          ctx.globalAlpha = prev * 0.5;
          trace(-1);
          ctx.globalAlpha = prev;
        }
      }
    }
    Viz.clearGlow(ctx);
  }
};
