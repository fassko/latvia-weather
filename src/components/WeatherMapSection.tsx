"use client";

import dynamic from "next/dynamic";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { MOBILE_MAP_MAX_WIDTH } from "@/lib/weather/map-view";
import type { WeatherLocationPoint } from "@/lib/weather/types";

const MAX_FORECAST_OFFSET_HOURS = 72;
const HOUR_TICKS = Array.from({ length: 13 }, (_, index) => index * 6);
const DAY_TICKS = [0, 24, 48, 72];
const MAP_HEIGHT_STORAGE_KEY = "latvia-weather-map-height-px";
const MOBILE_MAP_MIN_HEIGHT_PX = 160;
const MOBILE_MAP_CHROME_PX = 360;
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

  // Weekday-only keeps day chips readable on narrow phone timelines.
  return new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-US", {
    timeZone: "Europe/Riga",
    weekday: "short",
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

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function clampMobileMapHeight(heightPx: number, viewportHeight = getViewportHeight()): number {
  const maxHeight = Math.max(
    MOBILE_MAP_MIN_HEIGHT_PX,
    Math.min(
      Math.round(viewportHeight * 0.72),
      Math.round(viewportHeight - MOBILE_MAP_CHROME_PX + 80),
    ),
  );
  return Math.min(maxHeight, Math.max(MOBILE_MAP_MIN_HEIGHT_PX, Math.round(heightPx)));
}

function defaultMobileMapHeight(viewportHeight = getViewportHeight()): number {
  return clampMobileMapHeight(
    Math.min(viewportHeight * 0.52, viewportHeight - MOBILE_MAP_CHROME_PX),
    viewportHeight,
  );
}

function readStoredMobileMapHeight(viewportHeight = getViewportHeight()): number | null {
  try {
    const raw = window.localStorage.getItem(MAP_HEIGHT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return clampMobileMapHeight(parsed, viewportHeight);
  } catch {
    return null;
  }
}

function writeStoredMobileMapHeight(heightPx: number) {
  try {
    window.localStorage.setItem(MAP_HEIGHT_STORAGE_KEY, String(Math.round(heightPx)));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function isMobileMapViewport(width = window.innerWidth): boolean {
  return width > 0 && width < MOBILE_MAP_MAX_WIDTH;
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
  onRetry,
}: {
  offsetHours: number;
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  locale: string;
  onChange: (offsetHours: number) => void;
  onTogglePlay: () => void;
  onRetry: () => void;
}) {
  const tMap = useTranslations("map");
  const tErrors = useTranslations("errors");
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
          className="weather-map-time-control__stepper weather-map-time-control__stepper--back"
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
                data-dense={hourOffset % 12 === 0 ? undefined : "true"}
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
          className="weather-map-time-control__stepper weather-map-time-control__stepper--forward"
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
        {hasError && !isLoading ? (
          <button
            type="button"
            className="weather-map-time-control__retry"
            onClick={onRetry}
          >
            {tErrors("tryAgain")}
          </button>
        ) : null}
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
  const tMap = useTranslations("map");
  const [offsetHours, setOffsetHours] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [hasForecastError, setHasForecastError] = useState(false);
  const [forecastRetryToken, setForecastRetryToken] = useState(0);
  const [mapWeatherCache, setMapWeatherCache] = useState(
    () => new Map<number, WeatherLocationPoint[]>([[0, locations]]),
  );
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileMapHeightPx, setMobileMapHeightPx] = useState<number | null>(null);
  const [isResizingMap, setIsResizingMap] = useState(false);
  const resizeStartRef = useRef<{ pointerY: number; heightPx: number } | null>(
    null,
  );
  const mobileMapHeightRef = useRef<number | null>(null);
  const hasCachedForecast = offsetHours === 0 || mapWeatherCache.has(offsetHours);
  const displayLocations =
    offsetHours === 0
      ? locations
      : (mapWeatherCache.get(offsetHours) ?? locations);

  useEffect(() => {
    mobileMapHeightRef.current = mobileMapHeightPx;
  }, [mobileMapHeightPx]);

  useEffect(() => {
    function syncViewport() {
      const mobile = isMobileMapViewport();
      setIsMobileViewport(mobile);
      if (!mobile) {
        setMobileMapHeightPx(null);
        return;
      }

      const viewportHeight = getViewportHeight();
      setMobileMapHeightPx((current) => {
        const next =
          current == null
            ? (readStoredMobileMapHeight(viewportHeight) ??
              defaultMobileMapHeight(viewportHeight))
            : clampMobileMapHeight(current, viewportHeight);
        mobileMapHeightRef.current = next;
        return next;
      });
    }

    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
    };
  }, []);

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
  }, [forecastRetryToken, hasCachedForecast, offsetHours]);

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

  function handleForecastRetry() {
    setHasForecastError(false);
    setIsForecastLoading(true);
    setForecastRetryToken((token) => token + 1);
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

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (mobileMapHeightPx == null) return;
    event.preventDefault();
    resizeStartRef.current = {
      pointerY: event.clientY,
      heightPx: mobileMapHeightPx,
    };
    setIsResizingMap(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = resizeStartRef.current;
    if (!start) return;
    const nextHeight = clampMobileMapHeight(
      start.heightPx + (event.clientY - start.pointerY),
    );
    mobileMapHeightRef.current = nextHeight;
    setMobileMapHeightPx(nextHeight);
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    setIsResizingMap(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (mobileMapHeightRef.current != null) {
      writeStoredMobileMapHeight(mobileMapHeightRef.current);
    }
  }

  function handleResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (mobileMapHeightPx == null) return;

    const step = event.shiftKey ? 32 : 16;
    let nextHeight = mobileMapHeightPx;

    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        nextHeight = mobileMapHeightPx + step;
        break;
      case "ArrowDown":
      case "ArrowLeft":
        nextHeight = mobileMapHeightPx - step;
        break;
      case "Home":
        nextHeight = MOBILE_MAP_MIN_HEIGHT_PX;
        break;
      case "End":
        nextHeight = getViewportHeight() * 0.72;
        break;
      default:
        return;
    }

    event.preventDefault();
    const clamped = clampMobileMapHeight(nextHeight);
    mobileMapHeightRef.current = clamped;
    setMobileMapHeightPx(clamped);
    writeStoredMobileMapHeight(clamped);
  }

  const mapFrameStyle =
    isMobileViewport && mobileMapHeightPx != null
      ? ({ height: `${mobileMapHeightPx}px` } satisfies CSSProperties)
      : undefined;
  const mobileMaxHeightPx =
    isMobileViewport && typeof window !== "undefined"
      ? Math.round(getViewportHeight() * 0.72)
      : undefined;

  return (
    <section className="flex w-full flex-col gap-2">
      <div
        className={`weather-map-frame w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800 ${
          isResizingMap ? "select-none" : ""
        }`}
        style={mapFrameStyle}
      >
        <WeatherMap
          locations={displayLocations}
          locale={locale}
          selectedId={selectedId}
          focusLocationId={focusLocationId}
        />
      </div>
      {isMobileViewport ? (
        <div
          className={`weather-map-resize-handle${isResizingMap ? " weather-map-resize-handle--active" : ""}`}
          aria-label={tMap("resizeMap")}
          aria-valuemin={MOBILE_MAP_MIN_HEIGHT_PX}
          aria-valuemax={mobileMaxHeightPx}
          aria-valuenow={mobileMapHeightPx ?? undefined}
          aria-orientation="vertical"
          role="slider"
          tabIndex={0}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={handleResizeKeyDown}
        >
          <span className="weather-map-resize-handle__grip" aria-hidden="true" />
        </div>
      ) : null}
      <ForecastTimeControl
        offsetHours={offsetHours}
        isPlaying={isPlaying}
        isLoading={isForecastLoading}
        hasError={hasForecastError}
        locale={locale}
        onChange={handleForecastOffsetChange}
        onTogglePlay={handleTogglePlay}
        onRetry={handleForecastRetry}
      />
    </section>
  );
}
