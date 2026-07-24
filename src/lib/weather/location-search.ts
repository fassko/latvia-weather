import type { WeatherLocation } from "@/lib/weather/types";

export function normalizeForLocationSearch(value: string): string {
  return value
    .toLocaleLowerCase("lv")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function matchesQuery(value: string, query: string): boolean {
  const normalizedValue = normalizeForLocationSearch(value);
  const normalizedQuery = normalizeForLocationSearch(query);

  return (
    normalizedValue.includes(normalizedQuery) ||
    value.localeCompare(query, "lv", { sensitivity: "accent" }) === 0
  );
}

/** Lower rank = better match. Prefer exact city names over region-only hits. */
export function getLocationSearchRank(
  location: Pick<WeatherLocation, "name" | "region">,
  query: string,
): number {
  const normalizedQuery = normalizeForLocationSearch(query.trim());
  if (!normalizedQuery) return Number.POSITIVE_INFINITY;

  const normalizedName = normalizeForLocationSearch(location.name);
  const normalizedRegion = normalizeForLocationSearch(location.region);

  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  if (normalizedRegion === normalizedQuery) return 3;
  if (normalizedRegion.startsWith(normalizedQuery)) return 4;
  if (normalizedRegion.includes(normalizedQuery)) return 5;
  return 6;
}

export function locationMatchesQuery(
  location: Pick<WeatherLocation, "name" | "region">,
  query: string,
): boolean {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return false;

  return (
    matchesQuery(location.name, trimmedQuery) ||
    matchesQuery(location.region, trimmedQuery)
  );
}

export function compareLocationsBySearchRank(
  a: Pick<WeatherLocation, "name" | "region">,
  b: Pick<WeatherLocation, "name" | "region">,
  query: string,
): number {
  const rankDiff = getLocationSearchRank(a, query) - getLocationSearchRank(b, query);
  if (rankDiff !== 0) return rankDiff;
  return a.name.localeCompare(b.name, "lv");
}

export function searchAndRankLocations<T extends Pick<WeatherLocation, "name" | "region">>(
  locations: T[],
  query: string,
  limit?: number,
): T[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const ranked = locations
    .filter((location) => locationMatchesQuery(location, trimmedQuery))
    .sort((a, b) => compareLocationsBySearchRank(a, b, trimmedQuery));

  return limit === undefined ? ranked : ranked.slice(0, limit);
}
