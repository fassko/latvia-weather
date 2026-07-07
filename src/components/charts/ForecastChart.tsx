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
  type ChartPoint,
  getDaySegments,
  getHourTicks,
  getTodayForecasts,
  sumPrecipitation,
  toChartPoints,
} from "@/lib/weather/chart-data";
import { getConditionEmoji, getConditionKey, getWindDirection } from "@/lib/weather/parse";
import type { HourlyForecast } from "@/lib/weather/types";

type ForecastPeriod = 1 | 3 | 7;
type ChartSeriesKey = "temperature" | "precipitation" | "windSpeed";

const CHART_MARGIN = { top: 28, right: 4, left: 0, bottom: 4 };

interface ForecastChartProps {
  forecasts: HourlyForecast[];
}

interface ConditionDotProps {
  cx?: number | string;
  cy?: number | string;
  index?: number;
  payload?: ChartPoint;
}

function getForecastsForPeriod(forecasts: HourlyForecast[], period: ForecastPeriod) {
  if (period === 1) return getTodayForecasts(forecasts);
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

function isSvgCoordinate(value: number | string | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getTodayRainPoint(data: ChartPoint[]): ChartPoint | null {
  if (data.length === 0) return null;

  const wettestByAmount = data.reduce((best, point) =>
    point.precipitation > best.precipitation ? point : best,
  );

  if (wettestByAmount.precipitation > 0) return wettestByAmount;

  const wettestByChance = data.reduce((best, point) =>
    point.precipitationProbability > best.precipitationProbability ? point : best,
  );

  return wettestByChance.precipitationProbability > 0 ? wettestByChance : null;
}

function isChartSeriesKey(value: unknown): value is ChartSeriesKey {
  return value === "temperature" || value === "precipitation" || value === "windSpeed";
}

export function ForecastChart({ forecasts }: ForecastChartProps) {
  const locale = useLocale();
  const t = useTranslations("chart");
  const tConditions = useTranslations("conditions");
  const tWind = useTranslations("wind");
  const dateLocale = getDateFnsLocale(locale);
  const [period, setPeriod] = useState<ForecastPeriod>(1);
  const [hiddenSeries, setHiddenSeries] = useState<Set<ChartSeriesKey>>(() => new Set());
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
  const conditionIconIndexes = useMemo(
    () => getConditionIconIndexes(data, period),
    [data, period],
  );
  const todayRainPoint = useMemo(
    () => (period === 1 ? getTodayRainPoint(data) : null),
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

  const isMultiDay = period > 1;
  const temperatureLabel = t("temperature");
  const precipitationLabel = t("precipitation");
  const windLabel = t("wind");
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

    return (
      <g transform={`translate(${cx}, ${cy - 18})`} pointerEvents="none">
        <title>{condition}</title>
        <text
          y={4}
          textAnchor="middle"
          fontSize={16}
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
    return (
      <g
        transform={`translate(${cx}, ${cy + 20}) rotate(${payload.windDirection + 180})`}
        pointerEvents="none"
      >
        <title>{tWind("from", { direction })}</title>
        <text
          y={5}
          textAnchor="middle"
          fontSize={18}
          fontWeight={800}
          fill="#047857"
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
            {todayRainPoint ? (
              <span className="block">
                {todayRainPoint.precipitation > 0
                  ? t("rainPeak", {
                      time: format(new Date(todayRainPoint.time), "HH:mm"),
                      amount: todayRainPoint.precipitation.toFixed(1),
                      chance: Math.round(todayRainPoint.precipitationProbability),
                    })
                  : t("rainChancePeak", {
                      time: format(new Date(todayRainPoint.time), "HH:mm"),
                      chance: Math.round(todayRainPoint.precipitationProbability),
                    })}
              </span>
            ) : period === 1 ? (
              <span className="block">{t("noRainExpected")}</span>
            ) : null}
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
              <YAxis
                yAxisId="wind"
                orientation="right"
                tick={{ fontSize: 11, fill: colors.tick }}
                unit=" m/s"
                width="auto"
                tickCount={6}
                tickMargin={6}
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
                    if (point == null) return [`${num.toFixed(1)} m/s`, windLabel];

                    const direction = getWindDirection(point.windDirection);

                    return [
                      <span
                        key="wind-tooltip"
                        className="inline-flex items-center gap-1"
                      >
                        <span>{num.toFixed(1)} m/s</span>
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
              <Bar
                yAxisId="precip"
                dataKey="precipitation"
                name={precipitationLabel}
                fill="#38bdf8"
                fillOpacity={0.7}
                radius={[2, 2, 0, 0]}
                hide={hiddenSeries.has("precipitation")}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name={temperatureLabel}
                stroke="#f97316"
                strokeWidth={2}
                dot={renderConditionDot}
                activeDot={{ r: 4 }}
                hide={hiddenSeries.has("temperature")}
              />
              <Line
                yAxisId="wind"
                type="monotone"
                dataKey="windSpeed"
                name={windLabel}
                stroke="#10b981"
                strokeWidth={2}
                dot={renderWindDirectionDot}
                activeDot={{ r: 4 }}
                hide={hiddenSeries.has("windSpeed")}
              />
              <Legend
                wrapperStyle={{ color: colors.legend, cursor: "pointer" }}
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
      </ChartCard>
    </section>
  );
}
