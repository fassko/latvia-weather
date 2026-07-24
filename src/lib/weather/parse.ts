import type { HourlyForecast, HourlyForecastRaw } from "./types";
import { parseLaiks } from "./timezone";

export { parseLaiks } from "./timezone";

/**
 * LVĢMC `laika_apstaklu_ikona` codes are 4 digits:
 * - 1xxx = day, 2xxx = night
 * - remaining 3 digits identify the condition (see data.gov.lv weather_codes.csv)
 *
 * Important: 14xx is mist/fog, 16xx is snow. Mapping 40x → snow is wrong and
 * caused mist (e.g. 1403) to display as "heavy snow".
 */
export function getIconConditionId(iconCode: string): string {
  return iconCode.length >= 4 ? iconCode.slice(1) : iconCode;
}

export function isNightIcon(iconCode: string): boolean {
  return iconCode.startsWith("2");
}

export function parseNumber(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

export function parseHourlyForecast(raw: HourlyForecastRaw): HourlyForecast {
  return {
    time: parseLaiks(raw.laiks),
    temperature: parseNumber(raw.temperatura),
    feelsLike: parseNumber(raw.sajutu_temperatura),
    precipitation: parseNumber(raw.nokrisni_1h),
    snow: parseNumber(raw.sniegs),
    humidity: parseNumber(raw.relativais_mitrums),
    windSpeed: parseNumber(raw.veja_atrums),
    windGust: parseNumber(raw.brazmas),
    windDirection: parseNumber(raw.veja_virziens),
    pressure: parseNumber(raw.spiediens),
    cloudCover: parseNumber(raw.makoni),
    iconCode: raw.laika_apstaklu_ikona,
    precipitationProbability: parseNumber(raw.nokrisnu_varbutiba),
    uvIndex: raw.uvi_indekss != null ? parseNumber(raw.uvi_indekss) : null,
    thunderProbability: parseNumber(raw.perkons),
  };
}

const DIRECTIONS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export function getWindDirection(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return DIRECTIONS[index];
}

/** Translation key under `conditions.*` for an LVĢMC icon code. */
export function getConditionKey(iconCode: string): string {
  const id = getIconConditionId(iconCode);
  const night = isNightIcon(iconCode);

  switch (id) {
    case "101":
      return night ? "clear_night" : "clear_day";
    case "102":
      return "partlyCloudy";
    case "103":
      return "cloudyClearing";
    case "104":
      return "cloudy";
    case "105":
      return "overcast";

    case "201":
    case "203":
      return "freezingDrizzle";
    case "204":
    case "206":
      return "freezingRain";
    case "207":
    case "208":
      return "freezingSleet";

    case "301":
    case "303":
      return "thunderRain";
    case "304":
    case "306":
      return "thunderHeavyRain";
    case "307":
    case "309":
      return "thunderHail";
    case "310":
    case "312":
      return "thunderHeavyHail";
    case "313":
    case "314":
      return "thunderSleet";
    case "315":
    case "316":
      return "thunderHeavySleet";
    case "317":
    case "319":
      return "hail";
    case "320":
    case "322":
      return "heavyHail";

    case "401":
    case "403":
    case "404":
      return "mist";
    case "405":
    case "406":
      return "mistDrizzle";
    case "407":
    case "408":
      return "mistRain";
    case "409":
    case "411":
    case "412":
      return "mistHoarfrost";
    case "413":
    case "414":
      return "mistSnow";
    case "415":
    case "416":
      return "mistSleet";

    case "501":
    case "503":
      return "drizzle";
    case "504":
    case "506":
      return "rain";
    case "507":
    case "509":
      return "heavyRain";

    case "601":
    case "603":
      return "snow";
    case "604":
    case "606":
      return "heavySnow";
    case "607":
    case "608":
      return "snowstorm";
    case "609":
    case "610":
      return "heavySnowstorm";

    default:
      return night ? "fallback_night" : "fallback_day";
  }
}

/**
 * Prefer widely supported emoji (Unicode 6.0 era). Newer weather glyphs like
 * 🌫️ often render as empty "tofu" squares in mobile SVG text.
 */
export function getConditionEmoji(iconCode: string): string {
  const id = getIconConditionId(iconCode);
  const night = isNightIcon(iconCode);
  const family = id.slice(0, 1);

  if (id === "413" || id === "414" || family === "6") return "❄️";
  if (id === "415" || id === "416" || id === "207" || id === "208") return "❄️";
  // 🌁 (foggy) is far more reliable than 🌫️ in chart SVG / Android WebViews
  if (family === "4") return "🌁";
  if (family === "3") return "⛈️";
  if (family === "2" || family === "5") return "🌧️";
  if (id === "104" || id === "105") return "☁️";
  if (id === "103") return "☁️";
  if (id === "102") return night ? "☁️" : "⛅";
  if (id === "101") return night ? "🌙" : "☀️";

  return night ? "🌙" : "⛅";
}

/** Official LVĢMC pictogram image for an icon code (day or night). */
export function getLvgmcWeatherIconUrl(iconCode: string): string {
  return `https://videscentrs.lvgmc.lv/images/weather/${encodeURIComponent(iconCode)}.png`;
}
