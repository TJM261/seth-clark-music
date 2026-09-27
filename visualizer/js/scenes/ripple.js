/* Raindrops on water: each impact sends out a train of concentric rings
   that expand and fade. */
Viz.scenes.ripple = {
  name: "Ripple",
  options: [
    { key: "origin", label: "Drops land", type: "select", def: "random", choices: [
      ["random", "Anywhere"], ["center", "In the centre"], ["row", "Along a line"]
    ]},
    { key: "rings", label: "Rings per drop", type: "range", def: 4, min: 1, max: 10, step: 1 },
    { key: "speed", label: "Spread speed", type: "range", def: 1, min: 0.2, max: 3, step: 0.01, fmt: "x" },
    { key: "life", label: "Persistence", type: "range", def: 1, min: 0.3, max: 3, step: 0.01, fmt: "x" },
    { key: "rate", label: "Idle drop rate", type: "range", def: 0.35, min: 0, max: 1, step: 0.01, fmt: "pct" }
  ],

  draw(ctx, w, h, a, s, t, dt) {
    const p = s.params, o = s.opts;
    const drops = s.store.drops || (s.store.drops = []);
    const unit = Math.min(w, h);
    const step = Viz.clamp(dt / (1 / 60), 0.2, 3);

    const spawn = () => {
      let x, y;
      if (o.origin === "center") { x = w / 2; y = h / 2; }
      else if (o.origin === "row") { x = Math.random() * w; y = h / 2; }
      else { x = Math.random() * w; y = Math.random() * h; }
      drops.push({ x, y, age: 0, power: 0.55 + a.bass * 0.8, frac: Math.random() });
    };

    if (a.beat) spawn();
    /* A slow idle patter so the surface is never completely still. */
    if (Math.random() < o.rate * 0.05 * step) spawn();
    if (drops.length > 60) drops.splice(0, drops.length - 60);

    ctx.lineCap = "round";

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += 0.01 * o.speed * step;
      const fade = 1 - d.age / o.life;
      if (fade <= 0) { drops.splice(i, 1); continue; }

      const lead = d.age * unit * 0.85;
      const gap = unit * 0.045 * (0.6 + p.thickness);

      for (let r = 0; r < Math.round(o.rings); r++) {
        const radius = lead - r * gap;
        if (radius <= 0) continue;
        /* Trailing rings are weaker, and everything thins as it spreads. */
        const trail = 1 - r / Math.round(o.rings);
        const alpha = fade * trail * 0.85 * d.power;
        if (alpha <= 0.01) continue;
        const color = Viz.rampColor(s.colors, Viz.clamp(d.frac * 0.4 + r / 8, 0, 1));
        ctx.strokeStyle = Viz.rampColor(s.colors, Viz.clamp(d.frac * 0.4 + r / 8, 0, 1), alpha);
        ctx.lineWidth = Math.max(0.5, 5 * p.thickness * trail * fade * s.scale);
        Viz.setGlow(ctx, p.glow * alpha * 0.8, color, s.scale);
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      /* Bright pinprick where the drop landed, for the first moments. */
      if (d.age < 0.12) {
        const flash = 1 - d.age / 0.12;
        Viz.softDisc(ctx, d.x, d.y, unit * 0.02 * flash,
          Viz.rampColor(s.colors, 1, flash * 0.9), Viz.rampColor(s.colors, 1, 0));
      }
    }
    Viz.clearGlow(ctx);
  }
};
