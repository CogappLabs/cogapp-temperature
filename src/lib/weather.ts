// Outdoor weather for the office's town. The data source sits behind a small
// WeatherProvider interface so a different API can be plugged in later without
// touching the card or the live poller: implement WeatherProvider and swap the
// exported `weather` binding at the bottom of this file — that's the only edit.
//
// Providers must stay isomorphic (plain `fetch`, no Node- or DOM-only APIs), as
// the same code runs at build time and client-side, matching src/lib/adafruit.ts.

import type { Point } from "./adafruit";

/** The place these readings describe. Shown on the card heading. */
export const LOCATION = "Brighton";

// Brighton seafront-ish; providers snap to their nearest grid cell.
const LAT = 50.8225;
const LON = -0.1372;

export interface OutdoorReading {
  temperature: number; // °C
  humidity: number; // %RH
  at: string; // ISO timestamp of the reading
}

// A time series each for temperature and humidity, oldest first. Points reuse
// the {value, at} shape the charts already speak (see src/lib/chart.ts).
export interface OutdoorHistory {
  temperature: Point[];
  humidity: Point[];
}

export interface WeatherProvider {
  /** Human-readable source name, shown as attribution on the card. */
  readonly name: string;
  /** Attribution / source link for that name. */
  readonly url: string;
  /** Current outdoor conditions for the configured location. */
  getCurrent(): Promise<OutdoorReading>;
  /** Outdoor temperature + humidity over the last `hours`, oldest first. */
  getHistory(hours: number): Promise<OutdoorHistory>;
}

interface OpenMeteoRaw {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
  };
  hourly?: {
    time: number[]; // unix seconds (timeformat=unixtime)
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
  };
}

/** Open-Meteo provider: free, no API key, CORS-enabled. */
export function openMeteo(latitude: number, longitude: number): WeatherProvider {
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`;

  return {
    name: "Open-Meteo",
    url: "https://open-meteo.com",
    async getCurrent() {
      const res = await fetch(`${base}&current=temperature_2m,relative_humidity_2m`);
      if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);
      const raw = (await res.json()) as OpenMeteoRaw;
      const c = raw.current;
      if (!c) throw new Error("Open-Meteo: no current data");
      return {
        temperature: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        at: c.time,
      };
    },
    async getHistory(hours: number) {
      // The forecast endpoint serves recent past via `past_days` (up to 92),
      // which comfortably covers every office range (max 30d). Data is hourly,
      // so short windows are coarser than the once-a-minute office sensor.
      const pastDays = Math.min(92, Math.max(1, Math.ceil(hours / 24)));
      const url =
        `${base}&hourly=temperature_2m,relative_humidity_2m` +
        `&past_days=${pastDays}&forecast_days=1&timeformat=unixtime`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);
      const raw = (await res.json()) as OpenMeteoRaw;
      const h = raw.hourly;
      if (!h) throw new Error("Open-Meteo: no hourly data");

      // Keep only points within the requested window and up to now (drop the
      // future hours forecast_days=1 tacks on).
      const now = Date.now();
      const cutoff = now - hours * 3600_000;
      const temperature: Point[] = [];
      const humidity: Point[] = [];
      for (let i = 0; i < h.time.length; i++) {
        const ms = h.time[i] * 1000;
        if (ms < cutoff || ms > now) continue;
        const at = new Date(ms).toISOString();
        const t = h.temperature_2m[i];
        const rh = h.relative_humidity_2m[i];
        if (t != null) temperature.push({ value: t, at });
        if (rh != null) humidity.push({ value: rh, at });
      }
      return { temperature, humidity };
    },
  };
}

// The active weather source. To switch APIs, implement WeatherProvider above
// and assign the new instance here — the card and poller consume this binding
// (and its `name`/`url` for attribution) only.
export const weather: WeatherProvider = openMeteo(LAT, LON);
