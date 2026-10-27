import {
  buildField,
  createColorScale,
  FIELD_EXACT_KM,
  FIELD_FADE_KM,
  FIELD_SEARCH_RADIUS_KM,
  FIELD_SOLID_KM,
  FIELD_WIDTH,
  fieldHeight,
  type Field,
  type FieldOptions,
} from "@/lib/weather/map-field";

/**
 * Temperature colour wash for the map. The grid, interpolation and fade live
 * in `map-field.ts`; this file holds the temperature colours. The iOS app
 * builds the same field, so keep the numbers in sync.
 */

export interface TemperatureFieldPoint {
  lat: number;
  lon: number;
  temperature: number;
}

export type TemperatureFieldOptions = FieldOptions;
export type TemperatureField = Field;

export const TEMPERATURE_FIELD_WIDTH = FIELD_WIDTH;
export const TEMPERATURE_FIELD_SEARCH_RADIUS_KM = FIELD_SEARCH_RADIUS_KM;
export const TEMPERATURE_FIELD_EXACT_KM = FIELD_EXACT_KM;
export const TEMPERATURE_FIELD_SOLID_KM = FIELD_SOLID_KM;
export const TEMPERATURE_FIELD_FADE_KM = FIELD_FADE_KM;
/** Overlay opacity of the temperature wash. */
export const TEMPERATURE_FIELD_OPACITY = 0.55;

/** Colour stops for the wash and the legend gradient, coldest first. */
export const TEMPERATURE_FIELD_STOPS: ReadonlyArray<{
  temperature: number;
  color: string;
}> = [
  { temperature: -20, color: "#1e3a8a" },
  { temperature: -10, color: "#1d4ed8" },
  { temperature: -2, color: "#2563eb" },
  { temperature: 3, color: "#0284c7" },
  { temperature: 8, color: "#0ea5e9" },
  { temperature: 13, color: "#0f766e" },
  { temperature: 18, color: "#15803d" },
  { temperature: 23, color: "#ca8a04" },
  { temperature: 28, color: "#f97316" },
  { temperature: 33, color: "#ef4444" },
];

const temperatureScale = createColorScale(
  TEMPERATURE_FIELD_STOPS.map((stop) => ({
    value: stop.temperature,
    color: stop.color,
  })),
);

/** Colour for a temperature, linearly interpolated in RGB and clamped at the ends. */
export function temperatureFieldColor(temperature: number): [number, number, number] {
  return temperatureScale.color(temperature);
}

/** CSS `linear-gradient` for the legend bar, using the same stops as the wash. */
export function temperatureFieldGradientCss(): string {
  return temperatureScale.gradientCss();
}

/** Where a temperature sits on the legend bar, 0 to 1. */
export function temperatureFieldLegendPosition(temperature: number): number {
  return temperatureScale.position(temperature);
}

/** Rows for a field `width` columns wide, so the grid keeps the bounds' Web Mercator aspect. */
export const temperatureFieldHeight = fieldHeight;

export function buildTemperatureField(
  points: ReadonlyArray<TemperatureFieldPoint>,
  options: TemperatureFieldOptions = {},
): TemperatureField {
  return buildField(points, (point) => point.temperature, options);
}
