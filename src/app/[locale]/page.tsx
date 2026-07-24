import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DailyForecastList } from "@/components/DailyForecastList";
import { ForecastChartsSection } from "@/components/ForecastChartsSection";
import { ForecastError } from "@/components/ForecastError";
import { HourlyStripCard } from "@/components/HourlyStripCard";
import { MetricCards } from "@/components/MetricCards";
import { StalePageRefresh } from "@/components/StalePageRefresh";
import { TopNav } from "@/components/TopNav";
import { WeatherAssistant } from "@/components/WeatherAssistant";
import { WeatherHero } from "@/components/WeatherHero";
import { WeatherHighlights } from "@/components/WeatherHighlights";
import { WeatherWarnings } from "@/components/WeatherWarnings";
import { routing, type Locale } from "@/i18n/routing";
import {
  getHourlyForecast,
  getLocationPoints,
  getWeatherWarnings,
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
  const tAssistant = await getTranslations({ locale, namespace: "assistant" });

  let data;
  let locations;
  let warnings;

  try {
    [data, locations, warnings] = await Promise.all([
      getHourlyForecast(locationId),
      getLocationPoints(),
      getWeatherWarnings(),
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StalePageRefresh />
      <TopNav locationId={data.location.id} locationName={data.location.name} />
      <WeatherHero data={data} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-10 sm:px-6">
        {data.isStale ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            {tFooter("staleData")}
          </p>
        ) : null}
        <WeatherWarnings locale={locale} warnings={warnings} />
        <MetricCards forecasts={data.forecasts} />
        <WeatherHighlights forecasts={data.forecasts} />
        <WeatherAssistant
          locale={locale}
          locationId={data.location.id}
          labels={{
            title: tAssistant("title"),
            subtitle: tAssistant("subtitle", { location: data.location.name }),
            placeholder: tAssistant("placeholder", { location: data.location.name }),
            inputPlaceholder: tAssistant("inputPlaceholder"),
            send: tAssistant("send"),
            stop: tAssistant("stop"),
            user: tAssistant("user"),
            assistant: tAssistant("assistant"),
            thinking: tAssistant("thinking"),
            error: tAssistant("error"),
            close: tAssistant("close"),
            open: tAssistant("open"),
            examples: [
              tAssistant("examples.weekend"),
              tAssistant("examples.motorcycle"),
              tAssistant("examples.clothes", { location: data.location.name }),
              tAssistant("examples.rain", { location: data.location.name }),
            ],
          }}
        />
        <HourlyStripCard forecasts={data.forecasts} />
        <ForecastChartsSection forecasts={data.forecasts} />
        <DailyForecastList forecasts={data.forecasts} />
        <footer className="flex flex-col gap-2 pt-4 pb-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
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
    </>
  );
}
