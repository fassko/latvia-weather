"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const CONSENT_COOKIE = "lw_cookie_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;
const OPEN_SETTINGS_EVENT = "lw-open-cookie-settings";

type Consent = { analytics: boolean };

function parseConsent(cookie: string): Consent | null {
  const match = cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;

  try {
    const value = JSON.parse(decodeURIComponent(match[1])) as Partial<Consent>;
    return typeof value.analytics === "boolean" ? { analytics: value.analytics } : null;
  } catch {
    return null;
  }
}

function saveConsent(consent: Consent) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))};path=/;max-age=${CONSENT_MAX_AGE};SameSite=Lax;Secure`;
  window.dispatchEvent(new Event("lw-cookie-consent-changed"));
}

/** True only after client hydration so we do not flash the banner before cookies are readable. */
function useHasHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Runs optional measurement only after an affirmative, granular choice. */
export function CookieConsent() {
  const t = useTranslations("cookies");
  const hasHydrated = useHasHydrated();
  const cookieSnapshot = useSyncExternalStore(
    (notify) => {
      window.addEventListener("lw-cookie-consent-changed", notify);
      return () => window.removeEventListener("lw-cookie-consent-changed", notify);
    },
    () => document.cookie,
    () => "",
  );
  const consent = useMemo(() => parseConsent(cookieSnapshot), [cookieSnapshot]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [Analytics, setAnalyticsComponent] = useState<ComponentType | null>(null);
  const [SpeedInsights, setSpeedInsightsComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    const openSettings = () => {
      setAnalytics(consent?.analytics ?? false);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, [consent]);

  useEffect(() => {
    if (!consent?.analytics) return;
    void import("@vercel/analytics/react").then(({ Analytics: Component }) =>
      setAnalyticsComponent(() => Component),
    );
    void import("@vercel/speed-insights/next").then(({ SpeedInsights: Component }) =>
      setSpeedInsightsComponent(() => Component),
    );
  }, [consent?.analytics]);

  const choose = (next: Consent) => {
    saveConsent(next);
    setAnalytics(next.analytics);
    setSettingsOpen(false);
  };

  return (
    <>
      {Analytics ? <Analytics /> : null}
      {SpeedInsights ? <SpeedInsights /> : null}
      {hasHydrated && consent === null ? (
        <section
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-5"
          aria-label={t("title")}
          role="dialog"
          aria-modal="true"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {t("description")} {" "}
            <Link href="/privacy" className="font-medium underline underline-offset-2">
              {t("privacyLink")}
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => choose({ analytics: true })} className="rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-800">
              {t("acceptAll")}
            </button>
            <button onClick={() => choose({ analytics: false })} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
              {t("rejectOptional")}
            </button>
            <button onClick={() => { setAnalytics(false); setSettingsOpen(true); }} className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 underline hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
              {t("manage")}
            </button>
          </div>
        </section>
      ) : null}

      {settingsOpen ? (
        <section className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[51] mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" aria-label={t("settingsTitle")} role="dialog" aria-modal="true">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("settingsTitle")}</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{t("necessaryTitle")}</p>
              <p className="mt-1 leading-5 text-slate-600 dark:text-slate-300">{t("necessaryDescription")}</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 h-4 w-4 accent-sky-700" />
              <span><span className="block font-medium text-slate-900 dark:text-slate-100">{t("analyticsTitle")}</span><span className="mt-1 block leading-5 text-slate-600 dark:text-slate-300">{t("analyticsDescription")}</span></span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => choose({ analytics })} className="rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-800">{t("save")}</button>
            <button onClick={() => setSettingsOpen(false)} className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t("cancel")}</button>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
