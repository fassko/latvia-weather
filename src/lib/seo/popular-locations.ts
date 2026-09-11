import {
  DEFAULT_LOCATION_ID,
  type LocationPointId,
} from "@/lib/weather/locations";
import type { WeatherLocationPoint } from "@/lib/weather/types";
import { locationSlug } from "@/lib/site";

/**
 * Major cities/towns for crawlable internal links (sitemap alone is not enough).
 * IDs verified against the live LVĢMC location feed.
 */
export const POPULAR_LOCATION_IDS = [
  DEFAULT_LOCATION_ID, // Rīga
  "P770", // Liepāja
  "P450", // Daugavpils
  "P458", // Jelgava
  "P992", // Ventspils
  "P768", // Jūrmala
  "P905", // Valmiera
  "P862", // Rēzekne
  "P915", // Jēkabpils
  "P766", // Ogre
  "P449", // Cēsis
  "P215", // Kuldīga
  "P361", // Tukums
  "P117", // Sigulda
  "P211", // Bauska
  "P317", // Madona
] as const satisfies readonly LocationPointId[];

export function pickPopularLocations(
  locations: WeatherLocationPoint[],
): WeatherLocationPoint[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  return POPULAR_LOCATION_IDS.flatMap((id) => {
    const match = byId.get(id);
    return match ? [match] : [];
  });
}

export function popularLocationHref(locationId: string, locationName?: string): string {
  return locationId === DEFAULT_LOCATION_ID
    ? "/"
    : `/punkts/${encodeURIComponent(
        locationName ? locationSlug(locationName) : locationId,
      )}`;
}
