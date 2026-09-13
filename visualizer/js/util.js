/* Small shared drawing / math helpers. */
window.Viz = window.Viz || {};
Viz.scenes = Viz.scenes || {};

Viz.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
Viz.lerp = (a, b, t) => a + (b - a) * t;

Viz.roundRect = function (ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad);
  else {
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
};

/* Apply the user's glow amount as a shadow, scaled to canvas size. */
Viz.setGlow = function (ctx, glow, color, scale) {
  ctx.shadowBlur = glow * 34 * (scale || 1);
  ctx.shadowColor = glow > 0 ? color : "transparent";
};

Viz.clearGlow = function (ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
};

/* Downsample the time-domain buffer to `n` points in the range -1..1. */
Viz.waveform = function (timeData, n) {
  const out = new Float32Array(n);
  const step = timeData.length / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    let sum = 0;
    for (let j = start; j < end; j++) sum += timeData[j] - 128;
    out[i] = sum / (end - start) / 128;
  }
  return out;
};

/* Re-orient the drawing space so a scene can always draw as though it grows
   upward from the bottom edge, whichever side the user anchored it to.
   Returns the [width, height] of the re-oriented space (swapped for the
   sideways directions). */
Viz.orient = function (ctx, w, h, dir) {
  switch (dir) {
    case "down":
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-w / 2, -h / 2);
      return [w, h];
    case "right":
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-h / 2, -w / 2);
      return [h, w];
    case "left":
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-h / 2, -w / 2);
      return [h, w];
    default:
      return [w, h];
  }
};
