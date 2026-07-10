"use client";

import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { WindDirection } from "@/components/WindDirection";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import { getConditionEmoji } from "@/lib/weather/parse";
import type { DailySummary } from "@/lib/weather/daily";
import { METRIC_TEXT_CLASS_NAMES } from "@/lib/weather/metric-styles";
import { formatLatviaTime } from "@/lib/weather/timezone";
import type { HourlyForecast } from "@/lib/weather/types";

interface HourlyForecastMobileDayProps {
  date: Date;
  summary: DailySummary;
  forecasts: HourlyForecast[];
  defaultExpanded?: boolean;
}

function ExpandArrow({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
        expanded ? "rotate-90" : ""
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function HourlyForecastMobileDay({
  date,
  summary,
  forecasts,
  defaultExpanded = false,
}: HourlyForecastMobileDayProps) {
  const locale = useLocale();
  const t = useTranslations("hourly");
  const tDaily = useTranslations("daily");
  const dateLocale = getDateFnsLocale(locale);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const dateLabel = format(date, getDatePattern(locale, "longDate"), { locale: dateLocale });

  function toggleExpanded() {
    setExpanded((value) => !value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded();
    }
  }

  return (
    <section
      aria-label={tDaily("hourlyForecastFor", { date: dateLabel })}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        type="button"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-label={`${expanded ? tDaily("collapse") : tDaily("expand")} ${tDaily("hourlyForecastFor", { date: dateLabel })}`}
        className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left transition-colors duration-150 hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
      >
        <ExpandArrow expanded={expanded} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">{dateLabel}</span>
          <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
            {Math.round(summary.minTemperature)}° / {Math.round(summary.maxTemperature)}° ·{" "}
            {tDaily("mmTotal", { value: summary.totalPrecipitation.toFixed(1) })}
          </span>
        </span>
        <span className="shrink-0 text-2xl" aria-hidden="true">
          {getConditionEmoji(summary.representativeIconCode)}
        </span>
      </button>
      {expanded ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {forecasts.map((forecast) => (
            <article
              key={forecast.time.toISOString()}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
            >
              <time
                dateTime={forecast.time.toISOString()}
                className="font-mono text-sm text-slate-500 dark:text-slate-400"
              >
                {formatLatviaTime(forecast.time, "HH:mm")}
              </time>
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto text-sm tabular-nums [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className={`shrink-0 font-semibold ${METRIC_TEXT_CLASS_NAMES.temperature}`}>
                  {Math.round(forecast.temperature)}°C
                </span>
                <span aria-hidden="true" className="shrink-0 text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span className={`shrink-0 ${METRIC_TEXT_CLASS_NAMES.precipitation}`}>
                  {forecast.precipitation > 0
                    ? `${forecast.precipitation.toFixed(1)} mm`
                    : t("chance", { value: Math.round(forecast.precipitationProbability) })}
                </span>
                <span aria-hidden="true" className="shrink-0 text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 ${METRIC_TEXT_CLASS_NAMES.wind}`}
                >
                  {forecast.windSpeed.toFixed(1)} m/s
                  <WindDirection degrees={forecast.windDirection} size="sm" showLabel={false} />
                </span>
              </div>
              <span className="text-2xl" aria-hidden="true">
                {getConditionEmoji(forecast.iconCode)}
              </span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
