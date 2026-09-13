/* Wires the UI to the audio engine, renderer and recorder. */
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE_STATE = "viz.state.v1";
  const STORE_PRESETS = "viz.presets.v1";

  const defaults = () => ({
    layers: [Viz.applySceneDefaults(Viz.newLayer("bars"))],
    active: 0,
    trail: 0.25,
    palette: "ember",
    customColors: null,
    react: { sensitivity: 1.1, smoothing: 0.72, bassBoost: 1.25, beatSens: 1.35 },
    bg: {
      mode: "gradient", color: "#07080b", imageData: null,
      fit: "cover", zoom: 1, dim: 0.3, blur: 0, pulse: false,
      vignette: 0.45, grain: 0.05
    },
    overlay: {
      showText: true, title: "", artist: "", size: 1, pos: "bottom-left",
      logoData: null, logoPos: "none", logoSize: 0.28, logoPulse: true
    },
    exportSize: "1920x1080",
    fps: 60
  });

  let state = defaults();

  const engine = new Viz.AudioEngine();
  const renderer = new Viz.Renderer($("viz"), state, engine);
  const recorder = new Viz.Recorder($("viz"), engine);

  const syncFns = [];
  let seeking = false;

  /* The layer being edited. */
  const L = () => state.layers[state.active] || null;

  /* ---------- persistence ---------- */

  function save() {
    try { localStorage.setItem(STORE_STATE, JSON.stringify(state)); } catch (e) { /* quota: skip */ }
  }

  function normalise(saved) {
    const base = defaults();
    Viz.migrateState(saved);
    const merged = Object.assign(base, saved, {
      react: Object.assign(base.react, saved.react),
      bg: Object.assign(base.bg, saved.bg),
      overlay: Object.assign(base.overlay, saved.overlay)
    });
    if (!Array.isArray(merged.layers) || !merged.layers.length) {
      merged.layers = [Viz.applySceneDefaults(Viz.newLayer("bars"))];
    }
    merged.layers = merged.layers.map((l) => {
      const fresh = Viz.newLayer(l.scene);
      const layer = Object.assign(fresh, l, {
        params: Object.assign(fresh.params, l.params),
        opts: Object.assign({}, l.opts)
      });
      if (!Viz.scenes[layer.scene]) layer.scene = "bars";
      return Viz.applySceneDefaults(layer);
    });
    merged.active = Viz.clamp(merged.active | 0, 0, merged.layers.length - 1);
    return merged;
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORE_STATE);
      state = normalise(raw ? JSON.parse(raw) : {});
    } catch (e) {
      state = defaults();
    }
  }

  function getPresets() {
    try { return JSON.parse(localStorage.getItem(STORE_PRESETS)) || {}; } catch (e) { return {}; }
  }

  function setPresets(p) {
    try { localStorage.setItem(STORE_PRESETS, JSON.stringify(p)); } catch (e) {
      alert("Could not save the preset — browser storage is full. Try removing a background or artwork image first.");
    }
  }

  /* ---------- control binding ---------- */

  function bind(id, getter, setter, opts) {
    opts = opts || {};
    const el = $(id);
    if (!el) return;
    const isCheck = el.type === "checkbox";
    const isRange = el.type === "range";
    const label = opts.label ? $(opts.label) : null;

    const paint = () => {
      const v = getter();
      if (isCheck) el.checked = !!v; else el.value = v;
      if (label) label.textContent = opts.fmt ? opts.fmt(v) : v;
    };

    el.addEventListener("input", () => {
      setter(isCheck ? el.checked : isRange ? parseFloat(el.value) : el.value);
      if (label) label.textContent = opts.fmt ? opts.fmt(getter()) : getter();
      if (opts.after) opts.after();
      save();
    });

    syncFns.push(paint);
    paint();
  }

  const pct = (v) => Math.round(v * 100) + "%";
  const deg = (v) => Math.round(v) + "°";
  const mult = (v) => Number(v).toFixed(2) + "×";
  const FMT = { pct, deg, x: mult };

  /* ---------- layers ---------- */

  function layerLabel(layer, index) {
    const scene = Viz.scenes[layer.scene];
    const name = scene ? scene.name : layer.scene;
    const sameScene = state.layers.filter((l) => l.scene === layer.scene);
    if (sameScene.length < 2) return name;
    return name + " " + (sameScene.indexOf(layer) + 1);
  }

  function selectLayer(i) {
    state.active = Viz.clamp(i, 0, state.layers.length - 1);
    refreshLayerUI();
    save();
  }

  function refreshLayerUI() {
    renderLayerList();
    syncFns.forEach((fn) => fn());
    buildSceneOpts();
    const has = !!L();
    $("layerEditor").hidden = !has;
    $("noLayerHint").hidden = has;
  }

  function renderLayerList() {
    const list = $("layerList");
    list.innerHTML = "";
    /* Drawn back to front, so show the topmost layer at the top. */
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const layer = state.layers[i];
      const li = document.createElement("li");
      li.className = "layer-row" + (layer.on ? "" : " off");
      li.setAttribute("aria-selected", String(i === state.active));

      const name = document.createElement("button");
      name.type = "button";
      name.className = "layer-name";
      name.textContent = layerLabel(layer, i);
      name.addEventListener("click", () => selectLayer(i));
      li.appendChild(name);

      const mk = (glyph, title, fn, disabled) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "layer-btn";
        b.title = title;
        b.textContent = glyph;
        b.disabled = !!disabled;
        b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
        li.appendChild(b);
      };

      mk(layer.on ? "👁" : "◌", layer.on ? "Hide layer" : "Show layer", () => {
        layer.on = !layer.on;
        refreshLayerUI();
        save();
      });
      mk("↑", "Move up", () => moveLayer(i, 1), i === state.layers.length - 1);
      mk("↓", "Move down", () => moveLayer(i, -1), i === 0);
      mk("⧉", "Duplicate", () => duplicateLayer(i));
      mk("✕", "Delete", () => deleteLayer(i), state.layers.length < 2);

      list.appendChild(li);
    }
  }

  function moveLayer(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= state.layers.length) return;
    const [layer] = state.layers.splice(i, 1);
    state.layers.splice(j, 0, layer);
    state.active = j;
    refreshLayerUI();
    save();
  }

  function duplicateLayer(i) {
    const copy = JSON.parse(JSON.stringify(state.layers[i]));
    copy.id = Viz.newLayer().id;
    state.layers.splice(i + 1, 0, copy);
    state.active = i + 1;
    refreshLayerUI();
    save();
  }

  function deleteLayer(i) {
    if (state.layers.length < 2) return;
    state.layers.splice(i, 1);
    state.active = Viz.clamp(state.active > i ? state.active - 1 : state.active, 0, state.layers.length - 1);
    refreshLayerUI();
    save();
  }

  function addLayer() {
    const layer = Viz.applySceneDefaults(Viz.newLayer($("addScene").value));
    state.layers.push(layer);
    state.active = state.layers.length - 1;
    refreshLayerUI();
    save();
  }

  /* Controls declared by the active scene, rebuilt whenever it changes. */
  function buildSceneOpts() {
    const host = $("sceneOpts");
    host.innerHTML = "";
    const layer = L();
    const scene = layer && Viz.scenes[layer.scene];
    const options = (scene && scene.options) || [];
    $("sceneOptsHead").hidden = !options.length;
    if (!layer) return;

    options.forEach((o) => {
      if (layer.opts[o.key] === undefined) layer.opts[o.key] = o.def;

      if (o.type === "check") {
        const label = document.createElement("label");
        label.className = "check";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !!layer.opts[o.key];
        input.addEventListener("input", () => { layer.opts[o.key] = input.checked; save(); });
        const span = document.createElement("span");
        span.textContent = o.label;
        label.append(input, span);
        host.appendChild(label);
        return;
      }

      const label = document.createElement("label");
      label.className = "field" + (o.type === "range" ? " range" : "");
      const head = document.createElement("span");
      const title = document.createTextNode(o.label + " ");
      head.appendChild(title);
      label.appendChild(head);

      if (o.type === "select") {
        const sel = document.createElement("select");
        o.choices.forEach(([value, text]) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = text;
          sel.appendChild(opt);
        });
        sel.value = layer.opts[o.key];
        sel.addEventListener("input", () => { layer.opts[o.key] = sel.value; save(); });
        label.appendChild(sel);
      } else {
        const out = document.createElement("b");
        const fmt = FMT[o.fmt] || ((v) => Number(v).toFixed(2).replace(/\.00$/, ""));
        out.textContent = fmt(layer.opts[o.key]);
        head.appendChild(out);
        const input = document.createElement("input");
        input.type = "range";
        input.min = o.min; input.max = o.max; input.step = o.step;
        input.value = layer.opts[o.key];
        input.addEventListener("input", () => {
          layer.opts[o.key] = parseFloat(input.value);
          out.textContent = fmt(layer.opts[o.key]);
          save();
        });
        label.appendChild(input);
      }
      host.appendChild(label);
    });
  }

  function buildSceneSelects() {
    const keys = Object.keys(Viz.scenes);
    [["addScene", null], ["lscene", null]].forEach(([id]) => {
      const sel = $(id);
      sel.innerHTML = "";
      keys.forEach((k) => {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = Viz.scenes[k].name;
        sel.appendChild(o);
      });
    });

    $("addLayer").addEventListener("click", addLayer);
    $("lscene").addEventListener("input", () => {
      const layer = L();
      if (!layer) return;
      layer.scene = $("lscene").value;
      Viz.applySceneDefaults(layer);
      refreshLayerUI();
      save();
    });

    const grid = $("anchorGrid");
    Viz.ANCHORS.forEach(([title, x, y]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = title;
      /* Show where in the frame this button puts the layer. */
      const dot = document.createElement("span");
      dot.className = "anchor-dot";
      dot.style.left = (x * 100 - 17) + "%";
      dot.style.top = (y * 100 - 17) + "%";
      b.appendChild(dot);
      b.addEventListener("click", () => {
        const layer = L();
        if (!layer) return;
        layer.x = x;
        layer.y = y;
        /* A corner placement wants a smaller box than a full-frame one. */
        if (layer.w > 0.6 && layer.h > 0.6) { layer.w = 0.5; layer.h = 0.5; }
        refreshLayerUI();
        save();
      });
      grid.appendChild(b);
    });

    const blend = $("lblend");
    Viz.BLENDS.forEach(([value, text]) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = text;
      blend.appendChild(o);
    });
  }

  /* ---------- palette ---------- */

  function buildPalettePicker() {
    const sel = $("paletteSel");
    sel.innerHTML = "";
    Object.keys(Viz.palettes).forEach((key) => {
      const o = document.createElement("option");
      o.value = key;
      o.textContent = Viz.palettes[key].name;
      sel.appendChild(o);
    });

    const swatches = $("swatches");
    const inputs = [0, 1, 2].map((i) => {
      const c = document.createElement("input");
      c.type = "color";
      c.title = ["Low frequencies", "Mid frequencies", "High frequencies"][i];
      c.addEventListener("input", () => {
        const cur = (state.customColors || Viz.palettes[state.palette].colors).slice();
        cur[i] = c.value;
        state.customColors = cur;
        save();
      });
      swatches.appendChild(c);
      return c;
    });

    const paintSwatches = () => {
      const cols = state.customColors || Viz.palettes[state.palette].colors;
      inputs.forEach((c, i) => { c.value = cols[i]; });
      sel.value = state.palette;
    };

    sel.addEventListener("change", () => {
      state.palette = sel.value;
      state.customColors = null;
      paintSwatches();
      save();
    });

    syncFns.push(paintSwatches);
    paintSwatches();
  }

  /* ---------- images ---------- */

  function loadImageData(dataUrl, which) {
    if (!dataUrl) { renderer.setImage(which, null); return; }
    const img = new Image();
    img.onload = () => renderer.setImage(which, img);
    img.src = dataUrl;
  }

  function handleImageInput(input, labelEl, apply) {
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        apply(reader.result);
        labelEl.textContent = file.name;
        labelEl.parentElement.classList.add("loaded");
        /* Clear the input so picking the same file again still fires. */
        input.value = "";
        save();
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- transport ---------- */

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  async function togglePlay() {
    if (!engine.ready) return;
    if (engine.playing) engine.pause();
    else { try { await engine.play(); } catch (e) { console.warn(e); } }
    paintPlayButton();
  }

  function paintPlayButton() {
    $("playBtn").textContent = engine.playing ? "❚❚" : "▶";
    $("playBtn").setAttribute("aria-label", engine.playing ? "Pause" : "Play");
  }

  async function loadTrack(file) {
    try {
      await engine.load(file);
    } catch (e) {
      alert(e.message || "Could not load that file.");
      return;
    }
    $("audioFileLabel").textContent = file.name;
    $("audioFileLabel").parentElement.classList.add("loaded");
    $("dropzone").hidden = true;
    $("playBtn").disabled = false;
    $("seek").disabled = false;
    $("durTime").textContent = fmtTime(engine.duration);
    engine.setVolume(parseFloat($("volume").value));

    if (!state.overlay.title) {
      state.overlay.title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      $("ovTitle").value = state.overlay.title;
      save();
    }
    paintPlayButton();
  }

  /* ---------- recording ---------- */

  let recordingStopping = false;

  async function startRecording() {
    if (!engine.ready) { alert("Load a track first."); return; }
    if (!Viz.Recorder.supported) { alert("This browser cannot record canvas video. Chrome or Edge work best."); return; }

    engine.currentTime = 0;
    try { await engine.play(); } catch (e) { alert("Could not start playback."); return; }
    try { recorder.start(state.fps); } catch (e) { alert(e.message); return; }

    recordingStopping = false;
    $("recordBtn").classList.add("armed");
    $("recordLabel").textContent = "Stop & save";
    $("recBadge").hidden = false;
    $("recordHint").textContent = "Recording — leave this tab visible and in the foreground.";
    engine.el.addEventListener("ended", onTrackEnded);
    paintPlayButton();
  }

  function onTrackEnded() { stopRecording(); }

  async function stopRecording() {
    if (recordingStopping || !recorder.active) return;
    recordingStopping = true;
    engine.el.removeEventListener("ended", onTrackEnded);

    const blob = await recorder.stop();
    engine.pause();
    paintPlayButton();

    $("recordBtn").classList.remove("armed");
    $("recordLabel").textContent = "Record video";
    $("recBadge").hidden = true;
    $("recordHint").textContent = "Records in real time, from the start of the track.";

    if (!blob || !blob.size) {
      $("recordHint").textContent = "Recording produced no data — try again.";
      return;
    }

    const [w, h] = state.exportSize.split("x");
    const base = (state.overlay.title || "visualizer").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${base || "visualizer"}-${w}x${h}.${ext}`;
    a.textContent = `⬇ ${a.download} — ${(blob.size / 1048576).toFixed(1)} MB`;
    $("downloads").prepend(a);
  }

  /* ---------- wiring ---------- */

  function applyStateToEngineAndUI() {
    renderer.state = state;
    syncFns.forEach((fn) => fn());
    loadImageData(state.bg.imageData, "bg");
    loadImageData(state.overlay.logoData, "logo");
    paintImageLabels();
    updateBgFields();
    applyExportSize();
    refreshLayerUI();
  }

  function updateBgFields() {
    $("bgColorField").hidden = state.bg.mode !== "solid";
    $("bgImageOpts").hidden = state.bg.mode !== "image";
  }

  function paintImageLabel(labelEl, data, placeholder, loadedText) {
    labelEl.textContent = data ? loadedText : placeholder;
    labelEl.parentElement.classList.toggle("loaded", !!data);
  }

  function paintImageLabels() {
    paintImageLabel($("bgImageLabel"), state.bg.imageData, "Choose background image…", "Background image loaded");
    paintImageLabel($("ovLogoLabel"), state.overlay.logoData, "Choose cover art / logo…", "Artwork loaded");
  }

  function clearBgImage() {
    state.bg.imageData = null;
    renderer.setImage("bg", null);
    $("bgImage").value = "";
    if (state.bg.mode === "image") {
      state.bg.mode = "gradient";
      $("bgMode").value = "gradient";
    }
    paintImageLabels();
    updateBgFields();
    save();
  }

  function clearLogo() {
    state.overlay.logoData = null;
    renderer.setImage("logo", null);
    $("ovLogo").value = "";
    state.overlay.logoPos = "none";
    $("ovLogoPos").value = "none";
    paintImageLabels();
    save();
  }

  function applyExportSize() {
    const [w, h] = state.exportSize.split("x").map(Number);
    renderer.setSize(w, h);
  }

  function bindAll() {
    /* Layer placement. Getters read whichever layer is selected, so the
       same controls serve every layer. */
    const lset = (key) => (v) => { const l = L(); if (l) l[key] = v; };
    const lget = (key, fallback) => () => { const l = L(); return l ? l[key] : fallback; };

    bind("lscene", lget("scene", "bars"), lset("scene"));
    bind("lx", lget("x", 0.5), lset("x"), { label: "vLx", fmt: pct });
    bind("ly", lget("y", 0.5), lset("y"), { label: "vLy", fmt: pct });
    bind("lw", lget("w", 1), (v) => {
      const l = L();
      if (!l) return;
      if ($("lLock").checked && l.w) l.h = Viz.clamp(l.h * (v / l.w), 0.05, 2);
      l.w = v;
      syncFns.forEach((f) => f());
    }, { label: "vLw", fmt: pct });
    bind("lh", lget("h", 1), (v) => {
      const l = L();
      if (!l) return;
      if ($("lLock").checked && l.h) l.w = Viz.clamp(l.w * (v / l.h), 0.05, 2);
      l.h = v;
      syncFns.forEach((f) => f());
    }, { label: "vLh", fmt: pct });
    bind("lrot", lget("rot", 0), lset("rot"), { label: "vLrot", fmt: deg });
    bind("lop", lget("opacity", 1), lset("opacity"), { label: "vLop", fmt: pct });
    bind("lblend", lget("blend", "source-over"), lset("blend"));

    const pset = (key) => (v) => { const l = L(); if (l) l.params[key] = v; };
    const pget = (key, fallback) => () => { const l = L(); return l ? l.params[key] : fallback; };

    bind("pCount", pget("count", 96), (v) => pset("count")(Math.round(v)), { label: "vCount", fmt: (v) => Math.round(v) });
    bind("pThickness", pget("thickness", 0.6), pset("thickness"), { label: "vThickness", fmt: pct });
    bind("pGlow", pget("glow", 0.5), pset("glow"), { label: "vGlow", fmt: pct });
    bind("pSpin", pget("spin", 0.1), pset("spin"), { label: "vSpin", fmt: (v) => Number(v).toFixed(2) });
    bind("pMirror", pget("mirror", true), pset("mirror"));

    bind("gTrail", () => state.trail, (v) => (state.trail = v), { label: "vTrail", fmt: pct });

    bind("rSens", () => state.react.sensitivity, (v) => (state.react.sensitivity = v), { label: "vSens", fmt: mult });
    bind("rSmooth", () => state.react.smoothing, (v) => (state.react.smoothing = v), { label: "vSmooth", fmt: pct });
    bind("rBass", () => state.react.bassBoost, (v) => (state.react.bassBoost = v), { label: "vBass", fmt: mult });
    bind("rBeat", () => state.react.beatSens, (v) => (state.react.beatSens = v), { label: "vBeat", fmt: (v) => Number(v).toFixed(2) });

    bind("bgMode", () => state.bg.mode, (v) => (state.bg.mode = v), { after: updateBgFields });
    bind("bgColor", () => state.bg.color, (v) => (state.bg.color = v));
    bind("bgFit", () => state.bg.fit, (v) => (state.bg.fit = v));
    bind("bgZoom", () => state.bg.zoom, (v) => (state.bg.zoom = v), { label: "vBgZoom", fmt: mult });
    bind("bgDim", () => state.bg.dim, (v) => (state.bg.dim = v), { label: "vBgDim", fmt: pct });
    bind("bgBlur", () => state.bg.blur, (v) => (state.bg.blur = v), { label: "vBgBlur", fmt: (v) => Math.round(v) + "px" });
    bind("bgPulse", () => state.bg.pulse, (v) => (state.bg.pulse = v));
    bind("bgVignette", () => state.bg.vignette, (v) => (state.bg.vignette = v), { label: "vVignette", fmt: pct });
    bind("bgGrain", () => state.bg.grain, (v) => (state.bg.grain = v), { label: "vGrain", fmt: pct });

    bind("ovShow", () => state.overlay.showText, (v) => (state.overlay.showText = v));
    bind("ovTitle", () => state.overlay.title, (v) => (state.overlay.title = v));
    bind("ovArtist", () => state.overlay.artist, (v) => (state.overlay.artist = v));
    bind("ovPos", () => state.overlay.pos, (v) => (state.overlay.pos = v));
    bind("ovSize", () => state.overlay.size, (v) => (state.overlay.size = v), { label: "vOvSize", fmt: mult });
    bind("ovLogoPos", () => state.overlay.logoPos, (v) => (state.overlay.logoPos = v));
    bind("ovLogoSize", () => state.overlay.logoSize, (v) => (state.overlay.logoSize = v), { label: "vLogoSize", fmt: pct });
    bind("ovLogoPulse", () => state.overlay.logoPulse, (v) => (state.overlay.logoPulse = v));

    bind("exSize", () => state.exportSize, (v) => (state.exportSize = v), { after: applyExportSize });
    bind("exFps", () => String(state.fps), (v) => (state.fps = Number(v)));
  }

  function bindPanels() {
    document.querySelectorAll(".panel-head").forEach((head) => {
      head.addEventListener("click", () => {
        const panel = head.parentElement;
        panel.dataset.open = panel.dataset.open === "true" ? "false" : "true";
      });
    });
  }

  function bindPresets() {
    const listEl = $("presetList");

    const refresh = () => {
      const presets = getPresets();
      listEl.innerHTML = "";
      const names = Object.keys(presets);
      if (!names.length) {
        const o = document.createElement("option");
        o.textContent = "No saved presets";
        o.value = "";
        listEl.appendChild(o);
        return;
      }
      names.forEach((n) => {
        const o = document.createElement("option");
        o.value = o.textContent = n;
        listEl.appendChild(o);
      });
    };

    $("presetSave").addEventListener("click", () => {
      const name = $("presetName").value.trim();
      if (!name) { alert("Give the preset a name first."); return; }
      const presets = getPresets();
      /* Track title and artist belong to the song, not the look. */
      const snapshot = JSON.parse(JSON.stringify(state));
      snapshot.overlay.title = "";
      snapshot.overlay.artist = "";
      presets[name] = snapshot;
      setPresets(presets);
      refresh();
      listEl.value = name;
    });

    $("presetLoad").addEventListener("click", () => {
      const presets = getPresets();
      const chosen = presets[listEl.value];
      if (!chosen) return;
      const title = state.overlay.title, artist = state.overlay.artist;
      state = normalise(JSON.parse(JSON.stringify(chosen)));
      state.overlay.title = title;
      state.overlay.artist = artist;
      applyStateToEngineAndUI();
      save();
    });

    $("presetDelete").addEventListener("click", () => {
      const presets = getPresets();
      if (!presets[listEl.value]) return;
      delete presets[listEl.value];
      setPresets(presets);
      refresh();
    });

    $("presetReset").addEventListener("click", () => {
      const title = state.overlay.title, artist = state.overlay.artist;
      state = defaults();
      state.overlay.title = title;
      state.overlay.artist = artist;
      renderer.setImage("bg", null);
      renderer.setImage("logo", null);
      applyStateToEngineAndUI();
      save();
    });

    refresh();
  }

  function bindTransport() {
    $("playBtn").addEventListener("click", togglePlay);
    engine.el.addEventListener("play", paintPlayButton);
    engine.el.addEventListener("pause", paintPlayButton);
    engine.el.addEventListener("ended", paintPlayButton);

    const seek = $("seek");
    seek.addEventListener("input", () => { seeking = true; });
    seek.addEventListener("change", () => {
      if (engine.duration) engine.currentTime = (seek.value / 1000) * engine.duration;
      seeking = false;
    });

    $("volume").addEventListener("input", (e) => engine.setVolume(parseFloat(e.target.value)));

    $("fullBtn").addEventListener("click", () => {
      const el = $("stageInner");
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
    });

    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.key === "f" || e.key === "F") $("fullBtn").click();
    });
  }

  function bindFiles() {
    $("audioFile").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) loadTrack(file);
    });

    const stage = $("stageInner");
    ["dragenter", "dragover"].forEach((ev) =>
      stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add("dragging"); }));
    ["dragleave", "drop"].forEach((ev) =>
      stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.remove("dragging"); }));
    stage.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      if (file.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(file.name)) loadTrack(file);
      else alert("That does not look like an audio file.");
    });

    handleImageInput($("bgImage"), $("bgImageLabel"), (data) => {
      state.bg.imageData = data;
      loadImageData(data, "bg");
      /* Picking an image is the whole intent, so switch the mode too rather
         than leaving it inert behind the dropdown. */
      if (state.bg.mode !== "image") {
        state.bg.mode = "image";
        $("bgMode").value = "image";
        updateBgFields();
      }
    });
    handleImageInput($("ovLogo"), $("ovLogoLabel"), (data) => {
      state.overlay.logoData = data;
      loadImageData(data, "logo");
      if (state.overlay.logoPos === "none") {
        state.overlay.logoPos = "center";
        $("ovLogoPos").value = "center";
      }
    });
    $("bgImageClear").addEventListener("click", clearBgImage);
    $("ovLogoClear").addEventListener("click", clearLogo);

    $("recordBtn").addEventListener("click", () => {
      if (recorder.active) stopRecording();
      else startRecording();
    });
  }

  /* ---------- per-frame UI updates ---------- */

  let lastUiUpdate = 0;
  renderer.onFrame = () => {
    const now = performance.now();
    if (now - lastUiUpdate < 100) return;
    lastUiUpdate = now;

    if (engine.ready && !seeking) {
      const d = engine.duration;
      $("curTime").textContent = fmtTime(engine.currentTime);
      $("durTime").textContent = fmtTime(d);
      $("seek").value = d ? Math.round((engine.currentTime / d) * 1000) : 0;
    }
    if (recorder.active) $("recTime").textContent = fmtTime(recorder.elapsed);
  };

  /* ---------- boot ---------- */

  loadSaved();
  renderer.state = state;
  buildSceneSelects();
  buildPalettePicker();
  bindAll();
  bindPanels();
  bindPresets();
  bindTransport();
  bindFiles();
  applyStateToEngineAndUI();
  renderer.start();

  if (!Viz.Recorder.supported) {
    $("recordBtn").disabled = true;
    $("recordHint").textContent = "Video recording needs Chrome, Edge or another browser with MediaRecorder canvas support.";
  }
})();
