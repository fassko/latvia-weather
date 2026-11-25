import { decodeMvt, type MvtFeature, type MvtTile } from "./mvt";
import {
  parseRoadWeather,
  ROAD_CAMERAS_LAYER,
  ROAD_WEATHER_STATIONS_LAYER,
  ROAD_WEATHER_TILES,
  roadWeatherTileUrl,
  type ParsedRoadWeather,
} from "./road-weather";

/**
 * Stations report every few minutes. The tiles carry every photo (about 25 MB in all), which is too big for
 * Next's fetch cache, so each server instance keeps the last result in memory and shares one refresh at a time.
 */
export const ROAD_WEATHER_TTL_SECONDS = 300;
const FETCH_TIMEOUT_MS = 30_000;

interface CacheEntry {
  fetchedAt: number;
  data: ParsedRoadWeather;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<CacheEntry> | null = null;

async function fetchLayer(layer: string, tiles: readonly MvtTile[]): Promise<MvtFeature[]> {
  const results = await Promise.all(
    tiles.map(async (tile) => {
      const response = await fetch(roadWeatherTileUrl(layer, tile), {
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Road weather upstream returned ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return [...decodeMvt(bytes, tile).values()].flat();
    }),
  );
  return results.flat();
}

async function refresh(): Promise<CacheEntry> {
  const [stations, cameras] = await Promise.all([
    fetchLayer(ROAD_WEATHER_STATIONS_LAYER, ROAD_WEATHER_TILES),
    // Cameras are extra; stations still show without them.
    fetchLayer(ROAD_CAMERAS_LAYER, ROAD_WEATHER_TILES).catch(() => [] as MvtFeature[]),
  ]);
  const data = parseRoadWeather(stations, cameras, (imageId) => `/api/road-weather/image/${imageId}`);
  if (data.stations.length === 0 && data.cameras.length === 0) {
    throw new Error("No road weather stations in the tiles");
  }
  return { fetchedAt: Date.now(), data };
}

/**
 * The latest road weather, refreshed when older than the TTL. A failed refresh falls back to the last good
 * result for up to an hour so a brief upstream outage doesn't blank the map.
 */
export async function getRoadWeather(): Promise<ParsedRoadWeather> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < ROAD_WEATHER_TTL_SECONDS * 1000) {
    return cache.data;
  }

  inFlight ??= refresh().finally(() => {
    inFlight = null;
  });

  try {
    cache = await inFlight;
    return cache.data;
  } catch (error) {
    if (cache && now - cache.fetchedAt < 3_600_000) return cache.data;
    throw error;
  }
}
