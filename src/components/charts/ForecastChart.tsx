"use client";

import { isWeekend } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
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
import { useChartColors, WEEKEND_TICK_COLOR } from "@/components/charts/chart-theme";
import { getDateFnsLocale } from "@/lib/date-locale";
import {
  filterForecastsByDayCount,
  formatChartTooltipLabel,
  type ChartPoint,
  getDaySegments,
  getHourTicks,
  getUpcomingTodayForecasts,
  toChartPoints,
} from "@/lib/weather/chart-data";
import { getConditionEmoji, getConditionKey, getWindDirection } from "@/lib/weather/parse";
import { formatLatviaTime } from "@/lib/weather/timezone";
import {
  convertWindSpeed,
  formatWindSpeed,
  getWindSpeedUnitSuffix,
} from "@/lib/weather/wind-units";
import { useWindUnit } from "@/lib/weather/use-wind-unit";
import type { HourlyForecast } from "@/lib/weather/types";

type ForecastPeriod = 1 | 3 | 7;
type ChartSeriesKey = "temperature" | "precipitation" | "windSpeed";

const CHART_MARGIN = { top: 12, right: 12, left: 4, bottom: 8 };
const CHART_PREFS_STORAGE_KEY = "latvia-weather-chart-prefs";

/** Chart series colours tuned to the Skyline design (blue temp, violet wind). */
const CHART_SERIES = {
  temperature: "#2563eb",
  precipitation: "#bae6fd",
  wind: "#a78bfa",
} as const;
const WIND_ARROW_COLOR = "#7c3aed";

interface ForecastChartProps {
  forecasts: HourlyForecast[];
}

interface ConditionDotProps {
  cx?: number | string;
  cy?: number | string;
  index?: number;
  payload?: ChartPoint;
}

interface ChartPreferences {
  period: ForecastPeriod;
  hiddenSeries: ChartSeriesKey[];
}

function getForecastsForPeriod(forecasts: HourlyForecast[], period: ForecastPeriod) {
  if (period === 1) return getUpcomingTodayForecasts(forecasts);
  return filterForecastsByDayCount(forecasts, period);
}

function getConditionIconStep(period: ForecastPeriod) {
  if (period === 1) return 2;
  if (period === 3) return 4;
  return 8;
}

function getConditionIconMinGap(period: ForecastPeriod) {
  if (period === 1) return 1;
  if (period === 3) return 2;
  return 4;
}

function getWindDirectionIconStep(period: ForecastPeriod) {
  if (period === 1) return 2;
  if (period === 3) return 6;
  return 12;
}

function getHourTickStep(period: ForecastPeriod) {
  return period === 1 ? 1 : 8;
}

function getConditionIconSize(period: ForecastPeriod) {
  if (period === 1) return 16;
  if (period === 3) return 14;
  return 12;
}

function getWindDirectionIconSize(period: ForecastPeriod) {
  if (period === 1) return 18;
  if (period === 3) return 16;
  return 14;
}

function getConditionIconIndexes(data: ChartPoint[], period: ForecastPeriod): Set<number> {
  const indexes = new Set<number>();
  const step = getConditionIconStep(period);
  const minGap = getConditionIconMinGap(period);
  let lastSelected = Number.NEGATIVE_INFINITY;

  data.forEach((point, index) => {
    const isConditionChange = index > 0 && point.iconCode !== data[index - 1]?.iconCode;
    const isScheduledIcon = index % step === 0 || index === data.length - 1;

    if (isScheduledIcon || (isConditionChange && index - lastSelected >= minGap)) {
      indexes.add(index);
      lastSelected = index;
    }
  });

  return indexes;
}

function getHourTicksForPeriod(data: ChartPoint[], period: ForecastPeriod): number[] {
  if (period === 1) return getHourTicks(data, getHourTickStep(period));

  const dayPartHours = new Set([0, 8, 16]);
  const ticks = data
    .filter((point) => dayPartHours.has(Number(formatLatviaTime(new Date(point.time), "H"))))
    .map((point) => point.xIndex);

  return ticks.length > 0 ? ticks : getHourTicks(data, getHourTickStep(period));
}

function isSvgCoordinate(value: number | string | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isChartSeriesKey(value: unknown): value is ChartSeriesKey {
  return value === "temperature" || value === "precipitation" || value === "windSpeed";
}

function isForecastPeriod(value: unknown): value is ForecastPeriod {
  return value === 1 || value === 3 || value === 7;
}

function parseChartPreferences(value: string | null): ChartPreferences | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ChartPreferences>;
    return {
      period: isForecastPeriod(parsed.period) ? parsed.period : 1,
      hiddenSeries: Array.isArray(parsed.hiddenSeries)
        ? parsed.hiddenSeries.filter(isChartSeriesKey)
        : [],
    };
  } catch {
    return null;
  }
}

function getInitialChartPreferences(): ChartPreferences {
  if (typeof window === "undefined") {
    return { period: 1, hiddenSeries: [] };
  }

  return (
    parseChartPreferences(localStorage.getItem(CHART_PREFS_STORAGE_KEY)) ?? {
      period: 1,
      hiddenSeries: [],
    }
  );
}

export function ForecastChart({ forecasts }: ForecastChartProps) {
  const locale = useLocale();
  const t = useTranslations("chart");
  const tConditions = useTranslations("conditions");
  const tWind = useTranslations("wind");
  const dateLocale = getDateFnsLocale(locale);
  const [period, setPeriod] = useState<ForecastPeriod>(
    () => getInitialChartPreferences().period,
  );
  const [hiddenSeries, setHiddenSeries] = useState<Set<ChartSeriesKey>>(
    () => new Set(getInitialChartPreferences().hiddenSeries),
  );
  const colors = useChartColors();
  const windUnit = useWindUnit();
  const windAxisUnit = getWindSpeedUnitSuffix(windUnit);

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
  const hourTicks = useMemo(() => getHourTicksForPeriod(data, period), [data, period]);
  const conditionIconIndexes = useMemo(
    () => getConditionIconIndexes(data, period),
    [data, period],
  );

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

  const spansMultipleDays = useMemo(() => {
    if (data.length === 0) return false;
    const firstDay = data[0].dayKey;
    return data.some((point) => point.dayKey !== firstDay);
  }, [data]);
  const isMultiDay = period > 1 || spansMultipleDays;
  const temperatureLabel = t("temperature");
  const precipitationLabel = t("precipitation");
  const windLabel = t("wind");

  useEffect(() => {
    localStorage.setItem(
      CHART_PREFS_STORAGE_KEY,
      JSON.stringify({
        period,
        hiddenSeries: Array.from(hiddenSeries),
      }),
    );
  }, [hiddenSeries, period]);

  const toggleSeries = (dataKey: unknown) => {
    if (!isChartSeriesKey(dataKey)) return;

    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };
  const renderConditionDot = ({ cx, cy, index, payload }: ConditionDotProps) => {
    if (
      index == null ||
      !payload?.iconCode ||
      !conditionIconIndexes.has(index) ||
      !isSvgCoordinate(cx) ||
      !isSvgCoordinate(cy)
    ) {
      return null;
    }

    const condition = tConditions(getConditionKey(payload.iconCode));
    const iconSize = getConditionIconSize(period);

    return (
      <g transform={`translate(${cx}, ${cy - iconSize - 2})`} pointerEvents="none">
        <title>{condition}</title>
        <text
          y={iconSize / 4}
          textAnchor="middle"
          fontSize={iconSize}
          fontFamily="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
        >
          {getConditionEmoji(payload.iconCode)}
        </text>
      </g>
    );
  };
  const renderWindDirectionDot = ({ cx, cy, index, payload }: ConditionDotProps) => {
    if (
      index == null ||
      index % getWindDirectionIconStep(period) !== 0 ||
      payload == null ||
      !isSvgCoordinate(cx) ||
      !isSvgCoordinate(cy)
    ) {
      return null;
    }

    const direction = getWindDirection(payload.windDirection);
    const iconSize = getWindDirectionIconSize(period);
    return (
      <g
        transform={`translate(${cx}, ${cy + iconSize + 2}) rotate(${payload.windDirection + 180})`}
        pointerEvents="none"
      >
        <title>{tWind("from", { direction })}</title>
        <text
          y={5}
          textAnchor="middle"
          fontSize={iconSize}
          fontWeight={800}
          fill={WIND_ARROW_COLOR}
          stroke={colors.tooltipBg}
          strokeWidth={3}
          paintOrder="stroke fill"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        >
          ↑
        </text>
      </g>
    );
  };
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {t("noData")}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("title")}
        </h2>
        <div
          className="grid grid-cols-3 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 sm:inline-flex"
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
      <div className="overflow-x-auto pb-1">
          <div
            className={`min-w-[700px] sm:min-w-0 ${
              isMultiDay ? "h-80 md:h-[400px]" : "h-72"
            }`}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 700, height: isMultiDay ? 320 : 256 }}
            >
            <ComposedChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid
                yAxisId="temp"
                stroke={colors.grid}
                horizontal
                vertical={false}
                syncWithTicks
              />
              {hourTicks.map((tick) => (
                <ReferenceLine
                  key={`hour-${tick}`}
                  x={tick}
                  yAxisId="temp"
                  stroke={colors.grid}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
              ))}
              {isMultiDay &&
                daySegments.slice(1).map((segment) => (
                  <ReferenceLine
                    key={`divider-${segment.dayKey}`}
                    x={segment.start}
                    yAxisId="temp"
                    stroke={colors.dayDivider}
                    strokeWidth={1}
                  />
                ))}
              <XAxis
                dataKey="xIndex"
                type="number"
                domain={[0, Math.max(data.length - 1, 0)]}
                ticks={hourTicks}
                tick={{
                  fontSize: isMultiDay ? 10 : 11,
                  fill: colors.tick,
                }}
                tickFormatter={(index) => {
                  const point = data[Number(index)];
                  if (!point) return "";
                  return formatLatviaTime(new Date(point.time), "HH:mm");
                }}
                axisLine={{ stroke: colors.dayDivider }}
                tickLine={false}
                height={isMultiDay ? 20 : undefined}
              />
              {isMultiDay ? (
                <XAxis
                  xAxisId="days"
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
                  axisLine={false}
                  tickLine={false}
                  height={24}
                />
              ) : null}
              <YAxis
                yAxisId="temp"
                tick={{ fontSize: 11, fill: colors.tick }}
                unit="°C"
                width={48}
                tickCount={6}
                domain={[
                  (min: number) => Math.min(0, Math.floor(min)),
                  (max: number) => Math.ceil(max) + 5,
                ]}
              />
              <YAxis
                yAxisId="precip"
                orientation="right"
                tick={{ fontSize: 11, fill: colors.tick }}
                unit=" mm"
                width="auto"
                tickCount={6}
                tickMargin={6}
                domain={[0, (max: number) => Math.max(2, Math.ceil(max * 1.5))]}
              />
              <YAxis
                yAxisId="wind"
                orientation="right"
                tick={{ fontSize: 11, fill: colors.tick }}
                unit={` ${windAxisUnit}`}
                width="auto"
                tickCount={6}
                tickMargin={6}
                domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.6))]}
                tickFormatter={(value) => convertWindSpeed(Number(value), windUnit).toFixed(1)}
              />
              <Tooltip
                wrapperStyle={{
                  maxWidth: "none",
                }}
                contentStyle={{
                  borderRadius: "8px",
                  border: `1px solid ${colors.tooltipBorder}`,
                  backgroundColor: colors.tooltipBg,
                  color: colors.legend,
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                }}
                itemSorter={(item) => {
                  if (item.name === temperatureLabel) return 0;
                  if (item.name === precipitationLabel) return 1;
                  return 2;
                }}
                formatter={(value, name, item) => {
                  const num = typeof value === "number" ? value : 0;
                  const point = item.payload as ChartPoint | undefined;
                  if (name === temperatureLabel) {
                    return [`${num.toFixed(1)}°C`, temperatureLabel];
                  }
                  if (name === windLabel) {
                    if (point == null) {
                      return [formatWindSpeed(num, windUnit), windLabel];
                    }

                    const direction = getWindDirection(point.windDirection);

                    return [
                      <span
                        key="wind-tooltip"
                        className="inline-flex items-center gap-1"
                      >
                        <span>{formatWindSpeed(num, windUnit)}</span>
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ transform: `rotate(${point.windDirection + 180}deg)` }}
                        >
                          <path
                            d="M8 2v10M8 2L5 7M8 2l3 5"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{tWind("from", { direction })}</span>
                      </span>,
                      windLabel,
                    ];
                  }
                  return [`${num.toFixed(2)} mm`, precipitationLabel];
                }}
                labelFormatter={(label, payload) => {
                  const point = payload[0]?.payload;
                  const timeLabel = formatChartTooltipLabel(label, payload, dateLocale, locale);

                  if (!point?.iconCode) return timeLabel;

                  const condition = tConditions(getConditionKey(point.iconCode));
                  return `${timeLabel} · ${getConditionEmoji(point.iconCode)} ${condition}`;
                }}
              />
              <defs>
                <linearGradient id="temperatureFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_SERIES.temperature} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART_SERIES.temperature} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Bar
                yAxisId="precip"
                dataKey="precipitation"
                name={precipitationLabel}
                fill={CHART_SERIES.precipitation}
                fillOpacity={0.9}
                radius={[3, 3, 0, 0]}
                hide={hiddenSeries.has("precipitation")}
              />
              <Area
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                fill="url(#temperatureFill)"
                stroke="none"
                legendType="none"
                tooltipType="none"
                isAnimationActive={false}
                activeDot={false}
                hide={hiddenSeries.has("temperature")}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name={temperatureLabel}
                stroke={CHART_SERIES.temperature}
                strokeWidth={2.5}
                dot={renderConditionDot}
                activeDot={{ r: 4 }}
                hide={hiddenSeries.has("temperature")}
              />
              <Line
                yAxisId="wind"
                type="monotone"
                dataKey="windSpeed"
                name={windLabel}
                stroke={CHART_SERIES.wind}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={renderWindDirectionDot}
                activeDot={{ r: 4 }}
                hide={hiddenSeries.has("windSpeed")}
              />
              <Legend
                verticalAlign="top"
                align="left"
                wrapperStyle={{
                  color: colors.legend,
                  cursor: "pointer",
                  paddingBottom: "12px",
                }}
                onClick={(entry) => toggleSeries(entry.dataKey)}
                formatter={(value, entry) => (
                  <span
                    style={{
                      color: colors.legend,
                      opacity:
                        entry.dataKey != null && hiddenSeries.has(entry.dataKey as ChartSeriesKey)
                          ? 0.45
                          : 1,
                    }}
                  >
                    {value}
                  </span>
                )}
                itemSorter={(item) => {
                  if (item.value === temperatureLabel) return 0;
                  if (item.value === precipitationLabel) return 1;
                  return 2;
                }}
              />
            </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
    </div>
  );
}
