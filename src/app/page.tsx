import type { Metadata } from "next";
import { ForecastError } from "@/components/ForecastError";
import { HourlyForecastList } from "@/components/HourlyForecast";
import { WeatherChartSection } from "@/components/WeatherChartSection";
import { WeatherHeader } from "@/components/WeatherHeader";
import { WeatherTable } from "@/components/WeatherTable";
import { getHourlyForecast, getLocationPoints } from "@/lib/weather/fetch";
import {
  getLocationCookie,
  setLocationCookie,
} from "@/lib/weather/location-cookie.server";
import { isValidLocationId, resolveLocationId } from "@/lib/weather/locations";

interface HomeProps {
  searchParams: Promise<{ punkts?: string }>;
}

export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const { punkts } = await searchParams;
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);

  try {
    const data = await getHourlyForecast(locationId);
    return {
      title: `${data.location.name} Weather`,
      description: `Hourly weather forecast for ${data.location.name}, Latvia`,
    };
  } catch {
    return {
      title: "Latvia Weather",
      description: "Hourly weather forecast for Latvia",
    };
  }
}

export default async function Home({ searchParams }: HomeProps) {
  const { punkts } = await searchParams;
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(punkts, savedPunkts);

  if (punkts && isValidLocationId(punkts)) {
    await setLocationCookie(punkts);
  }

  let data;
  let locations;

  try {
    [data, locations] = await Promise.all([
      getHourlyForecast(locationId),
      getLocationPoints(),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load weather data";
    return <ForecastError message={message} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <WeatherHeader data={data} locations={locations} />
      <WeatherChartSection forecasts={data.forecasts} />
      <HourlyForecastList forecasts={data.forecasts} />
      <WeatherTable forecasts={data.forecasts} />
      <footer className="pb-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Data from{" "}
        <a
          href="https://videscentrs.lvgmc.lv/"
          className="underline hover:text-slate-700 dark:hover:text-slate-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          LVĢMC
        </a>
        . Updated every 30 minutes.
      </footer>
    </main>
  );
}
