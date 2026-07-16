import type { HourlyForecast } from "./types";

export type WeatherConditionGroup =
  | "clearDay"
  | "clearNight"
  | "partlyCloudy"
  | "cloudy"
  | "overcast"
  | "fog"
  | "rain"
  | "drizzle"
  | "snow"
  | "thunder";

/** Group an LVĢMC icon code into a condition family used by the summary copy. */
export function getConditionGroup(iconCode: string): WeatherConditionGroup {
  const code = iconCode.slice(1);
  const isNight = iconCode.startsWith("2");

  if (code.startsWith("40")) return "snow";
  if (code === "304" || code === "305" || code === "306") return "thunder";
  if (code.startsWith("50")) return "drizzle";
  if (code.startsWith("30")) return "rain";
  if (code === "201" || code === "202" || code === "203") return "fog";
  if (code === "104" || code === "204") return "overcast";
  if (code === "103") return "cloudy";
  if (code === "102") return "partlyCloudy";
  return isNight ? "clearNight" : "clearDay";
}

export function getTempBandKey(temperature: number): string {
  if (temperature <= 0) return "freezing";
  if (temperature < 8) return "cold";
  if (temperature < 15) return "cool";
  if (temperature < 22) return "mild";
  if (temperature < 28) return "warm";
  return "hot";
}

export interface WeatherSummaryParts {
  /** Translation key under `summary.cond.*`. */
  conditionKey: WeatherConditionGroup;
  /** Translation key under `summary.advice.*`. */
  adviceKey: string;
}

/**
 * Produce the two translation keys that build the hero's one-line description:
 * a condition clause and a piece of advice. Wet/rough conditions get advice
 * tied to the weather; otherwise the advice follows the temperature band.
 */
export function getWeatherSummaryParts(
  current: HourlyForecast,
): WeatherSummaryParts {
  const conditionKey = getConditionGroup(current.iconCode);

  let adviceKey: string;
  switch (conditionKey) {
    case "rain":
    case "drizzle":
      adviceKey = "rain";
      break;
    case "snow":
      adviceKey = "snow";
      break;
    case "thunder":
      adviceKey = "thunder";
      break;
    case "fog":
      adviceKey = "fog";
      break;
    default:
      adviceKey = getTempBandKey(current.temperature);
  }

  return { conditionKey, adviceKey };
}
