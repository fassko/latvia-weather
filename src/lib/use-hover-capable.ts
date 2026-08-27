"use client";

import { useSyncExternalStore } from "react";

const HOVER_CAPABLE_QUERY = "(hover: hover) and (pointer: fine)";

function getHoverCapablePreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(HOVER_CAPABLE_QUERY).matches;
}

function subscribeToHoverCapable(callback: () => void) {
  const mediaQuery = window.matchMedia(HOVER_CAPABLE_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

/** True when the primary input supports real hover (desktop mouse/trackpad). */
export function useHoverCapable(): boolean {
  return useSyncExternalStore(
    subscribeToHoverCapable,
    getHoverCapablePreference,
    () => true,
  );
}
