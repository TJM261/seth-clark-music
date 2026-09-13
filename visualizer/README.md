# Visualizer Studio

A browser-based music visualizer. Drop in a track, shape the look while it
plays, then record the canvas and the audio together into a video file.

Everything runs locally in the browser — no upload, no server, no build step,
no dependencies. Your audio never leaves your computer.

## Running it

Double-click `index.html`, or open it in a browser. That's it.

If you'd rather serve it (needed if you later add ES modules or fetch data):

```sh
cd visualizer
python3 -m http.server 8000   # then open http://localhost:8000
```

Chrome or Edge are the best choice — Safari and Firefox can play and preview
fine, but their canvas recording support is patchier.

## Making a video

1. Drag an audio file onto the stage (MP3, WAV, FLAC, M4A, OGG).
2. Pick a scene and dial in the look. Everything updates live while playing.
3. Type the title and artist, and add cover art if you want it on screen.
4. Under **Export**, choose a format — 16:9 for YouTube, 9:16 for Reels and
   Stories, 1:1 or 4:5 for feed posts.
5. Hit **Record video**. Playback restarts from zero and recording runs in
   real time, so a four-minute track takes four minutes.
6. It stops itself at the end of the track (or click **Stop & save**). The
   finished file appears as a download link under the button.

**Keep the tab visible and in the foreground while recording.** Browsers
throttle animation in background tabs, which drops frames in the capture.

### About the exported file

You get a `.webm` (VP9 video + Opus audio). YouTube accepts this directly.
Instagram and most editors want MP4, and WebM from a browser recorder carries
no duration header, which makes some editors scrub badly. Both are fixed by
one conversion:

```sh
ffmpeg -i visualizer.webm -c:v libx264 -crf 18 -preset slow \
       -pix_fmt yuv420p -c:a aac -b:a 320k visualizer.mp4
```

Monitor volume is tapped *after* the analyser, so you can turn your speakers
down — or all the way off — while recording without changing the level in the
exported file.

## Scenes

| Scene | What it does |
| --- | --- |
| **Bars** | Log-spaced frequency spectrum, along the bottom or mirrored around the centre. |
| **Radial** | The spectrum wrapped around a ring that pulses with the low end. |
| **Wave** | Layered oscilloscope traces of the actual waveform. |
| **Particles** | A field pushed out from the centre, with bursts fired on each beat. |
| **Rings** | A spectrum-deformed blob shedding ripple rings on the beat. |

Every scene reads the same controls, so the same settings carry across:

- **Detail** — number of frequency bands (or particle density).
- **Thickness**, **Glow**, **Motion trail**, **Rotation**, **Mirror**.
- **Sensitivity** / **Bass boost** — how hard the visuals react. Turn these
  down for loud masters, up for quiet or sparse material.
- **Smoothing** — low is twitchy and percussive, high is fluid.
- **Beat sensitivity** — lower catches more beats, higher only the hardest hits.

Bands are spaced logarithmically between 30 Hz and 16 kHz, with a tilt that
lifts the high end. Linear FFT bins would crowd everything musical into the
left few percent of the screen.

## Backgrounds

Pick a background image and it fills the frame edge to edge — scenes, text
and artwork all layer on top of it. Choosing a file switches the background
mode for you; the **✕** next to the picker removes the image and drops back
to the palette gradient.

| Fit | What it does |
| --- | --- |
| **Fill frame** | Scales until the frame is covered, cropping the overflow. The default, and what you want almost always. |
| **Full width** | Matches the image width to the frame width. For a 16:9 image in a 16:9 export this is identical to Fill frame; in a vertical export it letterboxes above and below. |
| **Fit whole image** | Shows the entire image, letterboxing whatever is left over. |
| **Stretch** | Forces the image to the frame exactly, distorting the aspect ratio. |

A 16:9 image in a 16:9 export fills the frame exactly under every fit mode.
The modes only diverge when the image and the export shape disagree — most
obviously exporting a 16:9 photo to a 9:16 reel, where **Fill frame** crops
the sides and **Fit whole image** letterboxes instead.

- **Zoom** pushes in past the fit, for cropping tighter or hiding an edge.
- **Dim** darkens the image so the visuals stay readable on top. Photos
  usually need 30–60%; the default is 30%.
- **Blur** softens it into a wash. It overscans slightly so no dark halo
  creeps in at the edges.
- **Pulse background on beat** nudges a slow zoom on each beat.

The scaled, dimmed and blurred image is composed once and cached, so none of
these cost anything per frame — they won't drop frames in a recording. It's
recomposed only when you change a setting or the export size.

Artwork (under **Overlay**) is a separate thing: a square cover-art badge
placed in the frame, not a background. Its **✕** removes it too.

## Presets

**Save** stores the current look under a name in your browser. Title and
artist are deliberately left out, so one preset works across a whole release.
Settings also autosave, so reopening the page brings back where you left off.

Presets live in `localStorage`, which means they're per-browser and not
backed up. Background and artwork images are stored inline, so a couple of
large images can fill the quota — the app will tell you if a save fails.

## Layout

```
visualizer/
├── index.html            markup for the whole UI
├── css/style.css
└── js/
    ├── util.js           drawing and maths helpers
    ├── palettes.js       colour palettes + ramp interpolation
    ├── audio-engine.js   playback, FFT, band mapping, beat detection
    ├── renderer.js       background, trails, overlays, the frame loop
    ├── recorder.js       canvas + audio -> WebM
    ├── app.js            UI wiring, presets, persistence
    └── scenes/           one file per scene
```

### Adding a scene

Drop a file in `js/scenes/`, register it on `Viz.scenes`, and add a
`<script>` tag for it in `index.html`. It shows up in the scene picker
automatically.

```js
Viz.scenes.myScene = {
  name: "My Scene",
  reset() { /* optional: called on scene change or resize */ },
  draw(ctx, w, h, a, s, t, dt) {
    // a.bands   Float32Array, 0..1, low -> high frequency
    // a.wave    raw time-domain samples
    // a.bass / a.mid / a.treble / a.energy   0..1
    // a.beat    true on the frame a beat lands
    // a.beatEnv 1 -> 0 decay after each beat, good for pulses
    // s.colors  three palette colours; s.params  the shared controls
    // s.scale   size factor vs 1080p, for resolution-independent widths
  }
};
```

Scenes draw onto an offscreen canvas so motion trails smear only the
visuals — text and artwork stay crisp on top.

## Shortcuts

- `Space` — play / pause
- `F` — fullscreen
