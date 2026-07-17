# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-page Astro dashboard showing live temperature and humidity for the Cogapp
office, pulled from two public Adafruit IO feeds. Styled with the Cogapp brand
(Untitled Serif + Civil fonts, cream/pastel tokens). Deploys to GitHub Pages.

## Commands

- `npm run dev`: dev server. A live one usually runs at http://localhost:4321/cogapp-temperature (note the base path). Prefer checking it over rebuilding.
- `npm run build`: static build to `dist/`.
- `npm run preview`: serve the build (also under `/cogapp-temperature`).
- `npm run check`: `biome check --write` then `astro check` (types).
- `npm run lint`: Biome, no writes.
- `node scripts/axe-check.mjs [url]`: run axe-core against the running preview/dev server. Exits non-zero on WCAG violations. Needs the server up first.

Lefthook runs Biome on staged `.ts/.js/.mjs/.json` at pre-commit.

## Data source

Office feeds are **public**, no API key. `src/lib/adafruit.ts` is that fetch layer:
`getReading` (latest + recent history), `getHistoryRange` (time-windowed, hits
the `/data/chart` endpoint so it downsamples server-side and dodges the raw
`/data` 1000-row cap that would drop the newest hours of a 24h window; the
returned buckets are averages, so longer windows are smoother than the raw
once-a-minute readings). Adafruit retains ~30 days. The same functions run at build time
(SSG, initial render) and client-side (live polling), so keep them isomorphic
(no Node- or DOM-only APIs in that file).

Outdoor weather comes from `src/lib/weather.ts` via a `WeatherProvider` interface
(`getCurrent`, `getHistory`); the default provider is Open-Meteo (free, no key,
CORS-enabled). `getHistory` uses the forecast endpoint's `past_days` (hourly, up
to 92 days back — so it covers every range but is coarser than the once-a-minute
office sensor on short windows). Swap providers by reassigning the `weather`
binding at the bottom of the file; keep implementations isomorphic like above.

## Architecture

Rendering is **SSG + progressive enhancement**, no framework islands:

- `src/pages/index.astro` renders the office `ReadingCard`s + the `OutdoorCard` (all ship empty placeholders — nothing is fetched at build) and loads the client scripts.
- `src/scripts/live.ts` re-polls every 60s (a circular SVG timer ring in the header fills down to the next poll, alongside a manual refresh button), updates the numbers, sparklines, band-scale highlight, and card background, plus the outdoor card's current numbers. Shows the offline banner (`[data-offline]`) on fetch failure.
- `src/scripts/history.ts` wires the per-card office history `<details>` panels: range buttons fetch a window and redraw the chart.
- `src/scripts/outdoor-history.ts` wires the outdoor card's history `<details>`: one `weather.getHistory` call per range redraws both the temperature and humidity charts.
- `src/scripts/draw.ts` holds the shared `drawChart` (SVG line/area + axis labels/gridlines from `data-*` geometry), used by both history scripts.

Client scripts talk to the server-rendered DOM through **`data-*` attributes**, not
IDs or classes (e.g. `data-value`, `data-spark`, `data-scale`, `data-seg`,
`data-chart` + `data-w/h/padx/...`, `data-range/hours`, `data-history`,
`data-outdoor-history`, `data-empty`, `data-refresh`/`data-refresh-icon`, and the
header countdown ring `data-timer`/`data-timer-ring`). When editing a component's
markup, keep these hooks in sync with the scripts that read them.

Chart geometry lives in `src/lib/chart.ts` (`buildChart` → SVG path + axis labels),
shared by the server render and the client redraw so both produce identical charts.
The small sparkline has its own inline path maths duplicated in `Sparkline.astro`
and `live.ts`, so the `W/H/PAD` constants must match between them. The sparkline is
the last 120 readings — two hours, since Adafruit logs once a minute — and is
labelled as such (it has no min/max readout).

Comfort bands (`tempBand`, `humidityBand`, `TEMP_SCALE`, `HUMIDITY_SCALE`) are
invented office-comfort thresholds, **not** Adafruit's dashboard values. If real
bands are provided, update the threshold functions and the scale arrays together.

## Theme

`src/styles/global.css` holds `@font-face`, the Tailwind v4 `@theme` tokens, and
base styles. Fonts live in `public/fonts/`. Because the site is served under the
`/cogapp-temperature` base path, **font `url()`s in CSS must include that prefix**
(Astro does not rewrite `public/` URLs in CSS). Any new `public/` asset referenced
from CSS needs the same prefix.

## Accessibility

Colour contrast is the recurring risk: grey/label text sits on pale pastel card
backgrounds. `--color-grey` is tuned to clear WCAG AA (4.5:1) on every card colour,
so don't lighten it. The band scale keeps full-contrast text and signals the
inactive state via background `saturate()`, not text opacity. Re-run
`scripts/axe-check.mjs` after visual changes.

## PWA / install to home screen

The site is an installable PWA. `public/manifest.webmanifest` (linked from
`Base.astro`, along with the `theme-color` and `apple-touch-icon`/apple meta
tags) declares the app; `public/sw.js` is a service worker registered by an
inline script in `Base.astro`. The SW precaches the app shell and does
stale-while-revalidate for same-origin assets, but deliberately **passes
cross-origin requests (Adafruit IO, Open-Meteo) straight to the network** so live
readings never come from the cache. Bump `VERSION` in `sw.js` to force clients
onto a new cache.

PNG icons (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
`apple-touch-icon.png`) are generated from `public/favicon.svg` and
`scripts/icon-source-maskable.svg` by `node scripts/gen-icons.mjs` (headless
Chromium via Playwright) — re-run it if either source changes. The maskable
source keeps the artwork inside the centre ~60% safe zone on a full-bleed
background.

The manifest's `start_url`, `scope`, `id`, and icon `src`s hardcode the
`/cogapp-temperature/` base path (static `public/` files aren't rewritten by
Astro), so they belong in the list below.

## Deploy

`.github/workflows/deploy.yml` builds with `withastro/action` and publishes to
GitHub Pages on push to `main`. `astro.config.mjs` sets `site` +
`base: "/cogapp-temperature"`; changing the repo name means updating the base,
the CSS font paths, the footer GitHub link, and the base-path references in
`public/manifest.webmanifest`.
