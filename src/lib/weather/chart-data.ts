import { addDays, format, type Locale } from "date-fns";
import { getDatePattern } from "@/lib/date-locale";
import { groupForecastsByDay } from "./daily";
import type { HourlyForecast } from "./types";

export interface ChartPoint {
  xIndex: number;
  dayKey: string;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  iconCode: string;
  time: string;
}

export interface DaySegment {
  dayKey: string;
  label: string;
  start: number;
  end: number;
  midIndex: number;
}

function dayKey(time: Date): string {
  return format(time, "yyyy-MM-dd");
}

export function getTodayForecasts(forecasts: HourlyForecast[]): HourlyForecast[] {
  if (forecasts.length === 0) return [];

  const today = dayKey(new Date());
  const todayForecasts = forecasts.filter((forecast) => dayKey(forecast.time) === today);

  if (todayForecasts.length > 0) return todayForecasts;

  const firstDay = groupForecastsByDay(forecasts)[0];
  return firstDay?.forecasts ?? [];
}

export function filterForecastsByDayCount(
  forecasts: HourlyForecast[],
  days: number,
): HourlyForecast[] {
  if (forecasts.length === 0) return [];

  const start = forecasts[0].time;
  const end = addDays(start, days);
  return forecasts.filter((forecast) => forecast.time < end);
}

export function sumPrecipitation(forecasts: HourlyForecast[]): number {
  return forecasts.reduce((total, forecast) => total + forecast.precipitation, 0);
}

export function toChartPoints(forecasts: HourlyForecast[]): ChartPoint[] {
  return forecasts.map((forecast, index) => ({
    xIndex: index,
    dayKey: dayKey(forecast.time),
    temperature: forecast.temperature,
    precipitation: forecast.precipitation,
    windSpeed: forecast.windSpeed,
    iconCode: forecast.iconCode,
    time: forecast.time.toISOString(),
  }));
}

export function getDaySegments(data: ChartPoint[], dateLocale: Locale, locale: string): DaySegment[] {
  if (data.length === 0) return [];

  const segments: DaySegment[] = [];
  let current: DaySegment | null = null;

  for (const point of data) {
    if (!current || current.dayKey !== point.dayKey) {
      if (current) segments.push(current);
      current = {
        dayKey: point.dayKey,
        label: format(new Date(point.time), getDatePattern(locale, "chartDay"), { locale: dateLocale }),
        start: point.xIndex,
        end: point.xIndex,
        midIndex: point.xIndex,
      };
    } else {
      current.end = point.xIndex;
      current.midIndex = Math.floor((current.start + current.end) / 2);
    }
  }

  if (current) segments.push(current);
  return segments;
}

export function formatChartTooltipLabel(
  _label: unknown,
  payload: ReadonlyArray<{ payload?: ChartPoint }>,
  dateLocale: Locale,
  locale: string,
): string {
  const point = payload[0]?.payload;
  if (!point?.time) return String(_label ?? "");
  return format(new Date(point.time), getDatePattern(locale, "chartTooltip"), { locale: dateLocale });
}

export function getHourTicks(data: ChartPoint[], step = 2): number[] {
  if (data.length === 0) return [];
  const ticks: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    ticks.push(i);
  }
  const lastIndex = data.length - 1;
  if (ticks[ticks.length - 1] !== lastIndex) {
    ticks.push(lastIndex);
  }
  return ticks;
}
