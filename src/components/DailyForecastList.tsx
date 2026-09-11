import { format, isWeekend } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import {
  DailyForecastAccordion,
  type DailyForecastDayRow,
} from "@/components/DailyForecastAccordion";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import { getUpcomingHourlyForecasts } from "@/lib/weather/chart-data";
import {
  buildUpcomingDailyGroups,
  groupForecastsByDay,
} from "@/lib/weather/daily";
import type { SunTimesByDay } from "@/lib/weather/sun";
import {
  formatLatviaTime,
  getLatviaDayKey,
  getLatviaStartOfHour,
} from "@/lib/weather/timezone";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import type { HourlyForecast } from "@/lib/weather/types";

interface DailyForecastListProps {
  forecasts: HourlyForecast[];
  sunTimesByDay: SunTimesByDay;
}

/** Server: build summary rows; client accordion mounts hourly tables on expand. */
export async function DailyForecastList({
  forecasts,
  sunTimesByDay,
}: DailyForecastListProps) {
  const locale = await getLocale();
  const t = await getTranslations("dailyList");
  const dateLocale = getDateFnsLocale(locale);
  const windUnit = await getWindUnitsCookie();
  const now = new Date();
  const todayKey = getLatviaDayKey(now);
  const currentHour = getLatviaStartOfHour(now);

  const rows = buildUpcomingDailyGroups(forecasts, getUpcomingHourlyForecasts(forecasts));
  const forecastsByDay = new Map(
    groupForecastsByDay(forecasts).map((group) => [group.dayKey, group.forecasts]),
  );

  if (rows.length === 0) return null;

  const overallMin = Math.min(...rows.map((row) => row.summary.minTemperature));
  const overallMax = Math.max(...rows.map((row) => row.summary.maxTemperature));
  const span = Math.max(overallMax - overallMin, 1);

  const days: DailyForecastDayRow[] = rows.map((row) => {
    const { summary } = row;
    const isToday = row.dayKey === todayKey;
    const weekday = isToday
      ? t("today")
      : format(row.date, getDatePattern(locale, "dailyWeekday"), {
          locale: dateLocale,
        });
    const dateLabel = format(row.date, getDatePattern(locale, "dailyDate"), {
      locale: dateLocale,
    });
    const sunTimes = sunTimesByDay[row.dayKey] ?? null;
    const breakdownForecasts =
      isToday ? (forecastsByDay.get(row.dayKey) ?? row.forecasts) : row.forecasts;

    return {
      dayKey: row.dayKey,
      weekday,
      dateLabel,
      weekend: isWeekend(row.date),
      isToday,
      low: Math.round(summary.minTemperature),
      high: Math.round(summary.maxTemperature),
      barLeft: ((summary.minTemperature - overallMin) / span) * 100,
      barWidth: Math.max(
        ((summary.maxTemperature - summary.minTemperature) / span) * 100,
        6,
      ),
      iconCode: summary.representativeIconCode,
      precipMm: summary.totalPrecipitation,
      rainChance: Math.round(summary.maxPrecipitationProbability),
      sunriseLabel: sunTimes ? formatLatviaTime(sunTimes.sunrise, "HH:mm") : null,
      sunsetLabel: sunTimes ? formatLatviaTime(sunTimes.sunset, "HH:mm") : null,
      forecasts: breakdownForecasts,
      sunTimes,
    };
  });

  return (
    <DailyForecastAccordion
      title={t("title")}
      days={days}
      windUnit={windUnit}
      fadedBeforeIso={currentHour.toISOString()}
    />
  );
}
