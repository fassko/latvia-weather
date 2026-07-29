"use client";

import dynamic from "next/dynamic";
import { type CSSProperties, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { WeatherLocationPoint } from "@/lib/weather/types";

const MAX_FORECAST_OFFSET_HOURS = 72;
const HOUR_TICKS = Array.from({ length: 13 }, (_, index) => index * 6);
const DAY_TICKS = [0, 24, 48, 72];
type TimelineTickStyle = CSSProperties & { "--tick-position": string };

const WeatherMap = dynamic(
  () => import("@/components/WeatherMap").then((mod) => mod.WeatherMap),
  {
    ssr: false,
    loading: () => <WeatherMapSkeleton />,
  },
);

interface WeatherMapSectionProps {
  locations: WeatherLocationPoint[];
  locale: string;
  selectedId?: string;
  focusLocationId?: string;
}

interface MapWeatherResponse {
  offsetHours: number;
  time: string;
  locations: WeatherLocationPoint[];
}

function getInitialForecastTime(): Date {
  const time = new Date();
  time.setMinutes(0, 0, 0);
  return time;
}

function formatForecastTime(locale: string, offsetHours: number): string {
  const time = getInitialForecastTime();
  time.setHours(time.getHours() + offsetHours);

  return new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-US", {
    timeZone: "Europe/Riga",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function formatForecastDay(locale: string, offsetHours: number): string {
  if (offsetHours === 0) return locale === "lv" ? "Šodien" : "Today";

  const time = getInitialForecastTime();
  time.setHours(time.getHours() + offsetHours);

  return new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-US", {
    timeZone: "Europe/Riga",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(time);
}

function formatForecastHour(locale: string, offsetHours: number): string {
  const time = getInitialForecastTime();
  time.setHours(time.getHours() + offsetHours);

  return new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-US", {
    timeZone: "Europe/Riga",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function getTimelineTickStyle(offsetHours: number): TimelineTickStyle {
  return {
    "--tick-position": `${(offsetHours / MAX_FORECAST_OFFSET_HOURS) * 100}%`,
  };
}

async function fetchMapWeather(offsetHours: number): Promise<MapWeatherResponse> {
  const response = await fetch(
    `/api/map-weather?offsetHours=${encodeURIComponent(offsetHours)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Map weather API returned ${response.status}`);
  }

  return (await response.json()) as MapWeatherResponse;
}

function WeatherMapSkeleton() {
  const t = useTranslations("map");

  return (
    <div
      className="flex h-full min-h-[28rem] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      role="status"
    >
      {t("loading")}
    </div>
  );
}

function PlayIcon({ paused }: { paused?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="currentColor"
    >
      {paused ? (
        <>
          <rect x="4" y="3" width="2.5" height="10" rx="0.6" />
          <rect x="9.5" y="3" width="2.5" height="10" rx="0.6" />
        </>
      ) : (
        <path d="M5 3.6v8.8c0 .6.7 1 1.2.6l6.1-4.4c.4-.3.4-.9 0-1.2L6.2 3C5.7 2.6 5 3 5 3.6Z" />
      )}
    </svg>
  );
}

function ForecastTimeControl({
  offsetHours,
  isPlaying,
  isLoading,
  hasError,
  locale,
  onChange,
  onTogglePlay,
}: {
  offsetHours: number;
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  locale: string;
  onChange: (offsetHours: number) => void;
  onTogglePlay: () => void;
}) {
  const tMap = useTranslations("map");
  const canStepBack = offsetHours > 0;
  const canStepForward = offsetHours < MAX_FORECAST_OFFSET_HOURS;

  return (
    <div className="weather-map-time-control">
      <div className="weather-map-time-control__header">
        <span className="weather-map-time-control__label">
          {tMap("forecastTime")}
        </span>
        <output
          className="weather-map-time-control__value"
          htmlFor="weather-map-time-slider"
        >
          {offsetHours === 0
            ? tMap("forecastNow")
            : formatForecastTime(locale, offsetHours)}
        </output>
      </div>
      <div className="weather-map-time-control__controls">
        <button
          type="button"
          className="weather-map-time-control__play"
          onClick={onTogglePlay}
          aria-label={isPlaying ? tMap("forecastPause") : tMap("forecastPlay")}
        >
          <PlayIcon paused={isPlaying} />
          <span>{isPlaying ? tMap("forecastPause") : tMap("forecastPlay")}</span>
        </button>
        <button
          type="button"
          className="weather-map-time-control__stepper"
          onClick={() => onChange(offsetHours - 1)}
          disabled={!canStepBack}
          aria-label={tMap("forecastPreviousHour")}
        >
          -
        </button>
        <div className="weather-map-time-control__timeline">
          <div className="weather-map-time-control__days">
            {DAY_TICKS.map((dayOffset) => (
              <button
                key={dayOffset}
                type="button"
                className="weather-map-time-control__day"
                style={getTimelineTickStyle(dayOffset)}
                data-edge={
                  dayOffset === 0
                    ? "start"
                    : dayOffset === MAX_FORECAST_OFFSET_HOURS
                      ? "end"
                      : undefined
                }
                onClick={() => onChange(dayOffset)}
                aria-current={
                  offsetHours >= dayOffset && offsetHours < dayOffset + 24
                    ? "true"
                    : undefined
                }
              >
                {formatForecastDay(locale, dayOffset)}
              </button>
            ))}
          </div>
          <input
            id="weather-map-time-slider"
            className="weather-map-time-control__slider"
            type="range"
            min={0}
            max={MAX_FORECAST_OFFSET_HOURS}
            step={1}
            value={offsetHours}
            aria-label={tMap("forecastTime")}
            onChange={(event) => onChange(Number(event.currentTarget.value))}
          />
          <div className="weather-map-time-control__hours" aria-hidden="true">
            {HOUR_TICKS.map((hourOffset) => (
              <span
                key={hourOffset}
                className="weather-map-time-control__hour"
                style={getTimelineTickStyle(hourOffset)}
                data-edge={
                  hourOffset === 0
                    ? "start"
                    : hourOffset === MAX_FORECAST_OFFSET_HOURS
                      ? "end"
                      : undefined
                }
              >
                <span className="weather-map-time-control__tick" />
                <span>{formatForecastHour(locale, hourOffset)}</span>
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="weather-map-time-control__stepper"
          onClick={() => onChange(offsetHours + 1)}
          disabled={!canStepForward}
          aria-label={tMap("forecastNextHour")}
        >
          +
        </button>
      </div>
      <p className="weather-map-time-control__status" role="status">
        {isLoading
          ? tMap("forecastLoading")
          : hasError
            ? tMap("forecastError")
            : "\u00a0"}
      </p>
    </div>
  );
}

export function WeatherMapSection({
  locations,
  locale,
  selectedId,
  focusLocationId,
}: WeatherMapSectionProps) {
  const [offsetHours, setOffsetHours] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [hasForecastError, setHasForecastError] = useState(false);
  const [mapWeatherCache, setMapWeatherCache] = useState(
    () => new Map<number, WeatherLocationPoint[]>([[0, locations]]),
  );
  const hasCachedForecast = offsetHours === 0 || mapWeatherCache.has(offsetHours);
  const displayLocations =
    offsetHours === 0
      ? locations
      : (mapWeatherCache.get(offsetHours) ?? locations);

  useEffect(() => {
    let ignore = false;

    if (hasCachedForecast) {
      return;
    }

    fetchMapWeather(offsetHours)
      .then((data) => {
        if (ignore) return;
        setMapWeatherCache((cache) => {
          const nextCache = new Map(cache);
          nextCache.set(data.offsetHours, data.locations);
          return nextCache;
        });
      })
      .catch(() => {
        if (ignore) return;
        setHasForecastError(true);
      })
      .finally(() => {
        if (ignore) return;
        setIsForecastLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [hasCachedForecast, offsetHours]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      setOffsetHours((currentOffsetHours) => {
        if (currentOffsetHours >= MAX_FORECAST_OFFSET_HOURS) {
          setIsPlaying(false);
          return currentOffsetHours;
        }

        const nextOffsetHours = currentOffsetHours + 1;
        setHasForecastError(false);
        setIsForecastLoading(
          nextOffsetHours !== 0 && !mapWeatherCache.has(nextOffsetHours),
        );
        return nextOffsetHours;
      });
    }, 900);

    return () => window.clearInterval(interval);
  }, [isPlaying, mapWeatherCache]);

  function handleForecastOffsetChange(nextOffsetHours: number) {
    setOffsetHours(nextOffsetHours);
    if (nextOffsetHours >= MAX_FORECAST_OFFSET_HOURS) {
      setIsPlaying(false);
    }
    setHasForecastError(false);
    setIsForecastLoading(
      nextOffsetHours !== 0 && !mapWeatherCache.has(nextOffsetHours),
    );
  }

  function handleTogglePlay() {
    setIsPlaying((currentIsPlaying) => {
      if (currentIsPlaying) return false;
      if (offsetHours >= MAX_FORECAST_OFFSET_HOURS) {
        handleForecastOffsetChange(0);
      }
      return true;
    });
  }

  return (
    <section className="flex w-full flex-col gap-2">
      <div className="h-[min(58vh,calc(100vh-20rem),42rem)] min-h-[20rem] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm sm:min-h-[24rem] dark:border-slate-800">
        <WeatherMap
          locations={displayLocations}
          locale={locale}
          selectedId={selectedId}
          focusLocationId={focusLocationId}
        />
      </div>
      <ForecastTimeControl
        offsetHours={offsetHours}
        isPlaying={isPlaying}
        isLoading={isForecastLoading}
        hasError={hasForecastError}
        locale={locale}
        onChange={handleForecastOffsetChange}
        onTogglePlay={handleTogglePlay}
      />
    </section>
  );
}
