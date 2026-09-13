/* Draws a frame: background + scene onto an offscreen field (so motion
   trails only smear the visuals), then composites overlays on top. */
window.Viz = window.Viz || {};

Viz.Renderer = class {
  constructor(canvas, state, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.state = state;
    this.engine = engine;

    this.field = document.createElement("canvas");
    this.fieldCtx = this.field.getContext("2d", { alpha: false });

    this.bgImage = null;
    this.logoImage = null;
    this.grainPattern = null;
    this._stores = {};
    this._bgKey = null;
    this._bgCanvas = null;
    this._bgToken = 0;
    this.lastTime = 0;
    this.running = false;
    this.onFrame = null;

    this._makeGrain();
  }

  /* A single noise tile, re-offset each frame, beats regenerating noise
     across the whole canvas every frame. */
  _makeGrain() {
    const size = 128;
    const tile = document.createElement("canvas");
    tile.width = tile.height = size;
    const tctx = tile.getContext("2d");
    const img = tctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.random() * 135;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    this.grainPattern = this.ctx.createPattern(tile, "repeat");
  }

  setSize(w, h) {
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = this.field.width = w;
    this.canvas.height = this.field.height = h;
    this.fieldCtx.fillStyle = "#000";
    this.fieldCtx.fillRect(0, 0, w, h);
    this._stores = {};
  }

  /* Per-layer scratch state (particle pools, ripples). Keyed by layer and
     scene so switching a layer's scene starts it clean, and two layers of
     the same scene never share a pool. */
  _storeFor(layer) {
    const key = layer.id + "|" + layer.scene;
    return this._stores[key] || (this._stores[key] = {});
  }

  _pruneStores() {
    const live = {};
    this.state.layers.forEach((l) => { live[l.id + "|" + l.scene] = true; });
    Object.keys(this._stores).forEach((k) => { if (!live[k]) delete this._stores[k]; });
  }

  setImage(which, img) {
    if (which === "bg") {
      this.bgImage = img;
      this._bgToken++;
      this._bgKey = null;
    } else {
      this.logoImage = img;
    }
  }

  /* Compose the background image once per settings change and reuse it.
     Scaling and blurring a full-resolution photo every frame is wasteful
     and would show up as dropped frames in a recording. */
  _composedBackground(w, h) {
    const bg = this.state.bg;
    const img = this.bgImage;
    const key = [w, h, bg.fit, bg.zoom, bg.dim, bg.blur, this._bgToken].join("|");
    if (this._bgKey === key && this._bgCanvas) return this._bgCanvas;

    const c = this._bgCanvas || (this._bgCanvas = document.createElement("canvas"));
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);

    const zoom = bg.zoom || 1;
    let dw, dh;
    if (bg.fit === "stretch") {
      dw = w * zoom;
      dh = h * zoom;
    } else {
      let scale;
      if (bg.fit === "contain") scale = Math.min(w / img.width, h / img.height);
      else if (bg.fit === "width") scale = w / img.width;
      else scale = Math.max(w / img.width, h / img.height);
      dw = img.width * scale * zoom;
      dh = img.height * scale * zoom;
    }

    if (bg.blur > 0) {
      /* Blur samples beyond the image, so overscan to avoid a soft dark
         edge. Letterboxing is deliberate in `contain`, so leave it alone. */
      if (bg.fit !== "contain") {
        const f = Math.max((w + bg.blur * 4) / w, (h + bg.blur * 4) / h);
        dw *= f;
        dh *= f;
      }
      g.filter = `blur(${bg.blur}px)`;
    }
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    g.filter = "none";

    if (bg.dim > 0) {
      g.fillStyle = `rgba(0,0,0,${bg.dim})`;
      g.fillRect(0, 0, w, h);
    }

    this._bgKey = key;
    return c;
  }

  get colors() {
    return this.state.customColors || Viz.palettes[this.state.palette].colors;
  }

  _drawBackground(ctx, w, h, alpha, a) {
    const pal = Viz.palettes[this.state.palette];
    ctx.save();
    ctx.globalAlpha = alpha;
    const bg = this.state.bg;

    if (bg.mode === "image" && this.bgImage) {
      /* The composed cache is already opaque and covers the frame, so it is
         drawn alone. Painting black underneath it would composite twice per
         frame and, with motion trails on, hold the image well below its
         true brightness. */
      const pulse = bg.pulse && a ? 1 + a.beatEnv * 0.025 : 1;
      const pw = w * pulse, ph = h * pulse;
      ctx.drawImage(this._composedBackground(w, h), (w - pw) / 2, (h - ph) / 2, pw, ph);
    } else if (bg.mode === "solid") {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, w, h);
    } else {
      const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75);
      g.addColorStop(0, pal.bg[0]);
      g.addColorStop(1, pal.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  _drawVignette(ctx, w, h, amount) {
    if (amount <= 0) return;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${amount})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  _drawGrain(ctx, w, h, amount) {
    if (amount <= 0 || !this.grainPattern) return;
    ctx.save();
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = "overlay";
    ctx.translate(-Math.random() * 128, -Math.random() * 128);
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, w + 128, h + 128);
    ctx.restore();
  }

  _drawArtwork(ctx, x, y, size, pulse) {
    const img = this.logoImage;
    if (!img) return;
    const s = size * pulse;
    const dx = x - (s - size) / 2, dy = y - (s - size) / 2;
    ctx.save();
    ctx.shadowBlur = size * 0.18;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    Viz.roundRect(ctx, dx, dy, s, s, size * 0.04);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    ctx.save();
    Viz.roundRect(ctx, dx, dy, s, s, size * 0.04);
    ctx.clip();
    /* Cover-fit so non-square artwork is cropped, not squashed. */
    const scale = Math.max(s / img.width, s / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, dx + (s - dw) / 2, dy + (s - dh) / 2, dw, dh);
    ctx.restore();
  }

  _drawOverlay(ctx, w, h, a) {
    const ov = this.state.overlay;
    const unit = Math.min(w, h);
    const pulse = ov.logoPulse ? 1 + a.beatEnv * 0.07 : 1;
    const hasText = ov.showText && (ov.title || ov.artist);

    if (ov.logoPos === "center" && this.logoImage) {
      const size = unit * ov.logoSize;
      this._drawArtwork(ctx, (w - size) / 2, (h - size) / 2, size, pulse);
    } else if (ov.logoPos === "top-right" && this.logoImage) {
      const size = unit * ov.logoSize * 0.55;
      this._drawArtwork(ctx, w - size - w * 0.05, h * 0.06, size, pulse);
    }

    if (!hasText && ov.logoPos !== "above-text") return;

    const titleSize = unit * 0.052 * ov.size;
    const artistSize = titleSize * 0.56;
    const gap = titleSize * 0.32;
    const blockH = (ov.title ? titleSize : 0) + (ov.artist ? artistSize + gap : 0);

    let align = "left";
    let x = w * 0.06;
    let top = h * 0.9 - blockH;

    if (ov.pos === "bottom-center") { align = "center"; x = w / 2; }
    else if (ov.pos === "top-left") { top = h * 0.08; }
    else if (ov.pos === "center") { align = "center"; x = w / 2; top = (h - blockH) / 2; }

    let sideArt = 0;
    if (ov.logoPos === "above-text" && this.logoImage) {
      sideArt = unit * ov.logoSize * 0.5;
      const artY = top + blockH / 2 - sideArt / 2;
      if (align === "center") {
        const total = sideArt + sideArt * 0.3;
        this._drawArtwork(ctx, x - total / 2 - sideArt * 0.5, artY, sideArt, pulse);
        x += sideArt * 0.45;
      } else {
        this._drawArtwork(ctx, x, artY, sideArt, pulse);
        x += sideArt + sideArt * 0.28;
      }
    }

    if (!hasText) return;

    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.shadowBlur = titleSize * 0.5;
    ctx.shadowColor = "rgba(0,0,0,0.65)";

    let y = top;
    if (ov.title) {
      ctx.font = `600 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(ov.title, x, y);
      y += titleSize + gap;
    }
    if (ov.artist) {
      ctx.font = `400 ${artistSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif`;
      ctx.fillStyle = Viz.rampColor(this.colors, 0.75, 0.92);
      ctx.letterSpacing = "0.08em";
      ctx.fillText(ov.artist, x, y);
    }
    ctx.restore();
  }

  renderFrame(now) {
    const w = this.canvas.width, h = this.canvas.height;
    const t = now / 1000;
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 1 / 60;
    this.lastTime = now;

    const a = this.engine.frame(this.state.react);
    const fctx = this.fieldCtx;
    const trail = this.state.trail;

    this._drawBackground(fctx, w, h, trail > 0 ? Math.max(0.05, 1 - trail) : 1, a);
    this._pruneStores();

    const scale = Math.min(w, h) / 1080;
    const layers = this.state.layers || [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.on) continue;
      const scene = Viz.scenes[layer.scene];
      if (!scene) continue;

      const lw = Math.max(8, layer.w * w);
      const lh = Math.max(8, layer.h * h);
      a.bands = this.engine.bands(layer.params.count);

      fctx.save();
      fctx.globalAlpha = layer.opacity;
      fctx.globalCompositeOperation = layer.blend || "source-over";
      /* Place by the layer's centre, then hand the scene a box of its own
         so every scene gets position, size and rotation for free. */
      fctx.translate(layer.x * w, layer.y * h);
      if (layer.rot) fctx.rotate((layer.rot * Math.PI) / 180);
      fctx.translate(-lw / 2, -lh / 2);

      scene.draw(fctx, lw, lh, a, {
        colors: this.colors,
        params: layer.params,
        opts: layer.opts || {},
        store: this._storeFor(layer),
        scale,
        layer
      }, t, dt);
      fctx.restore();
    }

    fctx.globalAlpha = 1;
    fctx.globalCompositeOperation = "source-over";

    const ctx = this.ctx;
    ctx.drawImage(this.field, 0, 0);
    this._drawVignette(ctx, w, h, this.state.bg.vignette);
    this._drawGrain(ctx, w, h, this.state.bg.grain);
    this._drawOverlay(ctx, w, h, a);

    if (this.onFrame) this.onFrame(a);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now) => {
      if (!this.running) return;
      this.renderFrame(now);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }
};
