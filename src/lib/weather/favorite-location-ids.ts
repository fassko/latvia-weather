/** Client-side favorite location IDs (localStorage) with stable snapshots for useSyncExternalStore. */

export const FAVORITE_LOCATION_STORAGE_KEY = "latvia-weather-favorite-locations";
export const FAVORITE_LOCATION_CHANGE_EVENT = "lw-favorites-changed";

const EMPTY_FAVORITE_IDS: string[] = [];

let cachedFavoriteRaw: string | null = null;
let cachedFavoriteIds: string[] = EMPTY_FAVORITE_IDS;

/**
 * Parse + cache favorite IDs.
 * Returning a new array on every read breaks useSyncExternalStore (React #185).
 */
export function readFavoriteLocationIds(
  getRaw: () => string | null = defaultGetRaw,
): string[] {
  try {
    const raw = getRaw() ?? "[]";
    if (raw === cachedFavoriteRaw) return cachedFavoriteIds;
    const parsed = JSON.parse(raw);
    const next = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : EMPTY_FAVORITE_IDS;
    cachedFavoriteRaw = raw;
    cachedFavoriteIds = next.length === 0 ? EMPTY_FAVORITE_IDS : next;
    return cachedFavoriteIds;
  } catch {
    cachedFavoriteRaw = null;
    cachedFavoriteIds = EMPTY_FAVORITE_IDS;
    return EMPTY_FAVORITE_IDS;
  }
}

function defaultGetRaw(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FAVORITE_LOCATION_STORAGE_KEY);
}

export function getEmptyFavoriteLocationIds(): string[] {
  return EMPTY_FAVORITE_IDS;
}

/** Test helper: reset module cache between cases. */
export function resetFavoriteLocationIdsCacheForTests(): void {
  cachedFavoriteRaw = null;
  cachedFavoriteIds = EMPTY_FAVORITE_IDS;
}

export function subscribeFavoriteLocationIds(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  window.addEventListener(FAVORITE_LOCATION_CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(FAVORITE_LOCATION_CHANGE_EVENT, notify);
  };
}

export function notifyFavoriteLocationIdsChanged(): void {
  window.dispatchEvent(new Event(FAVORITE_LOCATION_CHANGE_EVENT));
}
