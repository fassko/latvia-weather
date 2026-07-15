import { getTranslations } from "next-intl/server";
import { ForecastDaySection } from "@/components/ForecastDaySection";
import { HourlyForecastMobileDay } from "@/components/HourlyForecastMobileDay";
import { ConditionEmojiServer } from "@/components/ConditionEmojiServer";
import { WindDirection } from "@/components/WindDirection";
import { getUpcomingHourlyForecasts } from "@/lib/weather/forecast-period";
import { groupForecastsByDay, summarizeDay } from "@/lib/weather/daily";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import { METRIC_TEXT_CLASS_NAMES } from "@/lib/weather/metric-styles";
import { formatLatviaTime, getLatviaDayKey } from "@/lib/weather/timezone";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import type { HourlyForecast } from "@/lib/weather/types";

interface HourlyForecastProps {
  forecasts: HourlyForecast[];
}

export async function HourlyForecastList({ forecasts }: HourlyForecastProps) {
  const t = await getTranslations("hourly");
  const dayGroups = groupForecastsByDay(getUpcomingHourlyForecasts(forecasts));
  const todayKey = getLatviaDayKey(new Date());
  const windUnit = await getWindUnitsCookie();

  return (
    <section aria-labelledby="hourly-heading">
      <h2 id="hourly-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {t("title")}
      </h2>
      <div className="space-y-4 sm:hidden">
        {dayGroups.map(({ dayKey, date, forecasts: dayForecasts }) => (
          <HourlyForecastMobileDay
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
              <th className="px-2 py-3 font-medium sm:px-4">{t("time")}</th>
              <th className="px-2 py-3 font-medium sm:px-4">{t("condition")}</th>
              <th className="px-2 py-3 font-medium sm:px-4">{t("temp")}</th>
              <th className="px-2 py-3 font-medium sm:px-4">{t("precipRain")}</th>
              <th className="px-2 py-3 font-medium sm:px-4">{t("wind")}</th>
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
                  variant="hourly"
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
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums sm:px-4">
                        <time dateTime={forecast.time.toISOString()}>
                          {formatLatviaTime(forecast.time, "HH:mm")}
                        </time>
                      </td>
                      <td className="px-2 py-2 sm:px-4">
                        <ConditionEmojiServer iconCode={forecast.iconCode} />
                      </td>
                      <td className={`px-2 py-2 font-semibold tabular-nums sm:px-4 ${METRIC_TEXT_CLASS_NAMES.temperature}`}>
                        {Math.round(forecast.temperature)}°C
                      </td>
                      <td className={`px-2 py-2 tabular-nums sm:px-4 ${METRIC_TEXT_CLASS_NAMES.precipitation}`}>
                        {forecast.precipitation > 0
                          ? `${forecast.precipitation.toFixed(1)} mm`
                          : t("chance", { value: Math.round(forecast.precipitationProbability) })}
                      </td>
                      <td className={`whitespace-nowrap px-2 py-2 tabular-nums sm:px-4 ${METRIC_TEXT_CLASS_NAMES.wind}`}>
                        {formatWindSpeed(forecast.windSpeed, windUnit)}{" "}
                        <WindDirection degrees={forecast.windDirection} size="sm" />
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
