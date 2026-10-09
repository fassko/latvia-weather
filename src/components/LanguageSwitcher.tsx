"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

interface LanguageSwitcherProps {
  /** Stretch evenly across the parent (e.g. mobile overflow menu). */
  fullWidth?: boolean;
}

export function LanguageSwitcher({ fullWidth = false }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("language");

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;

    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { locale: nextLocale });
  }

  return (
    <div
      className={`flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${
        fullWidth ? "w-full" : "w-fit"
      }`}
      role="group"
      aria-label={t("groupLabel")}
    >
      {routing.locales.map((loc) => {
        const active = locale === loc;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={active}
            aria-label={t("switchTo", { locale: t(`${loc}Name`) })}
            onClick={() => switchLocale(loc)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              fullWidth ? "flex-1" : ""
            } ${
              active
                ? "bg-sky-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {loc === "lv" ? <LatviaFlag /> : <UkFlag />}
            <span>{t(loc)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Simplified Latvia flag — crimson / white / crimson. */
function LatviaFlag() {
  return (
    <svg
      viewBox="0 0 21 15"
      className="h-3 w-[1.05rem] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/15 dark:ring-white/20"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="21" height="15" fill="#9E3039" />
      <rect y="6" width="21" height="3" fill="#FFF" />
    </svg>
  );
}

/** Simplified UK flag for English — not relied on alone (label beside it). */
function UkFlag() {
  return (
    <svg
      viewBox="0 0 60 30"
      className="h-3 w-[1.05rem] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/15 dark:ring-white/20"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0 60 30M60 0 0 30" stroke="#FFF" strokeWidth="6" />
      <path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30 0v30M0 15h60" stroke="#FFF" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
