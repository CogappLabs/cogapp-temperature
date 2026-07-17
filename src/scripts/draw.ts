// Shared client-side chart renderer: draws a line/area chart plus axis labels
// and gridlines into a server-rendered <svg>, reading its geometry from the
// data-* attributes the history panels set. Used by both the office history
// panels (history.ts) and the outdoor history panel (outdoor-history.ts) so a
// single code path produces every redrawn chart.
import type { Point } from "../lib/adafruit";
import { buildChart } from "../lib/chart";

const SVG_NS = "http://www.w3.org/2000/svg";

function num(el: Element, attr: string): number {
  return Number(el.getAttribute(attr));
}

export function drawChart(svg: SVGElement, points: Point[], unit: string) {
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
