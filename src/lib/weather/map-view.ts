/** Geographic center used for the default Latvia overview. */
export const LATVIA_CENTER = [56.88, 24.6] as const;

/** Bounding box that covers Latvia with a small margin. */
export const LATVIA_BOUNDS = [
  [55.6, 20.7],
  [58.15, 28.4],
] as const;

/** Match Tailwind `sm` — phones stay in the mobile overview. */
export const MOBILE_MAP_MAX_WIDTH = 640;

/**
 * Narrow map panes under-zoom when fitting Latvia’s wide bounds (portrait
 * phones especially). Prefer this fixed overview instead of fitBounds.
 */
export const MOBILE_DEFAULT_ZOOM = 7;

export const DESKTOP_FIT_MAX_ZOOM = 8;
export const DESKTOP_FIT_PADDING = [24, 24] as const;

export type LatviaOverview =
  | {
      mode: "setView";
      center: readonly [number, number];
      zoom: number;
    }
  | {
      mode: "fitBounds";
      padding: readonly [number, number];
      maxZoom: number;
    };

export function isMobileMapWidth(width: number): boolean {
  return width > 0 && width < MOBILE_MAP_MAX_WIDTH;
}

/** Pick the default Latvia camera for the current map pane width. */
export function latviaOverviewForWidth(mapWidth: number): LatviaOverview {
  if (isMobileMapWidth(mapWidth)) {
    return {
      mode: "setView",
      center: LATVIA_CENTER,
      zoom: MOBILE_DEFAULT_ZOOM,
    };
  }

  return {
    mode: "fitBounds",
    padding: DESKTOP_FIT_PADDING,
    maxZoom: DESKTOP_FIT_MAX_ZOOM,
  };
}
