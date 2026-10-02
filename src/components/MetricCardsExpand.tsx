"use client";

import { useState, type ReactNode } from "react";

interface MetricCardsExpandProps {
  primary: ReactNode;
  secondary: ReactNode;
  moreLabel: string;
  fewerLabel: string;
}

/** Mobile: show primary metric cards; reveal the rest behind a disclosure. Desktop: all cards. */
export function MetricCardsExpand({
  primary,
  secondary,
  moreLabel,
  fewerLabel,
}: MetricCardsExpandProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {primary}
        <div className={expanded ? "contents" : "hidden sm:contents"}>{secondary}</div>
      </div>
      <button
        type="button"
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-50 sm:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:border-sky-600 dark:hover:bg-slate-800"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? fewerLabel : moreLabel}
      </button>
    </div>
  );
}
