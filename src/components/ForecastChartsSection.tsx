"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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

/** Mount Recharts only when the section nears the viewport (or after idle). */
export function ForecastChartsSection({
  forecasts,
  sunTimesByDay,
  sunLabels,
}: ForecastChartsSectionProps) {
  const t = useTranslations("chart");
  const sectionRef = useRef<HTMLElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    const node = sectionRef.current;
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    let observer: IntersectionObserver | undefined;

    const enable = () => setShouldLoad(true);

    if (node && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            enable();
          }
        },
        { rootMargin: "200px 0px" },
      );
      observer.observe(node);
    }

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(enable, { timeout: 8000 });
    } else {
      timeoutId = window.setTimeout(enable, 5000);
    }

    return () => {
      observer?.disconnect();
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [shouldLoad]);

  return (
    <section
      ref={sectionRef}
      aria-label={t("title")}
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      {shouldLoad ? (
        <ForecastChart
          forecasts={forecasts}
          sunTimesByDay={sunTimesByDay}
          sunLabels={sunLabels}
        />
      ) : (
        <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 md:h-[400px]" />
      )}
    </section>
  );
}
