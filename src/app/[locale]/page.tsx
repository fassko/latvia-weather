import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForecastError } from "@/components/ForecastError";
import { LastUpdated } from "@/components/LastUpdated";
import { StalePageRefresh } from "@/components/StalePageRefresh";
import { HourlyForecastList } from "@/components/HourlyForecast";
import { ForecastChartsSection } from "@/components/ForecastChartsSection";
import { WeatherHeader } from "@/components/WeatherHeader";
import { WeatherTable } from "@/components/WeatherTable";
import { routing, type Locale } from "@/i18n/routing";
import { getHourlyForecast } from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { DEFAULT_LOCATION_ID, resolveLocationId } from "@/lib/weather/locations";
import { getSiteUrl } from "@/lib/site";

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

export async function generateMetadata({ params, searchParams }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  const { punkts } = await searchParams;
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);
  const t = await getTranslations({ locale, namespace: "metadata" });
  const baseUrl = getSiteUrl();
  const pagePath = buildPagePath(locale, locationId);
  const pageUrl = `${baseUrl}${pagePath}`;

  try {
    const data = await getHourlyForecast(locationId);
    const title = t("locationTitle", { name: data.location.name });
    const description = t("locationDescription", { name: data.location.name });

    return {
      title,
      description,
      alternates: {
        canonical: pageUrl,
        languages: Object.fromEntries(
          routing.locales.map((altLocale) => [
            altLocale,
            `${baseUrl}${buildPagePath(altLocale, locationId)}`,
          ]),
        ),
      },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: t("siteTitle"),
        locale: locale === "lv" ? "lv_LV" : "en_US",
        type: "website",
        images: [{ url: `${baseUrl}/${locale}/opengraph-image` }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`${baseUrl}/${locale}/opengraph-image`],
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
        languages: Object.fromEntries(
          routing.locales.map((altLocale) => [
            altLocale,
            `${baseUrl}${buildPagePath(altLocale, locationId)}`,
          ]),
        ),
      },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: title,
        locale: locale === "lv" ? "lv_LV" : "en_US",
        type: "website",
        images: [{ url: `${baseUrl}/${locale}/opengraph-image` }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`${baseUrl}/${locale}/opengraph-image`],
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

  let data;

  try {
    data = await getHourlyForecast(locationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : t("loadWeatherData");
    return <ForecastError message={message} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6">
      <StalePageRefresh />
      <WeatherHeader data={data} />
      <ForecastChartsSection forecasts={data.forecasts} />
      <HourlyForecastList forecasts={data.forecasts} />
      <WeatherTable forecasts={data.forecasts} />
      <footer className="space-y-1 pb-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          <LastUpdated fetchedAt={data.fetchedAt} />
        </p>
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
  );
}
