import { datastoreSearch, datastoreSearchSql } from "@/lib/climate/ckan";
import { isValidLocationId, LOCATION_POINT_IDS } from "./locations";
import { formatLaiks, parseLaiks } from "./timezone";
import type { HourlyForecast, WeatherData, WeatherLocationPoint } from "./types";

const HOURLY_RESOURCE_ID = "4e9b37dc-a486-4af1-8964-b370f659811a";
const LOCATIONS_RESOURCE_ID = "f692fae6-99cd-4bee-95ec-f158a595873a";
const FORECAST_REVALIDATE_SECONDS = 900;
const LOCATIONS_REVALIDATE_SECONDS = 86_400;
const BATCH_SIZE = 80;

interface ForecastRow {
  CITY_ID: string;
  PARA_ID: number;
  DATUMS: string;
  VERTIBA: number | null;
}

interface CityRow {
  CITY_ID: string;
  NOSAUKUMS: string;
  PAGASTS_NOVADS: string;
  LAT: number;
  LON: number;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function sqlIds(ids: readonly string[]): string {
  // IDs are taken only from our fixed allowlist, never from request input.
  return ids.map((id) => `'${id}'`).join(",");
}

function localTimestamp(date: Date): string {
  const value = formatLaiks(date);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:00:00`;
}

function parseLocalTimestamp(value: string): Date {
  return parseLaiks(value.replace(/\D/g, "").slice(0, 12));
}

async function getCity(punkts: string): Promise<CityRow> {
  const rows = await datastoreSearch<CityRow>({
    resourceId: LOCATIONS_RESOURCE_ID,
    filters: { CITY_ID: punkts },
    limit: 1,
    revalidate: LOCATIONS_REVALIDATE_SECONDS,
  });
  if (!rows[0]) throw new Error(`data.gov.lv has no city ${punkts}`);
  return rows[0];
}

async function getCities(): Promise<Map<string, CityRow>> {
  const first = await datastoreSearch<CityRow>({
    resourceId: LOCATIONS_RESOURCE_ID,
    limit: 5000,
    revalidate: LOCATIONS_REVALIDATE_SECONDS,
  });
  const rest = first.length === 5000
    ? await datastoreSearch<CityRow>({
        resourceId: LOCATIONS_RESOURCE_ID,
        limit: 5000,
        offset: 5000,
        revalidate: LOCATIONS_REVALIDATE_SECONDS,
      })
    : [];
  return new Map([...first, ...rest].map((city) => [city.CITY_ID, city]));
}

function numeric(values: Map<number, number | null>, id: number): number | null {
  const value = values.get(id);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function required(values: Map<number, number | null>, id: number): number {
  const value = numeric(values, id);
  if (value === null) throw new Error(`data.gov.lv forecast is missing parameter ${id}`);
  return value;
}

function forecastFromValues(time: string, values: Map<number, number | null>): HourlyForecast {
  return {
    time: parseLocalTimestamp(time),
    iconCode: String(required(values, 1)),
    temperature: required(values, 2),
    feelsLike: required(values, 3),
    windSpeed: required(values, 4),
    windDirection: required(values, 5),
    windGust: required(values, 6),
    precipitation: required(values, 7),
    pressure: required(values, 8),
    humidity: required(values, 9),
    uvIndex: numeric(values, 10),
    thunderProbability: numeric(values, 11) ?? 0,
    precipitationProbability: null,
    cloudCover: null,
    snow: null,
  };
}

export async function getDataGovHourlyForecast(punkts: string): Promise<WeatherData> {
  if (!isValidLocationId(punkts)) {
    throw new Error(`Invalid forecast location ${punkts}`);
  }
  const [city, rows] = await Promise.all([
    getCity(punkts),
    datastoreSearchSql<ForecastRow>({
      sql: `SELECT "CITY_ID", "PARA_ID", "DATUMS", "VERTIBA" FROM "${HOURLY_RESOURCE_ID}" WHERE "CITY_ID"='${punkts}' LIMIT 500`,
      revalidate: FORECAST_REVALIDATE_SECONDS,
    }),
  ]);

  const byTime = new Map<string, Map<number, number | null>>();
  for (const row of rows) {
    const values = byTime.get(row.DATUMS) ?? new Map<number, number | null>();
    values.set(row.PARA_ID, row.VERTIBA);
    byTime.set(row.DATUMS, values);
  }
  const forecasts = [...byTime]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, values]) => forecastFromValues(time, values));
  if (!forecasts.some((forecast) => forecast.time.getTime() + 3_600_000 > Date.now())) {
    throw new Error(`data.gov.lv has no current hourly forecast for ${punkts}`);
  }

  return {
    location: {
      id: city.CITY_ID,
      name: city.NOSAUKUMS,
      region: city.PAGASTS_NOVADS,
      lat: city.LAT,
      lon: city.LON,
    },
    forecasts,
    fetchedAt: forecasts[0].time,
    isStale: false,
  };
}

export async function getDataGovLocationPoints(time: Date): Promise<WeatherLocationPoint[]> {
  const timestamp = localTimestamp(time);
  const [cities, rowBatches] = await Promise.all([
    getCities(),
    Promise.all(chunks(LOCATION_POINT_IDS, BATCH_SIZE).map((ids) =>
      datastoreSearchSql<ForecastRow>({
        sql: `SELECT "CITY_ID", "PARA_ID", "DATUMS", "VERTIBA" FROM "${HOURLY_RESOURCE_ID}" WHERE "CITY_ID" IN (${sqlIds(ids)}) AND "DATUMS"='${timestamp}' AND "PARA_ID" IN (1,2,4,5) LIMIT 500`,
        revalidate: FORECAST_REVALIDATE_SECONDS,
      }),
    )),
  ]);

  const byCity = new Map<string, Map<number, number | null>>();
  for (const row of rowBatches.flat()) {
    const values = byCity.get(row.CITY_ID) ?? new Map<number, number | null>();
    values.set(row.PARA_ID, row.VERTIBA);
    byCity.set(row.CITY_ID, values);
  }

  const points = [...byCity].flatMap(([id, values]) => {
    const city = cities.get(id);
    if (!city || numeric(values, 1) === null || numeric(values, 2) === null) return [];
    return [{
      id,
      name: city.NOSAUKUMS,
      region: city.PAGASTS_NOVADS,
      lat: city.LAT,
      lon: city.LON,
      temperature: required(values, 2),
      windSpeed: numeric(values, 4) ?? 0,
      windDirection: numeric(values, 5) ?? 0,
      iconCode: String(required(values, 1)),
      source: "data.gov.lv" as const,
    }];
  }).sort((a, b) => a.name.localeCompare(b.name, "lv"));

  if (points.length === 0) throw new Error(`data.gov.lv has no location forecast for ${timestamp}`);
  return points;
}
