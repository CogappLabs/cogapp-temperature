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

Feeds are **public**, no API key. `src/lib/adafruit.ts` is the only fetch layer:
`getReading` (latest + recent history), `getHistoryRange` (time-windowed, uses
`start_time`). Adafruit retains ~30 days. The same functions run at build time
(SSG, initial render) and client-side (live polling), so keep them isomorphic
(no Node- or DOM-only APIs in that file).

## Architecture

Rendering is **SSG + progressive enhancement**, no framework islands:

- `src/pages/index.astro` fetches both feeds at build, renders `ReadingCard`s, and loads two client scripts.
- `src/scripts/live.ts` re-polls every 60s (countdown + manual refresh button), updates the numbers, sparklines, band-scale highlight, and card background. Shows the offline banner (`[data-offline]`) on fetch failure.
- `src/scripts/history.ts` wires the per-card history `<details>` panels: range buttons fetch a window and redraw the chart.

Client scripts talk to the server-rendered DOM through **`data-*` attributes**, not
IDs or classes (e.g. `data-value`, `data-spark`, `data-scale`, `data-seg`,
`data-chart` + `data-w/h/padx/...`, `data-range/hours`). When editing a component's
markup, keep these hooks in sync with the scripts that read them.

Chart geometry lives in `src/lib/chart.ts` (`buildChart` → SVG path + axis labels),
shared by the server render and the client redraw so both produce identical charts.
The small sparkline has its own inline path maths duplicated in `Sparkline.astro`
and `live.ts`, so the `W/H/PAD` constants must match between them.

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

## Deploy

`.github/workflows/deploy.yml` builds with `withastro/action` and publishes to
GitHub Pages on push to `main`. `astro.config.mjs` sets `site` +
`base: "/cogapp-temperature"`; changing the repo name means updating the base,
the CSS font paths, and the footer GitHub link.
