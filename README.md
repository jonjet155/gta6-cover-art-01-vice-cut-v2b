# VICE CUT v2 — Painted Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/jonjet155/gta6-cover-art-01-vice-cut-v2b/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/jonjet155/gta6-cover-art-01-vice-cut-v2b/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

VICE CUT v2 is an offline web app that turns your own photos into a GTA 6-style cover poster — painted, not photographed. Every top entry in this bounty uses photos; this one is the only illustrated cover. Eight original painterly illustrations (golden-hour couple, neon wheelie, flamingo speedboat, Ocean Drive, swamp gator, skyline helicopter, neon diner, pier light) fill a **Cover Grid**: a 3×3 grid with a sunset title block at its centre, palm silhouettes and a gold frame, the composition of the iconic multi-panel key art.

Five layouts (Cover Grid, Comic Cuts, Hero + 3, Film Strip, Four Square), four colour grades (Vice Sunset, Neon Night, Teal Coast, Ink Mono), four caption styles (Sunset, Chrome, Neon, Mono), per-panel drag-to-pan and zoom, editable title and tagline, LEONIDA badge and five-star toggles, and one-click PNG export at the exact post sizes: 1080 × 1080, 1080 × 1350 and 1920 × 1080.

The moment it loads, the studio already shows a complete painted cover — zero clicks to the first cover. Your own photos are read on your machine only and never leave it, and the app makes no network requests at all. In the non-grid layouts the title sits in its own band below the photos, so it never covers a face.

## How to run

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. Add your photos, pick a layout, edit the caption, choose a grade, pick a post size and press **EXPORT PNG**.

## How it works

- `app/src/cover.js` — the cover renderer: panel geometry for all five layouts, cover-fit photo drawing with pan/zoom, colour grades, the painted sunset title block with palms and skyline, caption lettering, vignette.
- `app/src/main.js` — the studio wiring: sample tray, uploads, panel picking, drag-to-pan, wheel zoom, caption editing, export.
- `app/src/shots.js` — `?shot=cover` and `?shot=editor` scenes for screenshots, driven by URL params.
- `app/samples/` — eight original illustrations made with an image model in-session for this entry, in a flat painterly key-art style.

Everything in this app is original: no Rockstar Games logo, artwork, character or font. The title lettering is original; the samples are original illustrations, never the reference key art.

## License

MIT — see LICENSE.
