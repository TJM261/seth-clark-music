/* Bubbles: rings with a highlight that rise, wobble and pop. "Flow" decides
   whether they simply rise, run along an angle, or circle in a current. */
Viz.scenes.bubbles = {
  name: "Bubbles",
  options: [
    { key: "flow", label: "Flow", type: "select", def: "rise", choices: [
      ["rise", "Rise straight up"], ["angle", "Along an angle"],
      ["swirl", "Circling current"], ["stream", "Winding stream"]
    ]},
    { key: "angle", label: "Angle", type: "range", def: -90, min: -180, max: 180, step: 1, fmt: "deg" },
    { key: "speed", label: "Speed", type: "range", def: 1, min: 0.1, max: 3, step: 0.01, fmt: "x" },
    { key: "size", label: "Bubble size", type: "range", def: 1, min: 0.1, max: 2.5, step: 0.01, fmt: "x" },
    { key: "wobble", label: "Wobble", type: "range", def: 0.5, min: 0, max: 2, step: 0.01, fmt: "x" },
    { key: "pop", label: "Pop on the beat", type: "check", def: true }
  ],

  draw(ctx, w, h, a, s, t, dt) {
    const p = s.params, o = s.opts;
    const store = s.store;
    const list = store.bubbles || (store.bubbles = []);
    const pops = store.pops || (store.pops = []);
    const unit = Math.min(w, h);
    const step = Viz.clamp(dt / (1 / 60), 0.2, 3);
    const max = Math.round(p.count * 0.8);
    const rad = (o.angle * Math.PI) / 180;

    /* Spawn on the upstream edge for the chosen flow. */
    const spawn = () => {
      let x, y;
      if (o.flow === "rise" || o.flow === "stream") { x = Math.random() * w; y = h + unit * 0.03; }
      else if (o.flow === "angle") {
        x = Math.random() * w - Math.cos(rad) * w * 0.5;
        y = Math.random() * h - Math.sin(rad) * h * 0.5;
      } else {
        const ang = Math.random() * Math.PI * 2;
        const r = unit * (0.1 + Math.random() * 0.35);
        x = w / 2 + Math.cos(ang) * r;
        y = h / 2 + Math.sin(ang) * r;
      }
      list.push({
        x, y,
        r: unit * (0.010 + Math.random() * 0.040) * o.size,
        phase: Math.random() * 6.283,
        rate: 0.6 + Math.random() * 0.9,
        frac: Math.random(),
        life: 1
      });
    };

    const want = 1 + a.energy * 6;
    for (let i = 0; i < want && list.length < max; i++) spawn();
    if (a.beat) for (let i = 0; i < 4 && list.length < max; i++) spawn();

    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      const v = unit * 0.004 * o.speed * q.rate * (0.6 + a.energy * 1.1) * step;
      const wob = Math.sin(t * 2.4 * q.rate + q.phase) * o.wobble * unit * 0.004 * step * 12;

      if (o.flow === "rise") { q.y -= v; q.x += wob * 0.25; }
      else if (o.flow === "angle") { q.x += Math.cos(rad) * v; q.y += Math.sin(rad) * v; }
      else if (o.flow === "swirl") {
        const cx = w / 2, cy = h / 2;
        const ang = Math.atan2(q.y - cy, q.x - cx) + 0.02 * o.speed * step;
        const dist = Math.hypot(q.x - cx, q.y - cy) + v * 0.35;
        q.x = cx + Math.cos(ang) * dist;
        q.y = cy + Math.sin(ang) * dist;
      } else {
        /* A meandering current rather than a straight climb. */
        q.y -= v;
        q.x += Viz.noise2(q.x / w * 3, q.y / h * 3, t * 0.4) * unit * 0.004 * o.wobble * step * 6;
      }

      const m = unit * 0.08;
      const gone = q.y < -m || q.y > h + m || q.x < -m || q.x > w + m;
      if (gone) { list.splice(i, 1); continue; }

      if (o.pop && a.beat && Math.random() < 0.06) {
        pops.push({ x: q.x, y: q.y, r: q.r, life: 1, frac: q.frac });
        list.splice(i, 1);
        continue;
      }

      const r = q.r * (1 + Math.sin(t * 3 + q.phase) * 0.06 * o.wobble) * (0.8 + a.treble * 0.5);
      const color = Viz.rampColor(s.colors, q.frac);
      ctx.strokeStyle = Viz.rampColor(s.colors, q.frac, 0.92);
      ctx.lineWidth = Math.max(1, 3.2 * p.thickness * s.scale);
      Viz.setGlow(ctx, p.glow * 0.6, color, s.scale);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.stroke();
      Viz.clearGlow(ctx);

      /* Skin and the little specular dot that makes it read as a bubble. */
      Viz.softDisc(ctx, q.x, q.y, r * 0.92,
        Viz.rampColor(s.colors, q.frac, 0.17), Viz.rampColor(s.colors, q.frac, 0));
      ctx.fillStyle = Viz.rampColor(s.colors, 1, 0.75);
      ctx.beginPath();
      ctx.arc(q.x - r * 0.32, q.y - r * 0.34, Math.max(0.4, r * 0.17), 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = pops.length - 1; i >= 0; i--) {
      const q = pops[i];
      q.life -= 0.06 * step;
      if (q.life <= 0) { pops.splice(i, 1); continue; }
      ctx.strokeStyle = Viz.rampColor(s.colors, q.frac, q.life * 0.8);
      ctx.lineWidth = Math.max(0.4, 1.6 * p.thickness * q.life * s.scale);
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r * (1 + (1 - q.life) * 2.4), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
};
