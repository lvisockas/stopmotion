# Stop-motion carousel

A browser-only editor for animated Instagram carousel videos in a stop-motion
style. Screenshots drop onto a paper "table" one by one, land with a slight
tilt, a soft shadow and a small settle, and the whole scene shifts a hair
between shots, the way hand-placed objects do. Everything runs in the page,
including video encoding. There is no backend.

Output per slide: **1080×1350 (4:5), H.264 High profile, 30 fps, yuv420p
(BT.709, limited range), ~8 Mbps, no audio**, as `01.mp4`, `02.mp4`, … or all
of them in one `carousel.zip`.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + static build into dist/
npm run preview      # serve dist/ locally
```

## How it works

- `src/render/` is framework-free. `drawFrame(ctx, slide, frameIndex, assets)`
  is the only thing that draws: pure and deterministic, used by both the
  live preview (`requestAnimationFrame`) and the exporter. No CSS or DOM
  animation, no DOM-to-image.
- **Stop-motion rate** (6, 8, 12, 15, 30 fps): output is always 30 fps, but
  the scene is only "shot" that many times a second and frames in between
  repeat. On every shot each element gets a jitter (±2 px, ±0.5°) from a
  mulberry32 PRNG keyed by *slide seed + shot index + element*, so preview,
  export and re-exports match. **Reshuffle** picks a new seed: new layout,
  tilts and drop directions.
- Effects (paper texture, film grain, vignette, exposure flicker) are drawn
  on the canvas from the same seed.
- Timing: elements drop in order (title, screenshots, subtitle). The last one
  lands at least 1.5 s before the end, so the finished composition holds.
- Screenshots are fitted inside a 60 px safe margin and never cropped unless
  you pick **Fill**. Text uses the bundled Inter (via `@fontsource/inter`,
  latin + latin-ext, so ą č ę ė į š ų ū ž work), wraps, and shrinks to fit.
- Export (`src/export/encoder.ts`) renders frame by frame, offline and faster
  than real time: `drawFrame` → RGBA → I420 (BT.709 limited range) →
  WebCodecs `VideoEncoder` (`avc1.640028`, High@4.0) → Mediabunny
  `EncodedVideoPacketSource` → fast-start MP4 (`moov` first). Fonts
  (`document.fonts`) and images (`image.decode()`) are loaded before any
  frame is drawn.
- The project autosaves: slide settings in `localStorage`, image files in
  IndexedDB. **New project** clears both.

## Tests

```bash
npm test             # unit: drawFrame pixel determinism, layout margins, timeline, YUV
npm run get-chrome   # once: downloads Chrome for Testing (headless shell) into .chrome/
npm run test:e2e     # Playwright: upload 3 images, export, inspect the MP4 + ZIP, reload
```

The unit tests render with `@napi-rs/canvas` and compare SHA-256 hashes of
the pixels. The e2e test reads the exported files back with Mediabunny's
input API and checks size, duration, fps, frame count, codec and profile. If
`ffprobe` (or `ffmpeg`, via `FFPROBE` / `FFMPEG` env vars) is available it
also prints its view of the stream.

The e2e test needs a Chrome build: Playwright's own open-source Chromium has
no H.264 encoder. `npm run get-chrome` fetches Chrome for Testing, or set
`CHROMIUM_PATH` to any Chrome/Chromium with proprietary codecs.
`harness.html` (dev server only) exports one hardcoded slide;
`npm run test:harness` runs it.

## Deploy as a static site

`npm run build` produces a self-contained `dist/` with relative asset paths
(`base: './'`), so it works from any sub-path.

**GitHub Pages:** `.github/workflows/pages.yml` tests, builds and pushes
`dist/` to the `gh-pages` branch on every push to `main`. In Settings →
Pages, the source is *Deploy from a branch*, `gh-pages`, `/ (root)`.

**Vercel:** import the repo, Vite is auto-detected: build `npm run build`, output `dist`.

Any static host works; nothing is sent to a server.

## Browser support

Export needs WebCodecs `VideoEncoder` with H.264 High profile. The app checks
`VideoEncoder.isConfigSupported` at startup and, if it fails, disables
export and says so.

| Browser | Status |
| --- | --- |
| Chrome / Edge (desktop, 94+) | Supported. Tested with Chrome for Testing 154 (headless). |
| Safari 16.4+ (macOS / iOS) | Expected to work (WebCodecs + H.264 via VideoToolbox); not tested here. |
| Firefox | Depends on version and OS; older versions have no WebCodecs. The app shows a message recommending Chrome, Edge or Safari. |
| Playwright's bundled Chromium | Preview only: built without an H.264 encoder. |

Editing and preview work in any modern browser.
