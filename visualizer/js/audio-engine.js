/* Audio playback + analysis.
   Graph: <audio> -> analyser -> monitorGain -> speakers
                              -> streamDest  -> MediaRecorder
   Monitor volume is tapped after the analyser, so turning your speakers
   down while recording does not change the level in the exported file. */
window.Viz = window.Viz || {};

Viz.AudioEngine = class {
  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.crossOrigin = "anonymous";
    this.ctx = null;
    this.analyser = null;
    this.streamDest = null;
    this.objectUrl = null;
    this.ready = false;

    this.bands = new Float32Array(0);
    this.bassHistory = [];
    this.framesSinceBeat = 99;
    this.beatEnv = 0;
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0;
    this.beat = false;
  }

  /* Build the audio graph. Must happen after a user gesture on some browsers. */
  _ensureGraph() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.source = this.ctx.createMediaElementSource(this.el);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.72;
    this.monitorGain = this.ctx.createGain();
    this.streamDest = this.ctx.createMediaStreamDestination();

    this.source.connect(this.analyser);
    this.analyser.connect(this.monitorGain);
    this.monitorGain.connect(this.ctx.destination);
    this.analyser.connect(this.streamDest);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
  }

  async load(file) {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.el.src = this.objectUrl;
    this._ensureGraph();
    await new Promise((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(new Error("Could not decode that audio file.")); };
      const cleanup = () => {
        this.el.removeEventListener("loadedmetadata", ok);
        this.el.removeEventListener("error", bad);
      };
      this.el.addEventListener("loadedmetadata", ok);
      this.el.addEventListener("error", bad);
    });
    this.ready = true;
  }

  async play() {
    this._ensureGraph();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    await this.el.play();
  }

  pause() { this.el.pause(); }
  get playing() { return !this.el.paused && !this.el.ended; }
  get duration() { return isFinite(this.el.duration) ? this.el.duration : 0; }
  get currentTime() { return this.el.currentTime; }
  set currentTime(t) { this.el.currentTime = t; }
  setVolume(v) { if (this.monitorGain) this.monitorGain.gain.value = v; }

  /* Frequency index for a given frequency in Hz. */
  _bin(hz) {
    const nyquist = this.ctx.sampleRate / 2;
    return Math.min(this.freqData.length - 1, Math.max(0, Math.round((hz / nyquist) * this.freqData.length)));
  }

  _avgRange(loHz, hiHz) {
    const a = this._bin(loHz), b = Math.max(this._bin(hiHz), a + 1);
    let sum = 0;
    for (let i = a; i < b; i++) sum += this.freqData[i];
    return sum / (b - a) / 255;
  }

  /* Pull one frame of analysis. `react` carries the user's reactivity settings. */
  frame(count, react) {
    const out = {
      bands: this.bands, wave: this.timeData,
      bass: 0, mid: 0, treble: 0, energy: 0, beat: false, beatEnv: this.beatEnv
    };
    if (!this.analyser) return out;

    this.analyser.smoothingTimeConstant = Math.min(0.92, 0.55 + react.smoothing * 0.4);
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    if (this.bands.length !== count) this.bands = new Float32Array(count);

    /* Log-spaced bands: linear FFT bins crowd everything musical into the
       left-hand few percent of the display, which looks dead. */
    const fMin = 30, fMax = 16000, ratio = fMax / fMin;
    const attack = 1 - react.smoothing * 0.6;
    const release = 0.02 + (1 - react.smoothing) * 0.4;

    for (let i = 0; i < count; i++) {
      const f0 = fMin * Math.pow(ratio, i / count);
      const f1 = fMin * Math.pow(ratio, (i + 1) / count);
      const b0 = this._bin(f0);
      const b1 = Math.max(this._bin(f1), b0 + 1);
      let peak = 0;
      for (let b = b0; b < b1; b++) if (this.freqData[b] > peak) peak = this.freqData[b];

      /* Tilt: highs carry far less energy than lows, so lift them to keep
         the top of the spectrum visible. */
      const tilt = 1 + 1.1 * (i / count);
      let v = (peak / 255) * tilt * react.sensitivity;
      if (i < count * 0.18) v *= react.bassBoost;
      v = Math.max(0, Math.min(1, v));

      const prev = this.bands[i];
      this.bands[i] = v > prev ? prev + (v - prev) * attack : prev + (v - prev) * release;
    }

    out.bass = Math.min(1, this._avgRange(20, 160) * react.bassBoost * react.sensitivity);
    out.mid = Math.min(1, this._avgRange(160, 2000) * react.sensitivity);
    out.treble = Math.min(1, this._avgRange(2000, 10000) * 1.6 * react.sensitivity);
    out.energy = (out.bass + out.mid + out.treble) / 3;

    /* Beat: bass energy spiking above its own recent average. */
    this.bassHistory.push(out.bass);
    if (this.bassHistory.length > 43) this.bassHistory.shift();
    const avg = this.bassHistory.reduce((s, v) => s + v, 0) / this.bassHistory.length;
    this.framesSinceBeat++;
    if (this.playing && out.bass > avg * react.beatSens && out.bass > 0.12 && this.framesSinceBeat > 7) {
      out.beat = true;
      this.framesSinceBeat = 0;
      this.beatEnv = 1;
    }
    this.beatEnv *= 0.90;
    out.beatEnv = this.beatEnv;
    out.bands = this.bands;
    return out;
  }
};
