import { getSiteUrl } from "@/lib/site";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface PlaceInfo {
  name: string;
  region: string;
  lat: number;
  lon: number;
}

interface WebPageGraphInput {
  locale: string;
  pageUrl: string;
  name: string;
  description: string;
  breadcrumb: BreadcrumbItem[];
  place?: PlaceInfo;
}

const SITE_NAMES: Record<string, string> = {
  en: "Latvia Weather",
  lv: "Laika prognoze Latvijā",
};

function getLanguageTag(locale: string): string {
  return locale === "lv" ? "lv-LV" : "en-US";
}

/**
 * Search engines read one connected graph per page instead of several
 * disconnected snippets, so WebSite, WebPage, breadcrumb, and place are linked
 * by `@id`.
 */
export function buildPageStructuredData({
  locale,
  pageUrl,
  name,
  description,
  breadcrumb,
  place,
}: WebPageGraphInput) {
  const baseUrl = getSiteUrl();
  const websiteId = `${baseUrl}/#website`;
  const publisherId = `${baseUrl}/#publisher`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: `${baseUrl}/`,
        name: SITE_NAMES[locale] ?? SITE_NAMES.en,
        inLanguage: ["en-US", "lv-LV"],
        publisher: { "@id": publisherId },
      },
      {
        "@type": "Person",
        "@id": publisherId,
        name: "Kristaps Grinbergs",
        url: "https://kristaps.me/",
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name,
        description,
        inLanguage: getLanguageTag(locale),
        isPartOf: { "@id": websiteId },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: breadcrumb.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
          })),
        },
        isBasedOn: {
          "@type": "Dataset",
          name: "LVĢMC weather forecast data",
          creator: {
            "@type": "Organization",
            name: "Latvijas Vides, ģeoloģijas un meteoroloģijas centrs",
            alternateName: "LVĢMC",
            url: "https://videscentrs.lvgmc.lv/",
          },
        },
        ...(place
          ? {
              about: {
                "@type": "Place",
                name: place.name,
                address: {
                  "@type": "PostalAddress",
                  addressCountry: "LV",
                  addressRegion: place.region,
                },
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: place.lat,
                  longitude: place.lon,
                },
              },
            }
          : {}),
      },
    ],
  };
}
