import { LOCATION_POINT_IDS } from "./locations";
import { getDataGovHourlyForecast, getDataGovLocationPoints } from "./data-gov";
import { parseHourlyForecasts, parseLaiks, parseNumber } from "./parse";
import { formatLaiks } from "./timezone";
import type {
  HourlyForecastRaw,
  WeatherData,
  WeatherLocationPoint,
  WeatherPointForecastRaw,
} from "./types";

export { getWeatherWarnings } from "./alarms";
export { formatLaiks } from "./timezone";

const WEATHER_API_BASE = "https://videscentrs.lvgmc.lv/data";

export const REVALIDATE_SECONDS = 900;

export const STALE_REFRESH_MS = REVALIDATE_SECONDS * 1000;

const STALE_FALLBACK_MS = 6 * 60 * 60 * 1000;
const LOCATION_POINTS_BATCH_SIZE = 80;
/** Caps the per-instance stale fallback so crawlers cannot grow it unbounded. */
const HOURLY_FORECAST_CACHE_LIMIT = 64;
const LOCATION_POINTS_CACHE_LIMIT = 80;

interface CachedValue<T> {
  value: T;
  storedAt: number;
}

const locationPointsCache = new Map<string, CachedValue<WeatherLocationPoint[]>>();
const hourlyForecastCache = new Map<string, CachedValue<WeatherData>>();

function isUsableStaleValue<T>(
  cache: CachedValue<T>,
  isEmpty: (value: T) => boolean,
): boolean {
  return !isEmpty(cache.value) && Date.now() - cache.storedAt <= STALE_FALLBACK_MS;
}

function rememberLocationPoints(laiks: string, value: WeatherLocationPoint[]) {
  locationPointsCache.delete(laiks);
  locationPointsCache.set(laiks, { value, storedAt: Date.now() });
  while (locationPointsCache.size > LOCATION_POINTS_CACHE_LIMIT) {
    const oldestKey = locationPointsCache.keys().next().value;
    if (oldestKey === undefined) break;
    locationPointsCache.delete(oldestKey);
  }
}

function rememberHourlyForecast(punkts: string, value: WeatherData) {
  // Re-inserting keeps the Map ordered from least to most recently used.
  hourlyForecastCache.delete(punkts);
  hourlyForecastCache.set(punkts, {
    value,
    storedAt: Date.now(),
  });

  while (hourlyForecastCache.size > HOURLY_FORECAST_CACHE_LIMIT) {
    const oldestKey = hourlyForecastCache.keys().next().value;
    if (oldestKey === undefined) break;
    hourlyForecastCache.delete(oldestKey);
  }
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function hasCurrentForecast(value: WeatherData, now = Date.now()): boolean {
  return value.forecasts.some((forecast) =>
    Number.isFinite(forecast.time.getTime()) &&
    forecast.time.getTime() + 3_600_000 > now,
  );
}

export async function getLocationPoints(time?: Date): Promise<WeatherLocationPoint[]> {
  const laiks = formatLaiks(time ?? new Date());
  const fresh = locationPointsCache.get(laiks);
  if (fresh && Date.now() - fresh.storedAt < REVALIDATE_SECONDS * 1000) {
    return fresh.value;
  }

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
        windSpeed: parseNumber(point.veja_atrums),
        windDirection: parseNumber(point.veja_virziens),
        iconCode: point.laika_apstaklu_ikona,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "lv"));

    rememberLocationPoints(laiks, points);
    return points;
  } catch (error) {
    try {
      const points = await getDataGovLocationPoints(time ?? new Date());
      rememberLocationPoints(laiks, points);
      return points;
    } catch {
      // Keep the last usable response if both public sources are unavailable.
    }
    const cached = locationPointsCache.get(laiks);
    if (cached && isUsableStaleValue(cached, (value) => value.length === 0)) {
      return cached.value;
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
      forecasts: parseHourlyForecasts(raw),
      fetchedAt: parseLaiks(first.laiks),
      isStale: false,
    };

    if (!hasCurrentForecast(data)) {
      throw new Error(`Weather API returned an expired forecast for ${punkts}`);
    }

    rememberHourlyForecast(punkts, data);
    return data;
  } catch (error) {
    try {
      const data = await getDataGovHourlyForecast(punkts);
      rememberHourlyForecast(punkts, data);
      return data;
    } catch {
      // Keep the last usable response if both public sources are unavailable.
    }
    const cached = hourlyForecastCache.get(punkts);

    if (
      cached &&
      isUsableStaleValue(cached, (value) => !hasCurrentForecast(value))
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
