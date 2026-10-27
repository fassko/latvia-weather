import { createColorScale, type ColorStop } from "@/lib/weather/map-field";

/**
 * Wind layer numbers for the map. The wash uses the shared field in
 * `map-field.ts` with each place's speed; arrows sample `createWindSampler`.
 * The iOS app copies these, so keep them in sync.
 */

/** Overlay opacity of the wind wash. */
export const WIND_FIELD_OPACITY = 0.55;

/** Wind speed (m/s) colour stops, calmest first. */
export const WIND_FIELD_STOPS: ReadonlyArray<ColorStop> = [
  { value: 0, color: "#e0f2fe" },
  { value: 3, color: "#7dd3fc" },
  { value: 6, color: "#22c55e" },
  { value: 9, color: "#eab308" },
  { value: 12, color: "#f97316" },
  { value: 15, color: "#ef4444" },
  { value: 20, color: "#a21caf" },
];

/** Arrows sit on a screen grid this many px apart. */
export const WIND_ARROW_SPACING_PX = 56;
export const WIND_ARROW_MIN_LENGTH_PX = 10;
export const WIND_ARROW_MAX_LENGTH_PX = 22;
/** Speed (m/s) at which an arrow reaches its full length. */
export const WIND_ARROW_FULL_SPEED = 15;

/** Speeds (m/s) marked on the legend bar, shown in the user's unit. */
export const WIND_LEGEND_TICKS_MS = [0, 5, 10, 15, 20];

const windScale = createColorScale(WIND_FIELD_STOPS);

/** Colour for a wind speed in m/s, linearly interpolated in RGB and clamped at the ends. */
export function windFieldColor(speed: number): [number, number, number] {
  return windScale.color(speed);
}

export function windFieldGradientCss(): string {
  return windScale.gradientCss();
}

export function windFieldLegendPosition(speed: number): number {
  return windScale.position(speed);
}

/** Arrow length in px: 10 px when calm, growing linearly to 22 px at 15 m/s and above. */
export function windArrowLength(speed: number): number {
  const share = Math.min(Math.max(speed, 0), WIND_ARROW_FULL_SPEED) / WIND_ARROW_FULL_SPEED;
  return WIND_ARROW_MIN_LENGTH_PX + (WIND_ARROW_MAX_LENGTH_PX - WIND_ARROW_MIN_LENGTH_PX) * share;
}

/** Degrees to rotate an up-pointing arrow so it shows where the wind blows to. */
export function windArrowRotation(direction: number): number {
  return (((direction + 180) % 360) + 360) % 360;
}
