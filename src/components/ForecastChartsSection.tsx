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

const MD_UP_QUERY = "(min-width: 768px)";

/** Mount Recharts only when expanded and near the viewport (or after idle). */
export function ForecastChartsSection({
  forecasts,
  sunTimesByDay,
  sunLabels,
}: ForecastChartsSectionProps) {
  const t = useTranslations("chart");
  const sectionRef = useRef<HTMLElement>(null);
  const [mdUp, setMdUp] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(false);

  const expanded = mdUp || mobileExpanded;

  useEffect(() => {
    const media = window.matchMedia(MD_UP_QUERY);
    const sync = () => setMdUp(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!expanded || shouldLoad) return;

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
  }, [expanded, shouldLoad]);

  return (
    <section
      ref={sectionRef}
      aria-label={t("title")}
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 md:hidden">
        <button
          type="button"
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-sky-300 dark:hover:border-sky-600"
          aria-expanded={mobileExpanded}
          onClick={() => setMobileExpanded((value) => !value)}
        >
          {mobileExpanded ? t("hideChart") : t("showChart")}
        </button>
      </div>

      {expanded ? (
        shouldLoad ? (
          <ForecastChart
            forecasts={forecasts}
            sunTimesByDay={sunTimesByDay}
            sunLabels={sunLabels}
          />
        ) : (
          <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 md:h-[400px]" />
        )
      ) : null}
    </section>
  );
}
