import { createColorScale, type ColorStop } from "@/lib/weather/map-field";

/**
 * Rain layer numbers for the map. The wash interpolates each place's
 * `precipitation` (mm in the hour) with the dry places' zeros included, so
 * rain stays local. The iOS app copies these, so keep them in sync.
 */

/** Overlay opacity of the rain wash. */
export const RAIN_FIELD_OPACITY = 0.75;
/** Below this many mm a cell is transparent; it's also what counts as "rain" for the note. */
export const RAIN_FIELD_MIN_MM = 0.05;
/** From this many mm a chip shows the amount instead of the chance. */
export const RAIN_CHIP_MIN_MM = 0.1;

/** Radar-like colour stops (mm per hour), lightest first. */
export const RAIN_FIELD_STOPS: ReadonlyArray<ColorStop> = [
  { value: 0.1, color: "#a5f3fc" },
  { value: 0.5, color: "#38bdf8" },
  { value: 1, color: "#2563eb" },
  { value: 2.5, color: "#7c3aed" },
  { value: 5, color: "#c026d3" },
  { value: 10, color: "#db2777" },
];

/** mm per hour marked on the legend bar. */
export const RAIN_LEGEND_TICKS_MM = [0.1, 1, 5, 10];

// The legend bar is log-spaced so the light end isn't squeezed into a sliver.
const rainScale = createColorScale(RAIN_FIELD_STOPS, "log");

/** Colour for an amount in mm, linearly interpolated in RGB and clamped at the ends. */
export function rainFieldColor(mm: number): [number, number, number] {
  return rainScale.color(mm);
}

export function rainFieldGradientCss(): string {
  return rainScale.gradientCss();
}

export function rainFieldLegendPosition(mm: number): number {
  return rainScale.position(mm);
}

/**
 * Pixel alpha for a rain cell: 0 below 0.05 mm, otherwise the field's fade
 * alpha × min(1, 0.35 + mm / 2), so drizzle stays light.
 */
export function rainFieldAlpha(mm: number, fadeAlpha: number): number {
  if (!(mm >= RAIN_FIELD_MIN_MM)) return 0;
  return fadeAlpha * Math.min(1, 0.35 + mm / 2);
}

export interface RainChipInput {
  precipitation?: number | null;
  precipitationProbability?: number | null;
}

export type RainChip =
  | { kind: "amount"; text: string; mm: number }
  | { kind: "chance"; text: string }
  | { kind: "none"; text: string };

/**
 * A place's rain label: `1.2 mm` from 0.1 mm, else the chance as `30%` when
 * it rounds to at least 1%, else `0`. A missing chance (the data.gov.lv
 * fallback) counts as 0.
 */
export function rainChip(point: RainChipInput): RainChip {
  const mm = point.precipitation ?? 0;
  if (mm >= RAIN_CHIP_MIN_MM) {
    return { kind: "amount", text: `${mm.toFixed(1)} mm`, mm };
  }

  // A chance that rounds to 0% (LVĢMC gives tenths) reads as no rain.
  const chance = Math.round(point.precipitationProbability ?? 0);
  if (chance > 0) {
    return { kind: "chance", text: `${chance}%` };
  }

  return { kind: "none", text: "0" };
}

/** Whether any place has rain the wash would show at this hour. */
export function hasAnyRain(points: ReadonlyArray<RainChipInput>): boolean {
  return points.some((point) => (point.precipitation ?? 0) >= RAIN_FIELD_MIN_MM);
}
