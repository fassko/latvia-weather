"use client";

import { useTranslations } from "next-intl";
import type { WeatherWarning, WeatherWarningLevel } from "@/lib/weather/types";
import { useDismissedWarningIds } from "@/lib/weather/use-dismissed-warning-ids";
import {
  getWarningDismissKey,
  isWarningDismissed,
  setDismissedWarningIdsCookie,
  toRelevantDismissKeys,
} from "@/lib/weather/warning-dismiss-cookie";

interface WeatherWarningsClientProps {
  locale: string;
  warnings: WeatherWarning[];
  initialDismissedIds: string[];
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

export function WeatherWarningsClient({
  locale,
  warnings,
  initialDismissedIds,
}: WeatherWarningsClientProps) {
  const t = useTranslations("warnings");
  const dismissedIds = useDismissedWarningIds(initialDismissedIds);
  const dismissedSet = new Set(dismissedIds);

  if (warnings.length === 0) return null;

  function persistDismissed(ids: Iterable<string>) {
    setDismissedWarningIdsCookie(toRelevantDismissKeys(warnings, ids));
  }

  function dismissWarning(warning: WeatherWarning) {
    persistDismissed([...dismissedIds, getWarningDismissKey(warning)]);
  }

  function expandWarning(warning: WeatherWarning) {
    const key = getWarningDismissKey(warning);
    persistDismissed(
      dismissedIds.filter((id) => id !== key && id !== warning.id),
    );
  }

  return (
    <section aria-label={t("sectionLabel")} className="space-y-3">
      {warnings.map((warning) => {
        const text = locale === "lv" ? warning.textLv : warning.textEn || warning.textLv;
        const dismissed = isWarningDismissed(warning, dismissedSet);

        if (dismissed) {
          return (
            <button
              key={warning.id}
              type="button"
              onClick={() => expandWarning(warning)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left shadow-sm transition hover:brightness-[0.98] dark:hover:brightness-110 ${warningTone[warning.level]}`}
              aria-label={t("expand")}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-current dark:bg-white/10">
                <WarningIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{t("title")}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeTone[warning.level]}`}
                  >
                    {t(`levels.${warning.level}`)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium opacity-70">{t("show")}</span>
            </button>
          );
        }

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
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => dismissWarning(warning)}
                    className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                    aria-label={t("dismiss")}
                  >
                    <CloseIcon />
                  </button>
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

function WarningIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
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

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
