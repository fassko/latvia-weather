"use client";

import dynamic from "next/dynamic";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "next-intl";
import { getIntlLocale } from "@/lib/locale";
import {
  getEmptyFavoriteLocationIds,
  readFavoriteLocationIds,
  subscribeFavoriteLocationIds,
} from "@/lib/weather/favorite-location-ids";
import { filterLocationsByFavoriteIds } from "@/lib/weather/filter-favorite-locations";
import { MOBILE_MAP_MAX_WIDTH } from "@/lib/weather/map-view";
import {
  MAP_LAYERS,
  mapLayerSearch,
  type MapLayer,
} from "@/lib/weather/map-layer";
import {
  TEMPERATURE_FIELD_STOPS,
  temperatureFieldGradientCss,
  temperatureFieldLegendPosition,
} from "@/lib/weather/temperature-field";
import {
  WIND_LEGEND_TICKS_MS,
  windFieldGradientCss,
  windFieldLegendPosition,
} from "@/lib/weather/wind-field";
import {
  hasAnyRain,
  RAIN_LEGEND_TICKS_MM,
  rainFieldGradientCss,
  rainFieldLegendPosition,
} from "@/lib/weather/rain-field";
import { useWindUnit } from "@/lib/weather/use-wind-unit";
import {
  convertWindSpeed,
  getWindSpeedUnitSuffix,
} from "@/lib/weather/wind-units";
import { addForecastHours } from "@/lib/weather/timezone";
import type {
  WeatherAlarmPolygon,
  WeatherLocationPoint,
} from "@/lib/weather/types";

const MAX_FORECAST_OFFSET_HOURS = 72;
const FALLBACK_FORECAST_OFFSET_HOURS = 24;
const MAP_HEIGHT_STORAGE_KEY = "latvia-weather-map-height-px";
const MOBILE_MAP_MIN_HEIGHT_PX = 160;
const MOBILE_MAP_MAX_VIEWPORT_RATIO = 0.46;
const MOBILE_MAP_DEFAULT_VIEWPORT_RATIO = 0.38;
const MOBILE_MAP_MAX_RESERVED_CHROME_PX = 420;
const MOBILE_MAP_DEFAULT_RESERVED_CHROME_PX = 500;
type TimelineTickStyle = CSSProperties & { "--tick-position": string };
const TEMPERATURE_LEGEND_TICKS = [-10, 0, 10, 20, 30];

const WeatherMap = dynamic(
  () => import("@/components/WeatherMap").then((mod) => mod.WeatherMap),
  {
    ssr: false,
    loading: () => <WeatherMapSkeleton />,
  },
);

interface WeatherMapSectionProps {
  locations: WeatherLocationPoint[];
  alarms: WeatherAlarmPolygon[];
  locale: string;
  selectedId?: string;
  focusLocationId?: string;
  initialShowAlarms?: boolean;
  /** Layer from the page's `?layer=`. */
  initialLayer?: MapLayer;
}

interface MapWeatherResponse {
  offsetHours: number;
  time: string;
  locations: WeatherLocationPoint[];
}

function getInitialForecastTime(): Date {
  return addForecastHours(new Date(), 0);
}

function formatForecastTime(locale: string, offsetHours: number): string {
  const time = addForecastHours(getInitialForecastTime(), offsetHours);

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: "Europe/Riga",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function formatForecastDay(locale: string, offsetHours: number): string {
  if (offsetHours === 0) {
    if (locale === "lv") return "Šodien";
    if (locale === "ru") return "Сегодня";
    return "Today";
  }

  const time = addForecastHours(getInitialForecastTime(), offsetHours);

  // Weekday-only keeps day chips readable on narrow phone timelines.
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: "Europe/Riga",
    weekday: "short",
  }).format(time);
}

function formatForecastHour(locale: string, offsetHours: number): string {
  const time = addForecastHours(getInitialForecastTime(), offsetHours);

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: "Europe/Riga",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function getTimelineTickStyle(offsetHours: number, maxOffsetHours: number): TimelineTickStyle {
  return {
    "--tick-position": `${(offsetHours / maxOffsetHours) * 100}%`,
  };
}

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function clampMobileMapHeight(heightPx: number, viewportHeight = getViewportHeight()): number {
  const maxHeight = Math.max(
    MOBILE_MAP_MIN_HEIGHT_PX,
    Math.min(
      Math.round(viewportHeight * MOBILE_MAP_MAX_VIEWPORT_RATIO),
      Math.round(viewportHeight - MOBILE_MAP_MAX_RESERVED_CHROME_PX),
    ),
  );
  return Math.min(maxHeight, Math.max(MOBILE_MAP_MIN_HEIGHT_PX, Math.round(heightPx)));
}

function defaultMobileMapHeight(viewportHeight = getViewportHeight()): number {
  return clampMobileMapHeight(
    Math.min(
      viewportHeight * MOBILE_MAP_DEFAULT_VIEWPORT_RATIO,
      viewportHeight - MOBILE_MAP_DEFAULT_RESERVED_CHROME_PX,
    ),
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

function FavoritesOnlyIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5 14.7 9l6 .9-4.4 4.3 1 6L12 17.5 6.7 20.2l1-6L3.3 9.9l6-.9Z" />
    </svg>
  );
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
  maxOffsetHours,
  isPlaying,
  isLoading,
  hasError,
  locale,
  onChange,
  onTogglePlay,
  onRetry,
}: {
  offsetHours: number;
  maxOffsetHours: number;
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
  const canStepForward = offsetHours < maxOffsetHours;
  const hourTicks = Array.from(
    { length: maxOffsetHours / (maxOffsetHours === 24 ? 4 : 6) + 1 },
    (_, index) => index * (maxOffsetHours === 24 ? 4 : 6),
  );
  const dayTicks = maxOffsetHours === 24 ? [0, 24] : [0, 24, 48, 72];

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
            {dayTicks.map((dayOffset) => (
              <button
                key={dayOffset}
                type="button"
                className="weather-map-time-control__day"
                style={getTimelineTickStyle(dayOffset, maxOffsetHours)}
                data-edge={
                  dayOffset === 0
                    ? "start"
                    : dayOffset === maxOffsetHours
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
            max={maxOffsetHours}
            step={1}
            value={offsetHours}
            aria-label={tMap("forecastTime")}
            onChange={(event) => onChange(Number(event.currentTarget.value))}
          />
          <div className="weather-map-time-control__hours" aria-hidden="true">
            {hourTicks.map((hourOffset) => (
              <span
                key={hourOffset}
                className="weather-map-time-control__hour"
                style={getTimelineTickStyle(hourOffset, maxOffsetHours)}
                data-dense={hourOffset % 12 === 0 ? undefined : "true"}
                data-edge={
                  hourOffset === 0
                    ? "start"
                  : hourOffset === maxOffsetHours
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

function layerLabelKey(
  layer: MapLayer,
): "layerTemperature" | "layerWind" | "layerRain" | "layerNone" {
  switch (layer) {
    case "wind":
      return "layerWind";
    case "rain":
      return "layerRain";
    case "none":
      return "layerNone";
    default:
      return "layerTemperature";
  }
}

function MapLayerSwitch({
  layer,
  onChange,
}: {
  layer: MapLayer;
  onChange: (layer: MapLayer) => void;
}) {
  const tMap = useTranslations("map");
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % MAP_LAYERS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + MAP_LAYERS.length) % MAP_LAYERS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = MAP_LAYERS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(MAP_LAYERS[nextIndex]);
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className="weather-map-layer-switch"
      role="radiogroup"
      aria-label={tMap("layer")}
    >
      {MAP_LAYERS.map((option, index) => (
        <button
          key={option}
          ref={(element) => {
            optionRefs.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={layer === option}
          tabIndex={layer === option ? 0 : -1}
          className="weather-map-layer-switch__option"
          onClick={() => onChange(option)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {tMap(layerLabelKey(option))}
        </button>
      ))}
    </div>
  );
}

function MapLegend({
  title,
  description,
  gradient,
  ticks,
}: {
  title: string;
  description: string;
  gradient: string;
  ticks: Array<{ label: string; position: number }>;
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
      <span className="shrink-0 font-medium text-slate-600 dark:text-slate-300">
        {title}
      </span>
      <div className="flex w-full max-w-xs flex-col gap-1">
        <div
          role="img"
          aria-label={description}
          title={description}
          className="h-2 w-full rounded-full ring-1 ring-slate-900/10 dark:ring-white/15"
          style={{ backgroundImage: gradient }}
        />
        <div className="relative h-3.5" aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick.label}
              className="absolute -translate-x-1/2 tabular-nums leading-none"
              style={{ left: `${tick.position * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LayerLegend({ layer }: { layer: MapLayer }) {
  const tMap = useTranslations("map");
  const windUnit = useWindUnit();

  if (layer === "none") return null;

  if (layer === "wind") {
    const unit = getWindSpeedUnitSuffix(windUnit);
    const max = WIND_LEGEND_TICKS_MS.at(-1) ?? 0;
    return (
      <MapLegend
        title={tMap("legendWind", { unit })}
        description={tMap("legendWindScale", {
          max: Math.round(convertWindSpeed(max, windUnit)),
          unit,
        })}
        gradient={windFieldGradientCss()}
        ticks={WIND_LEGEND_TICKS_MS.map((speed) => ({
          label: String(Math.round(convertWindSpeed(speed, windUnit))),
          position: windFieldLegendPosition(speed),
        }))}
      />
    );
  }

  if (layer === "rain") {
    return (
      <MapLegend
        title={tMap("legendRain")}
        description={tMap("legendRainScale")}
        gradient={rainFieldGradientCss()}
        ticks={RAIN_LEGEND_TICKS_MM.map((mm) => ({
          label: String(mm),
          position: rainFieldLegendPosition(mm),
        }))}
      />
    );
  }

  return (
    <MapLegend
      title={tMap("legend")}
      description={tMap("legendScale", {
        min: TEMPERATURE_FIELD_STOPS[0].temperature,
        max: TEMPERATURE_FIELD_STOPS.at(-1)?.temperature ?? 0,
      })}
      gradient={temperatureFieldGradientCss()}
      ticks={TEMPERATURE_LEGEND_TICKS.map((temperature) => ({
        label: `${temperature}°`,
        position: temperatureFieldLegendPosition(temperature),
      }))}
    />
  );
}

export function WeatherMapSection({
  locations,
  alarms,
  locale,
  selectedId,
  focusLocationId,
  initialShowAlarms = true,
  initialLayer = "temperature",
}: WeatherMapSectionProps) {
  const tMap = useTranslations("map");
  const [layer, setLayer] = useState<MapLayer>(initialLayer);
  const [offsetHours, setOffsetHours] = useState(0);
  const [maxOffsetHours, setMaxOffsetHours] = useState(
    locations[0]?.source === "data.gov.lv"
      ? FALLBACK_FORECAST_OFFSET_HOURS
      : MAX_FORECAST_OFFSET_HOURS,
  );
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
  const [wantFavoritesOnly, setWantFavoritesOnly] = useState(false);
  const resizeStartRef = useRef<{ pointerY: number; heightPx: number } | null>(
    null,
  );
  const mobileMapHeightRef = useRef<number | null>(null);
  const favoriteIds = useSyncExternalStore(
    subscribeFavoriteLocationIds,
    readFavoriteLocationIds,
    getEmptyFavoriteLocationIds,
  );
  const favoritesOnly = wantFavoritesOnly;
  const hasCachedForecast = offsetHours === 0 || mapWeatherCache.has(offsetHours);
  const allDisplayLocations =
    offsetHours === 0
      ? locations
      : (mapWeatherCache.get(offsetHours) ?? locations);
  const displayLocations = favoritesOnly
    ? filterLocationsByFavoriteIds(allDisplayLocations, favoriteIds)
    : allDisplayLocations;
  const effectiveFocusLocationId =
    favoritesOnly &&
    focusLocationId &&
    !favoriteIds.includes(focusLocationId)
      ? undefined
      : focusLocationId;
  const showFavoritesEmpty = favoritesOnly && displayLocations.length === 0;
  const showNoRain =
    layer === "rain" &&
    hasCachedForecast &&
    !showFavoritesEmpty &&
    !hasAnyRain(allDisplayLocations);

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
        setMaxOffsetHours(data.locations[0]?.source === "data.gov.lv"
          ? FALLBACK_FORECAST_OFFSET_HOURS
          : MAX_FORECAST_OFFSET_HOURS);
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
        if (currentOffsetHours >= maxOffsetHours) {
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
  }, [isPlaying, mapWeatherCache, maxOffsetHours]);

  function handleForecastOffsetChange(nextOffsetHours: number) {
    const boundedOffset = Math.min(Math.max(nextOffsetHours, 0), maxOffsetHours);
    setOffsetHours(boundedOffset);
    if (boundedOffset >= maxOffsetHours) {
      setIsPlaying(false);
    }
    setHasForecastError(false);
    setIsForecastLoading(
      boundedOffset !== 0 && !mapWeatherCache.has(boundedOffset),
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
      if (offsetHours >= maxOffsetHours) {
        handleForecastOffsetChange(0);
      }
      return true;
    });
  }

  function handleLayerChange(nextLayer: MapLayer) {
    setLayer(nextLayer);
    // Keep the layer in the URL so a shared link opens the same view.
    const { pathname, search, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${mapLayerSearch(search, nextLayer)}${hash}`,
    );
  }

  function handleFavoritesOnlyToggle() {
    setWantFavoritesOnly((current) => !current);
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
        nextHeight = clampMobileMapHeight(Number.POSITIVE_INFINITY);
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
      ? clampMobileMapHeight(Number.POSITIVE_INFINITY)
      : undefined;

  const favoritesToggleLabel = tMap("favoritesOnly");
  const favoritesToggleTitle = showFavoritesEmpty
    ? tMap("favoritesOnlyDisabled")
    : tMap("favoritesOnlyHint");

  return (
    <section className="flex w-full flex-col gap-2">
      <div className="weather-map-favorites-filter">
        <MapLayerSwitch layer={layer} onChange={handleLayerChange} />
        <button
          type="button"
          className="weather-map-favorites-filter__button"
          data-active={favoritesOnly ? "true" : "false"}
          aria-pressed={favoritesOnly}
          aria-label={favoritesToggleLabel}
          title={favoritesToggleTitle}
          onClick={handleFavoritesOnlyToggle}
        >
          <FavoritesOnlyIcon active={favoritesOnly} />
          <span>{favoritesToggleLabel}</span>
        </button>
        {favoritesOnly ? (
          <p className="weather-map-favorites-filter__status" role="status">
            {showFavoritesEmpty
              ? tMap("favoritesOnlyEmpty")
              : tMap("favoritesOnlyActive", {
                  count: displayLocations.length,
                })}
          </p>
        ) : null}
      </div>
      <div
        className={`weather-map-frame relative w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800 ${
          isResizingMap ? "select-none" : ""
        }`}
        style={mapFrameStyle}
      >
        {showFavoritesEmpty ? (
          <div
            className="weather-map-favorites-empty flex h-full min-h-[28rem] w-full flex-col items-center justify-center gap-2 px-6 text-center"
            role="status"
          >
            <FavoritesOnlyIcon active={false} />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {tMap("favoritesOnlyEmpty")}
            </p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {tMap("favoritesOnlyEmptyHint")}
            </p>
          </div>
        ) : (
          <WeatherMap
            locations={displayLocations}
            alarms={alarms}
            locale={locale}
            selectedId={selectedId}
            focusLocationId={effectiveFocusLocationId}
            initialShowAlarms={initialShowAlarms}
            fitToLocations={favoritesOnly}
            fieldLocations={allDisplayLocations}
            showAllLabels={favoritesOnly}
            layer={layer}
          />
        )}
        {showNoRain ? (
          <p className="weather-map-note" role="status">
            {tMap("noRain")}
          </p>
        ) : null}
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
        maxOffsetHours={maxOffsetHours}
        isPlaying={isPlaying}
        isLoading={isForecastLoading}
        hasError={hasForecastError}
        locale={locale}
        onChange={handleForecastOffsetChange}
        onTogglePlay={handleTogglePlay}
        onRetry={handleForecastRetry}
      />
      <LayerLegend layer={layer} />
    </section>
  );
}
