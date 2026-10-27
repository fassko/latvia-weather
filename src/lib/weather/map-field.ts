import { LATVIA_BOUNDS } from "@/lib/weather/map-view";

/**
 * Shared grid and interpolation for the map's colour washes (temperature,
 * wind and rain). The iOS app builds the same fields, so keep the numbers in
 * sync with it:
 * - The grid covers `LATVIA_BOUNDS`: 240 columns evenly spaced in longitude,
 *   rows evenly spaced in Web Mercator Y, sampled at cell centres.
 * - Distances are equirectangular km: dx = Δlon·cos(meanLat)·111.32,
 *   dy = Δlat·110.57, with meanLat the middle of the bounds.
 * - Values are inverse-distance weighted (power 2) over the places within
 *   60 km. A place within 0.5 km gives its own value; no place within 60 km
 *   gives NaN.
 * - Alpha fades with the distance d to the nearest place: 1 up to 8 km, then
 *   linearly to 0 at 20 km. It roughly traces the border and coast.
 */

export type FieldBounds = [[number, number], [number, number]];

export interface FieldPoint {
  lat: number;
  lon: number;
}

export interface FieldOptions {
  bounds?: FieldBounds;
  /** Columns; rows follow from the bounds' Web Mercator aspect. */
  width?: number;
}

export interface Field {
  width: number;
  height: number;
  /** Row-major, north row first. NaN where no place is within the search radius. */
  values: Float32Array;
  /** Row-major, north row first. 0 to 1, from the distance to the nearest place. */
  alpha: Float32Array;
}

export interface ColorStop {
  value: number;
  color: string;
}

export const FIELD_WIDTH = 240;
export const FIELD_SEARCH_RADIUS_KM = 60;
export const FIELD_EXACT_KM = 0.5;
export const FIELD_SOLID_KM = 8;
export const FIELD_FADE_KM = 20;

const KM_PER_DEGREE_LON = 111.32;
const KM_PER_DEGREE_LAT = 110.57;

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Colour scale over ascending stops: `color(v)` interpolates linearly in RGB
 * and clamps at the ends.
 */
export function createColorScale(
  stops: ReadonlyArray<ColorStop>,
  /** How a legend bar spaces values; colours always blend linearly in value. */
  legendScale: "linear" | "log" = "linear",
) {
  const rgb = stops.map((stop) => hexToRgb(stop.color));
  const last = stops.length - 1;
  const axis = legendScale === "log" ? Math.log10 : (value: number) => value;
  const first = axis(stops[0].value);
  const span = axis(stops[last].value) - first;

  function color(value: number): [number, number, number] {
    if (!(value > stops[0].value)) return [...rgb[0]];
    if (value >= stops[last].value) return [...rgb[last]];

    let upper = 1;
    while (stops[upper].value < value) upper += 1;

    const lower = upper - 1;
    const t = (value - stops[lower].value) / (stops[upper].value - stops[lower].value);
    const from = rgb[lower];
    const to = rgb[upper];

    return [
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    ];
  }

  /** Where a value sits on a legend bar for these stops, 0 to 1. */
  function position(value: number): number {
    const offset = (axis(Math.max(value, stops[0].value)) - first) / span;
    return Math.min(1, Math.max(0, offset));
  }

  /** CSS `linear-gradient` for a legend bar, with the stops at their positions. */
  function gradientCss(): string {
    const parts = stops.map(
      (stop) => `${stop.color} ${(position(stop.value) * 100).toFixed(2)}%`,
    );
    return `linear-gradient(to right, ${parts.join(", ")})`;
  }

  return { color, position, gradientCss };
}

/** `#rrggbb` for an RGB triple, e.g. to colour a label chip like the wash. */
export function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Dark or white text, whichever reads better on an RGB background. */
export function textColorOn([r, g, b]: [number, number, number]): string {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

function mercatorY(latitude: number): number {
  const radians = (latitude * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function latitudeFromMercatorY(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/** Rows for a field `width` columns wide, so the grid keeps the bounds' Web Mercator aspect. */
export function fieldHeight(width: number, bounds: FieldBounds = LATVIA_BOUNDS): number {
  const [[south, west], [north, east]] = bounds;
  const xRange = ((east - west) * Math.PI) / 180;
  const yRange = mercatorY(north) - mercatorY(south);
  return Math.round((width * yRange) / xRange);
}

/** 1 up to 8 km from the nearest place, linearly down to 0 at 20 km. */
export function fieldFadeAlpha(distanceKm: number): number {
  if (distanceKm <= FIELD_SOLID_KM) return 1;
  if (distanceKm >= FIELD_FADE_KM) return 0;
  return (FIELD_FADE_KM - distanceKm) / (FIELD_FADE_KM - FIELD_SOLID_KM);
}

/**
 * Places bucketed into cells one search radius wide, so a sample only checks
 * the 3×3 cells around it instead of every place.
 */
interface PointIndex {
  lats: Float64Array;
  lons: Float64Array;
  /** One array per channel, each with a value per place. */
  channels: Float64Array[];
  buckets: Map<number, number[]>;
  south: number;
  west: number;
  bucketLat: number;
  bucketLon: number;
  kmPerLon: number;
}

function bucketKey(row: number, col: number): number {
  return row * 65536 + col;
}

function createPointIndex<T extends FieldPoint>(
  points: ReadonlyArray<T>,
  channelValues: ReadonlyArray<(point: T) => number | null | undefined>,
  bounds: FieldBounds,
): PointIndex {
  const [[south, west], [north]] = bounds;
  const meanLatRadians = (((south + north) / 2) * Math.PI) / 180;
  const kmPerLon = Math.cos(meanLatRadians) * KM_PER_DEGREE_LON;

  const valid: T[] = [];
  const rows: number[][] = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const row = channelValues.map((value) => value(point));
    if (!row.every((value) => typeof value === "number" && Number.isFinite(value))) {
      continue;
    }
    valid.push(point);
    rows.push(row as number[]);
  }

  const lats = Float64Array.from(valid, (point) => point.lat);
  const lons = Float64Array.from(valid, (point) => point.lon);
  const channels = channelValues.map((_, channel) =>
    Float64Array.from(rows, (row) => row[channel]),
  );

  const bucketLat = FIELD_SEARCH_RADIUS_KM / KM_PER_DEGREE_LAT;
  const bucketLon = FIELD_SEARCH_RADIUS_KM / kmPerLon;
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

  return { lats, lons, channels, buckets, south, west, bucketLat, bucketLon, kmPerLon };
}

/**
 * IDW sample of every channel at a spot. Writes the averages into `out` and
 * returns the squared km to the nearest place, or Infinity when none is
 * within the search radius (then `out` is left alone).
 */
function sampleIndex(
  index: PointIndex,
  lat: number,
  lon: number,
  out: Float64Array,
): number {
  const { lats, lons, channels, buckets, kmPerLon } = index;
  const channelCount = channels.length;
  const radiusSquared = FIELD_SEARCH_RADIUS_KM * FIELD_SEARCH_RADIUS_KM;
  const bucketRow = Math.floor((lat - index.south) / index.bucketLat);
  const bucketCol = Math.floor((lon - index.west) / index.bucketLon);

  let weightSum = 0;
  let nearestSquared = Infinity;
  let nearestIndex = -1;
  out.fill(0);

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const bucket = buckets.get(bucketKey(bucketRow + dr, bucketCol + dc));
      if (!bucket) continue;

      for (const point of bucket) {
        const dx = (lons[point] - lon) * kmPerLon;
        const dy = (lats[point] - lat) * KM_PER_DEGREE_LAT;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > radiusSquared) continue;

        if (distanceSquared < nearestSquared) {
          nearestSquared = distanceSquared;
          nearestIndex = point;
        }
        // Power 2: the weight is 1 / d².
        const weight = 1 / distanceSquared;
        weightSum += weight;
        for (let channel = 0; channel < channelCount; channel += 1) {
          out[channel] += weight * channels[channel][point];
        }
      }
    }
  }

  if (nearestIndex < 0) return Infinity;

  const exact = nearestSquared <= FIELD_EXACT_KM * FIELD_EXACT_KM;
  for (let channel = 0; channel < channelCount; channel += 1) {
    out[channel] = exact
      ? channels[channel][nearestIndex]
      : out[channel] / weightSum;
  }
  return nearestSquared;
}

/**
 * Field of one number per place over the map grid. `value` returns that
 * place's number; places where it's null or not finite are left out.
 */
export function buildField<T extends FieldPoint>(
  points: ReadonlyArray<T>,
  value: (point: T) => number | null | undefined,
  options: FieldOptions = {},
): Field {
  const bounds = options.bounds ?? LATVIA_BOUNDS;
  const width = options.width ?? FIELD_WIDTH;
  const height = fieldHeight(width, bounds);
  const [[south, west], [north, east]] = bounds;
  const index = createPointIndex(points, [value], bounds);

  const values = new Float32Array(width * height);
  const alpha = new Float32Array(width * height);
  const northY = mercatorY(north);
  const rowStepY = (northY - mercatorY(south)) / height;
  const columnStepLon = (east - west) / width;
  const sample = new Float64Array(1);

  for (let row = 0; row < height; row += 1) {
    const lat = latitudeFromMercatorY(northY - (row + 0.5) * rowStepY);

    for (let col = 0; col < width; col += 1) {
      const lon = west + (col + 0.5) * columnStepLon;
      const cell = row * width + col;
      const nearestSquared = sampleIndex(index, lat, lon, sample);

      if (nearestSquared === Infinity) {
        values[cell] = Number.NaN;
        alpha[cell] = 0;
        continue;
      }

      values[cell] = sample[0];
      alpha[cell] = fieldFadeAlpha(Math.sqrt(nearestSquared));
    }
  }

  return { width, height, values, alpha };
}

export interface WindPoint extends FieldPoint {
  /** m/s */
  windSpeed: number;
  /** Meteorological degrees: where the wind blows from, 0 = north. */
  windDirection: number;
}

export interface WindSample {
  /** m/s, IDW of the places' speeds (the same number as the wind wash). */
  speed: number;
  /** Meteorological degrees the wind blows from, 0 to 360. */
  direction: number;
  /** Degrees the wind blows towards (direction + 180), for drawing arrows. */
  bearing: number;
  /** Fade alpha from the distance to the nearest place, as in the wash. */
  alpha: number;
}

/**
 * Wind sampler over the same buckets as the fields. The direction comes from
 * IDW of the u/v components, u = −speed·sin(dir) and v = −speed·cos(dir), so
 * opposite winds cancel instead of averaging to a sideways one.
 */
export function createWindSampler(
  points: ReadonlyArray<WindPoint>,
  bounds: FieldBounds = LATVIA_BOUNDS,
) {
  const toRadians = Math.PI / 180;
  const index = createPointIndex(
    points,
    [
      (point) => point.windSpeed,
      (point) => -point.windSpeed * Math.sin(point.windDirection * toRadians),
      (point) => -point.windSpeed * Math.cos(point.windDirection * toRadians),
    ],
    bounds,
  );
  const sample = new Float64Array(3);

  return {
    /** Wind at a spot, or null when no place is within 60 km. */
    windAt(lat: number, lon: number): WindSample | null {
      const nearestSquared = sampleIndex(index, lat, lon, sample);
      if (nearestSquared === Infinity) return null;

      const [speed, u, v] = sample;
      // atan2(u, v) is where the air moves to, clockwise from north.
      const bearing = ((Math.atan2(u, v) / toRadians) % 360 + 360) % 360;
      return {
        speed,
        direction: (bearing + 180) % 360,
        bearing,
        alpha: fieldFadeAlpha(Math.sqrt(nearestSquared)),
      };
    },
  };
}
