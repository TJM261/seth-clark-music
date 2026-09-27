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

/* Canvas 2D filters (used for background blur) arrived late in Safari.
   Setting the property is silently ignored where unsupported, so probe it
   by reading the value back rather than trusting the assignment. */
Viz.supportsCanvasFilter = function () {
  try {
    const c = document.createElement("canvas").getContext("2d");
    c.filter = "blur(2px)";
    return c.filter === "blur(2px)";
  } catch (e) {
    return false;
  }
};

/* Fullscreen, with the prefixed spellings older Safari still needs. */
Viz.fullscreenElement = function () {
  return document.fullscreenElement || document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement || null;
};

Viz.requestFullscreen = function (el) {
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
  if (fn) try { fn.call(el); } catch (e) { /* user gesture required */ }
};

Viz.exitFullscreen = function () {
  const fn = document.exitFullscreen || document.webkitExitFullscreen ||
    document.webkitCancelFullScreen;
  if (fn) try { fn.call(document); } catch (e) { /* already exited */ }
};

/* Small deterministic RNG, so patterns that should stay put between frames
   (ice cracks, mist blobs) can be regenerated identically from a seed. */
Viz.rng = function (seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
};

/* Cheap smooth pseudo-noise: summed sines. Fast enough to call per particle
   per frame, and good enough for drift and churn. */
Viz.noise2 = function (x, y, t) {
  return (
    Math.sin(x * 1.7 + t * 0.7) * 0.5 +
    Math.sin(y * 2.3 - t * 0.5) * 0.3 +
    Math.sin((x + y) * 1.1 + t * 0.9) * 0.2
  );
};

/* A soft round blob, used by froth, mist and bubbles. */
Viz.softDisc = function (ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
  g.addColorStop(0, inner);
  g.addColorStop(0.55, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
  ctx.fill();
};
