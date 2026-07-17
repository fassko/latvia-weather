export const THEME_STORAGE_KEY = "latvia-theme";
export const THEME_CHANGE_EVENT = "latvia-theme-change";

/** Resolved visual appearance applied to the document. */
export type Theme = "light" | "dark";

/** User preference: explicit theme or follow the OS (iOS/Android/system). */
export type ThemePreference = Theme | "system";

export function getStoredPreference(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : null;
}

export function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveThemeFrom(
  preference: ThemePreference,
  prefersDark: boolean,
): Theme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

export function getThemePreference(): ThemePreference {
  return getStoredPreference() ?? "system";
}

export function resolveTheme(
  preference: ThemePreference = getThemePreference(),
): Theme {
  return resolveThemeFrom(
    preference,
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
}

/** Apply the resolved theme class to `<html>` without changing storage. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Persist preference and apply the resolved appearance. */
export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyTheme(resolveTheme(preference));
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function getActiveTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Re-apply the current preference to `<html>` (e.g. after navigation). */
export function syncTheme(): void {
  applyTheme(resolveTheme());
}

/**
 * When preference is "system", keep the document in sync with OS appearance
 * changes (iOS/Android Settings → Display).
 */
export function subscribeToSystemTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const onChange = () => {
    if (getThemePreference() !== "system") return;
    applyTheme(media.matches ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
