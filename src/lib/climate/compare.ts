import {
  ARCHIVE_REVALIDATE_SECONDS,
  CLIMATE_RESOURCE_IDS,
  MONTHLY_REVALIDATE_SECONDS,
  NORMALS_REVALIDATE_SECONDS,
  datastoreDumpCsv,
  datastoreSearch,
  datastoreSearchSql,
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

/** Hourly archive abbreviations (AVG/SUM-style hourly aggregates). */
export const ARCHIVE_TEMP = "HTDRY";
export const ARCHIVE_PRECIP = "HPRAB";
export const ARCHIVE_WIND = "HWNDS";

export const NORMALS_PERIOD_LABEL = "1991–2020";

/** Soften local claims beyond this distance. */
export const DISTANCE_CAUTION_KM = 40;

/** Enough hourly rows to trust a month aggregate (≈10 days). */
const MIN_ARCHIVE_SAMPLES = 200;

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
export type ClimateBaselineKind =
  | "climateNormal"
  | "priorYearMonth"
  | "stationTypical";

interface MonthlyWindRecord {
  YEAR: number;
  MONTH: number;
  VALUE: string | number;
}

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
  source: "hourlyArchive";
  metrics: ClimateMetricComparison[];
}

export interface MonthBounds {
  year: number;
  month: number;
  start: string;
  end: string;
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

/** Previous calendar month in Europe/Riga (archive lags ~1 day; month must be complete). */
export function latestCompleteMonth(now = new Date()): MonthBounds {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Riga",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  let year = Number(parts.year);
  let month = Number(parts.month) - 1;
  if (month === 0) {
    year -= 1;
    month = 12;
  }

  return monthBounds(year, month);
}

export function monthBounds(year: number, month: number): MonthBounds {
  const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00`;
  return { year, month, start, end };
}

/** Station IDs / abbreviations are constrained constants — keep SQL literals safe. */
function assertSafeArchiveToken(value: string): string {
  if (!/^[A-Z0-9]+$/i.test(value)) {
    throw new Error(`Unsafe archive token: ${value}`);
  }
  return value;
}

interface ArchiveValueRow {
  VALUE: number | string | null;
}

async function fetchArchiveValues(
  stationId: string,
  abbreviation: string,
  bounds: MonthBounds,
): Promise<number[]> {
  const safeStation = assertSafeArchiveToken(stationId);
  const safeAbbr = assertSafeArchiveToken(abbreviation);
  const sql = `SELECT "VALUE" FROM "${CLIMATE_RESOURCE_IDS.hourlyArchive}" WHERE "STATION_ID"='${safeStation}' AND "ABBREVIATION"='${safeAbbr}' AND "DATETIME" >= '${bounds.start}' AND "DATETIME" < '${bounds.end}'`;

  const rows = await datastoreSearchSql<ArchiveValueRow>({
    sql,
    revalidate: ARCHIVE_REVALIDATE_SECONDS,
  });

  const values: number[] = [];
  for (const row of rows) {
    const value = parseOptionalNumber(row.VALUE);
    if (value !== null) values.push(value);
  }
  return values;
}

export function aggregateArchiveMean(values: number[]): number | null {
  if (values.length < MIN_ARCHIVE_SAMPLES) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function aggregateArchiveSum(values: number[]): number | null {
  if (values.length < MIN_ARCHIVE_SAMPLES) return null;
  return values.reduce((sum, value) => sum + value, 0);
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

async function loadMonthSeries(
  stationId: string,
  bounds: MonthBounds,
): Promise<{
  temperature: number | null;
  precipitation: number | null;
  wind: number | null;
}> {
  const [tempValues, precipValues, windValues] = await Promise.all([
    fetchArchiveValues(stationId, ARCHIVE_TEMP, bounds),
    fetchArchiveValues(stationId, ARCHIVE_PRECIP, bounds),
    fetchArchiveValues(stationId, ARCHIVE_WIND, bounds),
  ]);

  return {
    temperature: aggregateArchiveMean(tempValues),
    precipitation: aggregateArchiveSum(precipValues),
    wind: aggregateArchiveMean(windValues),
  };
}

/** Multi-year monthly HWNDS mean from monthly stats (archive is only ~365 days). */
export async function fetchStationTypicalWind(
  stationId: string,
  month: number,
  excludeYear: number,
): Promise<number | null> {
  const rows = await datastoreSearch<MonthlyWindRecord>({
    resourceId: CLIMATE_RESOURCE_IDS.monthlyStats,
    filters: {
      STATION_ID: stationId,
      ABBREVIATION: ARCHIVE_WIND,
      FUNCTION: "AVG",
      DECADE: 0,
      MONTH: month,
    },
    limit: 40,
    sort: "YEAR desc",
    revalidate: MONTHLY_REVALIDATE_SECONDS,
  });

  const values: number[] = [];
  for (const row of rows) {
    if (Number(row.YEAR) === excludeYear) continue;
    const value = parseOptionalNumber(row.VALUE);
    if (value !== null) values.push(value);
  }
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function resolveWindBaseline(
  stationId: string,
  period: MonthBounds,
): Promise<{ baseline: number; kind: "priorYearMonth" | "stationTypical" } | null> {
  const priorYear = monthBounds(period.year - 1, period.month);
  const priorYearWind = aggregateArchiveMean(
    await fetchArchiveValues(stationId, ARCHIVE_WIND, priorYear),
  );
  if (priorYearWind !== null) {
    return { baseline: priorYearWind, kind: "priorYearMonth" };
  }

  const typical = await fetchStationTypicalWind(stationId, period.month, period.year);
  if (typical === null) return null;
  return { baseline: typical, kind: "stationTypical" };
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

  const period = latestCompleteMonth();
  const stationId = nearest.station.id;

  const [actual, windBaseline] = await Promise.all([
    loadMonthSeries(stationId, period),
    resolveWindBaseline(stationId, period),
  ]);

  if (
    actual.temperature === null ||
    actual.precipitation === null ||
    actual.wind === null
  ) {
    return null;
  }

  const metrics: ClimateMetricComparison[] = [];

  const tempNormal = getNormal(normals, stationId, NORMAL_TEMP, period.month);
  if (tempNormal !== null) {
    metrics.push({
      kind: "temperature",
      baselineKind: "climateNormal",
      actual: actual.temperature,
      baseline: tempNormal,
      delta: actual.temperature - tempNormal,
      unit: "°C",
    });
  }

  const precipNormal = getNormal(normals, stationId, NORMAL_PRECIP, period.month);
  if (precipNormal !== null) {
    metrics.push({
      kind: "precipitation",
      baselineKind: "climateNormal",
      actual: actual.precipitation,
      baseline: precipNormal,
      delta: actual.precipitation - precipNormal,
      unit: "mm",
    });
  }

  if (windBaseline !== null) {
    metrics.push({
      kind: "wind",
      baselineKind: windBaseline.kind,
      actual: actual.wind,
      baseline: windBaseline.baseline,
      delta: actual.wind - windBaseline.baseline,
      unit: "m/s",
    });
  }

  if (metrics.length === 0) return null;

  return {
    year: period.year,
    month: period.month,
    station: nearest.station,
    distanceKm: nearest.distanceKm,
    hasClimateNormals: normals.stationIds.has(stationId),
    source: "hourlyArchive",
    metrics,
  };
}

/** Exported for tests — rebuilds a comparison from pre-aggregated fixtures. */
export function buildClimateMonthComparisonFromData(options: {
  nearest: NearestClimateStation;
  normals: CachedNormals;
  year: number;
  month: number;
  actualTemperature: number;
  actualPrecipitation: number;
  actualWind: number;
  windBaseline: { baseline: number; kind: "priorYearMonth" | "stationTypical" } | null;
}): ClimateMonthComparison | null {
  const stationId = options.nearest.station.id;
  const metrics: ClimateMetricComparison[] = [];

  const tempNormal = getNormal(options.normals, stationId, NORMAL_TEMP, options.month);
  if (tempNormal !== null) {
    metrics.push({
      kind: "temperature",
      baselineKind: "climateNormal",
      actual: options.actualTemperature,
      baseline: tempNormal,
      delta: options.actualTemperature - tempNormal,
      unit: "°C",
    });
  }

  const precipNormal = getNormal(options.normals, stationId, NORMAL_PRECIP, options.month);
  if (precipNormal !== null) {
    metrics.push({
      kind: "precipitation",
      baselineKind: "climateNormal",
      actual: options.actualPrecipitation,
      baseline: precipNormal,
      delta: options.actualPrecipitation - precipNormal,
      unit: "mm",
    });
  }

  if (options.windBaseline !== null) {
    metrics.push({
      kind: "wind",
      baselineKind: options.windBaseline.kind,
      actual: options.actualWind,
      baseline: options.windBaseline.baseline,
      delta: options.actualWind - options.windBaseline.baseline,
      unit: "m/s",
    });
  }

  if (metrics.length === 0) return null;

  return {
    year: options.year,
    month: options.month,
    station: options.nearest.station,
    distanceKm: options.nearest.distanceKm,
    hasClimateNormals: options.normals.stationIds.has(stationId),
    source: "hourlyArchive",
    metrics,
  };
}
