import { ARCHIVE_REVALIDATE_SECONDS } from "@/lib/climate/ckan";
import {
  getClimateMonthComparison,
  monthBounds,
  NORMALS_PERIOD_LABEL,
  type ClimateMonthComparison,
} from "@/lib/climate/compare";
import { getLocationPoints } from "@/lib/weather/fetch";
import { isValidLocationId } from "@/lib/weather/locations";
import type { WeatherLocationPoint } from "@/lib/weather/types";

export { ARCHIVE_REVALIDATE_SECONDS };

export interface HistoricalClimateMetric {
  kind: "temperature" | "precipitation" | "wind";
  baselineKind: "climateNormal" | "priorYearMonth" | "stationTypical";
  actual: number;
  baseline: number;
  delta: number;
  unit: "°C" | "mm" | "m/s";
}

export interface HistoricalClimateResponse {
  punkts: string;
  location: {
    id: string;
    name: string;
    region: string;
    lat: number;
    lon: number;
  };
  period: {
    year: number;
    month: number;
    start: string;
    end: string;
  };
  station: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    distanceKm: number;
  };
  hasClimateNormals: boolean;
  source: "hourlyArchive";
  normalsPeriod: string;
  metrics: HistoricalClimateMetric[];
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

export function serializeHistoricalClimate(
  comparison: ClimateMonthComparison,
  location: WeatherLocationPoint,
): HistoricalClimateResponse {
  const period = monthBounds(comparison.year, comparison.month);

  return {
    punkts: location.id,
    location: {
      id: location.id,
      name: location.name,
      region: location.region,
      lat: location.lat,
      lon: location.lon,
    },
    period: {
      year: period.year,
      month: period.month,
      start: period.start,
      end: period.end,
    },
    station: {
      id: comparison.station.id,
      name: comparison.station.name,
      lat: comparison.station.lat,
      lon: comparison.station.lon,
      distanceKm: roundMetric(comparison.distanceKm),
    },
    hasClimateNormals: comparison.hasClimateNormals,
    source: comparison.source,
    normalsPeriod: NORMALS_PERIOD_LABEL,
    metrics: comparison.metrics.map((metric) => ({
      kind: metric.kind,
      baselineKind: metric.baselineKind,
      actual: roundMetric(metric.actual),
      baseline: roundMetric(metric.baseline),
      delta: roundMetric(metric.delta),
      unit: metric.unit,
    })),
  };
}

export async function getHistoricalClimateForPunkts(
  punkts: string,
): Promise<HistoricalClimateResponse | null> {
  if (!isValidLocationId(punkts)) {
    throw new HistoricalClimateRequestError(
      `Invalid location ID "${punkts}".`,
      400,
    );
  }

  const locations = await getLocationPoints();
  const location = locations.find((point) => point.id === punkts);
  if (!location) {
    throw new HistoricalClimateRequestError(
      `Location "${punkts}" was not found.`,
      404,
    );
  }

  const comparison = await getClimateMonthComparison({
    lat: location.lat,
    lon: location.lon,
  });
  if (!comparison) return null;

  return serializeHistoricalClimate(comparison, location);
}

export async function getHistoricalClimateForCoordinates(origin: {
  lat: number;
  lon: number;
  punkts?: string;
  name?: string;
  region?: string;
}): Promise<HistoricalClimateResponse | null> {
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) {
    throw new HistoricalClimateRequestError(
      "Query params lat and lon must be finite numbers.",
      400,
    );
  }

  const comparison = await getClimateMonthComparison({
    lat: origin.lat,
    lon: origin.lon,
  });
  if (!comparison) return null;

  const location: WeatherLocationPoint = {
    id: origin.punkts ?? "custom",
    name: origin.name ?? "Custom location",
    region: origin.region ?? "",
    lat: origin.lat,
    lon: origin.lon,
    temperature: 0,
    windSpeed: 0,
    windDirection: 0,
    iconCode: "",
  };

  return serializeHistoricalClimate(comparison, location);
}

export class HistoricalClimateRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HistoricalClimateRequestError";
    this.status = status;
  }
}
