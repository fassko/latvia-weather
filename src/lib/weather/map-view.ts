/** Geographic center used for the default Latvia overview. */
export const LATVIA_CENTER: [number, number] = [56.88, 24.6];

/** Bounding box that covers Latvia with a small margin. */
export const LATVIA_BOUNDS: [[number, number], [number, number]] = [
  [55.6, 20.7],
  [58.15, 28.4],
];

/** Match Tailwind `sm`; used for map chrome layout breakpoints. */
export const MOBILE_MAP_MAX_WIDTH = 640;

/**
 * Initial MapContainer zoom before FitLatvia runs. Kept low enough that the
 * first paint does not crop Latvia on typical phone widths.
 */
export const MOBILE_DEFAULT_ZOOM = 6;

export const LATVIA_FIT_PADDING: [number, number] = [28, 28];
export const LATVIA_FIT_MAX_ZOOM = 8;

export type LatviaOverview = {
  mode: "fitBounds";
  padding: [number, number];
  maxZoom: number;
};

export function isMobileMapWidth(width: number): boolean {
  return width > 0 && width < MOBILE_MAP_MAX_WIDTH;
}

/** Default Latvia camera: fit the full country into the current map pane. */
export function latviaOverviewForWidth(_mapWidth: number): LatviaOverview {
  return {
    mode: "fitBounds",
    padding: LATVIA_FIT_PADDING,
    maxZoom: LATVIA_FIT_MAX_ZOOM,
  };
}
