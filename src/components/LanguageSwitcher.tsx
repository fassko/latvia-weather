"use client";

import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [requestedLocale, setRequestedLocale] = useState<Locale | null>(null);

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;

    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    setRequestedLocale(nextLocale);
    startTransition(() => router.replace(href, { locale: nextLocale }));
  }

  return (
    <div
      className={`flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${
        fullWidth ? "w-full" : "w-fit"
      }`}
      role="group"
      aria-label={t("groupLabel")}
      aria-busy={isPending}
    >
      {routing.locales.map((loc) => {
        const active = locale === loc;
        const pending = isPending && requestedLocale === loc;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={active}
            aria-label={t("switchTo", { locale: t(`${loc}Name`) })}
            onClick={() => switchLocale(loc)}
            className={`inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              fullWidth ? "flex-1" : ""
            } ${
              active
                ? "bg-sky-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <span>{t(loc)}</span>
            {pending ? (
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-3 w-3 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
