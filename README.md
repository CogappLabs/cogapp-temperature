# cogapp-temperature

Live temperature and humidity for the Cogapp office, from two public
[Adafruit IO](https://io.adafruit.com/tristanr/dashboards/cogapp-office-habitability)
feeds. Astro + Tailwind v4, styled with the Cogapp brand. Deploys to GitHub Pages
at [cogapplabs.github.io/cogapp-temperature](https://cogapplabs.github.io/cogapp-temperature).

## Develop

```bash
npm install
npm run dev      # http://localhost:4321/cogapp-temperature
```

The feeds are public, so there is no API key and no `.env` to set up.

## Scripts

- `npm run build` builds the static site to `dist/`.
- `npm run preview` serves the build locally.
- `npm run check` runs Biome (autofix) then Astro type checks.
- `npm run lint` runs Biome without writing.
- `node scripts/axe-check.mjs` runs an axe-core accessibility check against a
  running dev/preview server.

Biome (lint + format) runs on staged files via Lefthook at pre-commit.

## How it works

The page fetches both feeds at build time for the initial render, then a small
client script re-polls every 60 seconds with a countdown and a manual refresh
button. Each metric shows the current value, a comfort-band scale, a sparkline,
and an expandable history chart. See `CLAUDE.md` for architecture detail.

The comfort thresholds are general office-comfort guesses, not Adafruit's own
dashboard bands.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. Enable Pages (source: GitHub Actions) in the repo
settings once.
