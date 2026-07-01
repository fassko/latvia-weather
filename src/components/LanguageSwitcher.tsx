"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export function LanguageSwitcher() {
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
      className="flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-pressed={locale === loc}
          aria-label={t("switchTo", { locale: t(loc) })}
          onClick={() => switchLocale(loc)}
          className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            locale === loc
              ? "bg-sky-500 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  );
}
