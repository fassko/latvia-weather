import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { FeelsLikeText } from "@/components/FeelsLikeText";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocationCombobox } from "@/components/LocationCombobox";
import { LocationCoordinates } from "@/components/LocationCoordinates";
import { ShareButton } from "@/components/ShareButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WindDirection } from "@/components/WindDirection";
import { getWeatherHeaderTheme } from "@/lib/weather/header-theme";
import { formatLatviaDateTime } from "@/lib/weather/timezone";
import { getLocationSubtitle } from "@/lib/weather/locations";
import { getConditionEmoji, getConditionKey } from "@/lib/weather/parse";
import type { HourlyForecast, WeatherData } from "@/lib/weather/types";

function findCurrentForecast(forecasts: HourlyForecast[]): HourlyForecast {
  const now = Date.now();
  const upcoming = forecasts.find((f) => f.time.getTime() >= now);
  return upcoming ?? forecasts[forecasts.length - 1];
}

interface WeatherHeaderProps {
  data: WeatherData;
}

export async function WeatherHeader({ data }: WeatherHeaderProps) {
  const locale = await getLocale();
  const t = await getTranslations("header");
  const tConditions = await getTranslations("conditions");
  const current = findCurrentForecast(data.forecasts);
  const headerTheme = getWeatherHeaderTheme(current.iconCode);
  const locationSubtitle = getLocationSubtitle(
    data.location.name,
    data.location.region,
    locale,
  );

  const extraStats: Array<{ label: string; value: string }> = [];

  extraStats.push({
    label: t("cloudCover"),
    value: `${Math.round(current.cloudCover)}%`,
  });

  if (current.uvIndex !== null) {
    extraStats.push({
      label: t("uvIndex"),
      value: current.uvIndex.toFixed(1),
    });
  }

  if (current.thunderProbability > 0) {
    extraStats.push({
      label: t("thunderChance"),
      value: `${Math.round(current.thunderProbability)}%`,
    });
  }

  return (
    <header className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <LocationCombobox selectedId={data.location.id} selectedName={data.location.name} />
            <LocationCoordinates locationId={data.location.id} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Suspense fallback={null}>
              <LanguageSwitcher />
            </Suspense>
            <ThemeToggle />
            <Suspense fallback={null}>
              <ShareButton />
            </Suspense>
          </div>
        </div>
        {locationSubtitle ? (
          <p className="text-slate-600 dark:text-slate-400">{locationSubtitle}</p>
        ) : null}
      </div>

      <div
        className={`rounded-2xl p-5 sm:p-6 ${headerTheme.card} ${headerTheme.shadow} ${headerTheme.text}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-base font-medium ${headerTheme.muted}`}>
              {formatLatviaDateTime(new Date(), locale, "headerDateTime")}
            </p>
            <p className="mt-2 text-5xl font-bold tabular-nums sm:text-6xl">
              {Math.round(current.temperature)}°C
            </p>
            <p className={`mt-2 text-base sm:text-lg ${headerTheme.muted}`}>
              <FeelsLikeText
                temperature={current.temperature}
                feelsLike={current.feelsLike}
              />{" "}
              · {tConditions(getConditionKey(current.iconCode))}
            </p>
          </div>
          <span className="text-5xl sm:text-6xl" aria-hidden="true">
            {getConditionEmoji(current.iconCode)}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          <div>
            <dt className={`text-sm ${headerTheme.statLabel}`}>{t("humidity")}</dt>
            <dd className="text-lg font-semibold">{Math.round(current.humidity)}%</dd>
          </div>
          <div>
            <dt className={`text-sm ${headerTheme.statLabel}`}>{t("wind")}</dt>
            <dd className="text-lg font-semibold">
              {current.windSpeed.toFixed(1)} m/s{" "}
              <WindDirection degrees={current.windDirection} />
            </dd>
          </div>
          <div>
            <dt className={`text-sm ${headerTheme.statLabel}`}>{t("gusts")}</dt>
            <dd className="text-lg font-semibold">{current.windGust.toFixed(1)} m/s</dd>
          </div>
          <div>
            <dt className={`text-sm ${headerTheme.statLabel}`}>{t("rainChance")}</dt>
            <dd className="text-lg font-semibold">
              {Math.round(current.precipitationProbability)}%
            </dd>
          </div>
          {extraStats.map((stat) => (
            <div key={stat.label}>
              <dt className={`text-sm ${headerTheme.statLabel}`}>{stat.label}</dt>
              <dd className="text-lg font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
