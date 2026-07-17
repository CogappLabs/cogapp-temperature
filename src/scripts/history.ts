// History panels: range buttons that fetch a time window and redraw the chart.
import { getHistoryRange, type Point } from "../lib/adafruit";
import { drawChart } from "./draw";

for (const panel of document.querySelectorAll<HTMLDetailsElement>("[data-history]")) {
  const id = panel.getAttribute("data-history") ?? "";
  const feedKey = panel.getAttribute("data-feed") ?? "";
  const unit = panel.getAttribute("data-unit") ?? "";
  const svg = panel.querySelector<SVGElement>(`[data-chart="${id}"]`);
  const emptyMsg = panel.querySelector<HTMLElement>(`[data-empty="${id}"]`);
  const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>("[data-range]"));
  if (!svg || !emptyMsg) continue;

  const cache = new Map<string, Point[]>();
  let activeKey = "";

  async function select(btn: HTMLButtonElement, svg: SVGElement, emptyMsg: HTMLElement) {
    const key = btn.getAttribute("data-range") ?? "";
    const hours = Number(btn.getAttribute("data-hours"));
    activeKey = key;
    for (const b of buttons) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    }

    let points = cache.get(key);
    if (!points) {
      try {
        points = await getHistoryRange(feedKey, hours);
        cache.set(key, points);
      } catch (err) {
        console.error("history fetch failed", err);
        return;
      }
    }
    // A newer click landed while we awaited; its result should win.
    if (activeKey !== key) return;

    if (points.length === 0) {
      svg.classList.add("hidden");
      emptyMsg.classList.remove("hidden");
      return;
    }
    svg.classList.remove("hidden");
    emptyMsg.classList.add("hidden");
    drawChart(svg, points, unit);
  }

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      void select(btn, svg, emptyMsg);
    });
  }

  // The chart ships empty (no build-time data), so load the default range the
  // first time the panel is opened.
  let loaded = false;
  panel.addEventListener("toggle", () => {
    if (!panel.open || loaded) return;
    loaded = true;
    const initial = buttons.find((b) => b.getAttribute("aria-pressed") === "true") ?? buttons[0];
    if (initial) void select(initial, svg, emptyMsg);
  });
}
