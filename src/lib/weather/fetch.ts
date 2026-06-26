import { LOCATION_POINT_IDS } from "./locations";
import { parseHourlyForecast, parseNumber } from "./parse";
import type {
  HourlyForecastRaw,
  WeatherData,
  WeatherLocationPoint,
  WeatherPointForecastRaw,
} from "./types";

const WEATHER_API_BASE = "https://videscentrs.lvgmc.lv/data";

export const REVALIDATE_SECONDS = 900;

export const STALE_REFRESH_MS = REVALIDATE_SECONDS * 1000;

/** LVĢMC expects `laiks` in Europe/Riga local time (start of current hour). */
export function formatLaiks(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}${parts.month}${parts.day}${hour}00`;
}

export async function getLocationPoints(time?: Date): Promise<WeatherLocationPoint[]> {
  const laiks = formatLaiks(time ?? new Date());
  const punkti = LOCATION_POINT_IDS.join(",");
  const url = `${WEATHER_API_BASE}/weather_points_forecast?laiks=${laiks}&punkti=${encodeURIComponent(punkti)}`;

  const response = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Location points API returned ${response.status}`);
  }

  const raw = (await response.json()) as WeatherPointForecastRaw[];

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Location points API returned empty data");
  }

  return raw
    .map((point) => ({
      id: point.punkts,
      name: point.nosaukums,
      region: point.novads,
      lat: parseNumber(point.lat),
      lon: parseNumber(point.lon),
      temperature: parseNumber(point.temperatura),
      iconCode: point.laika_apstaklu_ikona,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "lv"));
}

export async function getHourlyForecast(punkts: string): Promise<WeatherData> {
  const url = `${WEATHER_API_BASE}/weather_forecast_for_location_hourly?punkts=${encodeURIComponent(punkts)}`;

  const response = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Weather API returned ${response.status}`);
  }

  const raw = (await response.json()) as HourlyForecastRaw[];

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Weather API returned empty data");
  }

  const first = raw[0];

  return {
    location: {
      id: first.punkts,
      name: first.nosaukums,
      region: first.novads,
      lat: 0,
      lon: 0,
    },
    forecasts: raw.map(parseHourlyForecast),
  };
}
