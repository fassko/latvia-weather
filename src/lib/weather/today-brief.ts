import { getTodayForecasts } from "./chart-data";
import { summarizeDay } from "./daily";
import type { HourlyForecast } from "./types";

export interface TodayBrief {
  high: number;
  low: number;
  rainChance: number;
  precipMm: number;
}

interface WeatherApiForecastJson {
  time: string;
  temperature: number;
  feelsLike: number;
  precipitation: number;
  snow: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  pressure: number;
  cloudCover: number;
  iconCode: string;
  precipitationProbability: number;
  uvIndex: number | null;
  thunderProbability: number;
}

interface WeatherApiResponseJson {
  forecasts: WeatherApiForecastJson[];
}

const todayBriefCache = new Map<string, TodayBrief>();
const todayBriefInflight = new Map<string, Promise<TodayBrief>>();

function reviveForecast(raw: WeatherApiForecastJson): HourlyForecast {
  return {
    ...raw,
    time: new Date(raw.time),
  };
}

export function summarizeTodayBrief(forecasts: HourlyForecast[]): TodayBrief | null {
  const todayForecasts = getTodayForecasts(forecasts);
  if (todayForecasts.length === 0) return null;

  const today = summarizeDay(todayForecasts);
  return {
    high: Math.round(today.maxTemperature),
    low: Math.round(today.minTemperature),
    rainChance: Math.round(today.maxPrecipitationProbability),
    precipMm: Math.round(today.totalPrecipitation * 10) / 10,
  };
}

export async function fetchTodayBrief(punkts: string): Promise<TodayBrief> {
  const cached = todayBriefCache.get(punkts);
  if (cached) return cached;

  const inflight = todayBriefInflight.get(punkts);
  if (inflight) return inflight;

  const request = (async () => {
    const response = await fetch(
      `/api/weather?punkts=${encodeURIComponent(punkts)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const data = (await response.json()) as WeatherApiResponseJson;
    const forecasts = data.forecasts.map(reviveForecast);

    const brief = summarizeTodayBrief(forecasts);
    if (!brief) {
      throw new Error("No today forecast available");
    }

    todayBriefCache.set(punkts, brief);
    return brief;
  })();

  todayBriefInflight.set(punkts, request);

  try {
    return await request;
  } finally {
    todayBriefInflight.delete(punkts);
  }
}
