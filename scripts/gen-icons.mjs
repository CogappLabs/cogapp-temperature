// Renders the PWA PNG icons from the SVG sources with headless Chromium.
// Run once whenever the favicon or maskable source changes:
//   node scripts/gen-icons.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, "../public");

const favicon = readFileSync(resolve(pub, "favicon.svg"), "utf8");
const maskable = readFileSync(resolve(here, "icon-source-maskable.svg"), "utf8");

// [source svg, output filename, size, transparent background?]
const jobs = [
  [favicon, "icon-192.png", 192, true],
  [favicon, "icon-512.png", 512, true],
  [maskable, "icon-maskable-512.png", 512, false],
  // iOS uses apple-touch-icon and applies its own rounding, so it must be
  // full-bleed with an opaque background.
  [maskable, "apple-touch-icon.png", 180, false],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
try {
  for (const [svg, name, size, transparent] of jobs) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    await page.setContent(
      `<!doctype html><html><body style="margin:0">
         <img src="${dataUrl}" width="${size}" height="${size}" style="display:block">
       </body></html>`,
    );
    await page.locator("img").waitFor();
    await page.screenshot({
      path: resolve(pub, name),
      omitBackground: transparent,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await page.close();
    console.log(`wrote public/${name} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
