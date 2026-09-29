/* A composition is an ordered list of layers, each one a scene with its own
   placement. Layers draw back to front. */
window.Viz = window.Viz || {};

Viz.BLENDS = [
  ["source-over", "Normal"],
  ["lighter", "Add"],
  ["screen", "Screen"],
  ["overlay", "Overlay"],
  ["multiply", "Multiply"],
  ["difference", "Difference"]
];

Viz.newLayer = function (scene) {
  return {
    id: "l" + Math.random().toString(36).slice(2, 9),
    scene: scene || "bars",
    on: true,
    /* Placement is normalised to the canvas: x/y are the layer's centre,
       w/h its size, so a composition survives a change of export format. */
    x: 0.5, y: 0.5, w: 1, h: 1,
    rot: 0,
    opacity: 1,
    blend: "source-over",
    params: { count: 96, thickness: 0.6, glow: 0.5, spin: 0.1, mirror: true },
    opts: {}
  };
};

/* Fill in any option the scene declares but this layer has not set yet. */
Viz.applySceneDefaults = function (layer) {
  const scene = Viz.scenes[layer.scene];
  if (!scene || !scene.options) return layer;
  scene.options.forEach((o) => {
    if (layer.opts[o.key] === undefined) layer.opts[o.key] = o.def;
  });
  return layer;
};

Viz.ANCHORS = [
  ["Top left", 0.25, 0.25], ["Top", 0.5, 0.25], ["Top right", 0.75, 0.25],
  ["Left", 0.25, 0.5], ["Centre", 0.5, 0.5], ["Right", 0.75, 0.5],
  ["Bottom left", 0.25, 0.75], ["Bottom", 0.5, 0.75], ["Bottom right", 0.75, 0.75]
];

/* Older saved state had a single scene and one set of params. Convert it to
   a one-layer composition rather than dropping the user's settings. */
Viz.migrateState = function (saved) {
  if (!saved || saved.layers) return saved;
  if (!saved.scene && !saved.params) return saved;
  const layer = Viz.newLayer(saved.scene || "bars");
  const p = saved.params || {};
  layer.params = {
    count: p.count !== undefined ? p.count : 96,
    thickness: p.thickness !== undefined ? p.thickness : 0.6,
    glow: p.glow !== undefined ? p.glow : 0.5,
    spin: p.rotate !== undefined ? p.rotate : 0.1,
    mirror: p.mirror !== undefined ? p.mirror : true
  };
  saved.layers = [Viz.applySceneDefaults(layer)];
  saved.trail = p.trail !== undefined ? p.trail : 0.25;
  delete saved.scene;
  delete saved.params;
  return saved;
};
