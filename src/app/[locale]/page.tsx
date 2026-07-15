import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForecastError } from "@/components/ForecastError";
import { ForecastViewTabs } from "@/components/ForecastViewTabs";
import { StalePageRefresh } from "@/components/StalePageRefresh";
import { HourlyForecastList } from "@/components/HourlyForecast";
import { WeatherInsights } from "@/components/WeatherInsights";
import { WeatherHeader } from "@/components/WeatherHeader";
import { WeatherTable } from "@/components/WeatherTable";
import { routing, type Locale } from "@/i18n/routing";
import {
  getHourlyForecast,
  getLocationPoints,
  mergeForecastLocation,
} from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { DEFAULT_LOCATION_ID, resolveLocationId } from "@/lib/weather/locations";
import { getSiteUrl, localizedPath } from "@/lib/site";

interface HomeProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ punkts?: string }>;
}

function buildPagePath(locale: string, punkts?: string): string {
  const query =
    punkts && punkts !== DEFAULT_LOCATION_ID
      ? `?punkts=${encodeURIComponent(punkts)}`
      : "";
  return `/${locale}${query}`;
}

function buildOgImagePath(locale: string, punkts?: string): string {
  const query =
    punkts && punkts !== DEFAULT_LOCATION_ID
      ? `?punkts=${encodeURIComponent(punkts)}`
      : "";
  return `/${locale}/opengraph-image${query}`;
}

function getLocaleName(locale: string): "lv_LV" | "en_US" {
  return locale === "lv" ? "lv_LV" : "en_US";
}

export async function generateMetadata({ params, searchParams }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  const { punkts } = await searchParams;
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);
  const t = await getTranslations({ locale, namespace: "metadata" });
  const baseUrl = getSiteUrl();
  const pagePath = buildPagePath(locale, locationId);
  const pageUrl = `${baseUrl}${pagePath}`;
  const imageUrl = `${baseUrl}${buildOgImagePath(locale, locationId)}`;
  const languages = Object.fromEntries(
    routing.locales.map((altLocale) => [
      altLocale,
      `${baseUrl}${buildPagePath(altLocale, locationId)}`,
    ]),
  );

  try {
    const data = await getHourlyForecast(locationId);
    const title = t("locationTitle", { name: data.location.name });
    const description = t("locationDescription", { name: data.location.name });

    return {
      title,
      description,
      alternates: {
        canonical: pageUrl,
        languages,
      },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: t("siteTitle"),
        locale: getLocaleName(locale),
        alternateLocale: locale === "lv" ? ["en_US"] : ["lv_LV"],
        type: "website",
        images: [{ url: imageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    const title = t("siteTitle");
    const description = t("siteDescription");

    return {
      title,
      description,
      alternates: {
        canonical: pageUrl,
        languages,
      },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: title,
        locale: getLocaleName(locale),
        alternateLocale: locale === "lv" ? ["en_US"] : ["lv_LV"],
        type: "website",
        images: [{ url: imageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  }
}

export default async function Home({ params, searchParams }: HomeProps) {
  const { locale } = await params;
  const { punkts } = await searchParams;

  if (!routing.locales.includes(locale as Locale)) {
    return null;
  }

  setRequestLocale(locale);

  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);
  const t = await getTranslations({ locale, namespace: "errors" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });
  const tViews = await getTranslations({ locale, namespace: "forecastViews" });

  let data;
  let locations;

  try {
    [data, locations] = await Promise.all([
      getHourlyForecast(locationId),
      getLocationPoints(),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : t("loadWeatherData");
    return <ForecastError message={message} />;
  }

  data = mergeForecastLocation(data, locations);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${data.location.name} Weather`,
    url: `${getSiteUrl()}${localizedPath(
      locale,
      data.location.id === DEFAULT_LOCATION_ID ? undefined : data.location.id,
    )}`,
    about: {
      "@type": "Place",
      name: data.location.name,
      address: {
        "@type": "PostalAddress",
        addressCountry: "LV",
        addressRegion: data.location.region,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: data.location.lat,
        longitude: data.location.lon,
      },
    },
    provider: {
      "@type": "Organization",
      name: "LVĢMC",
      url: "https://videscentrs.lvgmc.lv/",
    },
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StalePageRefresh />
      <WeatherHeader data={data} />
      {data.isStale ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          {tFooter("staleData")}
        </p>
      ) : null}
      <WeatherInsights forecasts={data.forecasts} />
      <ForecastViewTabs
        ariaLabel={tViews("ariaLabel")}
        hourlyLabel={tViews("hourly")}
        detailedLabel={tViews("detailed")}
        hourly={<HourlyForecastList forecasts={data.forecasts} />}
        detailed={<WeatherTable forecasts={data.forecasts} />}
      />
      <footer className="space-y-1 pb-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          {tFooter("dataFrom")}{" "}
          <a
            href="https://videscentrs.lvgmc.lv/"
            className="underline hover:text-slate-700 dark:hover:text-slate-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            LVĢMC
          </a>
          . {tFooter("updatedEvery")}
        </p>
        <p>
          {tFooter("developedBy")}{" "}
          <a
            href="https://kristaps.me/"
            className="underline hover:text-slate-700 dark:hover:text-slate-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            {tFooter("authorName")}
          </a>
          {" · "}
          <a
            href="https://x.com/fassko"
            className="underline hover:text-slate-700 dark:hover:text-slate-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            {tFooter("onX")}
          </a>
          {" · "}
          <a
            href="https://github.com/fassko/latvia-weather"
            className="underline hover:text-slate-700 dark:hover:text-slate-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            {tFooter("onGitHub")}
          </a>
        </p>
      </footer>
    </main>
  );
}
