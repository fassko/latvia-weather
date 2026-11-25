import type { MvtFeature, MvtTile, MvtValue } from "./mvt";

/**
 * Road weather stations and traffic cameras from Latvijas Valsts ceļi, as published on the National Access Point
 * map (map.transportdata.gov.lv). The map serves them as vector tiles with each station's latest camera photo
 * inside the tile as a hex-encoded JPEG.
 */

export const ROAD_WEATHER_TILE_ORIGIN = "https://map.transportdata.gov.lv/gis/pg_tileserv";
export const ROAD_WEATHER_STATIONS_LAYER = "public.mvt_kafkamessages_cms";
export const ROAD_CAMERAS_LAYER = "public.mvt_kafkamessages_camera";
export const ROAD_WEATHER_MAP_PAGE = "https://map.transportdata.gov.lv/";
export const ROAD_WEATHER_ATTRIBUTION =
  '© <a href="https://map.transportdata.gov.lv/" target="_blank" rel="noopener noreferrer">Latvijas Valsts ceļi</a>';
export const ROAD_WEATHER_ATTRIBUTION_TEXT = "© Latvijas Valsts ceļi";

/**
 * The four zoom-5 tiles that cover Latvia. Zoom 5 keeps positions to about 170 m; one zoom-3 tile would hold
 * everything but rounds positions to over half a kilometre.
 */
export const ROAD_WEATHER_TILES: readonly MvtTile[] = [
  { z: 5, x: 17, y: 9 },
  { z: 5, x: 18, y: 9 },
  { z: 5, x: 17, y: 10 },
  { z: 5, x: 18, y: 10 },
];

/** Generous box around Latvia; tile buffers can carry points from well outside it. */
const LATVIA_BOX = { minLat: 55.5, maxLat: 58.2, minLon: 20.8, maxLon: 28.4 };

export type RoadWeatherKind = "station" | "camera";

export interface RoadWeatherStation {
  id: string;
  kind: "station";
  lat: number;
  lon: number;
  /** Road and kilometre, e.g. "A1 (96.999km)". */
  road: string | null;
  /** ISO time of the reading. */
  observedAt: string | null;
  airTemperature: number | null;
  roadTemperature: number | null;
  dewPoint: number | null;
  /** mm/h */
  precipitation: number | null;
  /** metres */
  visibility: number | null;
  /** Friction coefficient, 0–1. */
  grip: number | null;
  hasWarnings: boolean;
  imageUrl: string | null;
}

export interface RoadCamera {
  id: string;
  kind: "camera";
  lat: number;
  lon: number;
  road: string | null;
  imageUrl: string | null;
}

export type RoadWeatherPoint = RoadWeatherStation | RoadCamera;

export interface RoadWeatherFeed {
  stations: RoadWeatherStation[];
  cameras: RoadCamera[];
  attribution: string;
  attributionText: string;
}

export interface ParsedRoadWeather {
  stations: RoadWeatherStation[];
  cameras: RoadCamera[];
  /** Camera JPEGs keyed by image id (see `roadWeatherImageId`). */
  images: Map<string, Uint8Array>;
}

export const ROAD_WEATHER_IMAGE_ID_PATTERN = /^(station|camera)-\d{1,10}$/;

export function roadWeatherTileUrl(layer: string, tile: MvtTile): string {
  return `${ROAD_WEATHER_TILE_ORIGIN}/${layer}/${tile.z}/${tile.x}/${tile.y}.pbf`;
}

export function roadWeatherImageId(kind: RoadWeatherKind, id: string): string {
  return `${kind}-${id}`;
}

function toNumber(value: MvtValue | undefined): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toText(value: MvtValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toBoolean(value: MvtValue | undefined): boolean {
  return value === true || value === "true" || value === "True" || value === 1;
}

/** "2026-11-25 06:46:00+00" (Postgres timestamptz) to ISO, or null. */
export function parseRoadWeatherTime(value: MvtValue | undefined): string | null {
  const text = toText(value);
  if (!text) return null;
  const normalized = text
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const time = new Date(normalized);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
}

/** Postgres bytea hex ("\xffd8…") to bytes, or null when it isn't a JPEG. */
export function decodeRoadWeatherImage(value: MvtValue | undefined): Uint8Array | null {
  if (typeof value !== "string") return null;
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  if (hex.length < 8 || hex.length % 2 !== 0 || !/^ffd8/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

function inLatvia(lat: number, lon: number): boolean {
  return (
    lat >= LATVIA_BOX.minLat &&
    lat <= LATVIA_BOX.maxLat &&
    lon >= LATVIA_BOX.minLon &&
    lon <= LATVIA_BOX.maxLon
  );
}

interface ActivePoint {
  id: string;
  lat: number;
  lon: number;
  feature: MvtFeature;
}

/** Active features with a position, one per id (tile buffers repeat points near the edges). */
function activePoints(features: MvtFeature[]): ActivePoint[] {
  const byId = new Map<string, ActivePoint>();
  for (const feature of features) {
    const { properties, lat, lon } = feature;
    const id = toText(properties.id);
    if (!id || !/^\d+$/.test(id) || lat === null || lon === null) continue;
    if (properties.status !== "active" || !inLatvia(lat, lon)) continue;
    if (!byId.has(id)) byId.set(id, { id, lat, lon, feature });
  }
  return [...byId.values()];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Stations and cameras from decoded tiles. `imageUrl` builds the public URL of a photo from its image id.
 */
export function parseRoadWeather(
  stationFeatures: MvtFeature[],
  cameraFeatures: MvtFeature[],
  imageUrl: (imageId: string) => string,
): ParsedRoadWeather {
  const images = new Map<string, Uint8Array>();

  function takeImage(kind: RoadWeatherKind, point: ActivePoint): string | null {
    const image = decodeRoadWeatherImage(point.feature.properties.file_field);
    if (!image) return null;
    const imageId = roadWeatherImageId(kind, point.id);
    images.set(imageId, image);
    return imageUrl(imageId);
  }

  const stations = activePoints(stationFeatures)
    .map((point): RoadWeatherStation => {
      const p = point.feature.properties;
      return {
        id: point.id,
        kind: "station",
        lat: round(point.lat, 5),
        lon: round(point.lon, 5),
        road: toText(p.linear_reference),
        observedAt: parseRoadWeatherTime(p.minutemark),
        airTemperature: toNumber(p.t1),
        roadTemperature: toNumber(p.ts1dst111),
        dewPoint: toNumber(p.td1),
        precipitation: toNumber(p.pr),
        visibility: toNumber(p.vi),
        grip: toNumber(p.gr),
        hasWarnings: toBoolean(p.has_warnings),
        imageUrl: takeImage("station", point),
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  const cameras = activePoints(cameraFeatures)
    .map(
      (point): RoadCamera => ({
        id: point.id,
        kind: "camera",
        lat: round(point.lat, 5),
        lon: round(point.lon, 5),
        road: toText(point.feature.properties.linear_reference),
        imageUrl: takeImage("camera", point),
      }),
    )
    .sort((a, b) => Number(a.id) - Number(b.id));

  return { stations, cameras, images };
}

/** True when a reading is older than `maxAgeMinutes`, so the map can mark it as out of date. */
export function isRoadWeatherStale(
  observedAt: string | null,
  now: Date,
  maxAgeMinutes = 60,
): boolean {
  if (!observedAt) return true;
  return now.getTime() - new Date(observedAt).getTime() > maxAgeMinutes * 60_000;
}

/**
 * Road surface temperature chip colour: icy blue at or below freezing, amber just above it, neutral otherwise.
 */
export function roadTemperatureTone(value: number | null): "ice" | "near" | "ok" | "none" {
  if (value === null) return "none";
  if (value <= 0) return "ice";
  if (value <= 3) return "near";
  return "ok";
}
