import { POPULAR_LOCATION_IDS } from "@/lib/seo/popular-locations";
import { getSiteUrl, localizedPath, locationSlug } from "@/lib/site";
import type { Locale } from "@/i18n/routing";
import { getTodayForecasts } from "./chart-data";
import { getConditionGroup } from "./condition-group";
import { groupForecastsByDay, summarizeDay } from "./daily";
import { getOgImageGradient } from "./header-theme";
import { DEFAULT_LOCATION_ID } from "./locations";
import { getConditionEmoji, getConditionKey, getWindDirection } from "./parse";
import type {
  SocialBriefSlot,
  SocialBriefSlotId,
  SocialPlatform,
} from "./social-brief-schedule";
import { resolveSocialBriefSlot } from "./social-brief-schedule";
import { getWeatherSummaryParts } from "./summary";
import {
  formatLatviaDateTime,
  formatLatviaTime,
  getLatviaDayKey,
  getLatviaWallClock,
} from "./timezone";
import type { HourlyForecast, WeatherData, WeatherLocation } from "./types";

/** Keep in sync with messages summary.cond / summary.advice (en + lv). */
const SUMMARY_COPY = {
  en: {
    cond: {
      clearDay: "Clear and sunny",
      clearNight: "Clear skies tonight",
      partlyCloudy: "A mix of sun and clouds",
      cloudy: "Cloudy skies",
      overcast: "Grey and overcast",
      fog: "Foggy conditions",
      rain: "Rain in the forecast",
      drizzle: "Light drizzle around",
      snow: "Snow is falling",
      thunder: "Thunderstorms possible",
    },
    advice: {
      freezing: "Bundle up — it's freezing out.",
      cold: "Dress warm before heading out.",
      cool: "A light jacket will do.",
      mild: "A fine day to be outside.",
      warm: "Great weather to be out.",
      hot: "Stay cool and hydrated.",
      rain: "Keep an umbrella handy.",
      snow: "Watch for slippery paths.",
      thunder: "Best to stay indoors.",
      fog: "Take care on the roads.",
    },
  },
  lv: {
    cond: {
      clearDay: "Skaidrs un saulains",
      clearNight: "Skaidra nakts",
      partlyCloudy: "Saule un mākoņi",
      cloudy: "Apmācies",
      overcast: "Pelēks un apmācies",
      fog: "Migla",
      rain: "Gaidāms lietus",
      drizzle: "Viegls smidzināšana",
      snow: "Snieg",
      thunder: "Iespējams pērkona negaiss",
    },
    advice: {
      freezing: "Ģērbies silti — ir saldējošs aukstums.",
      cold: "Pirms iziešanas apģērbies silti.",
      cool: "Viegla jaka noderēs.",
      mild: "Lieliska diena pastaigai.",
      warm: "Lielisks laiks būt ārā.",
      hot: "Uzturi vēsumu un dzer ūdeni.",
      rain: "Paņem līdzi lietussargu.",
      snow: "Uzmanies no slidenām takām.",
      thunder: "Labāk palikt telpās.",
      fog: "Esi uzmanīgs uz ceļa.",
    },
  },
} as const;

/** HyperFrames composition id expected by the daily-brief template. */
export const HYPERFRAMES_DAILY_BRIEF_COMPOSITION_ID = "latvia-weather-daily-brief";

/**
 * Declared template variables for a HyperFrames daily-brief composition.
 * Paste into `data-composition-variables` on the composition root.
 */
export const HYPERFRAMES_DAILY_BRIEF_VARIABLE_SCHEMA = [
  { id: "brandName", type: "string", label: "Brand name", default: "Latvia Weather" },
  { id: "cityName", type: "string", label: "City name", default: "Rīga" },
  { id: "headline", type: "string", label: "Headline", default: "Rīga, 18:30" },
  { id: "dateLabel", type: "string", label: "Date label", default: "Wed, Sep 30" },
  { id: "temperature", type: "string", label: "Current temperature", default: "12°C" },
  { id: "tempHigh", type: "string", label: "Today high", default: "15°" },
  { id: "tempLow", type: "string", label: "Today low", default: "8°" },
  { id: "rainChance", type: "string", label: "Rain chance", default: "20%" },
  { id: "precipMm", type: "string", label: "Precipitation total", default: "0 mm" },
  { id: "windLine", type: "string", label: "Wind summary", default: "3 m/s SW" },
  { id: "condition", type: "string", label: "Condition line", default: "Partly cloudy" },
  { id: "advice", type: "string", label: "Advice line", default: "A light jacket will do." },
  { id: "hook", type: "string", label: "1-second hook", default: "Rīga — 12°C" },
  { id: "cta", type: "string", label: "Call to action", default: "Hourly on latvia-weather.com" },
  { id: "deepLink", type: "string", label: "Deep link URL", default: "https://latvia-weather.com" },
  { id: "emoji", type: "string", label: "Condition emoji", default: "⛅" },
  { id: "accent", type: "color", label: "Accent color", default: "#0284c7" },
  { id: "backgroundGradient", type: "string", label: "Background gradient", default: "" },
  { id: "hourlyJson", type: "string", label: "Hourly curve JSON", default: "[]" },
  { id: "locale", type: "string", label: "Locale", default: "lv" },
] as const;

export interface HyperframesHourlyPoint {
  hour: string;
  temperature: number;
  rainChance: number;
  precipMm: number;
  iconCode: string;
}

/** Flat variable map passed to `hyperframes render --variables`. */
export interface HyperframesDailyBriefVariables {
  brandName: string;
  cityName: string;
  headline: string;
  dateLabel: string;
  temperature: string;
  tempHigh: string;
  tempLow: string;
  rainChance: string;
  precipMm: string;
  windLine: string;
  condition: string;
  advice: string;
  hook: string;
  cta: string;
  deepLink: string;
  emoji: string;
  accent: string;
  backgroundGradient: string;
  hourlyJson: string;
  locale: string;
}

export interface HyperframesRenderHints {
  width: number;
  height: number;
  fps: number;
  format: "mp4";
  aspectRatio: "9:16";
  outputKey: string;
}

export interface SocialCaptions {
  instagram: string;
  tiktok: string;
  facebook: string;
  x: string;
  hashtags: string[];
}

export interface HyperframesDailyBriefPayload {
  compositionId: string;
  punkts: string;
  citySlug: string;
  dayKey: string;
  slotId: SocialBriefSlotId;
  variables: HyperframesDailyBriefVariables;
  /** Parsed hourly curve for clients that prefer structured JSON. */
  hourly: HyperframesHourlyPoint[];
  render: HyperframesRenderHints;
  captions: SocialCaptions;
  /** Platforms recommended for this payload given rain chance. */
  publish: {
    always: SocialPlatform[];
    conditional: SocialPlatform[];
    selected: SocialPlatform[];
    interesting: boolean;
    rainChance: number;
  };
  /** One JSONL-ready row for `hyperframes lambda render-batch`. */
  batchRow: {
    outputKey: string;
    executionName: string;
    variables: HyperframesDailyBriefVariables;
  };
}

interface LocaleCopy {
  brandName: string;
  cta: string;
  precipUnit: string;
  windUnit: string;
  highLow: (high: string, low: string) => string;
  summary: {
    cond: Record<string, string>;
    advice: Record<string, string>;
  };
}

const COPY: Record<Locale, LocaleCopy> = {
  en: {
    brandName: "Latvia Weather",
    cta: "Hourly on latvia-weather.com",
    precipUnit: "mm",
    windUnit: "m/s",
    highLow: (high, low) => `H ${high} · L ${low}`,
    summary: SUMMARY_COPY.en,
  },
  lv: {
    brandName: "Laika prognoze",
    cta: "Stundu prognoze: latvia-weather.com",
    precipUnit: "mm",
    windUnit: "m/s",
    highLow: (high, low) => `Augst. ${high} · Zem. ${low}`,
    summary: SUMMARY_COPY.lv,
  },
};

const ACCENT_BY_CONDITION: Record<string, { day: string; night: string }> = {
  clear: { day: "#0284c7", night: "#6366f1" },
  "partly-cloudy": { day: "#0ea5e9", night: "#818cf8" },
  cloudy: { day: "#64748b", night: "#94a3b8" },
  fog: { day: "#94a3b8", night: "#cbd5e1" },
  rain: { day: "#0284c7", night: "#3b82f6" },
  thunder: { day: "#4f46e5", night: "#818cf8" },
  snow: { day: "#0369a1", night: "#38bdf8" },
  drizzle: { day: "#06b6d4", night: "#22d3ee" },
};

function resolveLocale(locale: string | undefined): Locale {
  return locale === "lv" ? "lv" : "en";
}

function findCurrentForecast(
  forecasts: HourlyForecast[],
  now = new Date(),
): HourlyForecast {
  const upcoming = forecasts.find((forecast) => forecast.time.getTime() >= now.getTime());
  return upcoming ?? forecasts[forecasts.length - 1];
}

function formatSignedTemp(temp: number): string {
  const rounded = Math.round(temp);
  return `${rounded > 0 ? "+" : ""}${rounded}°C`;
}

function formatDegree(temp: number): string {
  return `${Math.round(temp)}°`;
}

function formatPrecip(mm: number, unit: string): string {
  const value = Math.round(mm * 10) / 10;
  return `${value} ${unit}`;
}

function accentForIcon(iconCode: string): string {
  const group = (() => {
    switch (getConditionGroup(iconCode)) {
      case "clearDay":
      case "clearNight":
        return "clear";
      case "partlyCloudy":
        return "partly-cloudy";
      case "cloudy":
      case "overcast":
        return "cloudy";
      case "fog":
        return "fog";
      case "rain":
        return "rain";
      case "drizzle":
        return "drizzle";
      case "snow":
        return "snow";
      case "thunder":
        return "thunder";
    }
  })();

  const period = iconCode.startsWith("2") ? "night" : "day";
  return ACCENT_BY_CONDITION[group][period];
}

function buildHourlyCurve(forecasts: HourlyForecast[]): HyperframesHourlyPoint[] {
  return getTodayForecasts(forecasts).map((forecast) => ({
    hour: formatLatviaTime(forecast.time, "HH"),
    temperature: Math.round(forecast.temperature),
    rainChance: Math.round(forecast.precipitationProbability),
    precipMm: Math.round(forecast.precipitation * 10) / 10,
    iconCode: forecast.iconCode,
  }));
}

function buildDeepLink(options: {
  locale: Locale;
  location: WeatherLocation;
  dayKey: string;
  platform: string;
  campaign: string;
}): string {
  const href =
    options.location.id === DEFAULT_LOCATION_ID
      ? `/${options.locale}`
      : localizedPath(
          options.locale,
          options.location.id,
          options.location.name,
        );

  const url = new URL(`${getSiteUrl()}${href}`);
  url.searchParams.set("utm_source", options.platform);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", options.campaign);
  url.searchParams.set("utm_content", `${locationSlug(options.location.name)}_${options.dayKey}`);
  return url.toString();
}

function buildHook(options: {
  locale: Locale;
  slot: SocialBriefSlot;
  cityName: string;
  temperature: string;
  rainChance: number;
}): string {
  const wet = options.rainChance >= options.slot.interestingRainChance;

  if (options.slot.angle === "weekend_plan") {
    if (wet) {
      return options.locale === "lv"
        ? `${options.cityName} brīvdienās — ņem lietussargu`
        : `${options.cityName} weekend — pack an umbrella`;
    }
    return options.locale === "lv"
      ? `${options.cityName} — brīvdienu laiks`
      : `${options.cityName} — weekend weather`;
  }

  if (options.slot.angle === "weekend_evening") {
    if (wet) {
      return options.locale === "lv"
        ? `${options.cityName} rīt — lietus risks`
        : `${options.cityName} tomorrow — rain risk`;
    }
    return options.locale === "lv"
      ? `${options.cityName} — rītdienas laiks`
      : `${options.cityName} — tomorrow's weather`;
  }

  if (wet) {
    return options.locale === "lv"
      ? `${options.cityName} rīt — ņem lietussargu`
      : `${options.cityName} tomorrow — take an umbrella`;
  }
  return options.locale === "lv"
    ? `${options.cityName} šovakar — ${options.temperature}`
    : `${options.cityName} tonight — ${options.temperature}`;
}

function buildCaptions(options: {
  locale: Locale;
  slot: SocialBriefSlot;
  cityName: string;
  temperature: string;
  high: string;
  low: string;
  rainChance: string;
  condition: string;
  advice: string;
  deepLink: string;
}): SocialCaptions {
  const copy = COPY[options.locale];
  const highLow = copy.highLow(options.high, options.low);

  let body: string;
  if (options.slot.angle === "weekend_plan") {
    body =
      options.locale === "lv"
        ? `${options.cityName} brīvdienās: ${options.temperature} (${highLow}). ${options.condition}. ${options.advice}`
        : `${options.cityName} this weekend: ${options.temperature} (${highLow}). ${options.condition}. ${options.advice}`;
  } else if (options.slot.angle === "weekend_evening") {
    body =
      options.locale === "lv"
        ? `${options.cityName} šovakar / rīt: ${options.temperature} (${highLow}). ${options.condition}. ${options.advice}`
        : `${options.cityName} tonight / tomorrow: ${options.temperature} (${highLow}). ${options.condition}. ${options.advice}`;
  } else {
    body =
      options.locale === "lv"
        ? `${options.cityName} šovakar: ${options.temperature} (${highLow}). ${options.condition}. ${options.advice}`
        : `${options.cityName} tonight: ${options.temperature} (${highLow}). ${options.condition}. ${options.advice}`;
  }

  const hashtags =
    options.locale === "lv"
      ? ["#laiks", "#Latvija", `#${options.cityName.replace(/\s+/g, "")}`, "#prognoze", "#LatviaWeather"]
      : ["#weather", "#Latvia", `#${options.cityName.replace(/\s+/g, "")}`, "#forecast", "#LatviaWeather"];

  const tagLine = hashtags.join(" ");

  return {
    instagram: `${body}\n\n${options.deepLink.replace(/utm_source=[^&]+/, "utm_source=instagram")}\n\n${tagLine}`,
    tiktok: `${body}\n\n${tagLine}`,
    facebook: `${body}\n\nFull hourly forecast: ${options.deepLink.replace(/utm_source=[^&]+/, "utm_source=facebook")}`,
    x: `${options.cityName}: ${options.temperature}, rain ${options.rainChance}. ${options.advice} ${options.deepLink.replace(/utm_source=[^&]+/, "utm_source=x")}`,
    hashtags,
  };
}

/** Next Saturday/Sunday day keys in Europe/Riga relative to `now`. */
export function getUpcomingWeekendDayKeys(now = new Date()): {
  saturday: string;
  sunday: string;
} {
  const local = getLatviaWallClock(now);
  const day = local.getDay(); // 0 Sun … 6 Sat
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = new Date(local);
  saturday.setDate(local.getDate() + (day === 6 ? 0 : daysUntilSaturday));
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return {
    saturday: getLatviaDayKey(saturday),
    sunday: getLatviaDayKey(sunday),
  };
}

function pickForecastHoursForSlot(
  forecasts: HourlyForecast[],
  slot: SocialBriefSlot,
  now: Date,
): HourlyForecast[] {
  if (slot.angle !== "weekend_plan") {
    const today = getTodayForecasts(forecasts);
    return today.length > 0 ? today : forecasts;
  }

  const { saturday, sunday } = getUpcomingWeekendDayKeys(now);
  const weekend = groupForecastsByDay(forecasts)
    .filter((group) => group.dayKey === saturday || group.dayKey === sunday)
    .flatMap((group) => group.forecasts);

  if (weekend.length > 0) return weekend;
  return getTodayForecasts(forecasts);
}

export interface BuildHyperframesDailyBriefOptions {
  data: WeatherData;
  locale?: string;
  /** Override "now" for deterministic tests. */
  now?: Date;
  /** Social platform baked into the default deep link UTM. */
  platform?: string;
  /** Posting slot controls cities upstream; here it shapes copy + campaign. */
  slot?: SocialBriefSlot | SocialBriefSlotId;
}

/**
 * Map a location forecast into HyperFrames template variables + social captions.
 * Pure: no network. Feed `getHourlyForecast` / merged weather data in.
 */
export function buildHyperframesDailyBrief(
  options: BuildHyperframesDailyBriefOptions,
): HyperframesDailyBriefPayload {
  const locale = resolveLocale(options.locale);
  const copy = COPY[locale];
  const now = options.now ?? new Date();
  const platform = options.platform ?? "instagram";
  const slot: SocialBriefSlot =
    typeof options.slot === "string" || options.slot == null
      ? resolveSocialBriefSlot(options.slot)
      : options.slot;
  const { data } = options;

  if (data.forecasts.length === 0) {
    throw new Error("No forecast hours available for daily brief");
  }

  const current = findCurrentForecast(data.forecasts, now);
  const focusHours = pickForecastHoursForSlot(data.forecasts, slot, now);
  const focus = summarizeDay(focusHours.length > 0 ? focusHours : data.forecasts);
  const summary = getWeatherSummaryParts(current);
  const dayKey = getLatviaDayKey(now);
  const citySlug = locationSlug(data.location.name);
  const timeLabel = formatLatviaTime(now, "HH:mm");
  const dateLabel = formatLatviaDateTime(now, locale, "shortDate");
  const temperature = formatSignedTemp(current.temperature);
  const tempHigh = formatDegree(focus.maxTemperature);
  const tempLow = formatDegree(focus.minTemperature);
  const rainChanceValue = Math.round(focus.maxPrecipitationProbability);
  const rainChance = `${rainChanceValue}%`;
  const precipMm = formatPrecip(focus.totalPrecipitation, copy.precipUnit);
  const windLine = `${Math.round(current.windSpeed)} ${copy.windUnit} ${getWindDirection(current.windDirection)}`;
  const condition =
    copy.summary.cond[summary.conditionKey] ?? getConditionKey(current.iconCode);
  const advice = copy.summary.advice[summary.adviceKey] ?? summary.adviceKey;
  const deepLink = buildDeepLink({
    locale,
    location: data.location,
    dayKey,
    platform,
    campaign: slot.campaign,
  });
  const hourly =
    slot.angle === "weekend_plan"
      ? focusHours.map((forecast) => ({
          hour: formatLatviaTime(forecast.time, "HH"),
          temperature: Math.round(forecast.temperature),
          rainChance: Math.round(forecast.precipitationProbability),
          precipMm: Math.round(forecast.precipitation * 10) / 10,
          iconCode: forecast.iconCode,
        }))
      : buildHourlyCurve(data.forecasts);
  const outputKey = `renders/${dayKey}/${slot.id}/${citySlug}-${locale}.mp4`;
  const interesting = rainChanceValue >= slot.interestingRainChance;
  const selected = interesting
    ? [...new Set([...slot.platforms, ...slot.conditionalPlatforms])]
    : [...slot.platforms];

  const variables: HyperframesDailyBriefVariables = {
    brandName: copy.brandName,
    cityName: data.location.name,
    headline: `${data.location.name}, ${timeLabel}`,
    dateLabel,
    temperature,
    tempHigh,
    tempLow,
    rainChance,
    precipMm,
    windLine,
    condition,
    advice,
    hook: buildHook({
      locale,
      slot,
      cityName: data.location.name,
      temperature,
      rainChance: rainChanceValue,
    }),
    cta: copy.cta,
    deepLink,
    emoji: getConditionEmoji(current.iconCode),
    accent: accentForIcon(current.iconCode),
    backgroundGradient: getOgImageGradient(current.iconCode),
    hourlyJson: JSON.stringify(hourly),
    locale,
  };

  return {
    compositionId: HYPERFRAMES_DAILY_BRIEF_COMPOSITION_ID,
    punkts: data.location.id,
    citySlug,
    dayKey,
    slotId: slot.id,
    variables,
    hourly,
    render: {
      width: 1080,
      height: 1920,
      fps: 30,
      format: "mp4",
      aspectRatio: "9:16",
      outputKey,
    },
    captions: buildCaptions({
      locale,
      slot,
      cityName: data.location.name,
      temperature,
      high: tempHigh,
      low: tempLow,
      rainChance,
      condition,
      advice,
      deepLink,
    }),
    publish: {
      always: [...slot.platforms],
      conditional: [...slot.conditionalPlatforms],
      selected,
      interesting,
      rainChance: rainChanceValue,
    },
    batchRow: {
      outputKey,
      executionName: `daily-brief-${slot.id}-${citySlug}-${locale}-${dayKey}`,
      variables,
    },
  };
}

/** Location IDs to seed the first daily-brief city set. */
export const DAILY_BRIEF_SEED_LOCATION_IDS = POPULAR_LOCATION_IDS.slice(0, 6);

export function toHyperframesVariablesJson(
  payload: HyperframesDailyBriefPayload,
): string {
  return JSON.stringify(payload.variables);
}

export function toHyperframesBatchJsonl(
  payloads: HyperframesDailyBriefPayload[],
): string {
  return payloads.map((payload) => JSON.stringify(payload.batchRow)).join("\n");
}
