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
import { pickLocationQueryValue } from "@/lib/weather/location-query";
import { parseMapLayer } from "@/lib/weather/map-layer";
import { buildPageStructuredData } from "@/lib/seo/structured-data";
import { getOgAlternateLocales, getOgLocale } from "@/lib/locale";
import { getSiteUrl } from "@/lib/site";

interface MapPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    alarms?: string;
    punkts?: string;
    location?: string;
    layer?: string;
  }>;
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

  const title = `${t("title")} — ${tMetadata("siteTitle")}`;

  return {
    title,
    description: t("description"),
    alternates: {
      canonical: pageUrl,
      languages,
    },
    openGraph: {
      title,
      description: t("description"),
      url: pageUrl,
      siteName: tMetadata("siteTitle"),
      locale: getOgLocale(locale),
      alternateLocale: getOgAlternateLocales(locale),
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t("description"),
      images: [imageUrl],
    },
  };
}

export default async function MapPage({ params, searchParams }: MapPageProps) {
  const { locale } = await params;
  const { alarms: alarmsParam, punkts, location, layer } = await searchParams;

  if (!routing.locales.includes(locale as Locale)) {
    return null;
  }

  setRequestLocale(locale);

  const savedPunkts = await getLocationCookie();
  const queryLocationId = pickLocationQueryValue(punkts, location);
  const locationId = resolveLocationId(queryLocationId, savedPunkts);
  const focusLocationId =
    queryLocationId && isValidLocationId(queryLocationId)
      ? queryLocationId
      : undefined;
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
  const pageName = `${t("title")} — ${tMetadata("siteTitle")}`;
  const jsonLd = buildPageStructuredData({
    locale,
    pageUrl: `${baseUrl}/${locale}/map`,
    name: pageName,
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
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {t("subtitle", { count: locations.length, min: minTemp, max: maxTemp })}
          </p>
        </header>

        <WeatherMapSection
          locations={locations}
          alarms={alarms}
          locale={locale}
          selectedId={selected?.id}
          focusLocationId={focusLocationId}
          initialShowAlarms={initialShowAlarms}
          initialLayer={parseMapLayer(layer)}
        />

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
