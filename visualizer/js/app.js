/* Wires the UI to the audio engine, renderer and recorder. */
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE_STATE = "viz.state.v1";
  const STORE_PRESETS = "viz.presets.v1";

  const defaults = () => ({
    scene: "bars",
    palette: "ember",
    customColors: null,
    params: { count: 96, thickness: 0.6, trail: 0.25, glow: 0.5, rotate: 0.1, mirror: true },
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

  /* ---------- persistence ---------- */

  function save() {
    try { localStorage.setItem(STORE_STATE, JSON.stringify(state)); } catch (e) { /* quota: skip */ }
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORE_STATE);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const base = defaults();
      state = Object.assign(base, saved, {
        params: Object.assign(base.params, saved.params),
        react: Object.assign(base.react, saved.react),
        bg: Object.assign(base.bg, saved.bg),
        overlay: Object.assign(base.overlay, saved.overlay)
      });
    } catch (e) { state = defaults(); }
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
      if (isCheck) el.checked = v; else el.value = v;
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

  /* ---------- scene + palette pickers ---------- */

  function buildScenePicker() {
    const grid = $("sceneGrid");
    grid.innerHTML = "";
    Object.keys(Viz.scenes).forEach((key) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scene-btn";
      b.textContent = Viz.scenes[key].name;
      b.setAttribute("aria-pressed", String(state.scene === key));
      b.addEventListener("click", () => {
        state.scene = key;
        grid.querySelectorAll(".scene-btn").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        save();
      });
      grid.appendChild(b);
    });
    syncFns.push(() => {
      grid.querySelectorAll(".scene-btn").forEach((b, i) => {
        b.setAttribute("aria-pressed", String(Object.keys(Viz.scenes)[i] === state.scene));
      });
    });
  }

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
    if (engine.playing) {
      engine.pause();
    } else {
      try { await engine.play(); } catch (e) { console.warn(e); }
    }
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

    /* Offer the filename as a title if the field is still empty. */
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
    syncFns.forEach((fn) => fn());
    loadImageData(state.bg.imageData, "bg");
    loadImageData(state.overlay.logoData, "logo");
    paintImageLabels();
    updateBgFields();
    applyExportSize();
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
    /* An image background with no image would render as flat black. */
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
    bind("pCount", () => state.params.count, (v) => (state.params.count = Math.round(v)), { label: "vCount", fmt: (v) => Math.round(v) });
    bind("pThickness", () => state.params.thickness, (v) => (state.params.thickness = v), { label: "vThickness", fmt: pct });
    bind("pTrail", () => state.params.trail, (v) => (state.params.trail = v), { label: "vTrail", fmt: pct });
    bind("pGlow", () => state.params.glow, (v) => (state.params.glow = v), { label: "vGlow", fmt: pct });
    bind("pRotate", () => state.params.rotate, (v) => (state.params.rotate = v), { label: "vRotate", fmt: (v) => v.toFixed(2) });
    bind("pMirror", () => state.params.mirror, (v) => (state.params.mirror = v));

    bind("rSens", () => state.react.sensitivity, (v) => (state.react.sensitivity = v), { label: "vSens", fmt: (v) => v.toFixed(2) + "×" });
    bind("rSmooth", () => state.react.smoothing, (v) => (state.react.smoothing = v), { label: "vSmooth", fmt: pct });
    bind("rBass", () => state.react.bassBoost, (v) => (state.react.bassBoost = v), { label: "vBass", fmt: (v) => v.toFixed(2) + "×" });
    bind("rBeat", () => state.react.beatSens, (v) => (state.react.beatSens = v), { label: "vBeat", fmt: (v) => v.toFixed(2) });

    bind("bgMode", () => state.bg.mode, (v) => (state.bg.mode = v), { after: updateBgFields });
    bind("bgColor", () => state.bg.color, (v) => (state.bg.color = v));
    bind("bgFit", () => state.bg.fit, (v) => (state.bg.fit = v));
    bind("bgZoom", () => state.bg.zoom, (v) => (state.bg.zoom = v), { label: "vBgZoom", fmt: (v) => v.toFixed(2) + "×" });
    bind("bgDim", () => state.bg.dim, (v) => (state.bg.dim = v), { label: "vBgDim", fmt: pct });
    bind("bgBlur", () => state.bg.blur, (v) => (state.bg.blur = v), { label: "vBgBlur", fmt: (v) => Math.round(v) + "px" });
    bind("bgPulse", () => state.bg.pulse, (v) => (state.bg.pulse = v));
    bind("bgVignette", () => state.bg.vignette, (v) => (state.bg.vignette = v), { label: "vVignette", fmt: pct });
    bind("bgGrain", () => state.bg.grain, (v) => (state.bg.grain = v), { label: "vGrain", fmt: pct });

    bind("ovShow", () => state.overlay.showText, (v) => (state.overlay.showText = v));
    bind("ovTitle", () => state.overlay.title, (v) => (state.overlay.title = v));
    bind("ovArtist", () => state.overlay.artist, (v) => (state.overlay.artist = v));
    bind("ovPos", () => state.overlay.pos, (v) => (state.overlay.pos = v));
    bind("ovSize", () => state.overlay.size, (v) => (state.overlay.size = v), { label: "vOvSize", fmt: (v) => v.toFixed(2) + "×" });
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
      /* Track title/artist belong to the song, not the look. */
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
      Object.assign(state, JSON.parse(JSON.stringify(chosen)));
      state.overlay.title = title;
      state.overlay.artist = artist;
      renderer.state = state;
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
      Object.assign(state, defaults());
      state.overlay.title = title;
      state.overlay.artist = artist;
      renderer.state = state;
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
         than leaving it silently inert behind the dropdown. */
      if (state.bg.mode !== "image") {
        state.bg.mode = "image";
        $("bgMode").value = "image";
        updateBgFields();
      }
    });
    $("bgImageClear").addEventListener("click", clearBgImage);
    $("ovLogoClear").addEventListener("click", clearLogo);
    handleImageInput($("ovLogo"), $("ovLogoLabel"), (data) => {
      state.overlay.logoData = data;
      loadImageData(data, "logo");
      if (state.overlay.logoPos === "none") {
        state.overlay.logoPos = "center";
        $("ovLogoPos").value = "center";
      }
    });

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
  buildScenePicker();
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
