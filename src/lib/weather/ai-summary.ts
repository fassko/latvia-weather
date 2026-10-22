import { getConditionKey, getWindDirection } from "./parse";
import { getWeatherSummaryParts } from "./summary";
import { getSunTimes } from "./sun";
import { formatLatviaTime } from "./timezone";
import type { HourlyForecast, WeatherLocation } from "./types";

export type SummaryLocale = "en" | "lv" | "ru";

/** Hours of forecast the model sees: enough for "rain from 15:00" or "clearing tonight", not the whole week. */
export const SUMMARY_HOURS = 12;

/** Longest summary the app's header shows comfortably on a phone. */
export const MAX_SUMMARY_LENGTH = 160;

export interface SummaryHour {
  time: string;
  isNight: boolean;
  condition: string;
  temperature: number;
  feelsLike: number;
  precipitationMm: number;
  snowCm: number | null;
  precipitationProbability: number | null;
  thunderProbability: number;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  cloudCover: number | null;
}

export interface SummaryContext {
  location: string;
  nowLocalTime: string;
  isNightNow: boolean;
  sunrise: string | null;
  sunset: string | null;
  hours: SummaryHour[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function isNightAt(time: Date, lat: number, lon: number): boolean {
  const sun = getSunTimes(time, lat, lon);
  if (!sun) return false;
  return time < sun.sunrise || time >= sun.sunset;
}

/**
 * The forecast the model writes the summary from: the current hour and the next ones, with day/night worked out
 * from the location's sunrise and sunset so the model never has to guess whether "sunny" makes sense.
 */
export function buildSummaryContext(
  location: WeatherLocation,
  forecasts: readonly HourlyForecast[],
  now: Date,
): SummaryContext {
  const currentHourStart = now.getTime() - (now.getTime() % 3_600_000);
  const hours = forecasts
    .filter((hour) => hour.time.getTime() >= currentHourStart)
    .slice(0, SUMMARY_HOURS);
  const sun = getSunTimes(now, location.lat, location.lon);

  return {
    location: location.name,
    nowLocalTime: formatLatviaTime(now, "HH:mm"),
    isNightNow: isNightAt(now, location.lat, location.lon),
    sunrise: sun ? formatLatviaTime(sun.sunrise, "HH:mm") : null,
    sunset: sun ? formatLatviaTime(sun.sunset, "HH:mm") : null,
    hours: hours.map((hour) => ({
      time: formatLatviaTime(hour.time, "HH:mm"),
      isNight: isNightAt(hour.time, location.lat, location.lon),
      condition: getConditionKey(hour.iconCode),
      temperature: round(hour.temperature),
      feelsLike: round(hour.feelsLike),
      precipitationMm: round(hour.precipitation),
      snowCm: hour.snow === null ? null : round(hour.snow),
      precipitationProbability: hour.precipitationProbability === null
        ? null : Math.round(hour.precipitationProbability),
      thunderProbability: Math.round(hour.thunderProbability),
      windSpeed: round(hour.windSpeed),
      windGust: round(hour.windGust),
      windDirection: getWindDirection(hour.windDirection),
      cloudCover: hour.cloudCover === null ? null : Math.round(hour.cloudCover),
    })),
  };
}

const LANGUAGE_INSTRUCTIONS: Record<SummaryLocale, string> = {
  en: "Write in English.",
  lv: "Write in Latvian only, with natural Latvian phrasing. Do not mix in English words.",
  ru: "Write in Russian only, with natural Russian phrasing. Do not mix in English or Latvian words.",
};

export function getSummaryInstructions(locale: SummaryLocale): string {
  return [
    "You write the one-line weather summary shown under the temperature in a Latvian weather app.",
    "Use only the forecast JSON you are given; it is the source of truth. Never invent weather.",
    `Write one or two short sentences, at most ${MAX_SUMMARY_LENGTH} characters in total.`,
    "Describe what it is like now, then the most useful change in the coming hours with its local time (for example rain starting, wind picking up, clearing, a temperature drop), then a short practical tip.",
    "Respect isNightNow and each hour's isNight: at night never mention sun or sunshine, and talk about tonight or the night instead of the day.",
    "Mention the temperature only if it adds something, and never repeat the exact current temperature, which the app already shows.",
    "Use 24-hour local times like 15:00. Do not mention the location name, the data source, or that you are an AI.",
    "Plain text only: no Markdown, no emoji, no quotation marks, no line breaks.",
    LANGUAGE_INSTRUCTIONS[locale],
  ].join(" ");
}

const NIGHT_ADVICE: Record<string, string> = { mild: "mildNight", warm: "warmNight", hot: "hotNight" };

/**
 * Translation keys under `summary.*` for the rule-based sentence used when the model is unavailable. Day or night
 * comes from sunrise and sunset rather than the LVĢMC icon, whose night variant lags behind sunset.
 */
export function getFallbackSummaryKeys(
  current: HourlyForecast,
  isNight: boolean,
): { conditionKey: string; adviceKey: string } {
  const parts = getWeatherSummaryParts(current);
  let conditionKey: string = parts.conditionKey;
  if (conditionKey === "clearDay" || conditionKey === "clearNight") {
    conditionKey = isNight ? "clearNight" : "clearDay";
  } else if (conditionKey === "partlyCloudy" && isNight) {
    conditionKey = "partlyCloudyNight";
  }
  const adviceKey = isNight ? (NIGHT_ADVICE[parts.adviceKey] ?? parts.adviceKey) : parts.adviceKey;

  return { conditionKey, adviceKey };
}

/** Strips whatever formatting the model adds anyway and caps the length so the header layout holds. */
export function cleanSummary(text: string): string {
  let summary = text
    .replace(/[*_`#>]/g, "")
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (summary.length > MAX_SUMMARY_LENGTH) {
    const cut = summary.slice(0, MAX_SUMMARY_LENGTH);
    const lastSentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    summary =
      lastSentenceEnd > 40
        ? cut.slice(0, lastSentenceEnd + 1)
        : `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
  }

  return summary;
}
