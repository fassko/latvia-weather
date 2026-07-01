import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForecastError } from "@/components/ForecastError";
import { StalePageRefresh } from "@/components/StalePageRefresh";
import { HourlyForecastList } from "@/components/HourlyForecast";
import { ForecastChartsSection } from "@/components/ForecastChartsSection";
import { WeatherHeader } from "@/components/WeatherHeader";
import { WeatherTable } from "@/components/WeatherTable";
import { routing, type Locale } from "@/i18n/routing";
import { getHourlyForecast, getLocationPoints } from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { resolveLocationId } from "@/lib/weather/locations";

export const dynamic = "force-dynamic";

interface HomeProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ punkts?: string }>;
}

export async function generateMetadata({ params, searchParams }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  const { punkts } = await searchParams;
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);
  const t = await getTranslations({ locale, namespace: "metadata" });

  try {
    const data = await getHourlyForecast(locationId);
    return {
      title: t("locationTitle", { name: data.location.name }),
      description: t("locationDescription", { name: data.location.name }),
    };
  } catch {
    return {
      title: t("siteTitle"),
      description: t("siteDescription"),
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6">
      <StalePageRefresh />
      <WeatherHeader data={data} locations={locations} />
      <ForecastChartsSection forecasts={data.forecasts} />
      <HourlyForecastList forecasts={data.forecasts} />
      <WeatherTable forecasts={data.forecasts} />
      <footer className="pb-4 text-center text-xs text-slate-500 dark:text-slate-400">
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
      </footer>
    </main>
  );
}
