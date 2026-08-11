/** Geographic center used for the default Latvia overview. */
export const LATVIA_CENTER: [number, number] = [56.88, 24.6];

/** Bounding box that covers Latvia with a small margin. */
export const LATVIA_BOUNDS: [[number, number], [number, number]] = [
  [55.6, 20.7],
  [58.15, 28.4],
];

/** Match Tailwind `sm`; narrow phones keep a less cropped overview. */
export const MOBILE_MAP_MAX_WIDTH = 640;

/**
 * Fixed overview zooms keep Latvia filling the pane. fitBounds under-zooms
 * on typical widths because Latvia is much wider than it is tall.
 */
export const MOBILE_DEFAULT_ZOOM = 7;
export const DESKTOP_DEFAULT_ZOOM = 8;

export type LatviaOverview = {
  mode: "setView";
  center: [number, number];
  zoom: number;
};

export function isMobileMapWidth(width: number): boolean {
  return width > 0 && width < MOBILE_MAP_MAX_WIDTH;
}

/** Pick the default Latvia camera for the current map pane width. */
export function latviaOverviewForWidth(mapWidth: number): LatviaOverview {
  return {
    mode: "setView",
    center: LATVIA_CENTER,
    zoom: isMobileMapWidth(mapWidth) ? MOBILE_DEFAULT_ZOOM : DESKTOP_DEFAULT_ZOOM,
  };
}
