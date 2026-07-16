// Run axe-core against the running preview and print violations.
// Usage: node scripts/axe-check.mjs [url]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:4322/cogapp-temperature/";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(axeSource);

const results = await page.evaluate(async () => {
  // @ts-ignore - axe is injected above
  return await axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
  });
});

const { violations } = results;
console.log(`\naxe: ${violations.length} violation type(s)\n`);
for (const v of violations) {
  console.log(`[${v.impact}] ${v.id}: ${v.help}`);
  console.log(`  ${v.helpUrl}`);
  for (const node of v.nodes) {
    console.log(`  - ${node.target.join(" ")}`);
    if (node.any?.length) console.log(`    ${node.any[0].message}`);
  }
  console.log();
}

await browser.close();
process.exit(violations.length ? 1 : 0);
