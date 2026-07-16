import { getTranslations } from "next-intl/server";
import { HourlyStrip } from "@/components/HourlyStrip";
import type { HourlyForecast } from "@/lib/weather/types";

interface HourlyStripCardProps {
  forecasts: HourlyForecast[];
}

export async function HourlyStripCard({ forecasts }: HourlyStripCardProps) {
  const t = await getTranslations("hourly");

  return (
    <section
      aria-labelledby="hourly-strip-heading"
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="hourly-strip-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        {t("title")}
      </h2>
      <HourlyStrip forecasts={forecasts} />
    </section>
  );
}
