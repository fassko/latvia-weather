"use client";

import type { MouseEvent } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/BrandMark";
import {
  setBottomBannerVisible,
  useCookieConsentDecided,
} from "@/components/CookieConsent";
import {
  APP_STORE_URL,
  buildAndroidIntentUrl,
  detectMobilePlatform,
  PLAY_STORE_URL,
  type MobilePlatform,
} from "@/lib/mobile-app";

const DISMISSED_AT_KEY = "lw_app_banner_dismissed_at";
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;
/** Queue behind the cookie banner and let the forecast paint first. */
const SHOW_DELAY_MS = 2500;
const BANNER_SOURCE = "app-install";

function wasDismissedRecently(): boolean {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  } catch {
    // Private mode can block storage; the banner then returns next visit.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function usePlatform(): MobilePlatform {
  return useSyncExternalStore(
    () => () => {},
    () => detectMobilePlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => "other",
  );
}

/**
 * Suggests the native app on phones. iOS Safari is left to the native Smart
 * App Banner (`apple-itunes-app` meta tag in the locale layout); every other mobile browser gets this card.
 */
export function AppInstallBanner() {
  const t = useTranslations("appBanner");
  const platform = usePlatform();
  const consentDecided = useCookieConsentDecided();
  const [visible, setVisible] = useState(false);

  const eligible = platform !== "other" && platform !== "ios-safari";

  useEffect(() => {
    if (!eligible || !consentDecided) return;
    if (isStandalone() || wasDismissedRecently()) return;
    const id = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [eligible, consentDecided]);

  useEffect(() => {
    setBottomBannerVisible(BANNER_SOURCE, visible);
    return () => setBottomBannerVisible(BANNER_SOURCE, false);
  }, [visible]);

  if (!visible) return null;

  const isAndroid = platform === "android-intent" || platform === "android-other";
  const storeUrl = isAndroid ? PLAY_STORE_URL : APP_STORE_URL;

  const dismiss = () => {
    rememberDismissal();
    setVisible(false);
  };

  const openApp = (event: MouseEvent<HTMLAnchorElement>) => {
    if (platform === "android-intent") {
      event.currentTarget.href = buildAndroidIntentUrl(window.location.href);
    }
    dismiss();
  };

  return (
    <section
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
      aria-label={t("region")}
      role="region"
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 1 0 1.06 1.06L10 11.06l4.72 4.72a.75.75 0 1 0 1.06-1.06L11.06 10l4.72-4.72a.75.75 0 0 0-1.06-1.06L10 8.94 5.28 4.22Z" />
          </svg>
        </button>
        <BrandMark className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("title")}
          </p>
          <p className="truncate text-xs text-slate-600 dark:text-slate-300">
            {isAndroid ? t("subtitleAndroid") : t("subtitleIos")}
          </p>
        </div>
        <a
          href={storeUrl}
          onClick={openApp}
          className="flex min-h-10 shrink-0 items-center rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
        >
          {platform === "android-intent" ? t("open") : t("get")}
        </a>
      </div>
    </section>
  );
}
