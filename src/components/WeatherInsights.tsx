import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { WindDirection } from "@/components/WindDirection";
import {
  getUpcomingTodayForecasts,
  sumPrecipitation,
} from "@/lib/weather/forecast-period";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import { formatLatviaTime } from "@/lib/weather/timezone";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import type { HourlyForecast } from "@/lib/weather/types";

interface WeatherInsightsProps {
  forecasts: HourlyForecast[];
}

const THUNDER_INSIGHT_THRESHOLD = 20;

function maxBy(
  forecasts: HourlyForecast[],
  getValue: (forecast: HourlyForecast) => number,
): HourlyForecast {
  return forecasts.reduce((best, forecast) =>
    getValue(forecast) > getValue(best) ? forecast : best,
  );
}

function getMainRainPeriod(forecasts: HourlyForecast[]): HourlyForecast[] {
  const periods: HourlyForecast[][] = [];
  let current: HourlyForecast[] = [];

  for (const forecast of forecasts) {
    if (forecast.precipitation > 0) {
      current.push(forecast);
    } else if (current.length > 0) {
      periods.push(current);
      current = [];
    }
  }

  if (current.length > 0) periods.push(current);

  return periods.reduce<HourlyForecast[]>((best, period) => {
    const bestAmount = sumPrecipitation(best);
    const periodAmount = sumPrecipitation(period);
    return periodAmount > bestAmount ? period : best;
  }, []);
}

function getMainSnowPeriod(forecasts: HourlyForecast[]): HourlyForecast[] {
  const periods: HourlyForecast[][] = [];
  let current: HourlyForecast[] = [];

  for (const forecast of forecasts) {
    if (forecast.snow > 0) {
      current.push(forecast);
    } else if (current.length > 0) {
      periods.push(current);
      current = [];
    }
  }

  if (current.length > 0) periods.push(current);

  return periods.reduce<HourlyForecast[]>((best, period) => {
    const bestAmount = sumSnow(period);
    const periodAmount = sumSnow(best);
    return periodAmount > bestAmount ? period : best;
  }, []);
}

function sumSnow(forecasts: HourlyForecast[]): number {
  return forecasts.reduce((total, forecast) => total + forecast.snow, 0);
}

export async function WeatherInsights({ forecasts }: WeatherInsightsProps) {
  const t = await getTranslations("insights");
  const windUnit = await getWindUnitsCookie();
  const periodForecasts = getUpcomingTodayForecasts(forecasts);

  if (periodForecasts.length === 0) return null;

  const warmest = maxBy(periodForecasts, (forecast) => forecast.temperature);
  const wettest = maxBy(periodForecasts, (forecast) => forecast.precipitationProbability);
  const windiest = maxBy(periodForecasts, (forecast) => forecast.windGust);
  const stormiest = maxBy(periodForecasts, (forecast) => forecast.thunderProbability);
  const totalPrecipitation = sumPrecipitation(periodForecasts);
  const totalSnow = sumSnow(periodForecasts);
  const mainRainPeriod = getMainRainPeriod(periodForecasts);
  const mainRainStart = mainRainPeriod[0];
  const mainRainEnd = mainRainPeriod[mainRainPeriod.length - 1];
  const mainRainChance = mainRainPeriod.reduce(
    (max, forecast) => Math.max(max, forecast.precipitationProbability),
    0,
  );
  const mainSnowPeriod = getMainSnowPeriod(periodForecasts);
  const mainSnowStart = mainSnowPeriod[0];
  const mainSnowEnd = mainSnowPeriod[mainSnowPeriod.length - 1];

  const items: { key: string; label: string; value: ReactNode }[] = [
    {
      key: "warmest",
      label: t("warmest"),
      value: t("temperatureAt", {
        temp: Math.round(warmest.temperature),
        time: formatLatviaTime(warmest.time, "HH:mm"),
      }),
    },
    {
      key: "rain",
      label: t("rain"),
      value:
        mainRainStart && mainRainEnd && mainRainStart !== mainRainEnd
          ? t("rainPeriod", {
              start: formatLatviaTime(mainRainStart.time, "HH:mm"),
              end: formatLatviaTime(mainRainEnd.time, "HH:mm"),
              amount: sumPrecipitation(mainRainPeriod).toFixed(1),
              chance: Math.round(mainRainChance),
            })
          : mainRainStart
            ? t("rainAmountAt", {
                time: formatLatviaTime(mainRainStart.time, "HH:mm"),
                amount: mainRainStart.precipitation.toFixed(1),
                chance: Math.round(mainRainStart.precipitationProbability),
              })
            : totalPrecipitation > 0
              ? t("rainAmount", {
                  amount: totalPrecipitation.toFixed(1),
                  chance: Math.round(wettest.precipitationProbability),
                })
              : t("rainChance", {
                  chance: Math.round(wettest.precipitationProbability),
                  time: formatLatviaTime(wettest.time, "HH:mm"),
                }),
    },
    {
      key: "wind",
      label: t("wind"),
      value: (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {t("windAt", {
              speed: formatWindSpeed(windiest.windGust, windUnit),
              time: formatLatviaTime(windiest.time, "HH:mm"),
            })}
          </span>
          <WindDirection degrees={windiest.windDirection} />
        </span>
      ),
    },
  ];

  if (stormiest.thunderProbability >= THUNDER_INSIGHT_THRESHOLD) {
    items.push({
      key: "thunder",
      label: t("thunder"),
      value: t("thunderAt", {
        chance: Math.round(stormiest.thunderProbability),
        time: formatLatviaTime(stormiest.time, "HH:mm"),
      }),
    });
  }

  if (totalSnow > 0) {
    items.push({
      key: "snow",
      label: t("snow"),
      value:
        mainSnowStart && mainSnowEnd && mainSnowStart !== mainSnowEnd
          ? t("snowPeriod", {
              start: formatLatviaTime(mainSnowStart.time, "HH:mm"),
              end: formatLatviaTime(mainSnowEnd.time, "HH:mm"),
              amount: sumSnow(mainSnowPeriod).toFixed(1),
            })
          : mainSnowStart
            ? t("snowAmountAt", {
                time: formatLatviaTime(mainSnowStart.time, "HH:mm"),
                amount: mainSnowStart.snow.toFixed(1),
              })
            : t("snowAmount", {
                amount: totalSnow.toFixed(1),
              }),
    });
  }

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
            key={item.key}
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
