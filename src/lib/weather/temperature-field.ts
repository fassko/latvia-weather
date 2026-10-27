import { LATVIA_BOUNDS } from "@/lib/weather/map-view";

/**
 * Temperature colour wash for the map: an inverse-distance-weighted grid over
 * Latvia, faded out away from forecast places so it roughly traces the border
 * and coast. The iOS app builds the same field, so keep the numbers in sync.
 */

export interface TemperatureFieldPoint {
  lat: number;
  lon: number;
  temperature: number;
}

export interface TemperatureFieldOptions {
  bounds?: [[number, number], [number, number]];
  /** Columns; rows follow from the bounds' Web Mercator aspect. */
  width?: number;
}

export interface TemperatureField {
  width: number;
  height: number;
  /** Row-major, north row first. NaN where no place is within the search radius. */
  values: Float32Array;
  /** Row-major, north row first. 0 to 1. */
  alpha: Float32Array;
}

export const TEMPERATURE_FIELD_WIDTH = 240;
export const TEMPERATURE_FIELD_SEARCH_RADIUS_KM = 60;
export const TEMPERATURE_FIELD_EXACT_KM = 0.5;
export const TEMPERATURE_FIELD_SOLID_KM = 8;
export const TEMPERATURE_FIELD_FADE_KM = 20;

const KM_PER_DEGREE_LON = 111.32;
const KM_PER_DEGREE_LAT = 110.57;

/** Colour stops for the wash and the legend gradient, coldest first. */
export const TEMPERATURE_FIELD_STOPS: ReadonlyArray<{
  temperature: number;
  color: string;
}> = [
  { temperature: -20, color: "#1e3a8a" },
  { temperature: -10, color: "#1d4ed8" },
  { temperature: -2, color: "#2563eb" },
  { temperature: 3, color: "#0284c7" },
  { temperature: 8, color: "#0ea5e9" },
  { temperature: 13, color: "#0f766e" },
  { temperature: 18, color: "#15803d" },
  { temperature: 23, color: "#ca8a04" },
  { temperature: 28, color: "#f97316" },
  { temperature: 33, color: "#ef4444" },
];

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const STOP_RGB = TEMPERATURE_FIELD_STOPS.map((stop) => hexToRgb(stop.color));

/** Colour for a temperature, linearly interpolated in RGB and clamped at the ends. */
export function temperatureFieldColor(temperature: number): [number, number, number] {
  const stops = TEMPERATURE_FIELD_STOPS;
  if (!(temperature > stops[0].temperature)) return [...STOP_RGB[0]];

  const last = stops.length - 1;
  if (temperature >= stops[last].temperature) return [...STOP_RGB[last]];

  let upper = 1;
  while (stops[upper].temperature < temperature) upper += 1;

  const lower = upper - 1;
  const t =
    (temperature - stops[lower].temperature) /
    (stops[upper].temperature - stops[lower].temperature);
  const from = STOP_RGB[lower];
  const to = STOP_RGB[upper];

  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

/** CSS `linear-gradient` for the legend bar, using the same stops as the wash. */
export function temperatureFieldGradientCss(): string {
  const first = TEMPERATURE_FIELD_STOPS[0].temperature;
  const span = TEMPERATURE_FIELD_STOPS.at(-1)!.temperature - first;
  const stops = TEMPERATURE_FIELD_STOPS.map(
    (stop) =>
      `${stop.color} ${(((stop.temperature - first) / span) * 100).toFixed(2)}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** Where a temperature sits on the legend bar, 0 to 1. */
export function temperatureFieldLegendPosition(temperature: number): number {
  const first = TEMPERATURE_FIELD_STOPS[0].temperature;
  const last = TEMPERATURE_FIELD_STOPS.at(-1)!.temperature;
  return Math.min(1, Math.max(0, (temperature - first) / (last - first)));
}

function mercatorY(latitude: number): number {
  const radians = (latitude * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function latitudeFromMercatorY(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/** Rows for a field `width` columns wide, so the grid keeps the bounds' Web Mercator aspect. */
export function temperatureFieldHeight(
  width: number,
  bounds: [[number, number], [number, number]] = LATVIA_BOUNDS,
): number {
  const [[south, west], [north, east]] = bounds;
  const xRange = ((east - west) * Math.PI) / 180;
  const yRange = mercatorY(north) - mercatorY(south);
  return Math.round((width * yRange) / xRange);
}

function fadeAlpha(distanceKm: number): number {
  if (distanceKm <= TEMPERATURE_FIELD_SOLID_KM) return 1;
  if (distanceKm >= TEMPERATURE_FIELD_FADE_KM) return 0;
  return (
    (TEMPERATURE_FIELD_FADE_KM - distanceKm) /
    (TEMPERATURE_FIELD_FADE_KM - TEMPERATURE_FIELD_SOLID_KM)
  );
}

export function buildTemperatureField(
  points: ReadonlyArray<TemperatureFieldPoint>,
  options: TemperatureFieldOptions = {},
): TemperatureField {
  const bounds = options.bounds ?? LATVIA_BOUNDS;
  const width = options.width ?? TEMPERATURE_FIELD_WIDTH;
  const height = temperatureFieldHeight(width, bounds);
  const [[south, west], [north, east]] = bounds;
  const meanLatRadians = (((south + north) / 2) * Math.PI) / 180;
  const kmPerLon = Math.cos(meanLatRadians) * KM_PER_DEGREE_LON;
  const radius = TEMPERATURE_FIELD_SEARCH_RADIUS_KM;
  const radiusSquared = radius * radius;
  const exactSquared = TEMPERATURE_FIELD_EXACT_KM * TEMPERATURE_FIELD_EXACT_KM;

  const valid = points.filter(
    (point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon) &&
      Number.isFinite(point.temperature),
  );
  const lats = Float64Array.from(valid, (point) => point.lat);
  const lons = Float64Array.from(valid, (point) => point.lon);
  const temps = Float64Array.from(valid, (point) => point.temperature);

  // Buckets one search radius wide, so a cell only needs its 3×3 neighbours.
  const bucketLat = radius / KM_PER_DEGREE_LAT;
  const bucketLon = radius / kmPerLon;
  const bucketKey = (row: number, col: number) => row * 65536 + col;
  const buckets = new Map<number, number[]>();
  for (let index = 0; index < valid.length; index += 1) {
    const key = bucketKey(
      Math.floor((lats[index] - south) / bucketLat),
      Math.floor((lons[index] - west) / bucketLon),
    );
    const bucket = buckets.get(key);
    if (bucket) bucket.push(index);
    else buckets.set(key, [index]);
  }

  const values = new Float32Array(width * height);
  const alpha = new Float32Array(width * height);
  const northY = mercatorY(north);
  const rowStepY = (northY - mercatorY(south)) / height;
  const columnStepLon = (east - west) / width;

  for (let row = 0; row < height; row += 1) {
    const lat = latitudeFromMercatorY(northY - (row + 0.5) * rowStepY);
    const bucketRow = Math.floor((lat - south) / bucketLat);

    for (let col = 0; col < width; col += 1) {
      const lon = west + (col + 0.5) * columnStepLon;
      const bucketCol = Math.floor((lon - west) / bucketLon);
      const cell = row * width + col;

      let weightSum = 0;
      let valueSum = 0;
      let nearestSquared = Infinity;
      let nearestIndex = -1;

      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const bucket = buckets.get(bucketKey(bucketRow + dr, bucketCol + dc));
          if (!bucket) continue;

          for (const index of bucket) {
            const dx = (lons[index] - lon) * kmPerLon;
            const dy = (lats[index] - lat) * KM_PER_DEGREE_LAT;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared > radiusSquared) continue;

            if (distanceSquared < nearestSquared) {
              nearestSquared = distanceSquared;
              nearestIndex = index;
            }
            // Power 2: the weight is 1 / d².
            const weight = 1 / distanceSquared;
            weightSum += weight;
            valueSum += weight * temps[index];
          }
        }
      }

      if (nearestIndex < 0) {
        values[cell] = Number.NaN;
        alpha[cell] = 0;
        continue;
      }

      values[cell] =
        nearestSquared <= exactSquared ? temps[nearestIndex] : valueSum / weightSum;
      alpha[cell] = fadeAlpha(Math.sqrt(nearestSquared));
    }
  }

  return { width, height, values, alpha };
}
