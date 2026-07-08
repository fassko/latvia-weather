import { format } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { ForecastDaySection } from "@/components/ForecastDaySection";
import { WindDirection } from "@/components/WindDirection";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import { getConditionEmoji } from "@/lib/weather/parse";
import { getUpcomingHourlyForecasts } from "@/lib/weather/chart-data";
import { groupForecastsByDay, summarizeDay } from "@/lib/weather/daily";
import { METRIC_TEXT_CLASS_NAMES } from "@/lib/weather/metric-styles";
import type { HourlyForecast } from "@/lib/weather/types";

interface HourlyForecastProps {
  forecasts: HourlyForecast[];
}

export async function HourlyForecastList({ forecasts }: HourlyForecastProps) {
  const locale = await getLocale();
  const t = await getTranslations("hourly");
  const tDaily = await getTranslations("daily");
  const dateLocale = getDateFnsLocale(locale);
  const dayGroups = groupForecastsByDay(getUpcomingHourlyForecasts(forecasts));

  return (
    <section aria-labelledby="hourly-heading">
      <h2 id="hourly-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {t("title")}
      </h2>
      <div className="space-y-4 sm:hidden">
        {dayGroups.map(({ date, forecasts: dayForecasts }) => {
          const summary = summarizeDay(dayForecasts);

          return (
            <section
              key={format(date, "yyyy-MM-dd")}
              aria-label={tDaily("hourlyForecastFor", {
                date: format(date, getDatePattern(locale, "longDate"), {
                  locale: dateLocale,
                }),
              })}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {format(date, getDatePattern(locale, "longDate"), { locale: dateLocale })}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {Math.round(summary.minTemperature)}° / {Math.round(summary.maxTemperature)}° ·{" "}
                  {tDaily("mmTotal", { value: summary.totalPrecipitation.toFixed(1) })}
                </p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dayForecasts.map((forecast) => (
                  <article
                    key={forecast.time.toISOString()}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
                  >
                    <time
                      dateTime={forecast.time.toISOString()}
                      className="font-mono text-sm text-slate-500 dark:text-slate-400"
                    >
                      {format(forecast.time, "HH:mm")}
                    </time>
                    <div className="min-w-0">
                      <p className={`font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.temperature}`}>
                        {Math.round(forecast.temperature)}°C
                      </p>
                      <p className={`text-sm tabular-nums ${METRIC_TEXT_CLASS_NAMES.precipitation}`}>
                        {forecast.precipitation > 0
                          ? `${forecast.precipitation.toFixed(1)} mm`
                          : t("chance", { value: Math.round(forecast.precipitationProbability) })}
                      </p>
                      <p className={`mt-0.5 text-sm tabular-nums ${METRIC_TEXT_CLASS_NAMES.wind}`}>
                        {forecast.windSpeed.toFixed(1)} m/s{" "}
                        <WindDirection degrees={forecast.windDirection} size="sm" />
                      </p>
                    </div>
                    <span className="text-2xl" aria-hidden="true">
                      {getConditionEmoji(forecast.iconCode)}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
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
            {dayGroups.map(({ date, forecasts: dayForecasts }) => {
              const summary = summarizeDay(dayForecasts);

              return (
                <ForecastDaySection
                  key={format(date, "yyyy-MM-dd")}
                  date={date}
                  summary={summary}
                  variant="hourly"
                >
                  {dayForecasts.map((forecast, index) => (
                    <tr
                      key={forecast.time.toISOString()}
                      className={`transition-colors duration-150 hover:bg-sky-200 dark:hover:bg-slate-700 ${
                        index % 2 === 0
                          ? "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          : "bg-sky-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                      }`}
                    >
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums sm:px-4">
                        <time dateTime={forecast.time.toISOString()}>
                          {format(forecast.time, "HH:mm")}
                        </time>
                      </td>
                      <td className="px-2 py-2 sm:px-4">
                        <span aria-hidden="true">{getConditionEmoji(forecast.iconCode)}</span>
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
                        {forecast.windSpeed.toFixed(1)} m/s{" "}
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
