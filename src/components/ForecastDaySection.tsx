"use client";

import { format } from "date-fns";
import { useState, type ReactNode } from "react";
import { DailyHeaderRow } from "@/components/DailyHeaderRow";
import type { DailySummary } from "@/lib/weather/daily";

interface ForecastDaySectionProps {
  date: Date;
  summary: DailySummary;
  variant: "hourly" | "detailed";
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function ForecastDaySection({
  date,
  summary,
  variant,
  defaultExpanded = false,
  children,
}: ForecastDaySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <>
      <DailyHeaderRow
        date={date}
        summary={summary}
        variant={variant}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      {expanded ? children : null}
    </>
  );
}
