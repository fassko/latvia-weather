export const LOCATION_COOKIE_NAME = "weather-punkts";
export const LOCATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function setLocationCookie(punkts: string): void {
  document.cookie = `${LOCATION_COOKIE_NAME}=${encodeURIComponent(punkts)};path=/;max-age=${LOCATION_COOKIE_MAX_AGE};SameSite=Lax`;
}
