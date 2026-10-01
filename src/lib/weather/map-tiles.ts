/**
 * Basemap tile URLs for the weather map.
 *
 * CARTO Voyager is preferred when `NEXT_PUBLIC_CARTO_API_KEY` is set (free key
 * from https://carto.com/basemaps/apikey/). Without a key, CARTO serves
 * watermarked "API KEY REQUIRED" tiles — so we fall back to OSM France, which
 * needs no key and works with the existing light/dark CSS filters.
 *
 * Optional escape hatch: `NEXT_PUBLIC_MAP_TILE_URL` (Leaflet URL template) and
 * `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` (HTML attribution string).
 */

export const CARTO_VOYAGER_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

/** Community OSM raster tiles — no API key required. */
export const OSM_FRANCE_TILE_URL =
  "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png";

export const CARTO_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const OSM_FRANCE_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://www.openstreetmap.fr/">OSM France</a>';

export type MapTileProvider = "carto" | "osm-fr" | "custom";

export type MapTileConfig = {
  url: string;
  attribution: string;
  provider: MapTileProvider;
};

type TileEnv = {
  NEXT_PUBLIC_CARTO_API_KEY?: string;
  NEXT_PUBLIC_MAP_TILE_URL?: string;
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?: string;
  [key: string]: string | undefined;
};

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Resolve the basemap tile layer from public env (build-time for Next). */
export function resolveMapTiles(
  env: TileEnv | NodeJS.ProcessEnv = process.env,
): MapTileConfig {
  const customUrl = trimEnv(env.NEXT_PUBLIC_MAP_TILE_URL);
  if (customUrl) {
    return {
      url: customUrl,
      attribution:
        trimEnv(env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION) ??
        OSM_FRANCE_TILE_ATTRIBUTION,
      provider: "custom",
    };
  }

  const cartoKey = trimEnv(env.NEXT_PUBLIC_CARTO_API_KEY);
  if (cartoKey) {
    return {
      url: `${CARTO_VOYAGER_TILE_URL}?key=${encodeURIComponent(cartoKey)}`,
      attribution: CARTO_TILE_ATTRIBUTION,
      provider: "carto",
    };
  }

  return {
    url: OSM_FRANCE_TILE_URL,
    attribution: OSM_FRANCE_TILE_ATTRIBUTION,
    provider: "osm-fr",
  };
}
