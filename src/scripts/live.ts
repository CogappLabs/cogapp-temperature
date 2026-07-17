// Live polling: refresh the reading cards on an interval, with a circular timer
// ring that drains to the next poll and a manual refresh button.
import { type Band, FEEDS, getReading, humidityBand, type Point, tempBand } from "../lib/adafruit";
import { weather } from "../lib/weather";

const cardBg: Record<Band, string> = {
  comfortable: "bg-green",
  cool: "bg-blue",
  warm: "bg-pink",
  cold: "bg-blue",
  hot: "bg-pink",
};

const W = 600;
const H = 110;
const PAD = 8;
// Left gutter for the y-axis labels; must match Sparkline.astro.
const PADL = 44;
const SVG_NS = "http://www.w3.org/2000/svg";

function sparkPaths(points: Point[]) {
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = (W - PADL - PAD) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const coords = points.map((p, i) => [PADL + i * stepX, y(p.value)] as const);
  const line = coords
    .map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD} L${coords[0][0].toFixed(1)},${H - PAD} Z`;
  return { line, area, min, max };
}

// Redraw the sparkline's y-axis labels (max/mid/min) to match sparkPaths.
function drawSparkLabels(svg: Element, min: number, max: number, unit: string) {
  svg.querySelectorAll("[data-ylabel]").forEach((n) => {
    n.remove();
  });
  const range = max - min || 1;
  for (const v of [max, (max + min) / 2, min]) {
    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("data-ylabel", "");
    t.setAttribute("x", String(PADL - 6));
    t.setAttribute("y", String(H - PAD - ((v - min) / range) * (H - PAD * 2)));
    t.setAttribute("text-anchor", "end");
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("class", "fill-slate text-[11px] font-mono");
    t.textContent = `${v.toFixed(1)}${unit}`;
    svg.appendChild(t);
  }
}

function swapBg(el: Element | null, band: Band) {
  if (!el) return;
  // Clear the loading placeholder state on first paint of real data.
  el.classList.remove("bg-green", "bg-blue", "bg-pink", "bg-light-grey", "animate-pulse");
  el.removeAttribute("aria-busy");
  el.classList.add(cardBg[band]);
}

function updateCard(id: string, unit: string, latest: number, band: Band, points: Point[]) {
  const val = document.querySelector(`[data-value="${id}"]`);
  if (val) val.textContent = latest.toFixed(1);
  swapBg(document.querySelector(`[data-value="${id}"]`)?.closest("article") ?? null, band);

  const { line, area, min, max } = sparkPaths(points);
  const svg = document.querySelector(`[data-spark="${id}"]`);
  svg?.querySelector("[data-line]")?.setAttribute("d", line);
  svg?.querySelector("[data-area]")?.setAttribute("d", area);
  if (svg) drawSparkLabels(svg, min, max, unit);
  // Keep the sparkline's accessible name in sync; server render ships a
  // "loading" label because no data exists at build time.
  svg?.setAttribute(
    "aria-label",
    `Past 2 hours, ranging ${min.toFixed(1)} to ${max.toFixed(1)} ${unit}`,
  );

  const scale = document.querySelector(`[data-scale="${id}"]`);
  scale?.querySelectorAll("[data-seg]").forEach((seg) => {
    if (seg.getAttribute("data-seg") === band) seg.setAttribute("aria-current", "true");
    else seg.removeAttribute("aria-current");
  });
}

async function refresh() {
  try {
    const [temp, hum] = await Promise.all([
      getReading(FEEDS.temperature),
      getReading(FEEDS.humidity),
    ]);
    const tBand = tempBand(temp.latest);
    const hBand = humidityBand(hum.latest);
    updateCard("temperature", "°C", temp.latest, tBand, temp.history);
    updateCard("humidity", "%", hum.latest, hBand, hum.history);

    const updated = new Date(Math.max(new Date(temp.at).getTime(), new Date(hum.at).getTime()));
    const timeEl = document.querySelector("[data-updated]");
    if (timeEl) {
      timeEl.setAttribute("datetime", updated.toISOString());
      timeEl.textContent = updated.toLocaleTimeString("en-GB");
    }
    setOffline(false);
  } catch (err) {
    console.error("refresh failed", err);
    setOffline(true);
  }
}

// The Brighton card is fetched independently of the office sensors so a
// weather-API hiccup can't blank the office cards (or vice versa).
async function refreshOutdoor() {
  try {
    const o = await weather.getCurrent();
    const t = document.querySelector('[data-value="brighton-temperature"]');
    const h = document.querySelector('[data-value="brighton-humidity"]');
    if (t) t.textContent = o.temperature.toFixed(1);
    if (h) h.textContent = o.humidity.toFixed(0);
    const card = document.querySelector("[data-outdoor]");
    if (card) {
      card.classList.remove("bg-light-grey", "animate-pulse");
      card.classList.add("bg-purple");
      card.removeAttribute("aria-busy");
    }
  } catch (err) {
    console.error("outdoor refresh failed", err);
  }
}

function setOffline(offline: boolean) {
  const banner = document.querySelector<HTMLElement>("[data-offline]");
  if (banner) banner.hidden = !offline;
}

const INTERVAL = 60; // seconds between auto-refreshes
const btn = document.querySelector<HTMLButtonElement>("[data-refresh]");
const icon = document.querySelector<SVGElement>("[data-refresh-icon]");
const timer = document.querySelector<HTMLElement>("[data-timer]");
const ring = document.querySelector<SVGCircleElement>("[data-timer-ring]");
const RING_CIRCUMFERENCE = 2 * Math.PI * 10; // r=10 in the timer SVG
let remaining = INTERVAL;

// The ring drains as time elapses: full at reset, empty when due.
function drawRing() {
  const fraction = Math.max(remaining, 0) / INTERVAL;
  if (ring) ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
  timer?.setAttribute("aria-label", `Next refresh in ${Math.max(remaining, 0)}s`);
}

function tick() {
  remaining -= 1;
  drawRing();
  if (remaining <= 0) void run();
}

let inFlight = false;

async function run() {
  if (inFlight) return;
  inFlight = true;
  remaining = INTERVAL;
  if (btn) btn.disabled = true;
  icon?.classList.add("animate-spin");
  await Promise.all([refresh(), refreshOutdoor()]);
  icon?.classList.remove("animate-spin");
  if (btn) btn.disabled = false;
  remaining = INTERVAL;
  inFlight = false;
  drawRing();
}

btn?.addEventListener("click", () => void run());
setInterval(tick, 1000);

// Fetch immediately on load: the page ships with a placeholder, so the first
// paint of real data comes from here rather than from build-time HTML.
void run();
