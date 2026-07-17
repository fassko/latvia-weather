import type { WeatherWarning } from "./types";

export const WARNING_DISMISS_COOKIE_NAME = "weather-warnings-dismissed";
export const WARNING_DISMISS_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;
export const WARNING_DISMISS_CHANGE_EVENT = "latvia-weather-warning-dismiss-change";

/** Stable key so dismissals survive LVĢMC reissuing the same advisory under a new id. */
export function getWarningDismissKey(
  warning: Pick<WeatherWarning, "id" | "level" | "type" | "textLv">,
): string {
  return `${warning.level}:${warning.type}:${hashText(warning.textLv)}`;
}

export function parseDismissedWarningIds(value: string | undefined): string[] {
  if (!value) return [];

  try {
    const decoded = decodeURIComponent(value);
    return decoded
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function serializeDismissedWarningIds(ids: string[]): string {
  return [...new Set(ids)].join(",");
}

export function getDismissedWarningIdsFromDocument(): string[] {
  if (typeof document === "undefined") return [];

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${WARNING_DISMISS_COOKIE_NAME}=([^;]*)`),
  );
  if (!match?.[1]) return [];

  try {
    return parseDismissedWarningIds(decodeURIComponent(match[1]));
  } catch {
    return parseDismissedWarningIds(match[1]);
  }
}

export function setDismissedWarningIdsCookie(ids: string[]): void {
  const value = serializeDismissedWarningIds(ids);
  document.cookie = `${WARNING_DISMISS_COOKIE_NAME}=${encodeURIComponent(value)};path=/;max-age=${WARNING_DISMISS_COOKIE_MAX_AGE};SameSite=Lax`;
  window.dispatchEvent(new Event(WARNING_DISMISS_CHANGE_EVENT));
}

export function isWarningDismissed(
  warning: Pick<WeatherWarning, "id" | "level" | "type" | "textLv">,
  dismissedKeys: ReadonlySet<string>,
): boolean {
  return (
    dismissedKeys.has(getWarningDismissKey(warning)) ||
    dismissedKeys.has(warning.id)
  );
}

export function toRelevantDismissKeys(
  warnings: Array<Pick<WeatherWarning, "id" | "level" | "type" | "textLv">>,
  keys: Iterable<string>,
): string[] {
  const dismissed = new Set(keys);
  const relevant: string[] = [];

  for (const warning of warnings) {
    const key = getWarningDismissKey(warning);
    if (dismissed.has(key) || dismissed.has(warning.id)) {
      relevant.push(key);
    }
  }

  return [...new Set(relevant)];
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
