"use client";

import { useSyncExternalStore } from "react";
import { WIND_UNIT_CHANGE_EVENT } from "./wind-units-cookie";
import {
  WIND_UNITS_COOKIE_NAME,
  parseWindUnit,
  type WindUnit,
} from "./wind-units";

function readWindUnitFromCookie(): WindUnit {
  if (typeof document === "undefined") return "ms";

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${WIND_UNITS_COOKIE_NAME}=([^;]*)`),
  );
  return parseWindUnit(match?.[1] ? decodeURIComponent(match[1]) : undefined);
}

function subscribeToWindUnit(callback: () => void) {
  window.addEventListener(WIND_UNIT_CHANGE_EVENT, callback);
  return () => window.removeEventListener(WIND_UNIT_CHANGE_EVENT, callback);
}

export function useWindUnit(): WindUnit {
  return useSyncExternalStore(subscribeToWindUnit, readWindUnitFromCookie, () => "ms");
}

