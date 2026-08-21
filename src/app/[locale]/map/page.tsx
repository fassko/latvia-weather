import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForecastError } from "@/components/ForecastError";
import { MAIN_CONTENT_ID } from "@/components/SkipToContent";
import { LegalLinks } from "@/components/LegalLinks";
import { TopNav } from "@/components/TopNav";
import { WeatherMapSection } from "@/components/WeatherMapSection";
import { routing, type Locale } from "@/i18n/routing";
import { getWeatherAlarmPolygons } from "@/lib/weather/alarms";
import { getLocationPoints } from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { DEFAULT_LOCATION_ID, isValidLocationId, resolveLocationId } from "@/lib/weather/locations";
import {
  TEMPERATURE_LEGEND_BANDS,
  type TemperatureLegendBandId,
} from "@/lib/weather/map-temp";
import { buildPageStructuredData } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site";

interface MapPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ alarms?: string; punkts?: string }>;
}

export async function generateMetadata({
  params,
}: MapPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "map" });
  const tMetadata = await getTranslations({ locale, namespace: "metadata" });
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${locale}/map`;
  const imageUrl = `${baseUrl}/${locale}/map/opengraph-image`;
  const languages = {
    ...Object.fromEntries(
      routing.locales.map((altLocale) => [
        altLocale,
        `${baseUrl}/${altLocale}/map`,
      ]),
    ),
    "x-default": `${baseUrl}/${routing.defaultLocale}/map`,
  };

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: pageUrl,
      languages,
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: pageUrl,
      siteName: tMetadata("siteTitle"),
      locale: locale === "lv" ? "lv_LV" : "en_US",
      alternateLocale: locale === "lv" ? ["en_US"] : ["lv_LV"],
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [imageUrl],
    },
  };
}

export default async function MapPage({ params, searchParams }: MapPageProps) {
  const { locale } = await params;
  const { alarms: alarmsParam, punkts } = await searchParams;

  if (!routing.locales.includes(locale as Locale)) {
    return null;
  }

  setRequestLocale(locale);

  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);
  const focusLocationId =
    punkts && isValidLocationId(punkts) ? punkts : undefined;
  const initialShowAlarms = alarmsParam !== "0";
  const t = await getTranslations({ locale, namespace: "map" });
  const tErrors = await getTranslations({ locale, namespace: "errors" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });
  const tMetadata = await getTranslations({ locale, namespace: "metadata" });

  let locations;
  let alarms;

  try {
    [locations, alarms] = await Promise.all([
      getLocationPoints(),
      getWeatherAlarmPolygons(),
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : tErrors("loadWeatherData");
    return <ForecastError message={message} />;
  }

  const selected =
    locations.find((location) => location.id === locationId) ??
    locations.find((location) => location.id === DEFAULT_LOCATION_ID) ??
    locations[0];

  const temps = locations.map((location) => location.temperature);
  const minTemp = Math.round(Math.min(...temps));
  const maxTemp = Math.round(Math.max(...temps));

  const baseUrl = getSiteUrl();
  const jsonLd = buildPageStructuredData({
    locale,
    pageUrl: `${baseUrl}/${locale}/map`,
    name: t("title"),
    description: t("description"),
    breadcrumb: [
      { name: tMetadata("siteTitle"), url: `${baseUrl}/${locale}` },
      { name: t("title"), url: `${baseUrl}/${locale}/map` },
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TopNav
        locationId={selected?.id ?? DEFAULT_LOCATION_ID}
        locationName={selected?.name ?? t("title")}
        active="map"
      />
      <main
        id={MAIN_CONTENT_ID}
        className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-5 pb-[max(2rem,calc(1rem+env(safe-area-inset-bottom)))] sm:px-6"
      >
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {t("subtitle", { count: locations.length })}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            {t("range", { min: minTemp, max: maxTemp })}
          </p>
        </header>

        <WeatherMapSection
          locations={locations}
          alarms={alarms}
          locale={locale}
          selectedId={selected?.id}
          focusLocationId={focusLocationId}
          initialShowAlarms={initialShowAlarms}
        />

        <div
          // Positioning context for the swatch tooltips: centring them on the
          // row keeps them on screen, which centring on a swatch does not.
          className="relative flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400"
          role="list"
          aria-label={t("legend")}
        >
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {t("legend")}
          </span>
          {TEMPERATURE_LEGEND_BANDS.map((band) => (
            <LegendSwatch
              key={band.id}
              color={band.color}
              label={t(legendLabelKey(band.id))}
              range={t(legendRangeKey(band.id))}
            />
          ))}
        </div>

        <footer className="pt-2 text-xs text-slate-500 dark:text-slate-400">
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
            {" · "}<LegalLinks />
          </p>
        </footer>
      </main>
    </>
  );
}

function legendLabelKey(
  id: TemperatureLegendBandId,
):
  | "legendCold"
  | "legendCool"
  | "legendMild"
  | "legendWarm"
  | "legendHot" {
  switch (id) {
    case "cold":
      return "legendCold";
    case "cool":
      return "legendCool";
    case "mild":
      return "legendMild";
    case "warm":
      return "legendWarm";
    case "hot":
      return "legendHot";
  }
}

function legendRangeKey(
  id: TemperatureLegendBandId,
):
  | "legendColdRange"
  | "legendCoolRange"
  | "legendMildRange"
  | "legendWarmRange"
  | "legendHotRange" {
  switch (id) {
    case "cold":
      return "legendColdRange";
    case "cool":
      return "legendCoolRange";
    case "mild":
      return "legendMildRange";
    case "warm":
      return "legendWarmRange";
    case "hot":
      return "legendHotRange";
  }
}

function LegendSwatch({
  color,
  label,
  range,
}: {
  color: string;
  label: string;
  range: string;
}) {
  return (
    <span
      role="listitem"
      tabIndex={0}
      title={`${label}: ${range}`}
      aria-label={`${label}: ${range}`}
      className="group inline-flex cursor-help items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 max-w-full -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-center text-[0.7rem] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-900"
      >
        {range}
      </span>
    </span>
  );
}
