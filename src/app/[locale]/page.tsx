import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DailyForecastList } from "@/components/DailyForecastList";
import { ForecastChartsSection } from "@/components/ForecastChartsSection";
import { ForecastError } from "@/components/ForecastError";
import { MAIN_CONTENT_ID } from "@/components/SkipToContent";
import { HourlyStripCard } from "@/components/HourlyStripCard";
import { MetricCards } from "@/components/MetricCards";
import { StalePageRefresh } from "@/components/StalePageRefresh";
import { TopNav } from "@/components/TopNav";
import { WeatherAssistantLoader } from "@/components/WeatherAssistantLoader";
import { WeatherHero } from "@/components/WeatherHero";
import { WeatherHighlights } from "@/components/WeatherHighlights";
import { WeatherWarnings } from "@/components/WeatherWarnings";
import { routing, type Locale } from "@/i18n/routing";
import { buildPageStructuredData } from "@/lib/seo/structured-data";
import {
  getHourlyForecast,
  getLocationPoints,
  getWeatherWarnings,
  mergeForecastLocation,
} from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { getSourceCaption } from "@/lib/weather/source-caption";
import { getAuthoritativeSunTimesByDay } from "@/lib/weather/sun";
import { getLatviaDayKey } from "@/lib/weather/timezone";
import {
  DEFAULT_LOCATION_ID,
  isValidLocationId,
  resolveLocationId,
} from "@/lib/weather/locations";
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

function buildLanguageAlternates(baseUrl: string, punkts?: string) {
  return {
    ...Object.fromEntries(
      routing.locales.map((altLocale) => [
        altLocale,
        `${baseUrl}${buildPagePath(altLocale, punkts)}`,
      ]),
    ),
    "x-default": `${baseUrl}${buildPagePath(routing.defaultLocale, punkts)}`,
  };
}

export async function generateMetadata({ params, searchParams }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  const { punkts } = await searchParams;
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);
  const t = await getTranslations({ locale, namespace: "metadata" });
  const baseUrl = getSiteUrl();
  // Canonical and hreflang describe the requested URL, never the visitor's
  // cookie: a personalised canonical would point crawlers at the wrong page.
  const canonicalLocationId = punkts && isValidLocationId(punkts) ? punkts : undefined;
  const pageUrl = `${baseUrl}${buildPagePath(locale, canonicalLocationId)}`;
  const imageUrl = `${baseUrl}${buildOgImagePath(locale, locationId)}`;
  const languages = buildLanguageAlternates(baseUrl, canonicalLocationId);

  let title = t("siteTitle");
  let description = t("siteDescription");

  try {
    const data = await getHourlyForecast(locationId);
    title = t("locationTitle", { name: data.location.name });
    description = t("locationDescription", { name: data.location.name });
  } catch {
    // Fall back to generic site metadata when the forecast is unavailable.
  }

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
  const tMetadata = await getTranslations({ locale, namespace: "metadata" });
  const tTable = await getTranslations({ locale, namespace: "table" });

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
  const sunTimesByDay = await getAuthoritativeSunTimesByDay(
    data.forecasts.map((forecast) => getLatviaDayKey(forecast.time)),
    data.location.lat,
    data.location.lon,
  );

  const pageUrl = `${getSiteUrl()}${localizedPath(
    locale,
    data.location.id === DEFAULT_LOCATION_ID ? undefined : data.location.id,
  )}`;
  const jsonLd = buildPageStructuredData({
    locale,
    pageUrl,
    name: tMetadata("locationTitle", { name: data.location.name }),
    description: tMetadata("locationDescription", { name: data.location.name }),
    breadcrumb: [
      { name: tMetadata("siteTitle"), url: `${getSiteUrl()}/${locale}` },
      { name: data.location.name, url: pageUrl },
    ],
    place: {
      name: data.location.name,
      region: data.location.region,
      lat: data.location.lat,
      lon: data.location.lon,
    },
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StalePageRefresh />
      <TopNav locationId={data.location.id} locationName={data.location.name} />
      <WeatherHero data={data} sunTimesByDay={sunTimesByDay} />
      <main
        id={MAIN_CONTENT_ID}
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-[max(6rem,calc(4.5rem+env(safe-area-inset-bottom)))] sm:px-6"
      >
        {data.isStale ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            {tFooter("staleData")}
          </p>
        ) : null}
        <WeatherWarnings locale={locale} warnings={warnings} />
        <MetricCards forecasts={data.forecasts} sunTimesByDay={sunTimesByDay} />
        <WeatherHighlights forecasts={data.forecasts} />
        <WeatherAssistantLoader
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
            clear: tAssistant("clear"),
            open: tAssistant("open"),
            sourceCaption: getSourceCaption(data.location.name, locale),
            examples: [
              tAssistant("examples.weekend"),
              tAssistant("examples.clothes", { location: data.location.name }),
              tAssistant("examples.rain", { location: data.location.name }),
            ],
          }}
        />
        <HourlyStripCard
          forecasts={data.forecasts}
          sunTimesByDay={sunTimesByDay}
          sunLabels={{
            sunrise: tTable("sunrise"),
            sunset: tTable("sunset"),
          }}
        />
        <ForecastChartsSection
          forecasts={data.forecasts}
          sunTimesByDay={sunTimesByDay}
          sunLabels={{
            sunrise: tTable("sunrise"),
            sunset: tTable("sunset"),
          }}
        />
        <DailyForecastList forecasts={data.forecasts} sunTimesByDay={sunTimesByDay} />
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
            {" "}
            {tFooter("sunTimesFrom")}{" "}
            <a
              href="https://sunrisesunset.io/"
              className="underline hover:text-slate-700 dark:hover:text-slate-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              SunriseSunset.io
            </a>
            .
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
