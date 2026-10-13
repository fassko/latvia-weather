import type { WeatherLocationPoint } from "@/lib/weather/types";

/** Keep favorite rail order; drop IDs that are missing from the current map payload. */
export function filterLocationsByFavoriteIds(
  locations: WeatherLocationPoint[],
  favoriteIds: string[],
): WeatherLocationPoint[] {
  if (favoriteIds.length === 0) return [];

  const byId = new Map(locations.map((location) => [location.id, location]));

  return favoriteIds
    .map((id) => byId.get(id))
    .filter((location): location is WeatherLocationPoint => Boolean(location));
}
