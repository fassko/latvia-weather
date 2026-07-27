import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForecastError } from "@/components/ForecastError";
import { TopNav } from "@/components/TopNav";
import { WeatherMapSection } from "@/components/WeatherMapSection";
import { routing, type Locale } from "@/i18n/routing";
import { getLocationPoints } from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { DEFAULT_LOCATION_ID, resolveLocationId } from "@/lib/weather/locations";
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
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-6 pb-10 sm:px-6">
        <header className="flex flex-col gap-2">
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
          locale={locale}
          selectedId={selected?.id}
        />

        <div
          className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400"
          aria-hidden="true"
        >
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {t("legend")}
          </span>
          <LegendSwatch color="#2563eb" label={t("legendCold")} />
          <LegendSwatch color="#0ea5e9" label={t("legendCool")} />
          <LegendSwatch color="#22c55e" label={t("legendMild")} />
          <LegendSwatch color="#eab308" label={t("legendWarm")} />
          <LegendSwatch color="#ef4444" label={t("legendHot")} />
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

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
