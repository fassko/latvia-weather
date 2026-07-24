import { getConditionGroup, type WeatherConditionGroup } from "./condition-group";
import type { HourlyForecast } from "./types";

export type { WeatherConditionGroup };
export { getConditionGroup };

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
