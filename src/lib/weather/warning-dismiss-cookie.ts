export const WARNING_DISMISS_COOKIE_NAME = "weather-warnings-dismissed";
export const WARNING_DISMISS_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

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

export function setDismissedWarningIdsCookie(ids: string[]): void {
  const value = serializeDismissedWarningIds(ids);
  document.cookie = `${WARNING_DISMISS_COOKIE_NAME}=${encodeURIComponent(value)};path=/;max-age=${WARNING_DISMISS_COOKIE_MAX_AGE};SameSite=Lax`;
}
