/* Colour palettes. Each palette supplies a background gradient and three
   colours that scenes blend across (low -> mid -> high frequency). */
window.Viz = window.Viz || {};

Viz.palettes = {
  ember:    { name: "Ember",     bg: ["#140a06", "#020101"], colors: ["#ff3d2e", "#ff8a2b", "#ffd166"] },
  midnight: { name: "Midnight",  bg: ["#050b18", "#00030a"],   colors: ["#1d4ed8", "#38bdf8", "#a5f3fc"] },
  neon:     { name: "Neon",      bg: ["#0c0418", "#020008"],   colors: ["#ff2d95", "#9b5cff", "#25f4ee"] },
  forest:   { name: "Forest",    bg: ["#04120d", "#000604"],   colors: ["#14532d", "#2dd4a7", "#d9f99d"] },
  sunset:   { name: "Sunset",    bg: ["#180614", "#050008"],   colors: ["#7c3aed", "#ec4899", "#fb923c"] },
  mono:     { name: "Mono",      bg: ["#101010", "#000000"],   colors: ["#5c5c5c", "#b4b4b4", "#ffffff"] },
  gold:     { name: "Gold",      bg: ["#120d04", "#040200"],   colors: ["#7c4a03", "#d69e2e", "#fde68a"] },
  ice:      { name: "Ice",       bg: ["#060f14", "#01060a"],   colors: ["#0e7490", "#67e8f9", "#f0fdff"] }
};

/* "#rrggbb" -> [r, g, b] */
Viz.hexToRgb = function (hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

Viz.rgbToHex = function (rgb) {
  return "#" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
};

/* Blend across the palette's three colours. t runs 0 -> 1. */
Viz.rampColor = function (colors, t, alpha) {
  t = Math.max(0, Math.min(1, t));
  const seg = t * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = Viz.hexToRgb(colors[i]);
  const b = Viz.hexToRgb(colors[i + 1]);
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return alpha === undefined || alpha >= 1
    ? `rgb(${r},${g},${bl})`
    : `rgba(${r},${g},${bl},${alpha})`;
};
