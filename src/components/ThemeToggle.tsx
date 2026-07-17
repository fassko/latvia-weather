"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import {
  THEME_CHANGE_EVENT,
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  return getThemePreference();
}

function getServerPreferenceSnapshot(): ThemePreference {
  return "system";
}

const CYCLE: ThemePreference[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const t = useTranslations("theme");
  const preference = useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  );

  function cycleTheme() {
    const index = CYCLE.indexOf(preference);
    const next = CYCLE[(index + 1) % CYCLE.length];
    setThemePreference(next);
  }

  const label =
    preference === "system"
      ? t("switchToLight")
      : preference === "light"
        ? t("switchToDark")
        : t("switchToSystem");

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={t(preference)}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {preference === "system" ? (
        <SystemIcon />
      ) : preference === "dark" ? (
        <MoonIcon />
      ) : (
        <SunIcon />
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
