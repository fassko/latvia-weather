import { format, isWeekend } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import { groupForecastsByDay, summarizeDay, type DailySummary } from "@/lib/weather/daily";
import { METRIC_TEXT_CLASS_NAMES } from "@/lib/weather/metric-styles";
import { getConditionEmoji, getWindDirection } from "@/lib/weather/parse";
import { formatLatviaTime, getLatviaDayKey } from "@/lib/weather/timezone";
import { formatWindSpeed, type WindUnit } from "@/lib/weather/wind-units";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import type { HourlyForecast } from "@/lib/weather/types";

interface DailyForecastListProps {
  forecasts: HourlyForecast[];
}

interface DailyRow {
  dayKey: string;
  date: Date;
  summary: DailySummary;
  forecasts: HourlyForecast[];
}

export async function DailyForecastList({ forecasts }: DailyForecastListProps) {
  const locale = await getLocale();
  const t = await getTranslations("dailyList");
  const tTable = await getTranslations("table");
  const dateLocale = getDateFnsLocale(locale);
  const windUnit = await getWindUnitsCookie();
  const todayKey = getLatviaDayKey(new Date());

  const rows: DailyRow[] = groupForecastsByDay(forecasts).map((group) => ({
    dayKey: group.dayKey,
    date: group.date,
    summary: summarizeDay(group.forecasts),
    forecasts: group.forecasts,
  }));

  if (rows.length === 0) return null;

  const overallMin = Math.min(...rows.map((row) => row.summary.minTemperature));
  const overallMax = Math.max(...rows.map((row) => row.summary.maxTemperature));
  const span = Math.max(overallMax - overallMin, 1);

  return (
    <section
      aria-labelledby="daily-heading"
      className="rounded-2xl border border-slate-200/70 bg-white p-2 shadow-sm sm:p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="daily-heading"
        className="px-3 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        {t("title")}
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => {
          const { summary } = row;
          const low = Math.round(summary.minTemperature);
          const high = Math.round(summary.maxTemperature);
          const left = ((summary.minTemperature - overallMin) / span) * 100;
          const width = Math.max(
            ((summary.maxTemperature - summary.minTemperature) / span) * 100,
            6,
          );
          const isToday = row.dayKey === todayKey;
          const weekday = isToday
            ? t("today")
            : format(row.date, getDatePattern(locale, "dailyWeekday"), {
                locale: dateLocale,
              });
          const dateLabel = format(row.date, getDatePattern(locale, "dailyDate"), {
            locale: dateLocale,
          });
          const weekend = isWeekend(row.date);

          return (
            <li key={row.dayKey}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 sm:gap-4 dark:hover:bg-slate-800/60">
                  <ChevronIcon />
                  <div className="w-14 shrink-0 sm:w-16">
                    <p
                      className={`text-sm font-semibold ${
                        weekend
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {weekday}
                    </p>
                    <p
                      className={`text-xs ${
                        weekend
                          ? "text-red-500/80 dark:text-red-400/70"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {dateLabel}
                    </p>
                  </div>

                  <span className="w-7 shrink-0 text-center text-xl" aria-hidden="true">
                    {getConditionEmoji(summary.representativeIconCode)}
                  </span>

                  <div className="hidden w-16 shrink-0 items-center gap-1 text-sm text-sky-600 tabular-nums sm:flex dark:text-sky-400">
                    <DropletIcon />
                    {summary.totalPrecipitation.toFixed(1)}
                  </div>

                  <div className="flex flex-1 items-center gap-2 sm:gap-3">
                    <span className="w-8 shrink-0 text-right text-sm text-slate-400 tabular-nums dark:text-slate-500">
                      {low}°
                    </span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-lime-400 to-green-500"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-left text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                      {high}°
                    </span>
                  </div>

                  <span className="w-10 shrink-0 text-right text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {Math.round(summary.maxPrecipitationProbability)}%
                  </span>
                </summary>

                <DayBreakdown
                  forecasts={row.forecasts}
                  windUnit={windUnit}
                  labels={{
                    time: tTable("time"),
                    temp: tTable("temp"),
                    feels: tTable("feels"),
                    precip: tTable("precip"),
                    rainPercent: tTable("rainPercent"),
                    wind: tTable("wind"),
                    humidity: tTable("humidity"),
                    cloudCover: tTable("cloudCover"),
                    pressure: tTable("pressure"),
                  }}
                />
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface DayBreakdownProps {
  forecasts: HourlyForecast[];
  windUnit: WindUnit;
  labels: {
    time: string;
    temp: string;
    feels: string;
    precip: string;
    rainPercent: string;
    wind: string;
    humidity: string;
    cloudCover: string;
    pressure: string;
  };
}

function DayBreakdown({ forecasts, windUnit, labels }: DayBreakdownProps) {
  return (
    <div className="overflow-x-auto px-3 pt-1 pb-3">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <th className="py-2 pr-3 font-medium">{labels.time}</th>
            <th className="py-2 pr-3 font-medium" />
            <th className="py-2 pr-3 font-medium">{labels.temp}</th>
            <th className="py-2 pr-3 font-medium">{labels.feels}</th>
            <th className="py-2 pr-3 font-medium">{labels.precip}</th>
            <th className="py-2 pr-3 font-medium">{labels.rainPercent}</th>
            <th className="py-2 pr-3 font-medium">{labels.wind}</th>
            <th className="py-2 pr-3 font-medium">{labels.humidity}</th>
            <th className="py-2 pr-3 font-medium">{labels.cloudCover}</th>
            <th className="py-2 font-medium">{labels.pressure}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {forecasts.map((forecast) => (
            <tr key={forecast.time.toISOString()} className="text-slate-600 dark:text-slate-300">
              <td className="py-1.5 pr-3 tabular-nums">
                <time dateTime={forecast.time.toISOString()}>
                  {formatLatviaTime(forecast.time, "HH:mm")}
                </time>
              </td>
              <td className="py-1.5 pr-3 text-base" aria-hidden="true">
                {getConditionEmoji(forecast.iconCode)}
              </td>
              <td
                className={`py-1.5 pr-3 font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.temperature}`}
              >
                {Math.round(forecast.temperature)}°
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{Math.round(forecast.feelsLike)}°</td>
              <td className={`py-1.5 pr-3 tabular-nums ${METRIC_TEXT_CLASS_NAMES.precipitation}`}>
                {forecast.precipitation > 0 ? `${forecast.precipitation.toFixed(1)} mm` : "—"}
              </td>
              <td className={`py-1.5 pr-3 tabular-nums ${METRIC_TEXT_CLASS_NAMES.precipitation}`}>
                {Math.round(forecast.precipitationProbability)}%
              </td>
              <td
                className={`py-1.5 pr-3 whitespace-nowrap tabular-nums ${METRIC_TEXT_CLASS_NAMES.wind}`}
              >
                {formatWindSpeed(forecast.windSpeed, windUnit)}{" "}
                <WindArrow degrees={forecast.windDirection} />{" "}
                {getWindDirection(forecast.windDirection)}
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{Math.round(forecast.humidity)}%</td>
              <td className="py-1.5 pr-3 tabular-nums">{Math.round(forecast.cloudCover)}%</td>
              <td className="py-1.5 tabular-nums">{forecast.pressure.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none dark:text-slate-500"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M12 2.5S5.5 9.5 5.5 14a6.5 6.5 0 0 0 13 0c0-4.5-6.5-11.5-6.5-11.5Z" />
    </svg>
  );
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      aria-hidden="true"
      className="inline h-3 w-3"
      style={{ transform: `rotate(${degrees + 180}deg)` }}
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M8 2v10M8 2L5 7M8 2l3 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
