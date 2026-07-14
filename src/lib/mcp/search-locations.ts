import type { WeatherLocationPoint } from "@/lib/weather/types";

function normalizeForSearch(value: string): string {
  return value
    .toLocaleLowerCase("lv")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function matchesQuery(value: string, query: string): boolean {
  const normalizedValue = normalizeForSearch(value);
  const normalizedQuery = normalizeForSearch(query);

  return (
    normalizedValue.includes(normalizedQuery) ||
    value.localeCompare(query, "lv", { sensitivity: "accent" }) === 0
  );
}

export function searchLocations(
  points: WeatherLocationPoint[],
  query: string,
  limit = 10,
): Array<{ id: string; name: string; region: string; lat: number; lon: number }> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  return points
    .filter(
      (point) =>
        matchesQuery(point.name, trimmedQuery) ||
        matchesQuery(point.region, trimmedQuery),
    )
    .slice(0, limit)
    .map(({ id, name, region, lat, lon }) => ({
      id,
      name,
      region,
      lat,
      lon,
    }));
}
