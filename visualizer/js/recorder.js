/* Records the visible canvas together with the track's audio into a single
   WebM file. Capture is real time: a four-minute song takes four minutes. */
window.Viz = window.Viz || {};

Viz.Recorder = class {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.engine = engine;
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;
  }

  static get supported() {
    return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
  }

  static pickMime() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
      "video/mp4"
    ];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) || "";
  }

  start(fps) {
    if (!Viz.Recorder.supported) throw new Error("This browser cannot record canvas video.");
    if (!this.engine.streamDest) throw new Error("Load a track before recording.");

    const video = this.canvas.captureStream(fps);
    const audio = this.engine.streamDest.stream;
    this.stream = new MediaStream([...video.getVideoTracks(), ...audio.getAudioTracks()]);

    const mimeType = Viz.Recorder.pickMime();
    /* ~12 Mbps keeps gradients and glow from banding at 1080p. */
    const opts = { videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 256_000 };
    if (mimeType) opts.mimeType = mimeType;

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, opts);
    this.mimeType = mimeType || "video/webm";
    this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.recorder.start(1000);
    this.startedAt = performance.now();
  }

  get elapsed() {
    return this.recorder ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  get active() {
    return !!this.recorder && this.recorder.state === "recording";
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(null);
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.chunks = [];
        this.recorder = null;
        if (this.stream) this.stream.getVideoTracks().forEach(t => t.stop());
        resolve(blob);
      };
      this.recorder.stop();
    });
  }
};
