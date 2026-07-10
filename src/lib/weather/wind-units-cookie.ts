import {
  WIND_UNITS_COOKIE_MAX_AGE,
  WIND_UNITS_COOKIE_NAME,
  type WindUnit,
} from "./wind-units";

export const WIND_UNIT_CHANGE_EVENT = "latvia-weather-wind-unit-change";

export function setWindUnitsCookie(unit: WindUnit): void {
  document.cookie = `${WIND_UNITS_COOKIE_NAME}=${encodeURIComponent(unit)};path=/;max-age=${WIND_UNITS_COOKIE_MAX_AGE};SameSite=Lax`;
  window.dispatchEvent(new Event(WIND_UNIT_CHANGE_EVENT));
}

