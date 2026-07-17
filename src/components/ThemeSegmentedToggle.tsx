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

const options: {
  value: ThemePreference;
  labelKey: "light" | "dark" | "system";
}[] = [
  { value: "system", labelKey: "system" },
  { value: "light", labelKey: "light" },
  { value: "dark", labelKey: "dark" },
];

export function ThemeSegmentedToggle() {
  const t = useTranslations("theme");
  const preference = useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  );

  function selectTheme(next: ThemePreference) {
    if (next === preference) return;
    setThemePreference(next);
  }

  return (
    <div
      className="flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      role="group"
      aria-label={t("groupLabel")}
    >
      {options.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={
              option.value === "system"
                ? t("switchToSystem")
                : option.value === "light"
                  ? t("switchToLight")
                  : t("switchToDark")
            }
            onClick={() => selectTheme(option.value)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
              active
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {option.value === "system" ? (
              <SystemIcon />
            ) : option.value === "light" ? (
              <SunIcon />
            ) : (
              <MoonIcon />
            )}
            <span className="hidden sm:inline">{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
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
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
