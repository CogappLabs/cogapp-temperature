// Live polling: refresh the reading cards on an interval, with a countdown
// and a manual refresh button.
import { type Band, FEEDS, getReading, humidityBand, type Point, tempBand } from "../lib/adafruit";

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

function sparkPaths(points: Point[]) {
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const coords = points.map((p, i) => [PAD + i * stepX, y(p.value)] as const);
  const line = coords
    .map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD} L${coords[0][0].toFixed(1)},${H - PAD} Z`;
  return { line, area, min, max };
}

function swapBg(el: Element | null, band: Band) {
  if (!el) return;
  // Clear the loading placeholder state on first paint of real data.
  el.classList.remove("bg-green", "bg-blue", "bg-pink", "bg-light-grey", "animate-pulse");
  el.removeAttribute("aria-busy");
  el.classList.add(cardBg[band]);
}

function updateCard(id: string, latest: number, unit: string, band: Band, points: Point[]) {
  const val = document.querySelector(`[data-value="${id}"]`);
  if (val) val.textContent = latest.toFixed(1);
  swapBg(document.querySelector(`[data-value="${id}"]`)?.closest("article") ?? null, band);

  const { line, area, min, max } = sparkPaths(points);
  const svg = document.querySelector(`[data-spark="${id}"]`);
  svg?.querySelector("[data-line]")?.setAttribute("d", line);
  svg?.querySelector("[data-area]")?.setAttribute("d", area);
  const minEl = document.querySelector(`[data-spark-min="${id}"]`);
  const maxEl = document.querySelector(`[data-spark-max="${id}"]`);
  if (minEl) minEl.textContent = `Low ${min.toFixed(1)}${unit}`;
  if (maxEl) maxEl.textContent = `High ${max.toFixed(1)}${unit}`;

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
    updateCard("temperature", temp.latest, "°C", tBand, temp.history);
    updateCard("humidity", hum.latest, "%", hBand, hum.history);

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

function setOffline(offline: boolean) {
  const banner = document.querySelector<HTMLElement>("[data-offline]");
  if (banner) banner.hidden = !offline;
}

const INTERVAL = 60; // seconds between auto-refreshes
const btn = document.querySelector<HTMLButtonElement>("[data-refresh]");
const icon = document.querySelector<SVGElement>("[data-refresh-icon]");
const countdownEl = document.querySelector<HTMLElement>("[data-countdown]");
let remaining = INTERVAL;

function tick() {
  remaining -= 1;
  if (countdownEl) countdownEl.textContent = String(Math.max(remaining, 0));
  if (remaining <= 0) void run();
}

let inFlight = false;

async function run() {
  if (inFlight) return;
  inFlight = true;
  remaining = INTERVAL;
  if (btn) btn.disabled = true;
  icon?.classList.add("animate-spin");
  await refresh();
  icon?.classList.remove("animate-spin");
  if (btn) btn.disabled = false;
  remaining = INTERVAL;
  inFlight = false;
  if (countdownEl) countdownEl.textContent = String(INTERVAL);
}

btn?.addEventListener("click", () => void run());
setInterval(tick, 1000);

// Fetch immediately on load: the page ships with a placeholder, so the first
// paint of real data comes from here rather than from build-time HTML.
void run();
