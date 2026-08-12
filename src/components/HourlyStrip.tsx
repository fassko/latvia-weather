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
import { getSunTimesForLatviaDay } from "@/lib/weather/sun";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import { useWindUnit } from "@/lib/weather/use-wind-unit";
import type { HourlyForecast, WeatherLocation } from "@/lib/weather/types";

interface HourlyStripProps {
  forecasts: HourlyForecast[];
  location: WeatherLocation;
  sunLabels: {
    sunrise: string;
    sunset: string;
  };
  hours?: number;
}

type SunEvent = { event: "sunrise" | "sunset"; time: Date };

function getSunEventsByForecastTime(
  forecasts: HourlyForecast[],
  location: WeatherLocation,
): Map<string, SunEvent[]> {
  const eventsByForecastTime = new Map<string, SunEvent[]>();
  const dayKeys = Array.from(new Set(forecasts.map((forecast) => getLatviaDayKey(forecast.time))));

  for (const dayKey of dayKeys) {
    const dayForecasts = forecasts.filter(
      (forecast) => getLatviaDayKey(forecast.time) === dayKey,
    );
    const sunTimes = getSunTimesForLatviaDay(dayKey, location.lat, location.lon);
    if (!sunTimes || dayForecasts.length === 0) continue;

    for (const sunEvent of [
      { event: "sunrise", time: sunTimes.sunrise },
      { event: "sunset", time: sunTimes.sunset },
    ] satisfies SunEvent[]) {
      const nearest = dayForecasts.reduce((best, forecast) => {
        const bestDistance = Math.abs(best.time.getTime() - sunEvent.time.getTime());
        const forecastDistance = Math.abs(forecast.time.getTime() - sunEvent.time.getTime());

        return forecastDistance < bestDistance ? forecast : best;
      });
      const key = nearest.time.toISOString();
      const events = eventsByForecastTime.get(key) ?? [];
      events.push(sunEvent);
      events.sort((a, b) => a.time.getTime() - b.time.getTime());
      eventsByForecastTime.set(key, events);
    }
  }

  return eventsByForecastTime;
}

export function HourlyStrip({
  forecasts,
  location,
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
  const sunEventsByForecastTime = getSunEventsByForecastTime(stripForecasts, location);
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
  }, [stripForecasts.length]);

  if (stripForecasts.length === 0) return null;

  return (
    // A scrollable region needs to be focusable so it can also be scrolled with
    // the keyboard.
    <div
      ref={stripRef}
      className="mt-4 flex gap-1.5 overflow-x-auto pb-2 focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:outline-none"
      role="group"
      aria-label={t("title")}
      tabIndex={0}
    >
      {stripForecasts.map((forecast, index) => {
        const isPast = getLatviaWallClock(forecast.time) < currentHour;
        const isNow = !isPast && getLatviaWallClock(forecast.time).getTime() === currentHour.getTime();
        const isNewDay =
          index > 0 &&
          getLatviaDayKey(forecast.time) !==
            getLatviaDayKey(stripForecasts[index - 1].time);
        const sunEvents = sunEventsByForecastTime.get(forecast.time.toISOString()) ?? [];

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
              ref={isNow ? currentTileRef : undefined}
              // `relative` keeps the visually hidden labels below anchored to
              // the tile; absolute positioning would otherwise resolve against
              // the page and stretch it far to the right.
              className={`relative flex min-w-[4.25rem] flex-col items-center gap-1 rounded-xl px-2 py-2.5 transition-colors duration-150 motion-reduce:transition-none ${hoverTileClass} ${
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
              {sunEvents.length > 0 ? (
                <span className="flex flex-col items-center gap-0.5 text-[10px] leading-none text-amber-700 dark:text-amber-300">
                  {sunEvents.map((sunEvent) => (
                    <span key={sunEvent.event} className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1 py-0.5 dark:bg-amber-950/50">
                      <span aria-hidden="true">
                        {sunEvent.event === "sunrise" ? "☀️" : "🌙"}
                      </span>
                      <time dateTime={sunEvent.time.toISOString()}>
                        {formatLatviaTime(sunEvent.time, "HH:mm")}
                      </time>
                      <span className="sr-only">{sunLabels[sunEvent.event]}</span>
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="text-xl" aria-hidden="true">
                {getConditionEmoji(forecast.iconCode)}
              </span>
              <span className="sr-only">
                {tConditions(getConditionKey(forecast.iconCode))}
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
