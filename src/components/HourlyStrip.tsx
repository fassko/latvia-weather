"use client";

import { Fragment, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import {
  getTodayForecasts,
  getUpcomingHourlyForecasts,
} from "@/lib/weather/chart-data";
import {
  getConditionEmoji,
  getConditionKey,
  getWindDirection,
} from "@/lib/weather/parse";
import {
  formatLatviaTime,
  getLatviaDayKey,
  getLatviaStartOfHour,
  getLatviaWallClock,
} from "@/lib/weather/timezone";
import type { SunTimesByDay } from "@/lib/weather/sun";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import { useWindUnit } from "@/lib/weather/use-wind-unit";
import type { HourlyForecast } from "@/lib/weather/types";

interface HourlyStripProps {
  forecasts: HourlyForecast[];
  sunTimesByDay: SunTimesByDay;
  sunLabels: {
    sunrise: string;
    sunset: string;
  };
  hours?: number;
}

type SunEvent = { event: "sunrise" | "sunset"; time: Date };

type StripItem =
  | { kind: "forecast"; forecast: HourlyForecast }
  | { kind: "sun"; sunEvent: SunEvent };

function getSunEventsInRange(
  stripForecasts: HourlyForecast[],
  sunTimesByDay: SunTimesByDay,
): SunEvent[] {
  if (stripForecasts.length === 0) return [];

  const rangeStart = stripForecasts[0].time.getTime();
  const rangeEnd = stripForecasts[stripForecasts.length - 1].time.getTime();
  const dayKeys = Array.from(
    new Set(stripForecasts.map((forecast) => getLatviaDayKey(forecast.time))),
  );
  const events: SunEvent[] = [];

  for (const dayKey of dayKeys) {
    const sunTimes = sunTimesByDay[dayKey];
    if (!sunTimes) continue;

    for (const sunEvent of [
      { event: "sunrise" as const, time: sunTimes.sunrise },
      { event: "sunset" as const, time: sunTimes.sunset },
    ]) {
      const eventMs = sunEvent.time.getTime();
      if (eventMs >= rangeStart && eventMs <= rangeEnd) {
        events.push(sunEvent);
      }
    }
  }

  return events.sort((a, b) => a.time.getTime() - b.time.getTime());
}

function buildStripTimeline(
  stripForecasts: HourlyForecast[],
  sunTimesByDay: SunTimesByDay,
): StripItem[] {
  const sunEvents = getSunEventsInRange(stripForecasts, sunTimesByDay);
  const timeline: StripItem[] = stripForecasts.map((forecast) => ({
    kind: "forecast",
    forecast,
  }));

  for (const sunEvent of sunEvents) {
    const insertIndex = timeline.findIndex(
      (item) =>
        item.kind === "forecast" &&
        item.forecast.time.getTime() > sunEvent.time.getTime(),
    );
    const sunItem: StripItem = { kind: "sun", sunEvent };
    if (insertIndex === -1) {
      timeline.push(sunItem);
    } else {
      timeline.splice(insertIndex, 0, sunItem);
    }
  }

  return timeline;
}

function getStripItemTime(item: StripItem): Date {
  return item.kind === "forecast" ? item.forecast.time : item.sunEvent.time;
}

export function HourlyStrip({
  forecasts,
  sunTimesByDay,
  sunLabels,
  hours = 24,
}: HourlyStripProps) {
  const t = useTranslations("hourlyCard");
  const tConditions = useTranslations("conditions");
  const tDaily = useTranslations("dailyList");
  const tWind = useTranslations("wind");
  const locale = useLocale();
  const dateLocale = getDateFnsLocale(locale);
  const windUnit = useWindUnit();
  const currentHour = getLatviaStartOfHour(new Date());
  const todayKey = getLatviaDayKey(new Date());
  const pastToday = getTodayForecasts(forecasts).filter((forecast) => {
    return (
      getLatviaDayKey(forecast.time) === todayKey &&
      getLatviaWallClock(forecast.time) < currentHour
    );
  });
  const upcoming = getUpcomingHourlyForecasts(forecasts).slice(0, hours);
  const stripForecasts = [...pastToday, ...upcoming];
  const stripTimeline = buildStripTimeline(stripForecasts, sunTimesByDay);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const currentTileRef = useRef<HTMLDivElement | null>(null);
  const activeTileClass =
    "bg-sky-50 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-500/30";
  const hoverTileClass =
    "hover:bg-sky-100/80 hover:ring-1 hover:ring-inset hover:ring-sky-300 dark:hover:bg-sky-500/15 dark:hover:ring-sky-500/50";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const strip = stripRef.current;
      const currentTile = currentTileRef.current;
      if (!strip || !currentTile) return;

      strip.scrollLeft = currentTile.offsetLeft - strip.offsetLeft;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [stripTimeline.length]);

  if (stripTimeline.length === 0) return null;

  return (
    <div
      ref={stripRef}
      className="mt-4 grid auto-cols-max grid-flow-col grid-rows-[repeat(5,auto)] gap-x-1.5 gap-y-1 overflow-x-auto pb-2 focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:outline-none"
      role="group"
      aria-label={t("title")}
      tabIndex={0}
    >
      {stripTimeline.map((item, index) => {
        const itemTime = getStripItemTime(item);
        const isNewDay =
          index > 0 &&
          getLatviaDayKey(itemTime) !==
            getLatviaDayKey(getStripItemTime(stripTimeline[index - 1]));

        if (item.kind === "sun") {
          return (
            <Fragment key={`${item.sunEvent.event}-${item.sunEvent.time.toISOString()}`}>
              {isNewDay ? (
                <div className="row-span-5 flex shrink-0 items-center gap-1.5 self-stretch pl-1">
                  <span className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 [writing-mode:vertical-rl] rotate-180 dark:text-slate-500">
                    {formatLatviaTime(itemTime, getDatePattern(locale, "dailyDate"), {
                      locale: dateLocale,
                    })}
                  </span>
                </div>
              ) : null}
              <div className="row-span-5 grid min-w-[4.25rem] grid-rows-subgrid justify-items-center rounded-xl px-2 py-2.5">
                <time
                  dateTime={item.sunEvent.time.toISOString()}
                  className="text-xs font-medium tabular-nums text-amber-600 dark:text-amber-300"
                >
                  {formatLatviaTime(item.sunEvent.time, "HH:mm")}
                </time>
                <span className="flex flex-col items-center justify-center">
                  <span className="text-xl" aria-hidden="true">
                    {item.sunEvent.event === "sunrise" ? "☀️" : "🌙"}
                  </span>
                  <span className="sr-only">{sunLabels[item.sunEvent.event]}</span>
                </span>
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </div>
            </Fragment>
          );
        }

        const forecast = item.forecast;
        const isPast = getLatviaWallClock(forecast.time) < currentHour;
        const isNow =
          !isPast &&
          getLatviaWallClock(forecast.time).getTime() === currentHour.getTime();

        return (
          <Fragment key={forecast.time.toISOString()}>
            {isNewDay ? (
              <div className="row-span-5 flex shrink-0 items-center gap-1.5 self-stretch pl-1">
                <span className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 [writing-mode:vertical-rl] rotate-180 dark:text-slate-500">
                  {formatLatviaTime(forecast.time, getDatePattern(locale, "dailyDate"), {
                    locale: dateLocale,
                  })}
                </span>
              </div>
            ) : null}
            <div
              ref={isNow ? currentTileRef : undefined}
              className={`relative row-span-5 grid min-w-[4.25rem] grid-rows-subgrid justify-items-center rounded-xl px-2 py-2.5 transition-colors duration-150 motion-reduce:transition-none ${hoverTileClass} ${
                isNow ? activeTileClass : ""
              } ${isPast ? "opacity-45" : ""}`}
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
              <span className="flex flex-col items-center justify-center">
                <span className="text-xl" aria-hidden="true">
                  {getConditionEmoji(forecast.iconCode)}
                </span>
                <span className="sr-only">
                  {tConditions(getConditionKey(forecast.iconCode))}
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {Math.round(forecast.temperature)}°C
              </span>
              <span className="text-xs tabular-nums text-sky-600 dark:text-sky-400">
                <span aria-hidden="true">
                  {Math.round(forecast.precipitationProbability)}%
                </span>
                <span className="sr-only">
                  {tDaily("rainChance", {
                    value: Math.round(forecast.precipitationProbability),
                  })}
                </span>
              </span>
              <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                <WindArrow degrees={forecast.windDirection} />
                {formatWindSpeed(forecast.windSpeed, windUnit)}
                <span className="sr-only">
                  {tWind("from", {
                    direction: tWind(
                      `directions.${getWindDirection(forecast.windDirection)}`,
                    ),
                  })}
                </span>
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
