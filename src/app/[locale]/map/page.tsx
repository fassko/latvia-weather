import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForecastError } from "@/components/ForecastError";
import { TopNav } from "@/components/TopNav";
import { WeatherMapSection } from "@/components/WeatherMapSection";
import { routing, type Locale } from "@/i18n/routing";
import { getLocationPoints } from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { DEFAULT_LOCATION_ID, isValidLocationId, resolveLocationId } from "@/lib/weather/locations";
import {
  TEMPERATURE_LEGEND_BANDS,
  type TemperatureLegendBandId,
} from "@/lib/weather/map-temp";
import { getSiteUrl } from "@/lib/site";

interface MapPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ punkts?: string }>;
}

export async function generateMetadata({
  params,
}: MapPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "map" });
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${locale}/map`;
  const languages = Object.fromEntries(
    routing.locales.map((altLocale) => [
      altLocale,
      `${baseUrl}/${altLocale}/map`,
    ]),
  );

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
      type: "website",
    },
  };
}

export default async function MapPage({ params, searchParams }: MapPageProps) {
  const { locale } = await params;
  const { punkts } = await searchParams;

  if (!routing.locales.includes(locale as Locale)) {
    return null;
  }

  setRequestLocale(locale);

  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);
  const focusLocationId =
    punkts && isValidLocationId(punkts) ? punkts : undefined;
  const t = await getTranslations({ locale, namespace: "map" });
  const tErrors = await getTranslations({ locale, namespace: "errors" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });

  let locations;

  try {
    locations = await getLocationPoints();
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

  return (
    <>
      <TopNav
        locationId={selected?.id ?? DEFAULT_LOCATION_ID}
        locationName={selected?.name ?? t("title")}
        active="map"
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-4 pb-[max(1.5rem,calc(0.75rem+env(safe-area-inset-bottom)))] sm:gap-4 sm:px-6 sm:pt-5 sm:pb-[max(2rem,calc(1rem+env(safe-area-inset-bottom)))]">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
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
          locale={locale}
          selectedId={selected?.id}
          focusLocationId={focusLocationId}
        />

        <div
          className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400"
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
      className="group relative inline-flex cursor-help items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-900"
      >
        {range}
      </span>
    </span>
  );
}
