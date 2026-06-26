"use client";

import { format, isWeekend } from "date-fns";
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

const PERIOD_OPTIONS: { value: ForecastPeriod; label: string }[] = [
  { value: 1, label: "Today" },
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
];

interface ForecastChartProps {
  forecasts: HourlyForecast[];
}

function getForecastsForPeriod(forecasts: HourlyForecast[], period: ForecastPeriod) {
  if (period === 1) return getTodayForecasts(forecasts);
  return filterForecastsByDayCount(forecasts, period);
}

export function ForecastChart({ forecasts }: ForecastChartProps) {
  const [period, setPeriod] = useState<ForecastPeriod>(1);
  const colors = useChartColors();

  const periodForecasts = useMemo(
    () => getForecastsForPeriod(forecasts, period),
    [forecasts, period],
  );
  const data = useMemo(() => toChartPoints(periodForecasts), [periodForecasts]);
  const daySegments = useMemo(() => getDaySegments(data), [data]);
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

  if (data.length === 0) {
    return (
      <section aria-labelledby="forecast-chart-heading">
        <h2
          id="forecast-chart-heading"
          className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Temperature & precipitation
        </h2>
        <ChartCard>
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No forecast data available.
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
            Temperature & precipitation
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {totalPrecip.toFixed(1)} mm total
            </span>
          </p>
        </div>
        <div
          className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
          role="group"
          aria-label="Forecast period"
        >
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
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
                width={48}
                tickCount={6}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: `1px solid ${colors.tooltipBorder}`,
                  backgroundColor: colors.tooltipBg,
                  color: colors.legend,
                  fontSize: "13px",
                }}
                itemSorter={(item) => (item.name === "Temperature" ? 0 : 1)}
                formatter={(value, name) => {
                  const num = typeof value === "number" ? value : 0;
                  if (name === "Temperature") return [`${num.toFixed(1)}°C`, "Temperature"];
                  return [`${num.toFixed(2)} mm`, "Precipitation"];
                }}
                labelFormatter={formatChartTooltipLabel}
              />
              <Bar
                yAxisId="precip"
                dataKey="precipitation"
                name="Precipitation"
                fill="#38bdf8"
                fillOpacity={0.7}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Temperature"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Legend
                wrapperStyle={{ color: colors.legend }}
                itemSorter={(item) => (item.value === "Temperature" ? 0 : 1)}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </section>
  );
}
