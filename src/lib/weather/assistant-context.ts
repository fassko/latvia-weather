import { addHours } from "date-fns";
import type { HourlyForecast } from "./types";
import {
  formatLatviaTime,
  getLatviaStartOfHour,
  getLatviaWallClock,
} from "./timezone";

const HOUR_MS = 60 * 60 * 1000;
const RAIN_PROBABILITY_THRESHOLD = 40;

export interface OverlappingHourSummary {
  time: string;
  localTime: string;
  precipitation: number;
  precipitationProbability: number;
}

export interface NextHourRainSummary {
  /** True when any overlapping forecast hour has measurable rain or high probability. */
  willRain: boolean;
  maxPrecipitationMm: number;
  maxPrecipitationProbability: number;
  totalPrecipitationMm: number;
  overlappingHours: OverlappingHourSummary[];
  earliestRainTime: string | null;
}

export interface RainWindowSummary {
  startTime: string;
  endTime: string;
  startLocalTime: string;
  endLocalTime: string;
  totalPrecipitationMm: number;
  maxPrecipitationProbability: number;
}

export interface AssistantTimingContext {
  nowLatvia: string;
  nowLocalTime: string;
  currentHourBucketStart: string;
  nextHourWindowEnd: string;
  nextHour: NextHourRainSummary;
  upcomingRainWindows: RainWindowSummary[];
}

function hourHasRain(forecast: HourlyForecast): boolean {
  return (
    forecast.precipitation > 0 ||
    forecast.precipitationProbability >= RAIN_PROBABILITY_THRESHOLD
  );
}

export function getForecastHoursOverlappingWindow(
  forecasts: HourlyForecast[],
  now: Date,
  windowMinutes = 60,
): HourlyForecast[] {
  const windowEndMs = now.getTime() + windowMinutes * 60 * 1000;

  return forecasts.filter((forecast) => {
    const bucketStartMs = forecast.time.getTime();
    const bucketEndMs = bucketStartMs + HOUR_MS;
    return bucketStartMs < windowEndMs && bucketEndMs > now.getTime();
  });
}

export function summarizeNextHourRain(
  forecasts: HourlyForecast[],
  now = new Date(),
): NextHourRainSummary {
  const overlappingHours = getForecastHoursOverlappingWindow(forecasts, now).map(
    (forecast) => ({
      time: forecast.time.toISOString(),
      localTime: formatLatviaTime(forecast.time, "HH:mm"),
      precipitation: forecast.precipitation,
      precipitationProbability: forecast.precipitationProbability,
    }),
  );

  const willRain = overlappingHours.some(
    (hour) =>
      hour.precipitation > 0 ||
      hour.precipitationProbability >= RAIN_PROBABILITY_THRESHOLD,
  );

  const rainyHours = overlappingHours.filter(
    (hour) =>
      hour.precipitation > 0 ||
      hour.precipitationProbability >= RAIN_PROBABILITY_THRESHOLD,
  );

  return {
    willRain,
    maxPrecipitationMm: overlappingHours.reduce(
      (max, hour) => Math.max(max, hour.precipitation),
      0,
    ),
    maxPrecipitationProbability: overlappingHours.reduce(
      (max, hour) => Math.max(max, hour.precipitationProbability),
      0,
    ),
    totalPrecipitationMm: overlappingHours.reduce(
      (total, hour) => total + hour.precipitation,
      0,
    ),
    overlappingHours,
    earliestRainTime: rainyHours[0]?.time ?? null,
  };
}

export function getUpcomingRainWindows(
  forecasts: HourlyForecast[],
  now = new Date(),
  limit = 3,
): RainWindowSummary[] {
  const upcoming = forecasts.filter(
    (forecast) => getLatviaWallClock(forecast.time) >= getLatviaStartOfHour(now),
  );

  const windows: RainWindowSummary[] = [];
  let current: HourlyForecast[] = [];

  for (const forecast of upcoming) {
    if (hourHasRain(forecast)) {
      current.push(forecast);
      continue;
    }

    if (current.length > 0) {
      windows.push(toRainWindow(current));
      current = [];
    }
  }

  if (current.length > 0) {
    windows.push(toRainWindow(current));
  }

  return windows.slice(0, limit);
}

function toRainWindow(period: HourlyForecast[]): RainWindowSummary {
  const start = period[0];
  const end = period[period.length - 1];

  return {
    startTime: start.time.toISOString(),
    endTime: addHours(end.time, 1).toISOString(),
    startLocalTime: formatLatviaTime(start.time, "HH:mm"),
    endLocalTime: formatLatviaTime(addHours(end.time, 1), "HH:mm"),
    totalPrecipitationMm: period.reduce(
      (total, forecast) => total + forecast.precipitation,
      0,
    ),
    maxPrecipitationProbability: period.reduce(
      (max, forecast) => Math.max(max, forecast.precipitationProbability),
      0,
    ),
  };
}

export function buildAssistantTimingContext(
  forecasts: HourlyForecast[],
  now = new Date(),
): AssistantTimingContext {
  const currentHourBucketStart = getLatviaStartOfHour(now);
  const nextHourWindowEnd = new Date(now.getTime() + HOUR_MS);

  return {
    nowLatvia: now.toISOString(),
    nowLocalTime: formatLatviaTime(now, "HH:mm"),
    currentHourBucketStart: currentHourBucketStart.toISOString(),
    nextHourWindowEnd: nextHourWindowEnd.toISOString(),
    nextHour: summarizeNextHourRain(forecasts, now),
    upcomingRainWindows: getUpcomingRainWindows(forecasts, now),
  };
}
