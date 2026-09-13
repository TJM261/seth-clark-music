# seth-clark-music

- `.htaccess` — 301 redirect from `sethclarkmusic.com` to `sethpeterclarkmusic.com`.
- `visualizer/` — [Visualizer Studio](visualizer/README.md), a browser-based
  music visualizer that records reactive video for a track. Open
  `visualizer/index.html` to use it.

Note: the redirect at the repo root sends every path on `sethclarkmusic.com`
to the other domain, so the visualizer is not reachable there if this repo is
deployed on that host. It runs fine locally and on any other static host.
