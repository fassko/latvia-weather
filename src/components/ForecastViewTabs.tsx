"use client";

import { useId, useState, type ReactNode } from "react";

type ForecastView = "hourly" | "detailed";

interface ForecastViewTabsProps {
  hourlyLabel: string;
  detailedLabel: string;
  ariaLabel: string;
  hourly: ReactNode;
  detailed: ReactNode;
}

export function ForecastViewTabs({
  hourlyLabel,
  detailedLabel,
  ariaLabel,
  hourly,
  detailed,
}: ForecastViewTabsProps) {
  const [view, setView] = useState<ForecastView>("hourly");
  const hourlyId = useId();
  const detailedId = useId();

  const tabs: { view: ForecastView; label: string; panelId: string }[] = [
    { view: "hourly", label: hourlyLabel, panelId: hourlyId },
    { view: "detailed", label: detailedLabel, panelId: detailedId },
  ];

  return (
    <section className="space-y-4" aria-label={ariaLabel}>
      <div
        className="grid w-full grid-cols-2 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 sm:inline-flex sm:w-auto"
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => (
          <button
            key={tab.view}
            type="button"
            role="tab"
            id={`${tab.panelId}-tab`}
            aria-controls={tab.panelId}
            aria-selected={view === tab.view}
            onClick={() => setView(tab.view)}
            className={`rounded-md px-3 py-1.5 text-center text-sm font-medium motion-reduce:transition-none transition-colors ${
              view === tab.view
                ? "bg-sky-500 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={hourlyId}
        role="tabpanel"
        aria-labelledby={`${hourlyId}-tab`}
        hidden={view !== "hourly"}
      >
        {hourly}
      </div>
      <div
        id={detailedId}
        role="tabpanel"
        aria-labelledby={`${detailedId}-tab`}
        hidden={view !== "detailed"}
      >
        {detailed}
      </div>
    </section>
  );
}
