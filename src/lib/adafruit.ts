// Adafruit IO public feed reader for the Cogapp office sensors.
// Feeds are public, so no API key is needed.

const USER = "tristanr";
const BASE = `https://io.adafruit.com/api/v2/${USER}/feeds`;

export const FEEDS = {
  temperature: "cogapp-office-temperature",
  humidity: "cogapp-office-humidity",
} as const;

export interface Point {
  value: number;
  at: string; // ISO timestamp
}

interface RawDatum {
  value: string;
  created_at: string;
}

/** Latest N data points for a feed, oldest first. */
export async function getHistory(feedKey: string, limit = 120): Promise<Point[]> {
  const res = await fetch(`${BASE}/${feedKey}/data?limit=${limit}`);
  if (!res.ok) throw new Error(`Adafruit ${feedKey}: ${res.status}`);
  const raw = (await res.json()) as RawDatum[];
  return raw.map((d) => ({ value: Number(d.value), at: d.created_at })).reverse();
}

/** Data points within the last `hours`, oldest first. Adafruit retains 30 days. */
export async function getHistoryRange(feedKey: string, hours: number): Promise<Point[]> {
  const start = new Date(Date.now() - hours * 3600_000).toISOString();
  const res = await fetch(
    `${BASE}/${feedKey}/data?start_time=${encodeURIComponent(start)}&limit=10000`,
  );
  if (!res.ok) throw new Error(`Adafruit ${feedKey}: ${res.status}`);
  const raw = (await res.json()) as RawDatum[];
  return raw.map((d) => ({ value: Number(d.value), at: d.created_at })).reverse();
}

export const RANGES = [
  { key: "1h", label: "1h", hours: 1 },
  { key: "6h", label: "6h", hours: 6 },
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7d", hours: 168 },
  { key: "30d", label: "30d", hours: 720 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export interface Reading {
  latest: number;
  at: string;
  history: Point[];
}

export async function getReading(feedKey: string, limit = 120): Promise<Reading> {
  const history = await getHistory(feedKey, limit);
  const last = history[history.length - 1];
  if (!last) throw new Error(`Adafruit ${feedKey}: no data points`);
  return { latest: last.value, at: last.at, history };
}

// Comfort bands. Temperature in °C, humidity in %RH.
// Based on typical office-comfort guidance, not Adafruit's dashboard.
export type Band = "cold" | "cool" | "comfortable" | "warm" | "hot";

export function tempBand(c: number): Band {
  if (c < 16) return "cold";
  if (c < 19) return "cool";
  if (c <= 24) return "comfortable";
  if (c <= 27) return "warm";
  return "hot";
}

export function humidityBand(pct: number): Band {
  if (pct < 30) return "cold"; // too dry
  if (pct < 40) return "cool";
  if (pct <= 60) return "comfortable";
  if (pct <= 70) return "warm";
  return "hot"; // too humid
}

export const BAND_LABEL: Record<Band, string> = {
  cold: "Too cold",
  cool: "A bit cool",
  comfortable: "Comfortable",
  warm: "A bit warm",
  hot: "Too hot",
};

export interface Segment {
  band: Band;
  short: string; // short label for the scale key
  range: string; // human range, e.g. "19–24°C"
}

// Scale segments in order, matching the tempBand / humidityBand thresholds.
export const TEMP_SCALE: Segment[] = [
  { band: "cold", short: "Cold", range: "<16" },
  { band: "cool", short: "Cool", range: "16–19" },
  { band: "comfortable", short: "Comfy", range: "19–24" },
  { band: "warm", short: "Warm", range: "24–27" },
  { band: "hot", short: "Hot", range: "27+" },
];

export const HUMIDITY_SCALE: Segment[] = [
  { band: "cold", short: "Dry", range: "<30" },
  { band: "cool", short: "Low", range: "30–40" },
  { band: "comfortable", short: "Comfy", range: "40–60" },
  { band: "warm", short: "High", range: "60–70" },
  { band: "hot", short: "Humid", range: "70+" },
];

// Overall office habitability: worst of the two bands.
const RANK: Record<Band, number> = { comfortable: 0, cool: 1, warm: 1, cold: 2, hot: 2 };

export function habitability(t: Band, h: Band): { band: Band; label: string } {
  const worst = RANK[t] >= RANK[h] ? t : h;
  if (RANK[t] === 0 && RANK[h] === 0) {
    return { band: "comfortable", label: "Habitable" };
  }
  return {
    band: worst,
    label: worst === "hot" || worst === "cold" ? "Barely habitable" : "Mostly habitable",
  };
}
