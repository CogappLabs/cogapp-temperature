import type { Point } from "./adafruit";

export interface ChartGeom {
  line: string;
  area: string;
  min: number;
  max: number;
  xLabels: { x: number; text: string }[];
  yLabels: { y: number; text: string }[];
}

export interface ChartOpts {
  w: number;
  h: number;
  padX: number;
  padTop: number;
  padBottom: number;
  unit: string;
  /** Approx number of x-axis ticks. */
  xTicks?: number;
}

function fmtTime(iso: string, spanHours: number): string {
  const d = new Date(iso);
  if (spanHours <= 24) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Build SVG path data + axis labels for a line/area chart. */
export function buildChart(points: Point[], o: ChartOpts): ChartGeom {
  const innerW = o.w - o.padX * 2;
  const innerH = o.h - o.padTop - o.padBottom;
  const vals = points.map((p) => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  // Pad the value range a little so the line isn't flush to the edges.
  const pad = (rawMax - rawMin || 1) * 0.1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const range = max - min || 1;

  const n = points.length;
  const x = (i: number) => o.padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => o.padTop + innerH - ((v - min) / range) * innerH;

  const coords = points.map((p, i) => [x(i), y(p.value)] as const);
  const line = coords
    .map(([xx, yy], i) => `${i === 0 ? "M" : "L"}${xx.toFixed(1)},${yy.toFixed(1)}`)
    .join(" ");
  const baseY = o.padTop + innerH;
  const area =
    coords.length > 0
      ? `${line} L${coords[coords.length - 1][0].toFixed(1)},${baseY} L${coords[0][0].toFixed(1)},${baseY} Z`
      : "";

  // X labels
  const first = points[0]?.at;
  const last = points[points.length - 1]?.at;
  const spanHours =
    first && last ? (new Date(last).getTime() - new Date(first).getTime()) / 3600_000 : 0;
  const xTicks = Math.min(o.xTicks ?? 4, Math.max(n, 1));
  const xLabels: ChartGeom["xLabels"] = [];
  for (let t = 0; t < xTicks; t++) {
    const idx = xTicks === 1 ? 0 : Math.round((t / (xTicks - 1)) * (n - 1));
    const p = points[idx];
    if (p) xLabels.push({ x: x(idx), text: fmtTime(p.at, spanHours) });
  }

  // Y labels: min, mid, max of the real data range
  const yLabels: ChartGeom["yLabels"] = [rawMax, (rawMax + rawMin) / 2, rawMin].map((v) => ({
    y: y(v),
    text: `${v.toFixed(1)}${o.unit}`,
  }));

  return { line, area, min: rawMin, max: rawMax, xLabels, yLabels };
}
