export type WindUnit = "ms" | "kmh";

export const WIND_UNITS_COOKIE_NAME = "weather-wind-units";
export const WIND_UNITS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const MS_TO_KMH = 3.6;

export function parseWindUnit(value: string | undefined): WindUnit {
  return value === "kmh" ? "kmh" : "ms";
}

export function toggleWindUnit(unit: WindUnit): WindUnit {
  return unit === "ms" ? "kmh" : "ms";
}

export function convertWindSpeed(speedMs: number, unit: WindUnit): number {
  return unit === "kmh" ? speedMs * MS_TO_KMH : speedMs;
}

export function formatWindSpeed(
  speedMs: number,
  unit: WindUnit,
  precision = 1,
): string {
  const value = convertWindSpeed(speedMs, unit);
  return unit === "kmh"
    ? `${value.toFixed(precision)} km/h`
    : `${value.toFixed(precision)} m/s`;
}

export function getWindSpeedUnitSuffix(unit: WindUnit): string {
  return unit === "kmh" ? "km/h" : "m/s";
}
