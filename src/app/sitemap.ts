import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { DEFAULT_LOCATION_ID, LOCATION_POINT_IDS } from "@/lib/weather/locations";
import { REVALIDATE_SECONDS } from "@/lib/weather/fetch";
import { getSiteUrl } from "@/lib/site";

function buildLocationQuery(locationId: string): string {
  return locationId === DEFAULT_LOCATION_ID
    ? ""
    : `?punkts=${encodeURIComponent(locationId)}`;
}

function buildAlternates(baseUrl: string, path: string) {
  return {
    languages: {
      ...Object.fromEntries(
        routing.locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`]),
      ),
      "x-default": `${baseUrl}/${routing.defaultLocale}${path}`,
    },
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  // Snap to the forecast revalidation window so `lastmod` reflects real data
  // freshness instead of changing on every crawl.
  const revalidateMs = REVALIDATE_SECONDS * 1000;
  const lastModified = new Date(
    Math.floor(Date.now() / revalidateMs) * revalidateMs,
  );

  const mapEntries = routing.locales.map((locale) => ({
    url: `${baseUrl}/${locale}/map`,
    lastModified,
    changeFrequency: "hourly" as const,
    priority: 0.7,
    alternates: buildAlternates(baseUrl, "/map"),
  }));

  const locationEntries = routing.locales.flatMap((locale) =>
    LOCATION_POINT_IDS.map((locationId) => {
      const query = buildLocationQuery(locationId);

      return {
        url: `${baseUrl}/${locale}${query}`,
        lastModified,
        changeFrequency: "hourly" as const,
        priority: locationId === DEFAULT_LOCATION_ID ? 1 : 0.6,
        alternates: buildAlternates(baseUrl, query),
      };
    }),
  );

  return [...mapEntries, ...locationEntries];
}
