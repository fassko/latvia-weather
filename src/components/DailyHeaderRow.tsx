"use client";

import { format, isWeekend } from "date-fns";
import type { KeyboardEvent } from "react";
import { getConditionEmoji, getWindDirection } from "@/lib/weather/parse";
import type { DailySummary } from "@/lib/weather/daily";

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

function formatPrecipSummary(summary: DailySummary): string {
  if (summary.totalPrecipitation > 0) {
    return `${summary.totalPrecipitation.toFixed(1)} mm total`;
  }

  return `Up to ${Math.round(summary.maxPrecipitationProbability)}%`;
}

function dayLabelClassName(date: Date): string {
  return `whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wide${
    isWeekend(date) ? ` ${weekendDateClassName}` : ""
  }`;
}

export function DailyHeaderRow({
  date,
  summary,
  variant,
  expanded,
  onToggle,
}: DailyHeaderRowProps) {
  const label = format(date, "EEEE, MMMM d");
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
        "aria-label": `${expanded ? "Collapse" : "Expand"} ${variant} forecast for ${label}`,
      }
    : {};

  if (variant === "hourly") {
    return (
      <tr className={rowClassName} {...rowProps}>
        <td className={dayLabelClassName(date)} {...toggleCellProps}>
          {format(date, "EEEE, MMMM d")}
        </td>
        <td className="px-4 py-2" {...toggleCellProps}>
          <span aria-hidden="true">{getConditionEmoji(summary.representativeIconCode)}</span>
        </td>
        <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
          {formatRange(summary.minTemperature, summary.maxTemperature, "°C")}
        </td>
        <td
          className="px-4 py-2 text-sm font-semibold tabular-nums text-sky-800 dark:text-sky-300"
          {...toggleCellProps}
        >
          {formatPrecipSummary(summary)}
        </td>
      </tr>
    );
  }

  return (
    <tr className={rowClassName} {...rowProps}>
      <td className={dayLabelClassName(date)} {...toggleCellProps}>
        {format(date, "EEEE, MMMM d")}
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        {formatRange(summary.minTemperature, summary.maxTemperature, "°C")}
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        {formatRange(summary.minFeelsLike, summary.maxFeelsLike, "°C")}
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        {summary.totalPrecipitation.toFixed(1)} mm
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        Up to {Math.round(summary.maxPrecipitationProbability)}%
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        Avg {Math.round(summary.avgHumidity)}%
      </td>
      <td
        className="whitespace-nowrap px-4 py-2 text-sm font-semibold tabular-nums"
        {...toggleCellProps}
      >
        Up to {summary.maxWindSpeed.toFixed(1)} m/s{" "}
        {getWindDirection(summary.windDirectionAtMaxWind)}
      </td>
      <td className="px-4 py-2 text-sm font-semibold tabular-nums" {...toggleCellProps}>
        Avg {summary.avgPressure.toFixed(1)} hPa
      </td>
    </tr>
  );
}
