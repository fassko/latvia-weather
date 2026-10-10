import { LOCATION_POINT_IDS } from "./locations";
import { getWeatherAlarmRegionLabelsByText } from "./alarms";
import { createResourceCache, REVALIDATE_SECONDS } from "./cache";
import { parseHourlyForecast, parseLaiks, parseNumber } from "./parse";
import type {
  HourlyForecastRaw,
  WeatherData,
  WeatherLocationPoint,
  WeatherPointForecastRaw,
  WeatherWarning,
  WeatherWarningLevel,
  WeatherWarningRaw,
} from "./types";

const WEATHER_API_BASE = "https://videscentrs.lvgmc.lv/data";

const LOCATION_POINTS_BATCH_SIZE = 80;
/** Covers the forecast hours the map can request within a single day. */
const LOCATION_POINTS_CACHE_LIMIT = 24;
/** Caps the per-instance stale fallback so crawlers cannot grow it unbounded. */
const HOURLY_FORECAST_CACHE_LIMIT = 64;

const locationPointsCache = createResourceCache<WeatherLocationPoint[]>({
  limit: LOCATION_POINTS_CACHE_LIMIT,
  isEmpty: (value) => value.length === 0,
  staleFallback: "latest",
});
const weatherWarningsCache = createResourceCache<WeatherWarning[]>({
  isEmpty: (value) => value.length === 0,
});
const hourlyForecastCache = createResourceCache<WeatherData>({
  limit: HOURLY_FORECAST_CACHE_LIMIT,
  isEmpty: (value) => value.forecasts.length === 0,
});

function normalizeWarningText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function getWarningLevel(color: string): WeatherWarningLevel {
  const normalized = color.toLocaleLowerCase("lv");

  if (normalized.includes("dzelten")) return "yellow";
  if (normalized.includes("oran")) return "orange";
  if (normalized.includes("sarkan")) return "red";

  return "unknown";
}

export function parseWeatherWarning(raw: WeatherWarningRaw): WeatherWarning {
  return {
    id: String(raw.id),
    textLv: raw.teksts,
    textEn: raw.teksts_en,
    type: raw.veids,
    color: raw.krasa,
    level: getWarningLevel(raw.krasa),
    iconCode: raw.ikona,
    regions: raw.regions
      .split(",")
      .map((region) => region.trim())
      .filter(Boolean),
  };
}

async function fetchLocationPoints(laiks: string): Promise<WeatherLocationPoint[]> {
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

  return raw
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
}

export async function getLocationPoints(time?: Date): Promise<WeatherLocationPoint[]> {
  const laiks = formatLaiks(time ?? new Date());
  const { value } = await locationPointsCache.read(laiks, () =>
    fetchLocationPoints(laiks),
  );

  return value;
}

async function fetchWeatherWarnings(): Promise<WeatherWarning[]> {
  const url = `${WEATHER_API_BASE}/warnings`;
  const response = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Warnings API returned ${response.status}`);
  }

  const raw = (await response.json()) as WeatherWarningRaw[];

  if (!Array.isArray(raw)) {
    throw new Error("Warnings API returned invalid data");
  }

  const warnings = raw.map(parseWeatherWarning);
  const labelsByText = await getWeatherAlarmRegionLabelsByText();

  return warnings.map((warning) => {
    const labels =
      labelsByText.get(normalizeWarningText(warning.textLv)) ??
      labelsByText.get(normalizeWarningText(warning.textEn));

    return labels
      ? {
          ...warning,
          regionNamesLv: labels.lv,
          regionNamesEn: labels.en,
        }
      : warning;
  });
}

export async function getWeatherWarnings(): Promise<WeatherWarning[]> {
  try {
    const { value, isStale } = await weatherWarningsCache.read(
      "warnings",
      fetchWeatherWarnings,
    );

    return isStale
      ? value.map((warning) => ({ ...warning, isStale: true }))
      : value;
  } catch {
    return [];
  }
}

async function fetchHourlyForecast(punkts: string): Promise<WeatherData> {
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
    fetchedAt: parseLaiks(first.laiks),
    isStale: false,
  };
}

export async function getHourlyForecast(punkts: string): Promise<WeatherData> {
  const { value, isStale } = await hourlyForecastCache.read(punkts, () =>
    fetchHourlyForecast(punkts),
  );

  return isStale ? { ...value, isStale: true } : value;
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
