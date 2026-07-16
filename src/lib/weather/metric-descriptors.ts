/**
 * Qualitative descriptor keys for the metric cards. Each returns a translation
 * key under the `metrics.*` namespace, so the UI layer stays i18n-friendly.
 */

export function getHumidityBandKey(humidity: number): string {
  if (humidity < 40) return "dry";
  if (humidity < 70) return "comfortable";
  return "humid";
}

/** Wind/gust strength band in m/s (loosely Beaufort-derived). */
export function getWindBandKey(speedMs: number): string {
  if (speedMs < 3.4) return "light";
  if (speedMs < 8) return "moderate";
  if (speedMs < 13.9) return "strong";
  return "gale";
}

export function getCloudBandKey(cloudCover: number): string {
  if (cloudCover < 12) return "clear";
  if (cloudCover < 50) return "partly";
  if (cloudCover < 85) return "cloudy";
  return "overcast";
}

export function getUvBandKey(uvIndex: number): string {
  if (uvIndex < 3) return "low";
  if (uvIndex < 6) return "moderate";
  if (uvIndex < 8) return "high";
  if (uvIndex < 11) return "veryHigh";
  return "extreme";
}

export function getFeelsBandKey(temperature: number, feelsLike: number): string {
  const delta = Math.round(feelsLike) - Math.round(temperature);
  if (delta >= 1) return "warmer";
  if (delta <= -1) return "colder";
  return "same";
}
