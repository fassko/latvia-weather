import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import {
  getCloudBandKey,
  getFeelsBandKey,
  getHumidityBandKey,
  getUvBandKey,
  getWindBandKey,
} from "@/lib/weather/metric-descriptors";
import { getWindDirection } from "@/lib/weather/parse";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";
import type { HourlyForecast } from "@/lib/weather/types";

function findCurrentForecast(forecasts: HourlyForecast[]): HourlyForecast {
  const now = Date.now();
  const upcoming = forecasts.find((f) => f.time.getTime() >= now);
  return upcoming ?? forecasts[forecasts.length - 1];
}

interface MetricCardsProps {
  forecasts: HourlyForecast[];
}

export async function MetricCards({ forecasts }: MetricCardsProps) {
  const t = await getTranslations("metrics");
  const windUnit = await getWindUnitsCookie();
  const current = findCurrentForecast(forecasts);

  const cards: { key: string; label: string; icon: ReactNode; value: string; sub: ReactNode }[] = [
    {
      key: "feels",
      label: t("feels"),
      icon: <ThermometerIcon />,
      value: `${Math.round(current.feelsLike)}°`,
      sub: t(`feelsBand.${getFeelsBandKey(current.temperature, current.feelsLike)}`),
    },
    {
      key: "humidity",
      label: t("humidity"),
      icon: <DropletIcon />,
      value: `${Math.round(current.humidity)}%`,
      sub: t(`humidityBand.${getHumidityBandKey(current.humidity)}`),
    },
    {
      key: "wind",
      label: t("wind"),
      icon: <WindIcon />,
      value: formatWindSpeed(current.windSpeed, windUnit),
      sub: (
        <span className="inline-flex items-center gap-1">
          <WindArrow degrees={current.windDirection} />
          {t("direction", { direction: getWindDirection(current.windDirection) })}
        </span>
      ),
    },
    {
      key: "gusts",
      label: t("gusts"),
      icon: <GustIcon />,
      value: formatWindSpeed(current.windGust, windUnit),
      sub: t(`windBand.${getWindBandKey(current.windGust)}`),
    },
    {
      key: "rain",
      label: t("rain"),
      icon: <RainIcon />,
      value: `${Math.round(current.precipitationProbability)}%`,
      sub: t("rainNextHour"),
    },
    {
      key: "clouds",
      label: t("clouds"),
      icon: <CloudIcon />,
      value: `${Math.round(current.cloudCover)}%`,
      sub: t(`cloudBand.${getCloudBandKey(current.cloudCover)}`),
    },
  ];

  if (current.uvIndex !== null) {
    cards.push({
      key: "uv",
      label: t("uvIndex"),
      icon: <UvIcon />,
      value: `${Math.round(current.uvIndex)}`,
      sub: t(`uvBand.${getUvBandKey(current.uvIndex)}`),
    });
  }

  cards.push({
    key: "pressure",
    label: t("pressure"),
    icon: <GaugeIcon />,
    value: current.pressure.toFixed(1),
    sub: t("hpa"),
  });

  return (
    <section aria-label={t("sectionLabel")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <span className="text-sky-500 dark:text-sky-400">{card.icon}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {card.value}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {card.sub}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const iconClass = "h-4 w-4";

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3 shrink-0 text-sky-500 dark:text-sky-400"
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

function WindIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5M3 16h13a2.5 2.5 0 1 1-2.5 2.5M3 12h16a2.5 2.5 0 1 0-2.5-2.5" />
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

function RainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <path d="M7 15a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 7a3.5 3.5 0 0 1 0 7" />
      <path d="M8 18.5 7 20M12 18.5 11 20M16 18.5 15 20" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 10a3.5 3.5 0 0 1 0 8Z" />
    </svg>
  );
}

function UvIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
      <path d="M12 14 15 9M4 18a8 8 0 1 1 16 0" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
