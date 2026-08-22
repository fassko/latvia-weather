import { getLatviaDayKey } from "./timezone";
import type { SunTimesByDay } from "./sun";
import type { HourlyForecast } from "./types";

export type SunEvent = { event: "sunrise" | "sunset"; time: Date };

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
      const nearest = dayForecasts.reduce((best, forecast) => {
        const bestDistance = Math.abs(best.time.getTime() - sunEvent.time.getTime());
        const forecastDistance = Math.abs(
          forecast.time.getTime() - sunEvent.time.getTime(),
        );

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
