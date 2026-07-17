// Outdoor weather for the office's town. The data source sits behind a small
// WeatherProvider interface so a different API can be plugged in later without
// touching the card or the live poller: implement WeatherProvider and swap the
// exported `weather` binding at the bottom of this file — that's the only edit.
//
// Providers must stay isomorphic (plain `fetch`, no Node- or DOM-only APIs), as
// the same code runs at build time and client-side, matching src/lib/adafruit.ts.

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

export interface WeatherProvider {
  /** Human-readable source name, shown as attribution on the card. */
  readonly name: string;
  /** Attribution / source link for that name. */
  readonly url: string;
  /** Current outdoor conditions for the configured location. */
  getCurrent(): Promise<OutdoorReading>;
}

interface OpenMeteoRaw {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
  };
}

/** Open-Meteo provider: free, no API key, CORS-enabled. */
export function openMeteo(latitude: number, longitude: number): WeatherProvider {
  const endpoint =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    "&current=temperature_2m,relative_humidity_2m";

  return {
    name: "Open-Meteo",
    url: "https://open-meteo.com",
    async getCurrent() {
      const res = await fetch(endpoint);
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
  };
}

// The active weather source. To switch APIs, implement WeatherProvider above
// and assign the new instance here — the card and poller consume this binding
// (and its `name`/`url` for attribution) only.
export const weather: WeatherProvider = openMeteo(LAT, LON);
