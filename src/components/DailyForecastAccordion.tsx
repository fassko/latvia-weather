"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { METRIC_TEXT_CLASS_NAMES } from "@/lib/weather/metric-styles";
import { getConditionEmoji, getWindDirection } from "@/lib/weather/parse";
import type { SunTimes } from "@/lib/weather/sun";
import { getSunEventsByForecastTime, type SunEvent } from "@/lib/weather/sun-events";
import {
  formatLatviaTime,
  getLatviaDayKey,
  getLatviaWallClock,
} from "@/lib/weather/timezone";
import { formatWindSpeed, type WindUnit } from "@/lib/weather/wind-units";
import type { HourlyForecast } from "@/lib/weather/types";

export interface DailyForecastDayRow {
  dayKey: string;
  weekday: string;
  dateLabel: string;
  weekend: boolean;
  isToday: boolean;
  low: number;
  high: number;
  barLeft: number;
  barWidth: number;
  iconCode: string;
  precipMm: number;
  rainChance: number;
  sunriseLabel: string | null;
  sunsetLabel: string | null;
  forecasts: HourlyForecast[];
  sunTimes: SunTimes | null;
}

interface DailyForecastAccordionProps {
  title: string;
  days: DailyForecastDayRow[];
  windUnit: WindUnit;
  /** ISO timestamp; hours before this are faded for "today". */
  fadedBeforeIso: string | null;
}

/**
 * Summary rows only on first paint. Hourly day tables mount when a day is
 * expanded so the initial DOM stays far below the ~2k-node budget.
 */
export function DailyForecastAccordion({
  title,
  days,
  windUnit,
  fadedBeforeIso,
}: DailyForecastAccordionProps) {
  const t = useTranslations("dailyList");
  const [mountedDayKeys, setMountedDayKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const fadedBefore = fadedBeforeIso ? new Date(fadedBeforeIso) : undefined;

  return (
    <section
      aria-labelledby="daily-heading"
      className="rounded-2xl border border-slate-200/70 bg-white p-2 shadow-sm sm:p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="daily-heading"
        className="px-3 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
      >
        {title}
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {days.map((day) => {
          const isMounted = mountedDayKeys.has(day.dayKey);

          return (
            <li key={day.dayKey}>
              <details
                className="group"
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setMountedDayKeys((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(day.dayKey);
                    else next.delete(day.dayKey);
                    return next;
                  });
                }}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 sm:gap-4 dark:hover:bg-slate-800/60">
                  <ChevronIcon />
                  <div className="w-14 shrink-0 sm:w-16">
                    <p
                      className={`text-sm font-semibold ${
                        day.weekend
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {day.weekday}
                    </p>
                    <p
                      className={`text-xs ${
                        day.weekend
                          ? "text-red-500/80 dark:text-red-400/70"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {day.dateLabel}
                    </p>
                  </div>

                  <span className="w-7 shrink-0 text-center text-xl" aria-hidden="true">
                    {getConditionEmoji(day.iconCode)}
                  </span>

                  <div className="hidden w-16 shrink-0 items-center gap-1 text-sm text-sky-600 tabular-nums sm:flex dark:text-sky-400">
                    <DropletIcon />
                    {day.precipMm.toFixed(1)}
                  </div>

                  <div className="flex flex-1 items-center gap-2 sm:gap-3">
                    <span className="w-8 shrink-0 text-right text-sm text-slate-400 tabular-nums dark:text-slate-500">
                      {day.low}°C
                    </span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-lime-400 to-green-500"
                        style={{ left: `${day.barLeft}%`, width: `${day.barWidth}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-left text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                      {day.high}°C
                    </span>
                  </div>

                  <span
                    className="flex w-12 shrink-0 items-center justify-end gap-0.5 text-xs text-sky-600 tabular-nums dark:text-sky-400"
                    aria-label={t("rainChance", { value: day.rainChance })}
                  >
                    <RainChanceIcon />
                    <span aria-hidden="true">{day.rainChance}%</span>
                  </span>
                  {day.sunriseLabel && day.sunsetLabel ? (
                    <span className="hidden shrink-0 items-center gap-1.5 text-[11px] font-medium tabular-nums text-amber-700 sm:flex dark:text-amber-300">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-1 dark:bg-amber-950/50">
                        <span aria-hidden="true">☀️</span>
                        {day.sunriseLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-1 dark:bg-amber-950/50">
                        <span aria-hidden="true">🌙</span>
                        {day.sunsetLabel}
                      </span>
                    </span>
                  ) : null}
                </summary>

                {isMounted ? (
                  <DayBreakdown
                    forecasts={day.forecasts}
                    sunTimes={day.sunTimes}
                    fadedBefore={day.isToday ? fadedBefore : undefined}
                    windUnit={windUnit}
                    caption={`${day.weekday} ${day.dateLabel}`}
                  />
                ) : null}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DayBreakdown({
  forecasts,
  sunTimes,
  fadedBefore,
  windUnit,
  caption,
}: {
  forecasts: HourlyForecast[];
  sunTimes: SunTimes | null;
  fadedBefore?: Date;
  windUnit: WindUnit;
  caption: string;
}) {
  const tTable = useTranslations("table");
  const tHourly = useTranslations("hourly");
  const tWind = useTranslations("wind");

  const dayKey = forecasts[0] ? getLatviaDayKey(forecasts[0].time) : null;
  const sunEventsByForecastTime =
    sunTimes && dayKey
      ? getSunEventsByForecastTime(forecasts, { [dayKey]: sunTimes })
      : new Map<string, SunEvent[]>();

  return (
    <div className="overflow-x-auto px-3 pt-1 pb-3">
      <table className="relative min-w-full text-left text-sm">
        <caption className="sr-only">
          {caption} — {tTable("title")}
        </caption>
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <th scope="col" className="py-2 pr-3 pl-3 font-medium">
              {tTable("time")}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              <span className="sr-only">{tHourly("condition")}</span>
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {tTable("temp")}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {tTable("feels")}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {tTable("precip")}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {tTable("rainPercent")}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {tTable("wind")}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {tTable("humidity")}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {tTable("cloudCover")}
            </th>
            <th scope="col" className="py-2 font-medium">
              {tTable("pressure")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {forecasts.map((forecast, index) => {
            const sunEvents = sunEventsByForecastTime.get(forecast.time.toISOString()) ?? [];
            const isPast =
              fadedBefore != null && getLatviaWallClock(forecast.time) < fadedBefore;

            return (
              <tr
                key={forecast.time.toISOString()}
                className={`transition-colors duration-150 motion-reduce:transition-none hover:bg-sky-200 dark:hover:bg-slate-700 ${
                  index % 2 === 0
                    ? "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    : "bg-sky-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
                } ${isPast ? "opacity-45" : ""}`}
              >
                <td className="py-1.5 pr-3 pl-3 tabular-nums">
                  <time dateTime={forecast.time.toISOString()}>
                    {formatLatviaTime(forecast.time, "HH:mm")}
                  </time>
                  {sunEvents.length > 0 ? (
                    <span className="mt-1 flex flex-col gap-1 text-[11px] leading-none text-amber-700 dark:text-amber-300">
                      {sunEvents.map((sunEvent) => (
                        <span
                          key={sunEvent.event}
                          className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-1.5 py-1 font-medium tabular-nums dark:bg-amber-950/50"
                        >
                          <span aria-hidden="true">
                            {sunEvent.event === "sunrise" ? "☀️" : "🌙"}
                          </span>
                          <time dateTime={sunEvent.time.toISOString()}>
                            {formatLatviaTime(sunEvent.time, "HH:mm")}
                          </time>
                          <span>{tTable(sunEvent.event)}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-3 text-base" aria-hidden="true">
                  {getConditionEmoji(forecast.iconCode)}
                </td>
                <td
                  className={`py-1.5 pr-3 font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.temperature}`}
                >
                  {Math.round(forecast.temperature)}°C
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{Math.round(forecast.feelsLike)}°C</td>
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
                  {tWind(`directions.${getWindDirection(forecast.windDirection)}`)}
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{Math.round(forecast.humidity)}%</td>
                <td className="py-1.5 pr-3 tabular-nums">{Math.round(forecast.cloudCover)}%</td>
                <td className="py-1.5 tabular-nums">{forecast.pressure.toFixed(0)}</td>
              </tr>
            );
          })}
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

function RainChanceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M7 15a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 7a3.5 3.5 0 0 1 0 7" />
      <path d="M8 18.5 7 20M12 18.5 11 20M16 18.5 15 20" />
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
