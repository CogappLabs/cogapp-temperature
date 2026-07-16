// History panels: range buttons that fetch a time window and redraw the chart.
import { getHistoryRange, type Point } from "../lib/adafruit";
import { buildChart } from "../lib/chart";

const SVG_NS = "http://www.w3.org/2000/svg";

function num(el: Element, attr: string): number {
  return Number(el.getAttribute(attr));
}

function drawChart(svg: SVGElement, points: Point[], unit: string) {
  const w = num(svg, "data-w");
  const h = num(svg, "data-h");
  const padX = num(svg, "data-padx");
  const padTop = num(svg, "data-padtop");
  const padBottom = num(svg, "data-padbottom");
  const geom = buildChart(points, { w, h, padX, padTop, padBottom, unit, xTicks: 5 });

  svg.querySelector("[data-line]")?.setAttribute("d", geom.line);
  svg.querySelector("[data-area]")?.setAttribute("d", geom.area);

  // Rebuild axis labels + gridlines from scratch.
  svg.querySelectorAll("[data-xlabel], [data-ylabel], [data-grid]").forEach((n) => {
    n.remove();
  });

  for (const l of geom.yLabels) {
    const grid = document.createElementNS(SVG_NS, "line");
    grid.setAttribute("data-grid", "");
    grid.setAttribute("x1", String(padX));
    grid.setAttribute("x2", String(w - padX));
    grid.setAttribute("y1", String(l.y));
    grid.setAttribute("y2", String(l.y));
    grid.setAttribute("stroke", "currentColor");
    grid.setAttribute("stroke-opacity", "0.12");
    svg.insertBefore(grid, svg.firstChild);

    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("data-ylabel", "");
    t.setAttribute("x", String(padX - 6));
    t.setAttribute("y", String(l.y));
    t.setAttribute("text-anchor", "end");
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("class", "fill-slate text-[13px] font-mono");
    t.textContent = l.text;
    svg.appendChild(t);
  }
  for (const l of geom.xLabels) {
    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("data-xlabel", "");
    t.setAttribute("x", String(l.x));
    t.setAttribute("y", String(h - 8));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", "fill-slate text-[13px] font-mono");
    t.textContent = l.text;
    svg.appendChild(t);
  }
}

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
}
