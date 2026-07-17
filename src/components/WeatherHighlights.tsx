import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { getRemainingTodayForecasts } from "@/lib/weather/chart-data";
import { formatLatviaTime } from "@/lib/weather/timezone";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import type { HourlyForecast } from "@/lib/weather/types";

function maxBy(
  forecasts: HourlyForecast[],
  getValue: (forecast: HourlyForecast) => number,
): HourlyForecast {
  return forecasts.reduce((best, forecast) =>
    getValue(forecast) > getValue(best) ? forecast : best,
  );
}

interface WeatherHighlightsProps {
  forecasts: HourlyForecast[];
}

export async function WeatherHighlights({ forecasts }: WeatherHighlightsProps) {
  const t = await getTranslations("highlights");
  const windUnit = await getWindUnitsCookie();
  const period = getRemainingTodayForecasts(forecasts);

  if (period.length === 0) return null;

  const warmest = maxBy(period, (f) => f.temperature);
  const wettest = maxBy(period, (f) => f.precipitationProbability);
  const windiest = maxBy(period, (f) => f.windGust);

  const items: {
    key: string;
    label: string;
    value: string;
    time: Date;
    icon: ReactNode;
    tone: string;
    arrow?: number;
  }[] = [
    {
      key: "warmest",
      label: t("warmest"),
      value: `${Math.round(warmest.temperature)}°`,
      time: warmest.time,
      icon: <ThermometerIcon />,
      tone: "bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400",
    },
    {
      key: "peakRain",
      label: t("peakRain"),
      value: `${Math.round(wettest.precipitationProbability)}%`,
      time: wettest.time,
      icon: <DropletIcon />,
      tone: "bg-sky-100 text-sky-500 dark:bg-sky-500/15 dark:text-sky-400",
    },
    {
      key: "windGusts",
      label: t("windGusts"),
      value: formatWindSpeed(windiest.windGust, windUnit),
      time: windiest.time,
      icon: <GustIcon />,
      tone: "bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-300",
      arrow: windiest.windDirection,
    },
  ];

  return (
    <section aria-labelledby="highlights-heading" className="space-y-3">
      <h2
        id="highlights-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        {t("title")}
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/70 bg-white p-2.5 text-center shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:text-left dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${item.tone}`}
            >
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px] dark:text-slate-500">
                {item.label}
              </p>
              <p className="flex items-center justify-center gap-1 text-base font-bold tabular-nums text-slate-900 sm:justify-start sm:gap-1.5 sm:text-2xl dark:text-slate-100">
                {item.value}
                {item.arrow !== undefined ? (
                  <WindArrow degrees={item.arrow} />
                ) : null}
              </p>
              <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                {t("at", { time: formatLatviaTime(item.time, "HH:mm") })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const iconClass = "h-3.5 w-3.5 sm:h-5 sm:w-5";

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3 shrink-0 text-slate-400 sm:h-4 sm:w-4 dark:text-slate-500"
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

function ThermometerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z" />
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <path d="M12 2.5S5.5 9.5 5.5 14a6.5 6.5 0 0 0 13 0c0-4.5-6.5-11.5-6.5-11.5Z" />
    </svg>
  );
}

function GustIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <path d="M5 7h8a2 2 0 1 0-2-2M4 12h11a2 2 0 1 1-2 2M6 17h6a2 2 0 1 1-2 2" />
    </svg>
  );
}
