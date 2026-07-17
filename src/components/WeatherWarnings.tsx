import { getTranslations } from "next-intl/server";
import type { WeatherWarning, WeatherWarningLevel } from "@/lib/weather/types";

interface WeatherWarningsProps {
  locale: string;
  warnings: WeatherWarning[];
}

const warningTone: Record<WeatherWarningLevel, string> = {
  yellow:
    "border-yellow-200 bg-yellow-50 text-yellow-950 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-100",
  orange:
    "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-100",
  red:
    "border-red-200 bg-red-50 text-red-950 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100",
  unknown:
    "border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
};

const badgeTone: Record<WeatherWarningLevel, string> = {
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-300/20 dark:text-yellow-100",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-300/20 dark:text-orange-100",
  red: "bg-red-100 text-red-800 dark:bg-red-300/20 dark:text-red-100",
  unknown: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export async function WeatherWarnings({ locale, warnings }: WeatherWarningsProps) {
  const t = await getTranslations("warnings");

  if (warnings.length === 0) return null;

  return (
    <section aria-label={t("sectionLabel")} className="space-y-3">
      {warnings.map((warning) => {
        const text = locale === "lv" ? warning.textLv : warning.textEn || warning.textLv;

        return (
          <article
            key={warning.id}
            className={`rounded-2xl border p-4 shadow-sm ${warningTone[warning.level]}`}
          >
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-current dark:bg-white/10">
                <WarningIcon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold">{t("title")}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeTone[warning.level]}`}
                  >
                    {t(`levels.${warning.level}`)}
                  </span>
                  {warning.isStale ? (
                    <span className="text-xs font-medium opacity-75">{t("stale")}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-6">{text}</p>
                <p className="mt-2 text-xs opacity-75">
                  {t("source")} LVĢMC
                  {warning.regions.length > 0
                    ? ` · ${t("regions", { count: warning.regions.length })}`
                    : ""}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.9 2.7 17.1A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}
