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
  const times = points.map((p) => new Date(p.at).getTime());
  const t0 = times[0] ?? 0;
  const tLast = times[n - 1] ?? t0;
  const tSpan = tLast - t0 || 1;
  // Position points by time, not index, so gaps in the data read as horizontal
  // empty space rather than a compressed near-vertical line.
  const x = (i: number) => o.padX + (n <= 1 ? innerW / 2 : ((times[i] - t0) / tSpan) * innerW);
  const y = (v: number) => o.padTop + innerH - ((v - min) / range) * innerH;

  const coords = points.map((p, i) => [x(i), y(p.value)] as const);

  // Break the line where consecutive readings are more than a few times the
  // typical sampling interval apart, so a sensor dropout shows as a gap instead
  // of a straight line drawn across it.
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const gapThreshold = median > 0 ? median * 4 : Number.POSITIVE_INFINITY;

  let line = "";
  for (let i = 0; i < coords.length; i++) {
    const [xx, yy] = coords[i];
    const startSegment = i === 0 || times[i] - times[i - 1] > gapThreshold;
    line += `${startSegment ? "M" : "L"}${xx.toFixed(1)},${yy.toFixed(1)} `;
  }
  line = line.trimEnd();

  // Fill the area under each unbroken segment separately, so gaps stay empty.
  const baseY = o.padTop + innerH;
  const areaParts: string[] = [];
  let segStart = 0;
  for (let i = 1; i <= coords.length; i++) {
    const isBreak = i === coords.length || times[i] - times[i - 1] > gapThreshold;
    if (isBreak) {
      const seg = coords.slice(segStart, i);
      if (seg.length > 0) {
        const pathTop = seg
          .map(([xx, yy], j) => `${j === 0 ? "M" : "L"}${xx.toFixed(1)},${yy.toFixed(1)}`)
          .join(" ");
        areaParts.push(
          `${pathTop} L${seg[seg.length - 1][0].toFixed(1)},${baseY} L${seg[0][0].toFixed(1)},${baseY} Z`,
        );
      }
      segStart = i;
    }
  }
  const area = areaParts.join(" ");

  // X labels, positioned by time across the window.
  const spanHours = tSpan / 3600_000;
  const xTicks = Math.min(o.xTicks ?? 4, Math.max(n, 1));
  const xLabels: ChartGeom["xLabels"] = [];
  for (let t = 0; t < xTicks; t++) {
    const frac = xTicks === 1 ? 0 : t / (xTicks - 1);
    const tickTime = t0 + frac * tSpan;
    const px = o.padX + (n <= 1 ? innerW / 2 : frac * innerW);
    xLabels.push({ x: px, text: fmtTime(new Date(tickTime).toISOString(), spanHours) });
  }

  // Y labels: min, mid, max of the real data range
  const yLabels: ChartGeom["yLabels"] = [rawMax, (rawMax + rawMin) / 2, rawMin].map((v) => ({
    y: y(v),
    text: `${v.toFixed(1)}${o.unit}`,
  }));

  return { line, area, min: rawMin, max: rawMax, xLabels, yLabels };
}
