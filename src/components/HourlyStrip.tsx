"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import { getUpcomingHourlyForecasts } from "@/lib/weather/chart-data";
import { getConditionEmoji } from "@/lib/weather/parse";
import { formatLatviaTime, getLatviaDayKey } from "@/lib/weather/timezone";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import { useWindUnit } from "@/lib/weather/use-wind-unit";
import type { HourlyForecast } from "@/lib/weather/types";

interface HourlyStripProps {
  forecasts: HourlyForecast[];
  hours?: number;
}

export function HourlyStrip({ forecasts, hours = 24 }: HourlyStripProps) {
  const t = useTranslations("hourlyCard");
  const locale = useLocale();
  const dateLocale = getDateFnsLocale(locale);
  const windUnit = useWindUnit();
  const upcoming = getUpcomingHourlyForecasts(forecasts).slice(0, hours);

  if (upcoming.length === 0) return null;

  return (
    <div className="mt-4 flex gap-1.5 overflow-x-auto pb-2">
      {upcoming.map((forecast, index) => {
        const isNow = index === 0;
        const isNewDay =
          index > 0 &&
          getLatviaDayKey(forecast.time) !== getLatviaDayKey(upcoming[index - 1].time);

        return (
          <Fragment key={forecast.time.toISOString()}>
            {isNewDay ? (
              <div className="flex shrink-0 items-center gap-1.5 self-stretch pl-1">
                <span className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 [writing-mode:vertical-rl] rotate-180 dark:text-slate-500">
                  {formatLatviaTime(forecast.time, getDatePattern(locale, "dailyDate"), {
                    locale: dateLocale,
                  })}
                </span>
              </div>
            ) : null}
            <div
              className={`flex min-w-[4.25rem] flex-col items-center gap-1 rounded-xl px-2 py-2.5 ${
                isNow
                  ? "bg-sky-50 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-500/30"
                  : ""
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isNow
                    ? "text-sky-600 dark:text-sky-300"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {isNow ? t("now") : formatLatviaTime(forecast.time, "HH:mm")}
              </span>
              <span className="text-xl" aria-hidden="true">
                {getConditionEmoji(forecast.iconCode)}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {Math.round(forecast.temperature)}°
              </span>
              <span className="text-xs tabular-nums text-sky-600 dark:text-sky-400">
                {Math.round(forecast.precipitationProbability)}%
              </span>
              <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                <WindArrow degrees={forecast.windDirection} />
                {formatWindSpeed(forecast.windSpeed, windUnit)}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      aria-hidden="true"
      className="h-2.5 w-2.5 shrink-0 text-violet-500 dark:text-violet-400"
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
