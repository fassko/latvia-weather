/**
 * Basemap tile URLs for the weather map.
 *
 * Default tiles are Esri Light/Dark Gray Canvas — neutral land cover (no green
 * forests), so temperature markers stay readable. When
 * `NEXT_PUBLIC_CARTO_API_KEY` is set, prefer CARTO Positron / Dark Matter
 * (same idea; free key from https://carto.com/basemaps/apikey/).
 *
 * Optional escape hatch: `NEXT_PUBLIC_MAP_TILE_URL` (+ optional
 * `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`). Custom URLs are used for both themes.
 */

export type MapTheme = "light" | "dark";

/** Esri XYZ uses {z}/{y}/{x} (y before x). */
export const ESRI_LIGHT_GRAY_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";

export const ESRI_LIGHT_GRAY_REFERENCE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}";

export const ESRI_DARK_GRAY_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

export const ESRI_DARK_GRAY_REFERENCE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";

export const CARTO_POSITRON_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export const CARTO_DARK_MATTER_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export const ESRI_TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';

export const CARTO_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export type MapTileProvider = "esri-gray" | "carto-gray" | "custom";

export type MapTileConfig = {
  url: string;
  /** Optional labels/roads overlay (Esri gray canvas). */
  referenceUrl?: string;
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

function withCartoKey(url: string, key: string): string {
  return `${url}?key=${encodeURIComponent(key)}`;
}

/** Resolve the basemap tile layer from theme + public env (build-time for Next). */
export function resolveMapTiles(
  theme: MapTheme,
  env: TileEnv | NodeJS.ProcessEnv = process.env,
): MapTileConfig {
  const customUrl = trimEnv(env.NEXT_PUBLIC_MAP_TILE_URL);
  if (customUrl) {
    return {
      url: customUrl,
      attribution:
        trimEnv(env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION) ?? ESRI_TILE_ATTRIBUTION,
      provider: "custom",
    };
  }

  const cartoKey = trimEnv(env.NEXT_PUBLIC_CARTO_API_KEY);
  if (cartoKey) {
    const base =
      theme === "dark" ? CARTO_DARK_MATTER_TILE_URL : CARTO_POSITRON_TILE_URL;
    return {
      url: withCartoKey(base, cartoKey),
      attribution: CARTO_TILE_ATTRIBUTION,
      provider: "carto-gray",
    };
  }

  if (theme === "dark") {
    return {
      url: ESRI_DARK_GRAY_TILE_URL,
      referenceUrl: ESRI_DARK_GRAY_REFERENCE_URL,
      attribution: ESRI_TILE_ATTRIBUTION,
      provider: "esri-gray",
    };
  }

  return {
    url: ESRI_LIGHT_GRAY_TILE_URL,
    referenceUrl: ESRI_LIGHT_GRAY_REFERENCE_URL,
    attribution: ESRI_TILE_ATTRIBUTION,
    provider: "esri-gray",
  };
}
