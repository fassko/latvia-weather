import { LOCATION_POINT_IDS } from "./locations";
import { parseHourlyForecast, parseLaiks, parseNumber } from "./parse";
import type {
  HourlyForecastRaw,
  WeatherData,
  WeatherLocationPoint,
  WeatherPointForecastRaw,
} from "./types";

const WEATHER_API_BASE = "https://videscentrs.lvgmc.lv/data";

export const REVALIDATE_SECONDS = 900;

export const STALE_REFRESH_MS = REVALIDATE_SECONDS * 1000;

const STALE_FALLBACK_MS = 6 * 60 * 60 * 1000;
const LOCATION_POINTS_BATCH_SIZE = 80;

interface CachedValue<T> {
  value: T;
  storedAt: number;
}

const locationPointsCache: CachedValue<WeatherLocationPoint[]> = {
  value: [],
  storedAt: 0,
};
const hourlyForecastCache = new Map<string, CachedValue<WeatherData>>();

function isUsableStaleValue<T>(
  cache: CachedValue<T>,
  isEmpty: (value: T) => boolean,
): boolean {
  return !isEmpty(cache.value) && Date.now() - cache.storedAt <= STALE_FALLBACK_MS;
}

function rememberLocationPoints(value: WeatherLocationPoint[]) {
  locationPointsCache.value = value;
  locationPointsCache.storedAt = Date.now();
}

function rememberHourlyForecast(punkts: string, value: WeatherData) {
  hourlyForecastCache.set(punkts, {
    value,
    storedAt: Date.now(),
  });
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

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

  try {
    const raw = (
      await Promise.all(
        chunkArray(LOCATION_POINT_IDS, LOCATION_POINTS_BATCH_SIZE).map(
          async (batch) => {
            const punkti = batch.join(",");
            const url = `${WEATHER_API_BASE}/weather_points_forecast?laiks=${laiks}&punkti=${encodeURIComponent(punkti)}`;
            const response = await fetch(url, {
              next: { revalidate: REVALIDATE_SECONDS },
            });

            if (!response.ok) {
              throw new Error(`Location points API returned ${response.status}`);
            }

            return (await response.json()) as WeatherPointForecastRaw[];
          },
        ),
      )
    ).flat();

    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("Location points API returned empty data");
    }

    const points = raw
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

    rememberLocationPoints(points);
    return points;
  } catch (error) {
    if (isUsableStaleValue(locationPointsCache, (value) => value.length === 0)) {
      return locationPointsCache.value;
    }

    throw error;
  }
}

export async function getHourlyForecast(punkts: string): Promise<WeatherData> {
  const url = `${WEATHER_API_BASE}/weather_forecast_for_location_hourly?punkts=${encodeURIComponent(punkts)}`;

  try {
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
    const data = {
      location: {
        id: first.punkts,
        name: first.nosaukums,
        region: first.novads,
        lat: 0,
        lon: 0,
      },
      forecasts: raw.map(parseHourlyForecast),
      fetchedAt: parseLaiks(first.laiks),
      isStale: false,
    };

    rememberHourlyForecast(punkts, data);
    return data;
  } catch (error) {
    const cached = hourlyForecastCache.get(punkts);

    if (
      cached &&
      isUsableStaleValue(cached, (value) => value.forecasts.length === 0)
    ) {
      return {
        ...cached.value,
        isStale: true,
      };
    }

    throw error;
  }
}

export function mergeForecastLocation(
  data: WeatherData,
  locations: WeatherLocationPoint[],
): WeatherData {
  const location = locations.find((point) => point.id === data.location.id);

  if (!location) return data;

  return {
    ...data,
    location: {
      id: location.id,
      name: location.name,
      region: location.region,
      lat: location.lat,
      lon: location.lon,
    },
  };
}
