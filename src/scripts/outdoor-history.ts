// Outdoor history panel: range buttons that fetch a time window of outdoor
// weather and redraw the temperature + humidity charts. Mirrors history.ts but
// draws both charts from a single provider call (Open-Meteo returns both series
// in one request) rather than one feed per panel.
import type { OutdoorHistory } from "../lib/weather";
import { weather } from "../lib/weather";
import { drawChart } from "./draw";

// Which series feeds which chart, and in what unit.
const CHARTS = [
  { chartKey: "brighton-temperature", series: "temperature" as const, unit: "°C" },
  { chartKey: "brighton-humidity", series: "humidity" as const, unit: "%" },
];

for (const panel of document.querySelectorAll<HTMLDetailsElement>("[data-outdoor-history]")) {
  const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-range]"));
  const charts = CHARTS.map((c) => ({
    ...c,
    svg: panel.querySelector<SVGElement>(`[data-chart="${c.chartKey}"]`),
    emptyMsg: panel.querySelector<HTMLElement>(`[data-empty="${c.chartKey}"]`),
  }));

  const cache = new Map<string, OutdoorHistory>();
  let activeKey = "";

  async function select(btn: HTMLButtonElement) {
    const key = btn.getAttribute("data-range") ?? "";
    const hours = Number(btn.getAttribute("data-hours"));
    activeKey = key;
    for (const b of buttons) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    }

    let data = cache.get(key);
    if (!data) {
      try {
        data = await weather.getHistory(hours);
        cache.set(key, data);
      } catch (err) {
        console.error("outdoor history fetch failed", err);
        return;
      }
    }
    // A newer click landed while we awaited; its result should win.
    if (activeKey !== key) return;

    for (const c of charts) {
      if (!c.svg || !c.emptyMsg) continue;
      const points = data[c.series];
      if (points.length === 0) {
        c.svg.classList.add("hidden");
        c.emptyMsg.classList.remove("hidden");
        continue;
      }
      c.svg.classList.remove("hidden");
      c.emptyMsg.classList.add("hidden");
      drawChart(c.svg, points, c.unit);
    }
  }

  for (const btn of buttons) {
    btn.addEventListener("click", () => void select(btn));
  }

  // The charts ship empty; load the default range the first time the panel opens.
  let loaded = false;
  panel.addEventListener("toggle", () => {
    if (!panel.open || loaded) return;
    loaded = true;
    const initial = buttons.find((b) => b.getAttribute("aria-pressed") === "true") ?? buttons[0];
    if (initial) void select(initial);
  });
}
