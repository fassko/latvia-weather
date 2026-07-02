import type { HourlyForecast, HourlyForecastRaw } from "./types";
import { parseLaiks } from "./timezone";

export { parseLaiks } from "./timezone";

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

export function getConditionKey(iconCode: string): string {
  const code = iconCode.slice(1);
  const isNight = iconCode.startsWith("2");

  const conditions: Record<string, string> = {
    "101": isNight ? "101_night" : "101_day",
    "102": "102",
    "103": "103",
    "104": "104",
    "201": "201",
    "202": "202",
    "203": "203",
    "204": "204",
    "301": "301",
    "302": "302",
    "303": "303",
    "304": "304",
    "305": "305",
    "306": "306",
    "401": "401",
    "402": "402",
    "403": "403",
    "404": "404",
    "501": "501",
    "502": "502",
    "503": "503",
    "504": "504",
    "505": "505",
    "506": "506",
  };

  return conditions[code] ?? (isNight ? "fallback_night" : "fallback_day");
}

export function getConditionEmoji(iconCode: string): string {
  const code = iconCode.slice(1);
  const isNight = iconCode.startsWith("2");

  if (code.startsWith("50") || code.startsWith("30")) return "🌧️";
  if (code.startsWith("40")) return "❄️";
  if (code === "104" || code === "204") return "☁️";
  if (code === "103" || code === "203") return "🌥️";
  if (code === "102" || code === "202") return isNight ? "🌙" : "⛅";
  if (code === "101" || code === "201") return isNight ? "🌙" : "☀️";
  if (code.startsWith("30")) return "⛈️";

  return isNight ? "🌙" : "🌤️";
}
