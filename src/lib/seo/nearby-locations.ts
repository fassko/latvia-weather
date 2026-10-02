import { distanceKm } from "@/lib/weather/coordinates";
import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import type { WeatherLocationPoint } from "@/lib/weather/types";
import { locationSlug } from "@/lib/site";

const DEFAULT_NEARBY_LIMIT = 8;
const DEFAULT_REGION_LIMIT = 8;

export interface NearbyLocationLink {
  id: string;
  name: string;
  region: string;
  distanceKm: number;
  href: string;
}

function locationHref(location: Pick<WeatherLocationPoint, "id" | "name">): string {
  return location.id === DEFAULT_LOCATION_ID
    ? "/"
    : `/punkts/${encodeURIComponent(locationSlug(location.name))}`;
}

/** Nearest forecast points for crawlable internal links (excludes current). */
export function pickNearbyLocations(
  current: Pick<WeatherLocationPoint, "id" | "lat" | "lon">,
  locations: readonly WeatherLocationPoint[],
  limit = DEFAULT_NEARBY_LIMIT,
): NearbyLocationLink[] {
  return locations
    .filter(
      (location) =>
        location.id !== current.id &&
        Number.isFinite(location.lat) &&
        Number.isFinite(location.lon),
    )
    .map((location) => ({
      id: location.id,
      name: location.name,
      region: location.region,
      distanceKm: distanceKm(current, location),
      href: locationHref(location),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, "lv"))
    .slice(0, limit);
}

/** Same-region towns for a secondary crawlable hub (excludes current + nearby). */
export function pickRegionLocations(
  current: Pick<WeatherLocationPoint, "id" | "region">,
  locations: readonly WeatherLocationPoint[],
  excludeIds: ReadonlySet<string> = new Set(),
  limit = DEFAULT_REGION_LIMIT,
): NearbyLocationLink[] {
  const regionKey = current.region.trim().toLocaleLowerCase("lv");
  if (!regionKey) return [];

  return locations
    .filter((location) => {
      if (location.id === current.id || excludeIds.has(location.id)) return false;
      return location.region.trim().toLocaleLowerCase("lv") === regionKey;
    })
    .map((location) => ({
      id: location.id,
      name: location.name,
      region: location.region,
      distanceKm: 0,
      href: locationHref(location),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "lv"))
    .slice(0, limit);
}
