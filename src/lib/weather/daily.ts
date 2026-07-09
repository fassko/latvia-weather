import { format } from "date-fns";
import type { HourlyForecast } from "./types";
import { getLatviaDayKey } from "./timezone";

export interface DailyForecastGroup {
  date: Date;
  forecasts: HourlyForecast[];
}

export interface DailySummary {
  minTemperature: number;
  maxTemperature: number;
  minFeelsLike: number;
  maxFeelsLike: number;
  totalPrecipitation: number;
  maxPrecipitationProbability: number;
  avgHumidity: number;
  avgCloudCover: number;
  maxWindSpeed: number;
  windDirectionAtMaxWind: number;
  avgPressure: number;
  representativeIconCode: string;
}

function dayKey(time: Date): string {
  return getLatviaDayKey(time);
}

export function groupForecastsByDay(
  forecasts: HourlyForecast[],
): DailyForecastGroup[] {
  const groups = new Map<string, DailyForecastGroup>();

  for (const forecast of forecasts) {
    const key = dayKey(forecast.time);
    const existing = groups.get(key);

    if (existing) {
      existing.forecasts.push(forecast);
      continue;
    }

    groups.set(key, {
      date: forecast.time,
      forecasts: [forecast],
    });
  }

  return [...groups.values()];
}

function findRepresentativeIconCode(forecasts: HourlyForecast[]): string {
  const midday = forecasts.reduce((closest, forecast) => {
    const hourDistance = Math.abs(forecast.time.getHours() - 12);
    const closestDistance = Math.abs(closest.time.getHours() - 12);
    return hourDistance < closestDistance ? forecast : closest;
  });

  return midday.iconCode;
}

export function summarizeDay(forecasts: HourlyForecast[]): DailySummary {
  let minTemperature = forecasts[0].temperature;
  let maxTemperature = forecasts[0].temperature;
  let minFeelsLike = forecasts[0].feelsLike;
  let maxFeelsLike = forecasts[0].feelsLike;
  let totalPrecipitation = 0;
  let maxPrecipitationProbability = 0;
  let humiditySum = 0;
  let cloudCoverSum = 0;
  let maxWindSpeed = 0;
  let windDirectionAtMaxWind = forecasts[0].windDirection;
  let pressureSum = 0;

  for (const forecast of forecasts) {
    minTemperature = Math.min(minTemperature, forecast.temperature);
    maxTemperature = Math.max(maxTemperature, forecast.temperature);
    minFeelsLike = Math.min(minFeelsLike, forecast.feelsLike);
    maxFeelsLike = Math.max(maxFeelsLike, forecast.feelsLike);
    totalPrecipitation += forecast.precipitation;
    maxPrecipitationProbability = Math.max(
      maxPrecipitationProbability,
      forecast.precipitationProbability,
    );
    humiditySum += forecast.humidity;
    cloudCoverSum += forecast.cloudCover;
    if (forecast.windSpeed >= maxWindSpeed) {
      maxWindSpeed = forecast.windSpeed;
      windDirectionAtMaxWind = forecast.windDirection;
    }
    pressureSum += forecast.pressure;
  }

  return {
    minTemperature,
    maxTemperature,
    minFeelsLike,
    maxFeelsLike,
    totalPrecipitation,
    maxPrecipitationProbability,
    avgHumidity: humiditySum / forecasts.length,
    avgCloudCover: cloudCoverSum / forecasts.length,
    maxWindSpeed,
    windDirectionAtMaxWind,
    avgPressure: pressureSum / forecasts.length,
    representativeIconCode: findRepresentativeIconCode(forecasts),
  };
}
