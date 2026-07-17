// Outdoor weather for Brighton, UK via the Open-Meteo current-conditions API.
// Free, no API key, CORS-enabled — so the same fetch runs at build time and
// client-side, matching the isomorphic constraint of src/lib/adafruit.ts.

// Brighton seafront-ish. Open-Meteo snaps to its nearest grid cell.
const LAT = 50.8225;
const LON = -0.1372;

const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  "&current=temperature_2m,relative_humidity_2m";

interface RawCurrent {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
  };
}

export interface Outdoor {
  temperature: number; // °C
  humidity: number; // %RH
  at: string; // ISO timestamp of the reading
}

/** Current outdoor temperature and humidity for Brighton. */
export async function getOutdoor(): Promise<Outdoor> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);
  const raw = (await res.json()) as RawCurrent;
  const c = raw.current;
  if (!c) throw new Error("Open-Meteo: no current data");
  return {
    temperature: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    at: c.time,
  };
}
