/**
 * Temperature → marker fill color for the locations map.
 * Mid greens stay a bit deeper so weather emoji remain readable on callouts
 * (emoji sit on a light chip; fill still needs enough contrast with dark type).
 */
export function temperatureMarkerColor(temperature: number): string {
  if (temperature <= -15) return "#1e3a8a";
  if (temperature <= -5) return "#1d4ed8";
  if (temperature <= 0) return "#2563eb";
  if (temperature <= 5) return "#0284c7";
  if (temperature <= 10) return "#0ea5e9";
  if (temperature <= 15) return "#0f766e";
  if (temperature <= 20) return "#15803d";
  if (temperature <= 25) return "#ca8a04";
  if (temperature <= 30) return "#f97316";
  return "#ef4444";
}

export function temperatureTextColor(temperature: number): string {
  // Deep cold/hot, plus deeper teal/green mid bands, use light type.
  if (temperature <= 5 || temperature >= 30) return "#ffffff";
  if (temperature > 10 && temperature <= 20) return "#ffffff";
  return "#0f172a";
}

export function formatMapTemperature(temperature: number): string {
  const rounded = Math.round(temperature);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

export type TemperatureLegendBandId =
  | "cold"
  | "cool"
  | "mild"
  | "warm"
  | "hot";

/** Coarse legend bands shown under the map (matches representative marker colors). */
export const TEMPERATURE_LEGEND_BANDS: ReadonlyArray<{
  id: TemperatureLegendBandId;
  color: string;
  /** Inclusive lower bound in °C, or null for an open lower end. */
  minC: number | null;
  /** Inclusive upper bound in °C, or null for an open upper end. */
  maxC: number | null;
}> = [
  { id: "cold", color: "#2563eb", minC: null, maxC: 0 },
  { id: "cool", color: "#0ea5e9", minC: 1, maxC: 10 },
  { id: "mild", color: "#15803d", minC: 11, maxC: 20 },
  { id: "warm", color: "#ca8a04", minC: 21, maxC: 25 },
  { id: "hot", color: "#ef4444", minC: 26, maxC: null },
];
