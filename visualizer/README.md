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

## Layers

A composition is a stack of layers, each one a scene with its own placement.
Add as many as you like — four bar layers facing different edges, two ring
layers at opposite corners, a wave laid diagonally over a radial. Layers draw
bottom-up, so the top row of the list sits in front.

Each row has: **👁** show/hide, **↑ ↓** reorder, **⧉** duplicate, **✕** delete.
Click a layer's name to edit it.

**Placement** applies to every scene, so anything can go anywhere:

- The **3×3 grid** drops the layer into a corner, edge or the centre in one
  click. Coming from full frame, it also halves the size to suit a corner.
- **Horizontal / Vertical** place the layer's centre. The range runs past the
  edges, so a layer can sit half off-frame.
- **Width / Height** size it, up to twice the frame. **Lock** keeps the
  aspect ratio while you drag either one.
- **Rotation** turns it freely — a wave at 45°, bars raking diagonally.
- **Opacity** and **Blend** (Add, Screen, Overlay, Multiply, Difference)
  control how it sits over the layers beneath. Add and Screen are the ones
  that make overlapping glows build rather than occlude.

Placement is stored as a fraction of the frame, so a composition laid out in
16:9 keeps its proportions when you switch the export to 9:16.

Each layer carries its own **Detail**, **Thickness**, **Glow**, **Spin** and
**Mirror**, plus whatever options its scene declares.

**Motion trail** lives under **Look**, not on the layer — it smears the whole
field at once, so it applies to the composition as a whole.

## Scenes

| Scene | What it does | Its own options |
| --- | --- | --- |
| **Bars** | Log-spaced frequency spectrum. | Direction (up, down, left, right), baseline at the edge or centred, reflection |
| **Radial** | Spectrum wrapped around a pulsing ring. | Arc (a full circle or a fan), start angle, inner radius, centre ring |
| **Wave** | Oscilloscope traces of the waveform. | Straight line or looped circle, number of traces, amplitude |
| **Particles** | A field thrown out from an emitter. | Emit from centre or any edge, direction (away, inward, fixed angle), spread, speed, emitter size |
| **Rings** | Spectrum-deformed blob shedding ripples on the beat. | Blob and ripples independently, ripple speed, base size |
| **Frame** | Spectrum along every edge at once. | All four sides or one pair, facing in or out, inset, reach |

**Frame** is the quickest way to get the edges moving on all sides. For finer
control use four **Bars** layers, one per direction.

Shared reactivity controls (under **Reactivity**) apply to every layer:

- **Sensitivity** / **Bass boost** — how hard the visuals react. Turn these
  down for loud masters, up for quiet or sparse material.
- **Smoothing** — low is twitchy and percussive, high is fluid.
- **Beat sensitivity** — lower catches more beats, higher only the hardest hits.

Bands are spaced logarithmically between 30 Hz and 16 kHz, with a tilt that
lifts the high end. Linear FFT bins would crowd everything musical into the
left few percent of the screen. Layers set to the same **Detail** share one
computed spectrum, so adding layers costs drawing time, not analysis.

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
`<script>` tag for it in `index.html`. It appears in the scene lists
automatically, and its `options` become controls in the layer editor.

```js
Viz.scenes.myScene = {
  name: "My Scene",
  options: [
    { key: "mode", label: "Mode", type: "select", def: "a",
      choices: [["a", "First"], ["b", "Second"]] },
    { key: "size", label: "Size", type: "range", def: 0.5,
      min: 0, max: 1, step: 0.01, fmt: "pct" },   // fmt: pct | deg | x
    { key: "glowy", label: "Extra glow", type: "check", def: true }
  ],
  draw(ctx, w, h, a, s, t, dt) {
    // w, h      THIS LAYER's box. Position, rotation and scale are already
    //           applied, so always draw as if you own the whole box.
    // a.bands   Float32Array, 0..1, low -> high frequency
    // a.wave    raw time-domain samples
    // a.bass / a.mid / a.treble / a.energy   0..1
    // a.beat    true on the frame a beat lands
    // a.beatEnv 1 -> 0 decay after each beat, good for pulses
    // s.colors  three palette colours
    // s.params  shared per-layer controls (count, thickness, glow, spin, mirror)
    // s.opts    this scene's declared options
    // s.store   scratch space private to this layer — keep particle pools and
    //           other persistent state here, never on the scene object, or two
    //           layers of the same scene will fight over it
    // s.scale   size factor vs 1080p, for resolution-independent widths
  }
};
```

Layers draw onto an offscreen canvas so motion trails smear only the
visuals — text and artwork stay crisp on top.

## Shortcuts

- `Space` — play / pause
- `F` — fullscreen
