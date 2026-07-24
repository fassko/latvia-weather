import { getLocale, getTranslations } from "next-intl/server";
import { getTodayForecasts } from "@/lib/weather/chart-data";
import { summarizeDay } from "@/lib/weather/daily";
import { getWeatherHeaderTheme } from "@/lib/weather/header-theme";
import { getConditionEmoji, getConditionKey, getWindDirection, isNightIcon } from "@/lib/weather/parse";
import { getWeatherSummaryParts } from "@/lib/weather/summary";
import { formatLatviaDateTime } from "@/lib/weather/timezone";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import type { HourlyForecast, WeatherData } from "@/lib/weather/types";

function findCurrentForecast(forecasts: HourlyForecast[]): HourlyForecast {
  const now = Date.now();
  const upcoming = forecasts.find((f) => f.time.getTime() >= now);
  return upcoming ?? forecasts[forecasts.length - 1];
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      style={{ transform: `rotate(${degrees + 180}deg)` }}
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M8 2v10M8 2L5 7M8 2l3 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface WeatherHeroProps {
  data: WeatherData;
}

export async function WeatherHero({ data }: WeatherHeroProps) {
  const locale = await getLocale();
  const t = await getTranslations("hero");
  const tConditions = await getTranslations("conditions");
  const tSummary = await getTranslations("summary");
  const windUnit = await getWindUnitsCookie();

  const current = findCurrentForecast(data.forecasts);
  const theme = getWeatherHeaderTheme(current.iconCode);
  const today = summarizeDay(getTodayForecasts(data.forecasts));
  const summary = getWeatherSummaryParts(current);
  const night = isNightIcon(current.iconCode);

  return (
    <section
      className={`relative isolate overflow-hidden ${theme.card} ${theme.text}`}
    >
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-7">
        {/* Ambient celestial glow, aligned to the content column */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 right-0 -z-10 h-72 w-72 rounded-full blur-2xl sm:right-4"
          style={{
            background: night
              ? "radial-gradient(circle, rgba(226,232,240,0.55) 0%, rgba(148,163,184,0.15) 45%, transparent 70%)"
              : "radial-gradient(circle, rgba(255,243,191,0.9) 0%, rgba(253,224,71,0.45) 40%, transparent 70%)",
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2 right-2 -z-10 text-6xl opacity-95 drop-shadow-[0_2px_16px_rgba(0,0,0,0.15)] sm:right-6 sm:text-9xl"
        >
          {getConditionEmoji(current.iconCode)}
        </span>

        <p className={`text-sm font-medium ${theme.muted}`}>
          {formatLatviaDateTime(new Date(), locale, "headerDateTime")}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
          <p className="flex items-start font-bold leading-none tabular-nums">
            <span className="text-6xl sm:text-7xl">
              {Math.round(current.temperature)}
            </span>
            <span className="mt-1 text-2xl sm:text-3xl">°</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="text-3xl" aria-hidden="true">
              {getConditionEmoji(current.iconCode)}
            </span>
            <span className="text-2xl font-semibold sm:text-3xl">
              {tConditions(getConditionKey(current.iconCode))}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm ${theme.text}`}
          >
            {t("feelsLike", { temp: Math.round(current.feelsLike) })}
          </span>
          <span
            className={`rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm ${theme.text}`}
          >
            {t("highLow", {
              high: Math.round(today.maxTemperature),
              low: Math.round(today.minTemperature),
            })}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm ${theme.text}`}
          >
            <WindArrow degrees={current.windDirection} />
            {formatWindSpeed(current.windSpeed, windUnit)}
            <span className="opacity-80">{getWindDirection(current.windDirection)}</span>
          </span>
        </div>

        <p className={`mt-3 max-w-xl text-sm sm:text-base ${theme.muted}`}>
          {tSummary(`cond.${summary.conditionKey}`)}.{" "}
          {tSummary(`advice.${summary.adviceKey}`)}
        </p>
      </div>
    </section>
  );
}
