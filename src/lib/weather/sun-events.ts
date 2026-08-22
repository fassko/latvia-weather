import { getLatviaDayKey } from "./timezone";
import type { SunTimesByDay } from "./sun";
import type { HourlyForecast } from "./types";

export type SunEvent = { event: "sunrise" | "sunset"; time: Date };

const HOUR_MS = 3_600_000;
const MAX_FALLBACK_MS = 30 * 60 * 1000;

export function isSunEventInForecastHour(
  sunEvent: SunEvent,
  forecast: HourlyForecast,
): boolean {
  const eventMs = sunEvent.time.getTime();
  const startMs = forecast.time.getTime();
  return eventMs >= startMs && eventMs < startMs + HOUR_MS;
}

function findForecastForSunEvent(
  sunEvent: SunEvent,
  dayForecasts: HourlyForecast[],
): HourlyForecast | null {
  if (dayForecasts.length === 0) return null;

  const eventMs = sunEvent.time.getTime();
  const bucketMatch = dayForecasts.find((forecast) =>
    isSunEventInForecastHour(sunEvent, forecast),
  );
  if (bucketMatch) return bucketMatch;

  let nearest: HourlyForecast | null = null;
  let nearestDistance = Infinity;
  for (const forecast of dayForecasts) {
    const distance = Math.abs(forecast.time.getTime() - eventMs);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = forecast;
    }
  }

  if (nearest && nearestDistance <= MAX_FALLBACK_MS) return nearest;
  return null;
}

export function getSunEventsByForecastTime(
  forecasts: HourlyForecast[],
  sunTimesByDay: SunTimesByDay,
): Map<string, SunEvent[]> {
  const eventsByForecastTime = new Map<string, SunEvent[]>();
  const dayKeys = Array.from(
    new Set(forecasts.map((forecast) => getLatviaDayKey(forecast.time))),
  );

  for (const dayKey of dayKeys) {
    const dayForecasts = forecasts.filter(
      (forecast) => getLatviaDayKey(forecast.time) === dayKey,
    );
    const sunTimes = sunTimesByDay[dayKey];
    if (!sunTimes || dayForecasts.length === 0) continue;

    for (const sunEvent of [
      { event: "sunrise", time: sunTimes.sunrise },
      { event: "sunset", time: sunTimes.sunset },
    ] satisfies SunEvent[]) {
      const match = findForecastForSunEvent(sunEvent, dayForecasts);
      if (!match) continue;

      const key = match.time.toISOString();
      const events = eventsByForecastTime.get(key) ?? [];
      events.push(sunEvent);
      events.sort((a, b) => a.time.getTime() - b.time.getTime());
      eventsByForecastTime.set(key, events);
    }
  }

  return eventsByForecastTime;
}
