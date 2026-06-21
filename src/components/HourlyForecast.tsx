import { format } from "date-fns";
import { ForecastDaySection } from "@/components/ForecastDaySection";
import { getConditionEmoji } from "@/lib/weather/parse";
import { groupForecastsByDay, summarizeDay } from "@/lib/weather/daily";
import type { HourlyForecast } from "@/lib/weather/types";

interface HourlyForecastProps {
  forecasts: HourlyForecast[];
}

export function HourlyForecastList({ forecasts }: HourlyForecastProps) {
  const dayGroups = groupForecastsByDay(forecasts);

  return (
    <section aria-labelledby="hourly-heading">
      <h2 id="hourly-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Hourly forecast
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Condition</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">Precip / Rain</th>
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
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                        <time dateTime={forecast.time.toISOString()}>
                          {format(forecast.time, "HH:mm")}
                        </time>
                      </td>
                      <td className="px-4 py-2">
                        <span aria-hidden="true">{getConditionEmoji(forecast.iconCode)}</span>
                      </td>
                      <td className="px-4 py-2 font-semibold tabular-nums">
                        {Math.round(forecast.temperature)}°C
                      </td>
                      <td className="px-4 py-2 tabular-nums text-sky-700 dark:text-sky-400">
                        {forecast.precipitation > 0
                          ? `${forecast.precipitation.toFixed(1)} mm`
                          : `${Math.round(forecast.precipitationProbability)}% chance`}
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
