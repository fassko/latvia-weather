import { format } from "date-fns";
import { ForecastDaySection } from "@/components/ForecastDaySection";
import { getWindDirection } from "@/lib/weather/parse";
import { groupForecastsByDay, summarizeDay } from "@/lib/weather/daily";
import type { HourlyForecast } from "@/lib/weather/types";

interface WeatherTableProps {
  forecasts: HourlyForecast[];
}

export function WeatherTable({ forecasts }: WeatherTableProps) {
  const dayGroups = groupForecastsByDay(forecasts);

  return (
    <section aria-labelledby="table-heading">
      <h2 id="table-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Detailed forecast
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">Feels</th>
              <th className="px-4 py-3 font-medium">Precip</th>
              <th className="px-4 py-3 font-medium">Rain %</th>
              <th className="px-4 py-3 font-medium">Humidity</th>
              <th className="px-4 py-3 font-medium">Wind</th>
              <th className="px-4 py-3 font-medium">Pressure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {dayGroups.map(({ date, forecasts: dayForecasts }) => {
              const summary = summarizeDay(dayForecasts);

              return (
                <ForecastDaySection
                  key={format(date, "yyyy-MM-dd")}
                  date={date}
                  summary={summary}
                  variant="detailed"
                >
                  {dayForecasts.map((forecast) => (
                    <tr
                      key={forecast.time.toISOString()}
                      className="text-slate-700 transition-colors duration-150 hover:bg-sky-200 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                        {format(forecast.time, "HH:mm")}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {forecast.temperature.toFixed(1)}°C
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {forecast.feelsLike.toFixed(1)}°C
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {forecast.precipitation.toFixed(1)} mm
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {Math.round(forecast.precipitationProbability)}%
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {Math.round(forecast.humidity)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                        {forecast.windSpeed.toFixed(1)} m/s{" "}
                        {getWindDirection(forecast.windDirection)}
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
