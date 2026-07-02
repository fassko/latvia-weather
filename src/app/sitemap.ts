import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  return routing.locales.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "hourly",
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((altLocale) => [altLocale, `${baseUrl}/${altLocale}`]),
      ),
    },
  }));
}
