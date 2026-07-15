"use client";

import { useEffect, useState, type ReactNode } from "react";

export const WEEKEND_TICK_COLOR = "#dc2626";

export const CHART_COLORS = {
  light: {
    grid: "#e2e8f0",
    tick: "#64748b",
    dayDivider: "#cbd5e1",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    legend: "#334155",
  },
  dark: {
    grid: "#475569",
    tick: "#94a3b8",
    dayDivider: "#475569",
    tooltipBg: "#1e293b",
    tooltipBorder: "#475569",
    legend: "#cbd5e1",
  },
} as const;

export function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function useChartColors() {
  const isDark = useIsDark();
  return isDark ? CHART_COLORS.dark : CHART_COLORS.light;
}

interface ChartCardProps {
  children: ReactNode;
  className?: string;
}

export function ChartCard({ children, className = "" }: ChartCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white px-2 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}
