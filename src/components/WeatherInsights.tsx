import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { WindDirection } from "@/components/WindDirection";
import { getTodayForecasts, sumPrecipitation } from "@/lib/weather/chart-data";
import type { HourlyForecast } from "@/lib/weather/types";

interface WeatherInsightsProps {
  forecasts: HourlyForecast[];
}

function maxBy(
  forecasts: HourlyForecast[],
  getValue: (forecast: HourlyForecast) => number,
): HourlyForecast {
  return forecasts.reduce((best, forecast) =>
    getValue(forecast) > getValue(best) ? forecast : best,
  );
}

export async function WeatherInsights({ forecasts }: WeatherInsightsProps) {
  const t = await getTranslations("insights");
  const todayForecasts = getTodayForecasts(forecasts);

  if (todayForecasts.length === 0) return null;

  const warmest = maxBy(todayForecasts, (forecast) => forecast.temperature);
  const wettest = maxBy(todayForecasts, (forecast) => forecast.precipitationProbability);
  const windiest = maxBy(todayForecasts, (forecast) => forecast.windGust);
  const totalPrecipitation = sumPrecipitation(todayForecasts);

  const items: { label: string; value: ReactNode }[] = [
    {
      label: t("warmest"),
      value: t("temperatureAt", {
        temp: Math.round(warmest.temperature),
        time: format(warmest.time, "HH:mm"),
      }),
    },
    {
      label: t("rain"),
      value:
        totalPrecipitation > 0
          ? t("rainAmount", {
              amount: totalPrecipitation.toFixed(1),
              chance: Math.round(wettest.precipitationProbability),
            })
          : t("rainChance", {
              chance: Math.round(wettest.precipitationProbability),
              time: format(wettest.time, "HH:mm"),
            }),
    },
    {
      label: t("wind"),
      value: (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {t("windAt", {
              speed: windiest.windGust.toFixed(1),
              time: format(windiest.time, "HH:mm"),
            })}
          </span>
          <WindDirection degrees={windiest.windDirection} />
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="insights-heading">
      <h2
        id="insights-heading"
        className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        {t("title")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
