import {
  CLIMATE_RESOURCE_IDS,
  MONTHLY_REVALIDATE_SECONDS,
  NORMALS_REVALIDATE_SECONDS,
  datastoreDumpCsv,
  datastoreSearch,
  parseCsv,
  parseOptionalNumber,
} from "./ckan";
import {
  findNearestClimateStation,
  getClimateStations,
  type ClimateStation,
  type NearestClimateStation,
} from "./stations";

/** Official 1991–2020 normals abbreviations. */
export const NORMAL_TEMP = "TDRY";
export const NORMAL_PRECIP = "PRAB";

/** Monthly / archive abbreviations (H-prefix hourly aggregates). */
export const MONTHLY_TEMP = "HTDRY";
export const MONTHLY_PRECIP = "HPRAB";
export const MONTHLY_WIND = "HWNDS";

export const NORMALS_PERIOD_LABEL = "1991–2020";

/** Soften local claims beyond this distance. */
export const DISTANCE_CAUTION_KM = 40;

interface MonthlyRecord {
  STATION_ID: string;
  ABBREVIATION: string;
  FUNCTION: string;
  YEAR: number;
  MONTH: number;
  DECADE: number;
  VALUE: string | number;
}

interface CachedNormals {
  byStationMonth: Map<string, number>;
  stationIds: Set<string>;
  storedAt: number;
}

const STALE_FALLBACK_MS = 14 * 24 * 60 * 60 * 1000;
const normalsCache: CachedNormals = {
  byStationMonth: new Map(),
  stationIds: new Set(),
  storedAt: 0,
};

export type ClimateMetricKind = "temperature" | "precipitation" | "wind";
export type ClimateBaselineKind = "climateNormal" | "stationTypical";

export interface ClimateMetricComparison {
  kind: ClimateMetricKind;
  baselineKind: ClimateBaselineKind;
  actual: number;
  baseline: number;
  delta: number;
  unit: "°C" | "mm" | "m/s";
}

export interface ClimateMonthComparison {
  year: number;
  month: number;
  station: ClimateStation;
  distanceKm: number;
  hasClimateNormals: boolean;
  metrics: ClimateMetricComparison[];
}

function normalKey(stationId: string, abbreviation: string, month: number): string {
  return `${stationId}|${abbreviation}|${month}`;
}

async function loadNormalsIndex(): Promise<CachedNormals> {
  if (
    normalsCache.byStationMonth.size > 0 &&
    Date.now() - normalsCache.storedAt < NORMALS_REVALIDATE_SECONDS * 1000
  ) {
    return normalsCache;
  }

  try {
    const csv = await datastoreDumpCsv(
      CLIMATE_RESOURCE_IDS.normals,
      NORMALS_REVALIDATE_SECONDS,
    );
    const byStationMonth = new Map<string, number>();
    const stationIds = new Set<string>();

    for (const row of parseCsv(csv)) {
      const decade = parseOptionalNumber(row.DECADE);
      const month = parseOptionalNumber(row.MONTH);
      const normal = parseOptionalNumber(row.NORMAL);
      const stationId = row.STATION_ID?.trim();
      const abbreviation = row.ABBREVIATION?.trim();

      // Decade 0 = full month; months 1–12 only (13 = annual).
      if (
        !stationId ||
        !abbreviation ||
        decade !== 0 ||
        month === null ||
        month < 1 ||
        month > 12 ||
        normal === null
      ) {
        continue;
      }

      stationIds.add(stationId);
      byStationMonth.set(normalKey(stationId, abbreviation, month), normal);
    }

    if (byStationMonth.size === 0) {
      throw new Error("Climate normals dump had no usable month rows");
    }

    normalsCache.byStationMonth = byStationMonth;
    normalsCache.stationIds = stationIds;
    normalsCache.storedAt = Date.now();
    return normalsCache;
  } catch (error) {
    if (
      normalsCache.byStationMonth.size > 0 &&
      Date.now() - normalsCache.storedAt <= STALE_FALLBACK_MS
    ) {
      return normalsCache;
    }
    throw error;
  }
}

function getNormal(
  index: CachedNormals,
  stationId: string,
  abbreviation: string,
  month: number,
): number | null {
  return index.byStationMonth.get(normalKey(stationId, abbreviation, month)) ?? null;
}

async function fetchMonthlyRows(
  stationId: string,
  abbreviation: string,
  functionName: string,
): Promise<MonthlyRecord[]> {
  return datastoreSearch<MonthlyRecord>({
    resourceId: CLIMATE_RESOURCE_IDS.monthlyStats,
    filters: {
      STATION_ID: stationId,
      ABBREVIATION: abbreviation,
      FUNCTION: functionName,
      DECADE: 0,
    },
    limit: 400,
    sort: "YEAR desc, MONTH desc",
    revalidate: MONTHLY_REVALIDATE_SECONDS,
  });
}

function monthValue(record: MonthlyRecord): number | null {
  return parseOptionalNumber(record.VALUE);
}

/** Latest calendar month that has a non-blank value for every required series. */
export function findLatestCompleteMonth(series: {
  temperature: MonthlyRecord[];
  precipitation: MonthlyRecord[];
  wind: MonthlyRecord[];
}): { year: number; month: number } | null {
  const precipByMonth = new Map<string, number>();
  const windByMonth = new Map<string, number>();

  for (const record of series.precipitation) {
    const value = monthValue(record);
    if (value === null) continue;
    precipByMonth.set(`${record.YEAR}-${record.MONTH}`, value);
  }
  for (const record of series.wind) {
    const value = monthValue(record);
    if (value === null) continue;
    windByMonth.set(`${record.YEAR}-${record.MONTH}`, value);
  }

  for (const record of series.temperature) {
    const temp = monthValue(record);
    if (temp === null) continue;
    const key = `${record.YEAR}-${record.MONTH}`;
    if (!precipByMonth.has(key) || !windByMonth.has(key)) continue;
    return { year: Number(record.YEAR), month: Number(record.MONTH) };
  }

  return null;
}

export function typicalMonthlyMean(
  records: MonthlyRecord[],
  month: number,
  excludeYear?: number,
): number | null {
  const values: number[] = [];
  for (const record of records) {
    if (Number(record.MONTH) !== month) continue;
    if (excludeYear !== undefined && Number(record.YEAR) === excludeYear) continue;
    const value = monthValue(record);
    if (value === null) continue;
    values.push(value);
  }
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMonthActual(
  records: MonthlyRecord[],
  year: number,
  month: number,
): number | null {
  for (const record of records) {
    if (Number(record.YEAR) === year && Number(record.MONTH) === month) {
      return monthValue(record);
    }
  }
  return null;
}

export function classifyTemperatureDelta(delta: number): "warmer" | "colder" | "usual" {
  if (delta >= 0.5) return "warmer";
  if (delta <= -0.5) return "colder";
  return "usual";
}

export function classifyPrecipitationDelta(
  actual: number,
  baseline: number,
): "rainier" | "drier" | "usual" {
  if (baseline <= 0) {
    if (actual <= 0) return "usual";
    return "rainier";
  }
  const ratio = actual / baseline;
  if (ratio >= 1.15) return "rainier";
  if (ratio <= 0.85) return "drier";
  return "usual";
}

export function classifyWindDelta(delta: number): "windier" | "calmer" | "usual" {
  if (delta >= 0.3) return "windier";
  if (delta <= -0.3) return "calmer";
  return "usual";
}

export async function getClimateMonthComparison(origin: {
  lat: number;
  lon: number;
}): Promise<ClimateMonthComparison | null> {
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) {
    return null;
  }

  const [stations, normals] = await Promise.all([
    getClimateStations(),
    loadNormalsIndex(),
  ]);

  const nearest: NearestClimateStation | null = findNearestClimateStation(
    origin,
    stations,
    normals.stationIds,
  );
  if (!nearest) return null;

  const stationId = nearest.station.id;
  const [temperatureRows, precipRows, windRows] = await Promise.all([
    fetchMonthlyRows(stationId, MONTHLY_TEMP, "AVG"),
    fetchMonthlyRows(stationId, MONTHLY_PRECIP, "SUM"),
    fetchMonthlyRows(stationId, MONTHLY_WIND, "AVG"),
  ]);

  const latest = findLatestCompleteMonth({
    temperature: temperatureRows,
    precipitation: precipRows,
    wind: windRows,
  });
  if (!latest) return null;

  const actualTemp = getMonthActual(temperatureRows, latest.year, latest.month);
  const actualPrecip = getMonthActual(precipRows, latest.year, latest.month);
  const actualWind = getMonthActual(windRows, latest.year, latest.month);
  if (actualTemp === null || actualPrecip === null || actualWind === null) {
    return null;
  }

  const metrics: ClimateMetricComparison[] = [];

  const tempNormal = getNormal(normals, stationId, NORMAL_TEMP, latest.month);
  if (tempNormal !== null) {
    metrics.push({
      kind: "temperature",
      baselineKind: "climateNormal",
      actual: actualTemp,
      baseline: tempNormal,
      delta: actualTemp - tempNormal,
      unit: "°C",
    });
  }

  const precipNormal = getNormal(normals, stationId, NORMAL_PRECIP, latest.month);
  if (precipNormal !== null) {
    metrics.push({
      kind: "precipitation",
      baselineKind: "climateNormal",
      actual: actualPrecip,
      baseline: precipNormal,
      delta: actualPrecip - precipNormal,
      unit: "mm",
    });
  }

  const windTypical = typicalMonthlyMean(windRows, latest.month, latest.year);
  if (windTypical !== null) {
    metrics.push({
      kind: "wind",
      baselineKind: "stationTypical",
      actual: actualWind,
      baseline: windTypical,
      delta: actualWind - windTypical,
      unit: "m/s",
    });
  }

  if (metrics.length === 0) return null;

  return {
    year: latest.year,
    month: latest.month,
    station: nearest.station,
    distanceKm: nearest.distanceKm,
    hasClimateNormals: normals.stationIds.has(stationId),
    metrics,
  };
}

/** Exported for tests — rebuilds a comparison from in-memory fixtures. */
export function buildClimateMonthComparisonFromData(options: {
  nearest: NearestClimateStation;
  normals: CachedNormals;
  temperature: MonthlyRecord[];
  precipitation: MonthlyRecord[];
  wind: MonthlyRecord[];
}): ClimateMonthComparison | null {
  const latest = findLatestCompleteMonth({
    temperature: options.temperature,
    precipitation: options.precipitation,
    wind: options.wind,
  });
  if (!latest) return null;

  const stationId = options.nearest.station.id;
  const actualTemp = getMonthActual(options.temperature, latest.year, latest.month);
  const actualPrecip = getMonthActual(options.precipitation, latest.year, latest.month);
  const actualWind = getMonthActual(options.wind, latest.year, latest.month);
  if (actualTemp === null || actualPrecip === null || actualWind === null) return null;

  const metrics: ClimateMetricComparison[] = [];
  const tempNormal = getNormal(options.normals, stationId, NORMAL_TEMP, latest.month);
  if (tempNormal !== null) {
    metrics.push({
      kind: "temperature",
      baselineKind: "climateNormal",
      actual: actualTemp,
      baseline: tempNormal,
      delta: actualTemp - tempNormal,
      unit: "°C",
    });
  }
  const precipNormal = getNormal(options.normals, stationId, NORMAL_PRECIP, latest.month);
  if (precipNormal !== null) {
    metrics.push({
      kind: "precipitation",
      baselineKind: "climateNormal",
      actual: actualPrecip,
      baseline: precipNormal,
      delta: actualPrecip - precipNormal,
      unit: "mm",
    });
  }
  const windTypical = typicalMonthlyMean(options.wind, latest.month, latest.year);
  if (windTypical !== null) {
    metrics.push({
      kind: "wind",
      baselineKind: "stationTypical",
      actual: actualWind,
      baseline: windTypical,
      delta: actualWind - windTypical,
      unit: "m/s",
    });
  }
  if (metrics.length === 0) return null;

  return {
    year: latest.year,
    month: latest.month,
    station: options.nearest.station,
    distanceKm: options.nearest.distanceKm,
    hasClimateNormals: options.normals.stationIds.has(stationId),
    metrics,
  };
}
