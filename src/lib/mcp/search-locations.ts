import type { WeatherLocationPoint } from "@/lib/weather/types";
import { searchAndRankLocations } from "@/lib/weather/location-search";

export function searchLocations(
  points: WeatherLocationPoint[],
  query: string,
  limit = 10,
): Array<{ id: string; name: string; region: string; lat: number; lon: number }> {
  return searchAndRankLocations(points, query, limit).map(
    ({ id, name, region, lat, lon }) => ({
      id,
      name,
      region,
      lat,
      lon,
    }),
  );
}
