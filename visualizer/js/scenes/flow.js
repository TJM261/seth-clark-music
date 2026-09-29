/* Flowing water over whatever is underneath. Outline a region on the
   preview and everything already drawn inside it — background image,
   artwork, other layers — is resampled in travelling strips so it ripples
   like water, with caustic highlights on top.

   This scene works in raw canvas space rather than in a layer box, because
   it has to line up with the pixels beneath it. The layer's position and
   size sliders therefore do nothing here; the drawn path is the region.  */
Viz.scenes.flow = {
  name: "Flow (path)",
  rawSpace: true,
  options: [
    { key: "path", label: "Region", type: "path", def: null },
    { key: "shape", label: "Region is", type: "select", def: "area", choices: [
      ["area", "The enclosed area"], ["ribbon", "A band along the line"]
    ]},
    { key: "width", label: "Band width", type: "range", def: 0.18, min: 0.01, max: 0.8, step: 0.005, fmt: "pct" },
    { key: "dir", label: "Flow", type: "select", def: "h", choices: [
      ["h", "Sideways"], ["v", "Up and down"]
    ]},
    { key: "amount", label: "Distortion", type: "range", def: 0.35, min: 0, max: 1, step: 0.01, fmt: "pct" },
    { key: "wavelength", label: "Wave size", type: "range", def: 0.3, min: 0.03, max: 1, step: 0.01, fmt: "pct" },
    { key: "speed", label: "Speed", type: "range", def: 1, min: -3, max: 3, step: 0.01, fmt: "x" },
    { key: "caustics", label: "Caustic highlights", type: "range", def: 0.4, min: 0, max: 1, step: 0.01, fmt: "pct" },
    { key: "tint", label: "Water tint", type: "range", def: 0.12, min: 0, max: 0.8, step: 0.01, fmt: "pct" },
    { key: "feather", label: "Soften edges", type: "check", def: true }
  ],

  /* Widen a polyline into a closed polygon so it can be used as a clip. */
  _ribbon(pts, width) {
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let dx = next[0] - prev[0], dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const nx = -dy * width / 2, ny = dx * width / 2;
      left.push([pts[i][0] + nx, pts[i][1] + ny]);
      right.push([pts[i][0] - nx, pts[i][1] - ny]);
    }
    return left.concat(right.reverse());
  },

  _region(ctx, w, h, o) {
    const raw = o.path;
    if (!raw || raw.length < 2) {
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      return { x0: 0, y0: 0, x1: w, y1: h };
    }
    let pts = raw.map(([x, y]) => [x * w, y * h]);
    if (o.shape === "ribbon") pts = this._ribbon(pts, Math.min(w, h) * o.width);

    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(([x, y]) => {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    });
    return { x0, y0, x1, y1 };
  },

  draw(ctx, w, h, a, s, t) {
    const p = s.params, o = s.opts;
    const snap = s.below && s.below();
    if (!snap) return;

    const unit = Math.min(w, h);
    const amp = unit * 0.06 * o.amount * (0.45 + a.energy * 1.2 + a.beatEnv * 0.4);
    const waveLen = Math.max(4, unit * o.wavelength);
    const vertical = o.dir === "v";
    const strip = Math.max(2, Math.round(unit * 0.005));

    ctx.save();
    const box = this._region(ctx, w, h, o);
    ctx.clip();

    /* Resample the pixels beneath in strips, each nudged along the flow.
       The undistorted copy is still underneath, so the sliver a shifted
       strip leaves at the edge is filled by the original rather than a gap. */
    if (vertical) {
      const from = Math.max(0, Math.floor(box.x0 / strip) * strip);
      const to = Math.min(w, box.x1 + strip);
      for (let x = from; x < to; x += strip) {
        const off = Math.sin((x / waveLen) * Math.PI * 2 + t * o.speed * 2) * amp;
        ctx.drawImage(snap, x, 0, strip, h, x, off, strip, h);
      }
    } else {
      const from = Math.max(0, Math.floor(box.y0 / strip) * strip);
      const to = Math.min(h, box.y1 + strip);
      for (let y = from; y < to; y += strip) {
        const off = Math.sin((y / waveLen) * Math.PI * 2 + t * o.speed * 2) * amp;
        ctx.drawImage(snap, 0, y, w, strip, off, y, w, strip);
      }
    }

    if (o.tint > 0) {
      ctx.fillStyle = Viz.rampColor(s.colors, 0.35, o.tint);
      ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    }

    /* Caustics: bright bands sliding across the surface at an angle. */
    if (o.caustics > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const bands = 14;
      const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) || unit;
      ctx.lineWidth = Math.max(1, span / bands * 0.16 * (0.5 + p.thickness));
      ctx.lineCap = "round";
      for (let i = 0; i < bands; i++) {
        const ph = t * o.speed * 0.5 + i * 0.7;
        const k = (i / bands + (t * 0.05 * o.speed)) % 1;
        const bright = (Math.sin(ph) * 0.5 + 0.5) * o.caustics * (0.25 + a.treble * 0.9);
        if (bright < 0.02) continue;
        ctx.strokeStyle = Viz.rampColor(s.colors, 1, Math.min(0.55, bright));
        ctx.beginPath();
        if (vertical) {
          const x = box.x0 + k * (box.x1 - box.x0);
          ctx.moveTo(x + Math.sin(ph) * amp, box.y0);
          ctx.lineTo(x - Math.sin(ph) * amp, box.y1);
        } else {
          const y = box.y0 + k * (box.y1 - box.y0);
          ctx.moveTo(box.x0, y + Math.sin(ph) * amp);
          ctx.lineTo(box.x1, y - Math.sin(ph) * amp);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    /* A soft rim keeps the region from looking cut out with scissors. */
    if (o.feather) {
      ctx.save();
      this._region(ctx, w, h, o);
      ctx.strokeStyle = Viz.rampColor(s.colors, 0.8, 0.18 + a.energy * 0.2);
      ctx.lineWidth = Math.max(1, 3 * s.scale);
      Viz.setGlow(ctx, p.glow * 0.5, Viz.rampColor(s.colors, 0.8), s.scale);
      ctx.stroke();
      Viz.clearGlow(ctx);
      ctx.restore();
    }
  }
};
