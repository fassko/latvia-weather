import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { DEFAULT_LOCATION_ID, LOCATION_POINT_IDS } from "@/lib/weather/locations";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const lastModified = new Date();

  return routing.locales.flatMap((locale) =>
    LOCATION_POINT_IDS.map((locationId) => {
      const query =
        locationId === DEFAULT_LOCATION_ID
          ? ""
          : `?punkts=${encodeURIComponent(locationId)}`;

      return {
        url: `${baseUrl}/${locale}${query}`,
        lastModified,
        changeFrequency: "hourly" as const,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((altLocale) => [altLocale, `${baseUrl}/${altLocale}${query}`]),
          ),
        },
      };
    }),
  );
}
