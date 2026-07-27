"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { WeatherLocationPoint } from "@/lib/weather/types";

const WeatherMap = dynamic(
  () => import("@/components/WeatherMap").then((mod) => mod.WeatherMap),
  {
    ssr: false,
    loading: () => <WeatherMapSkeleton />,
  },
);

interface WeatherMapSectionProps {
  locations: WeatherLocationPoint[];
  locale: string;
  selectedId?: string;
  focusLocationId?: string;
}

function WeatherMapSkeleton() {
  const t = useTranslations("map");

  return (
    <div
      className="flex h-full min-h-[28rem] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      role="status"
    >
      {t("loading")}
    </div>
  );
}

export function WeatherMapSection({
  locations,
  locale,
  selectedId,
  focusLocationId,
}: WeatherMapSectionProps) {
  return (
    <div className="h-[min(70vh,44rem)] min-h-[28rem] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800">
      <WeatherMap
        locations={locations}
        locale={locale}
        selectedId={selectedId}
        focusLocationId={focusLocationId}
      />
    </div>
  );
}
