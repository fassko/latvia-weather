"use client";

import { format, isWeekend } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, useChartColors, WEEKEND_TICK_COLOR } from "@/components/charts/chart-theme";
import { getDateFnsLocale } from "@/lib/date-locale";
import {
  filterForecastsByDayCount,
  formatChartTooltipLabel,
  getDaySegments,
  getHourTicks,
  getTodayForecasts,
  sumPrecipitation,
  toChartPoints,
} from "@/lib/weather/chart-data";
import type { HourlyForecast } from "@/lib/weather/types";

type ForecastPeriod = 1 | 3 | 7;

const CHART_MARGIN = { top: 8, right: 4, left: 0, bottom: 4 };

interface ForecastChartProps {
  forecasts: HourlyForecast[];
}

function getForecastsForPeriod(forecasts: HourlyForecast[], period: ForecastPeriod) {
  if (period === 1) return getTodayForecasts(forecasts);
  return filterForecastsByDayCount(forecasts, period);
}

export function ForecastChart({ forecasts }: ForecastChartProps) {
  const locale = useLocale();
  const t = useTranslations("chart");
  const dateLocale = getDateFnsLocale(locale);
  const [period, setPeriod] = useState<ForecastPeriod>(1);
  const colors = useChartColors();

  const periodOptions: { value: ForecastPeriod; label: string }[] = [
    { value: 1, label: t("today") },
    { value: 3, label: t("threeDays") },
    { value: 7, label: t("sevenDays") },
  ];

  const periodForecasts = useMemo(
    () => getForecastsForPeriod(forecasts, period),
    [forecasts, period],
  );
  const data = useMemo(() => toChartPoints(periodForecasts), [periodForecasts]);
  const daySegments = useMemo(
    () => getDaySegments(data, dateLocale, locale),
    [data, dateLocale, locale],
  );
  const totalPrecip = useMemo(() => sumPrecipitation(periodForecasts), [periodForecasts]);
  const hourTicks = useMemo(() => getHourTicks(data), [data]);

  const dayTickLabels = useMemo(
    () =>
      new Map(
        daySegments.map((segment) => [
          segment.midIndex,
          {
            label: segment.label,
            isWeekendDay: isWeekend(new Date(`${segment.dayKey}T12:00:00`)),
          },
        ]),
      ),
    [daySegments],
  );

  const isMultiDay = period > 1;
  const temperatureLabel = t("temperature");
  const precipitationLabel = t("precipitation");

  if (data.length === 0) {
    return (
      <section aria-labelledby="forecast-chart-heading">
        <h2
          id="forecast-chart-heading"
          className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          {t("title")}
        </h2>
        <ChartCard>
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t("noData")}
          </p>
        </ChartCard>
      </section>
    );
  }

  return (
    <section aria-labelledby="forecast-chart-heading">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="forecast-chart-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {t("title")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t("mmTotal", { value: totalPrecip.toFixed(1) })}
            </span>
          </p>
        </div>
        <div
          className="grid w-full grid-cols-3 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 sm:inline-flex sm:w-auto"
          role="group"
          aria-label={t("periodLabel")}
        >
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors ${
                period === option.value
                  ? "bg-sky-500 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <ChartCard>
        <div className={`w-full ${isMultiDay ? "h-80 md:h-[400px]" : "h-64"}`}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 520, height: isMultiDay ? 320 : 256 }}
          >
            <ComposedChart data={data} margin={CHART_MARGIN}>
              {isMultiDay &&
                daySegments.slice(1).map((segment) => (
                  <ReferenceLine
                    key={`divider-${segment.dayKey}`}
                    x={segment.start}
                    yAxisId="temp"
                    stroke={colors.dayDivider}
                    strokeWidth={1.5}
                  />
                ))}
              <CartesianGrid
                yAxisId="temp"
                stroke={colors.grid}
                horizontal
                vertical={false}
                syncWithTicks
              />
              <XAxis
                dataKey="xIndex"
                type="number"
                domain={[0, Math.max(data.length - 1, 0)]}
                ticks={
                  isMultiDay ? daySegments.map((segment) => segment.midIndex) : hourTicks
                }
                tick={
                  isMultiDay
                    ? ({ x, y, payload }) => {
                        const tick = dayTickLabels.get(Number(payload.value));
                        if (!tick) return null;

                        return (
                          <text
                            x={x}
                            y={y}
                            dy={8}
                            textAnchor="middle"
                            fill={tick.isWeekendDay ? WEEKEND_TICK_COLOR : colors.tick}
                            fontSize={12}
                            fontWeight={500}
                          >
                            {tick.label}
                          </text>
                        );
                      }
                    : {
                        fontSize: 11,
                        fill: colors.tick,
                      }
                }
                tickFormatter={
                  isMultiDay
                    ? undefined
                    : (index) => {
                        const point = data[Number(index)];
                        if (!point) return "";
                        return format(new Date(point.time), "HH:mm");
                      }
                }
                axisLine={{ stroke: colors.dayDivider }}
                tickLine={false}
              />
              <YAxis
                yAxisId="temp"
                tick={{ fontSize: 11, fill: colors.tick }}
                unit="°C"
                width={48}
                tickCount={6}
              />
              <YAxis
                yAxisId="precip"
                orientation="right"
                tick={{ fontSize: 11, fill: colors.tick }}
                unit=" mm"
                width="auto"
                tickCount={6}
                tickMargin={6}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: `1px solid ${colors.tooltipBorder}`,
                  backgroundColor: colors.tooltipBg,
                  color: colors.legend,
                  fontSize: "13px",
                }}
                itemSorter={(item) => (item.name === temperatureLabel ? 0 : 1)}
                formatter={(value, name) => {
                  const num = typeof value === "number" ? value : 0;
                  if (name === temperatureLabel) {
                    return [`${num.toFixed(1)}°C`, temperatureLabel];
                  }
                  return [`${num.toFixed(2)} mm`, precipitationLabel];
                }}
                labelFormatter={(label, payload) =>
                  formatChartTooltipLabel(label, payload, dateLocale, locale)
                }
              />
              <Bar
                yAxisId="precip"
                dataKey="precipitation"
                name={precipitationLabel}
                fill="#38bdf8"
                fillOpacity={0.7}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name={temperatureLabel}
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Legend
                wrapperStyle={{ color: colors.legend }}
                itemSorter={(item) => (item.value === temperatureLabel ? 0 : 1)}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </section>
  );
}
