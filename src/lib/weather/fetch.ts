import { format, startOfHour } from "date-fns";
import { LOCATION_POINT_IDS } from "./locations";
import { parseHourlyForecast, parseNumber } from "./parse";
import type {
  HourlyForecastRaw,
  WeatherData,
  WeatherLocationPoint,
  WeatherPointForecastRaw,
} from "./types";

const WEATHER_API_BASE = "https://videscentrs.lvgmc.lv/data";

export const REVALIDATE_SECONDS = 1800;

export function formatLaiks(date: Date): string {
  return format(startOfHour(date), "yyyyMMddHHmm");
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
    },
    forecasts: raw.map(parseHourlyForecast),
  };
}
