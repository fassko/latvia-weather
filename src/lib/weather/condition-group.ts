import { getIconConditionId, isNightIcon } from "./parse";

/**
 * Broad condition families used for summary copy and header theming.
 * Derived from official LVĢMC pictogram families (weather_codes.csv):
 * 1xxx sky, 2xxx icing, 3xxx thunder, 4xxx mist, 5xxx rain, 6xxx snow.
 */
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

const MIST_SNOW_IDS = new Set(["413", "414", "415", "416"]);
const DRIZZLE_IDS = new Set(["201", "203", "405", "406", "501", "503"]);
const SLEET_OR_SNOW_ICING_IDS = new Set(["207", "208"]);

export function getConditionGroup(iconCode: string): WeatherConditionGroup {
  const id = getIconConditionId(iconCode);
  const family = id.slice(0, 1);
  const night = isNightIcon(iconCode);

  if (family === "6" || MIST_SNOW_IDS.has(id) || SLEET_OR_SNOW_ICING_IDS.has(id)) {
    return "snow";
  }
  if (family === "3") return "thunder";
  if (DRIZZLE_IDS.has(id)) return "drizzle";
  if (family === "5" || family === "2") return "rain";
  if (family === "4") return "fog";
  if (id === "105") return "overcast";
  if (id === "103" || id === "104") return "cloudy";
  if (id === "102") return "partlyCloudy";
  if (id === "101") return night ? "clearNight" : "clearDay";

  return night ? "clearNight" : "clearDay";
}
