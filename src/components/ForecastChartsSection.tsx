"use client";

import dynamic from "next/dynamic";
import type { HourlyForecast } from "@/lib/weather/types";

const ForecastChart = dynamic(
  () => import("@/components/charts/ForecastChart").then((mod) => mod.ForecastChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800 md:h-[400px]" />
    ),
  },
);

interface ForecastChartsSectionProps {
  forecasts: HourlyForecast[];
}

export function ForecastChartsSection({ forecasts }: ForecastChartsSectionProps) {
  return <ForecastChart forecasts={forecasts} />;
}
