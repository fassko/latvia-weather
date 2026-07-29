"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setWindUnitsCookie } from "@/lib/weather/wind-units-cookie";
import { toggleWindUnit, type WindUnit } from "@/lib/weather/wind-units";
import { useWindUnit } from "@/lib/weather/use-wind-unit";

export function WindUnitsToggle() {
  const router = useRouter();
  const t = useTranslations("windUnits");
  const unit = useWindUnit();

  function handleToggle() {
    const nextUnit: WindUnit = toggleWindUnit(unit);
    setWindUnitsCookie(nextUnit);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={unit === "ms" ? t("switchToKmh") : t("switchToMs")}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {unit === "ms" ? "m/s" : "km/h"}
    </button>
  );
}
