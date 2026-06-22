"use client";

import { addDays, format, isWeekend } from "date-fns";
import { useEffect, useMemo, useState } from "react";
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
import type { HourlyForecast } from "@/lib/weather/types";

interface WeatherChartProps {
  forecasts: HourlyForecast[];
}

interface ChartPoint {
  xIndex: number;
  dayKey: string;
  temperature: number;
  precipitation: number;
  time: string;
}

interface DaySegment {
  dayKey: string;
  label: string;
  start: number;
  end: number;
  midIndex: number;
}

const CHART_DAYS = 7;

function getDaySegments(data: ChartPoint[]): DaySegment[] {
  if (data.length === 0) return [];

  const segments: DaySegment[] = [];
  let current: DaySegment | null = null;

  for (const point of data) {
    if (!current || current.dayKey !== point.dayKey) {
      if (current) segments.push(current);
      current = {
        dayKey: point.dayKey,
        label: format(new Date(point.time), "EEE d"),
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

function buildChartData(forecasts: HourlyForecast[]): ChartPoint[] {
  if (forecasts.length === 0) return [];

  const start = forecasts[0].time;
  const end = addDays(start, CHART_DAYS);
  const weekForecasts = forecasts.filter((forecast) => forecast.time < end);

  return weekForecasts.map((forecast, index) => ({
    xIndex: index,
    dayKey: format(forecast.time, "yyyy-MM-dd"),
    temperature: forecast.temperature,
    precipitation: forecast.precipitation,
    time: forecast.time.toISOString(),
  }));
}

function formatTooltipLabel(
  _label: unknown,
  payload: ReadonlyArray<{ payload?: ChartPoint }>,
): string {
  const point = payload[0]?.payload;
  if (!point?.time) return String(_label ?? "");
  return format(new Date(point.time), "EEE, MMM d · HH:mm");
}

const WEEKEND_TICK_COLOR = "#dc2626";

const CHART_COLORS = {
  light: {
    grid: "#e2e8f0",
    tick: "#64748b",
    dayDivider: "#cbd5e1",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    legend: "#334155",
  },
  dark: {
    grid: "#475569",
    tick: "#94a3b8",
    dayDivider: "#475569",
    tooltipBg: "#1e293b",
    tooltipBorder: "#475569",
    legend: "#cbd5e1",
  },
} as const;

function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function WeatherChart({ forecasts }: WeatherChartProps) {
  const data = buildChartData(forecasts);
  const daySegments = useMemo(() => getDaySegments(data), [data]);
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
  const isDark = useIsDark();
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;

  return (
    <section aria-labelledby="chart-heading">
      <h2 id="chart-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Temperature & precipitation (7 days)
      </h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="h-80 w-full md:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              {daySegments.slice(1).map((segment) => (
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
                ticks={daySegments.map((segment) => segment.midIndex)}
                tick={({ x, y, payload }) => {
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
                }}
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
                labelFormatter={formatTooltipLabel}
              />
              <Legend wrapperStyle={{ color: colors.legend }} />
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
