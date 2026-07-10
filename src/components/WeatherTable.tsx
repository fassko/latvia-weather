import { getTranslations } from "next-intl/server";
import { DetailedForecastMobileDay } from "@/components/DetailedForecastMobileDay";
import { ForecastDaySection } from "@/components/ForecastDaySection";
import { FeelsLikeText } from "@/components/FeelsLikeText";
import { WindDirection } from "@/components/WindDirection";
import { groupForecastsByDay, summarizeDay } from "@/lib/weather/daily";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import { METRIC_TEXT_CLASS_NAMES } from "@/lib/weather/metric-styles";
import { formatLatviaTime, getLatviaDayKey } from "@/lib/weather/timezone";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import type { HourlyForecast } from "@/lib/weather/types";

interface WeatherTableProps {
  forecasts: HourlyForecast[];
}

export async function WeatherTable({ forecasts }: WeatherTableProps) {
  const t = await getTranslations("table");
  const dayGroups = groupForecastsByDay(forecasts);
  const todayKey = getLatviaDayKey(new Date());
  const windUnit = await getWindUnitsCookie();

  return (
    <section aria-labelledby="table-heading">
      <h2 id="table-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {t("title")}
      </h2>
      <div className="space-y-4 sm:hidden">
        {dayGroups.map(({ dayKey, date, forecasts: dayForecasts }) => (
          <DetailedForecastMobileDay
            key={dayKey}
            date={date}
            summary={summarizeDay(dayForecasts)}
            forecasts={dayForecasts}
            defaultExpanded={dayKey === todayKey}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">{t("time")}</th>
              <th className="px-4 py-3 font-medium">{t("temp")}</th>
              <th className="px-4 py-3 font-medium">{t("feels")}</th>
              <th className="px-4 py-3 font-medium">{t("precip")}</th>
              <th className="px-4 py-3 font-medium">{t("rainPercent")}</th>
              <th className="px-4 py-3 font-medium">{t("humidity")}</th>
              <th className="px-4 py-3 font-medium">{t("cloudCover")}</th>
              <th className="px-4 py-3 font-medium">{t("wind")}</th>
              <th className="px-4 py-3 font-medium">{t("pressure")}</th>
            </tr>
          </thead>
          <tbody>
            {dayGroups.map(({ dayKey, date, forecasts: dayForecasts }) => {
              const summary = summarizeDay(dayForecasts);

              return (
                <ForecastDaySection
                  key={dayKey}
                  date={date}
                  summary={summary}
                  variant="detailed"
                  defaultExpanded={dayKey === todayKey}
                >
                  {dayForecasts.map((forecast, index) => (
                    <tr
                      key={forecast.time.toISOString()}
                      className={`motion-reduce:transition-none transition-colors duration-150 hover:bg-sky-200 dark:hover:bg-slate-700 ${
                        index % 2 === 0
                          ? "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          : "bg-sky-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                        <time dateTime={forecast.time.toISOString()}>
                          {formatLatviaTime(forecast.time, "HH:mm")}
                        </time>
                      </td>
                      <td className={`px-4 py-2 tabular-nums ${METRIC_TEXT_CLASS_NAMES.temperature}`}>
                        {forecast.temperature.toFixed(1)}°C
                      </td>
                      <td className={`px-4 py-2 tabular-nums ${METRIC_TEXT_CLASS_NAMES.temperature}`}>
                        <FeelsLikeText
                          temperature={forecast.temperature}
                          feelsLike={forecast.feelsLike}
                          precision={1}
                          variant="table"
                          showLabel={false}
                        />
                      </td>
                      <td className={`px-4 py-2 tabular-nums ${METRIC_TEXT_CLASS_NAMES.precipitation}`}>
                        {forecast.precipitation.toFixed(1)} mm
                        {forecast.snow > 0 ? ` / ${forecast.snow.toFixed(1)} cm` : ""}
                      </td>
                      <td className={`px-4 py-2 tabular-nums ${METRIC_TEXT_CLASS_NAMES.precipitation}`}>
                        {Math.round(forecast.precipitationProbability)}%
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {Math.round(forecast.humidity)}%
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {Math.round(forecast.cloudCover)}%
                      </td>
                      <td className={`whitespace-nowrap px-4 py-2 tabular-nums ${METRIC_TEXT_CLASS_NAMES.wind}`}>
                        {formatWindSpeed(forecast.windSpeed, windUnit)}{" "}
                        <WindDirection degrees={forecast.windDirection} size="sm" />
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {forecast.pressure.toFixed(1)} hPa
                      </td>
                    </tr>
                  ))}
                </ForecastDaySection>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
