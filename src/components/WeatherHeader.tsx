import { format } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { AppToolbar } from "@/components/AppToolbar";
import { FeelsLikeText } from "@/components/FeelsLikeText";
import { LocationSwitcher } from "@/components/LocationSwitcher";
import { WindDirection } from "@/components/WindDirection";
import { getDateFnsLocale, getDatePattern } from "@/lib/date-locale";
import { formatCoordinates, openStreetMapUrl } from "@/lib/weather/coordinates";
import { getConditionEmoji, getConditionKey } from "@/lib/weather/parse";
import type { HourlyForecast, WeatherData, WeatherLocationPoint } from "@/lib/weather/types";

function findCurrentForecast(forecasts: HourlyForecast[]): HourlyForecast {
  const now = Date.now();
  const upcoming = forecasts.find((f) => f.time.getTime() >= now);
  return upcoming ?? forecasts[forecasts.length - 1];
}

interface WeatherHeaderProps {
  data: WeatherData;
  locations: WeatherLocationPoint[];
}

export async function WeatherHeader({ data, locations }: WeatherHeaderProps) {
  const locale = await getLocale();
  const t = await getTranslations("header");
  const tConditions = await getTranslations("conditions");
  const dateLocale = getDateFnsLocale(locale);
  const current = findCurrentForecast(data.forecasts);
  const selectedLocation = locations.find((location) => location.id === data.location.id);

  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <LocationSwitcher locations={locations} selectedId={data.location.id} />
          <p className="mt-1 text-slate-600 dark:text-slate-400">{data.location.region}</p>
          {selectedLocation && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <a
                href={openStreetMapUrl(selectedLocation.lat, selectedLocation.lon)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono underline decoration-slate-300 underline-offset-2 hover:text-slate-700 dark:decoration-slate-600 dark:hover:text-slate-200"
              >
                {formatCoordinates(selectedLocation.lat, selectedLocation.lon)}
              </a>
            </p>
          )}
        </div>
        <AppToolbar />
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 p-6 text-white shadow-lg dark:from-sky-600 dark:to-sky-900 dark:shadow-sky-950/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sky-100">
              {format(current.time, getDatePattern(locale, "headerDateTime"), { locale: dateLocale })}
            </p>
            <p className="mt-2 text-5xl font-bold tabular-nums">
              {Math.round(current.temperature)}°C
            </p>
            <p className="mt-1 text-sky-100">
              <FeelsLikeText
                temperature={current.temperature}
                feelsLike={current.feelsLike}
              />{" "}
              · {tConditions(getConditionKey(current.iconCode))}
            </p>
          </div>
          <span className="text-5xl" aria-hidden="true">
            {getConditionEmoji(current.iconCode)}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-sky-200">{t("humidity")}</dt>
            <dd className="text-lg font-semibold">{Math.round(current.humidity)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-200">{t("wind")}</dt>
            <dd className="text-lg font-semibold">
              {current.windSpeed.toFixed(1)} m/s{" "}
              <WindDirection degrees={current.windDirection} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-sky-200">{t("gusts")}</dt>
            <dd className="text-lg font-semibold">{current.windGust.toFixed(1)} m/s</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-200">{t("rainChance")}</dt>
            <dd className="text-lg font-semibold">
              {Math.round(current.precipitationProbability)}%
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
