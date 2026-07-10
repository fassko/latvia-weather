"use client";

import { format, isWeekend } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { WindDirection } from "@/components/WindDirection";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import { ConditionEmoji } from "@/components/ConditionEmoji";
import { METRIC_TEXT_CLASS_NAMES } from "@/lib/weather/metric-styles";
import type { DailySummary } from "@/lib/weather/daily";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import { useWindUnit } from "@/lib/weather/use-wind-unit";

const headerRowClassName =
  "border-t-2 border-sky-300 bg-sky-100 text-sky-900 transition-colors duration-150 hover:bg-sky-300 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-800";

const weekendDateClassName = "text-red-600 dark:text-red-400";

interface DailyHeaderRowProps {
  date: Date;
  summary: DailySummary;
  variant: "hourly" | "detailed";
  expanded?: boolean;
  onToggle?: () => void;
}

function formatRange(min: number, max: number, unit: string): string {
  if (Math.round(min) === Math.round(max)) {
    return `${Math.round(min)}${unit}`;
  }

  return `${Math.round(min)}${unit} – ${Math.round(max)}${unit}`;
}

function dayLabelClassName(date: Date): string {
  return `whitespace-nowrap px-2 py-2 text-xs font-semibold uppercase tracking-wide sm:px-4${
    isWeekend(date) ? ` ${weekendDateClassName}` : ""
  }`;
}

function ExpandArrow({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 motion-reduce:transition-none transition-transform duration-150 ${
        expanded ? "rotate-90" : ""
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DayLabelCell({
  date,
  compact,
  expanded,
  showArrow,
  dateLocale,
  locale,
}: {
  date: Date;
  compact?: boolean;
  expanded?: boolean;
  showArrow: boolean;
  dateLocale: ReturnType<typeof getDateFnsLocale>;
  locale: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {showArrow ? <ExpandArrow expanded={expanded ?? false} /> : null}
      {compact ? (
        <>
          <span className="sm:hidden">
            {format(date, getDatePattern(locale, "shortDate"), { locale: dateLocale })}
          </span>
          <span className="hidden sm:inline">
            {format(date, getDatePattern(locale, "longDate"), { locale: dateLocale })}
          </span>
        </>
      ) : (
        format(date, getDatePattern(locale, "longDate"), { locale: dateLocale })
      )}
    </span>
  );
}

export function DailyHeaderRow({
  date,
  summary,
  variant,
  expanded,
  onToggle,
}: DailyHeaderRowProps) {
  const locale = useLocale();
  const t = useTranslations("daily");
  const dateLocale = getDateFnsLocale(locale);
  const windUnit = useWindUnit();
  const label = format(date, getDatePattern(locale, "longDate"), { locale: dateLocale });
  const rowClassName = onToggle
    ? `${headerRowClassName} cursor-pointer`
    : headerRowClassName;
  const toggleCellProps = onToggle ? { onClick: onToggle } : {};
  const rowProps = onToggle
    ? {
        onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        },
        tabIndex: 0,
        role: "button" as const,
        "aria-expanded": expanded,
        "aria-label": `${expanded ? t("collapse") : t("expand")} ${
          variant === "hourly"
            ? t("hourlyForecastFor", { date: label })
            : t("detailedForecastFor", { date: label })
        }`,
      }
    : {};

  function formatPrecipSummary(): string {
    if (summary.totalPrecipitation > 0) {
      return t("mmTotal", { value: summary.totalPrecipitation.toFixed(1) });
    }

    return t("upToPercent", { value: Math.round(summary.maxPrecipitationProbability) });
  }

  if (variant === "hourly") {
    return (
      <tr className={rowClassName} {...rowProps}>
        <td className={dayLabelClassName(date)} {...toggleCellProps}>
          <DayLabelCell
            date={date}
            compact
            expanded={expanded}
            showArrow={Boolean(onToggle)}
            dateLocale={dateLocale}
            locale={locale}
          />
        </td>
        <td className="px-2 py-2 sm:px-4" {...toggleCellProps}>
          <ConditionEmoji iconCode={summary.representativeIconCode} />
        </td>
        <td
          className={`px-2 py-2 text-sm font-semibold tabular-nums sm:px-4 ${METRIC_TEXT_CLASS_NAMES.temperature}`}
          {...toggleCellProps}
        >
          {formatRange(summary.minTemperature, summary.maxTemperature, "°C")}
        </td>
        <td
          className={`px-2 py-2 text-sm font-semibold tabular-nums sm:px-4 ${METRIC_TEXT_CLASS_NAMES.precipitationStrong}`}
          {...toggleCellProps}
        >
          {formatPrecipSummary()}
        </td>
        <td
          className={`whitespace-nowrap px-2 py-2 text-sm font-semibold tabular-nums sm:px-4 ${METRIC_TEXT_CLASS_NAMES.windStrong}`}
          {...toggleCellProps}
        >
          {t("upToWind", { speed: formatWindSpeed(summary.maxWindSpeed, windUnit) })}{" "}
          <WindDirection degrees={summary.windDirectionAtMaxWind} size="sm" />
        </td>
      </tr>
    );
  }

  return (
    <tr className={rowClassName} {...rowProps}>
      <td className={dayLabelClassName(date)} {...toggleCellProps}>
        <DayLabelCell
          date={date}
          compact
          expanded={expanded}
          showArrow={Boolean(onToggle)}
          dateLocale={dateLocale}
          locale={locale}
        />
      </td>
      <td
        className={`px-4 py-2 text-sm font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.temperature}`}
        {...toggleCellProps}
      >
        {formatRange(summary.minTemperature, summary.maxTemperature, "°C")}
      </td>
      <td
        className={`px-4 py-2 text-sm font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.temperature}`}
        {...toggleCellProps}
      >
        {formatRange(summary.minFeelsLike, summary.maxFeelsLike, "°C")}
      </td>
      <td
        className={`px-4 py-2 text-sm font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.precipitationStrong}`}
        {...toggleCellProps}
      >
        {summary.totalPrecipitation.toFixed(1)} mm
      </td>
      <td
        className={`px-4 py-2 text-sm font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.precipitationStrong}`}
        {...toggleCellProps}
      >
        {t("upToPercent", { value: Math.round(summary.maxPrecipitationProbability) })}
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        {t("avgHumidity", { value: Math.round(summary.avgHumidity) })}
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        {t("avgCloudCover", { value: Math.round(summary.avgCloudCover) })}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-2 text-sm font-semibold tabular-nums ${METRIC_TEXT_CLASS_NAMES.windStrong}`}
        {...toggleCellProps}
      >
        {t("upToWind", { speed: formatWindSpeed(summary.maxWindSpeed, windUnit) })}{" "}
        <WindDirection degrees={summary.windDirectionAtMaxWind} size="sm" />
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        {t("avgPressure", { value: summary.avgPressure.toFixed(1) })}
      </td>
    </tr>
  );
}
