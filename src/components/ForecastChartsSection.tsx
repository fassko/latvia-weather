"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { SunTimesByDay } from "@/lib/weather/sun";
import type { HourlyForecast } from "@/lib/weather/types";

const ForecastChart = dynamic(
  () => import("@/components/charts/ForecastChart").then((mod) => mod.ForecastChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 md:h-[400px]" />
    ),
  },
);

interface ForecastChartsSectionProps {
  forecasts: HourlyForecast[];
  sunTimesByDay: SunTimesByDay;
  sunLabels: {
    sunrise: string;
    sunset: string;
  };
}

export function ForecastChartsSection({
  forecasts,
  sunTimesByDay,
  sunLabels,
}: ForecastChartsSectionProps) {
  const t = useTranslations("chart");

  return (
    <section
      aria-label={t("title")}
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <ForecastChart
        forecasts={forecasts}
        sunTimesByDay={sunTimesByDay}
        sunLabels={sunLabels}
      />
    </section>
  );
}
