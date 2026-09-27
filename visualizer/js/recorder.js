/* Records the visible canvas together with the track's audio.
   Capture is real time: a four-minute song takes four minutes. */
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
    return typeof MediaRecorder !== "undefined" &&
      typeof HTMLCanvasElement.prototype.captureStream === "function";
  }

  /* MP4 must be gated on an explicit H.264 codec string. Chrome answers
     isTypeSupported("video/mp4") with true even where it can only put VP9
     inside the container — a file that plays in a browser but that most
     editors and phones refuse to open. Better to offer WebM than to hand
     back an .mp4 that is not really one. */
  static mp4Mime() {
    if (!Viz.Recorder.supported) return null;
    const candidates = [
      'video/mp4;codecs="avc1.4d002a,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      "video/mp4;codecs=avc1.4d002a,mp4a.40.2",
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4;codecs=h264,aac"
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  }

  static webmMime() {
    if (!Viz.Recorder.supported) return null;
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  }

  static mimeFor(format) {
    return format === "mp4" ? Viz.Recorder.mp4Mime() : Viz.Recorder.webmMime();
  }

  start(fps, format) {
    if (!Viz.Recorder.supported) throw new Error("This browser cannot record canvas video.");
    if (!this.engine.streamDest) throw new Error("Load a track before recording.");

    const mimeType = Viz.Recorder.mimeFor(format);
    if (format === "mp4" && !mimeType) {
      throw new Error("This browser cannot record H.264 MP4. Record WebM instead and convert it.");
    }

    const video = this.canvas.captureStream(fps);
    const audio = this.engine.streamDest.stream;
    this.stream = new MediaStream([...video.getVideoTracks(), ...audio.getAudioTracks()]);

    /* ~12 Mbps keeps gradients and glow from banding at 1080p. */
    const opts = { videoBitsPerSecond: 12000000, audioBitsPerSecond: 256000 };
    if (mimeType) opts.mimeType = mimeType;

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, opts);
    this.mimeType = this.recorder.mimeType || mimeType || "video/webm";
    this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.recorder.start(1000);
    this.startedAt = performance.now();
  }

  /* The extension the produced file should actually carry. */
  get extension() {
    return (this.mimeType || "").includes("mp4") ? "mp4" : "webm";
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
        if (this.stream) this.stream.getVideoTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      this.recorder.stop();
    });
  }
};
