/** Temperature → marker fill color for the locations map. */
export function temperatureMarkerColor(temperature: number): string {
  if (temperature <= -15) return "#1e3a8a";
  if (temperature <= -5) return "#1d4ed8";
  if (temperature <= 0) return "#2563eb";
  if (temperature <= 5) return "#0284c7";
  if (temperature <= 10) return "#0ea5e9";
  if (temperature <= 15) return "#14b8a6";
  if (temperature <= 20) return "#22c55e";
  if (temperature <= 25) return "#eab308";
  if (temperature <= 30) return "#f97316";
  return "#ef4444";
}

export function temperatureTextColor(temperature: number): string {
  if (temperature <= 5 || temperature >= 30) return "#ffffff";
  return "#0f172a";
}

export function formatMapTemperature(temperature: number): string {
  const rounded = Math.round(temperature);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}
