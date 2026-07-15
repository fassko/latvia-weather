import { addHours } from "date-fns";
import type { HourlyForecast } from "./types";
import {
  getLatviaStartOfHour,
  getLatviaWallClock,
} from "./timezone";

export function getUpcomingHourlyForecasts(
  forecasts: HourlyForecast[],
  now = new Date(),
): HourlyForecast[] {
  if (forecasts.length === 0) return [];

  const currentHour = getLatviaStartOfHour(now);
  const upcoming = forecasts.filter(
    (forecast) => getLatviaWallClock(forecast.time) >= currentHour,
  );

  if (upcoming.length > 0) return upcoming;
  return forecasts.slice(-1);
}

export function getUpcomingTodayForecasts(
  forecasts: HourlyForecast[],
  now = new Date(),
): HourlyForecast[] {
  if (forecasts.length === 0) return [];

  const currentHour = getLatviaStartOfHour(now);
  const end = addHours(currentHour, 24);
  const next24Hours = getUpcomingHourlyForecasts(forecasts, now).filter(
    (forecast) => getLatviaWallClock(forecast.time) < end,
  );

  if (next24Hours.length > 0) return next24Hours;

  const upcoming = getUpcomingHourlyForecasts(forecasts, now);
  if (upcoming.length > 0) return upcoming.slice(0, 24);

  return forecasts.slice(-1);
}

export function sumPrecipitation(forecasts: HourlyForecast[]): number {
  return forecasts.reduce((total, forecast) => total + forecast.precipitation, 0);
}
