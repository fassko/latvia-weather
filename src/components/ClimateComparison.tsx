import { getTranslations } from "next-intl/server";
import {
  classifyPrecipitationDelta,
  classifyTemperatureDelta,
  classifyWindDelta,
  DISTANCE_CAUTION_KM,
  NORMALS_PERIOD_LABEL,
  type ClimateMetricComparison,
  type ClimateMonthComparison,
} from "@/lib/climate/compare";
import {
  convertWindSpeed,
  formatWindSpeed,
  getWindSpeedUnitSuffix,
  type WindUnit,
} from "@/lib/weather/wind-units";
import { getWindUnitsCookie } from "@/lib/weather/wind-units-cookie.server";

interface ClimateComparisonProps {
  comparison: ClimateMonthComparison;
  locale: string;
}

function formatSigned(value: number, digits: number, suffix: string): string {
  const rounded = Number(value.toFixed(digits));
  const abs = Math.abs(rounded).toFixed(digits);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${abs}${suffix}`;
}

function monthLabel(locale: string, year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function metricVerdict(
  metric: ClimateMetricComparison,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  if (metric.kind === "temperature") {
    return t(`verdict.temperature.${classifyTemperatureDelta(metric.delta)}`);
  }
  if (metric.kind === "precipitation") {
    return t(
      `verdict.precipitation.${classifyPrecipitationDelta(metric.actual, metric.baseline)}`,
    );
  }
  const windKey = classifyWindDelta(metric.delta);
  if (metric.baselineKind === "priorYearMonth") {
    return t(`verdict.windLastYear.${windKey}`);
  }
  return t(`verdict.windTypical.${windKey}`);
}

function formatMetricValue(
  metric: ClimateMetricComparison,
  windUnit: WindUnit,
): { actual: string; baseline: string; delta: string } {
  if (metric.kind === "temperature") {
    return {
      actual: `${metric.actual.toFixed(1)}°C`,
      baseline: `${metric.baseline.toFixed(1)}°C`,
      delta: formatSigned(metric.delta, 1, "°C"),
    };
  }
  if (metric.kind === "precipitation") {
    return {
      actual: `${metric.actual.toFixed(1)} mm`,
      baseline: `${metric.baseline.toFixed(1)} mm`,
      delta: formatSigned(metric.delta, 1, " mm"),
    };
  }

  const suffix = ` ${getWindSpeedUnitSuffix(windUnit)}`;
  return {
    actual: formatWindSpeed(metric.actual, windUnit),
    baseline: formatWindSpeed(metric.baseline, windUnit),
    delta: formatSigned(convertWindSpeed(metric.delta, windUnit), 1, suffix),
  };
}

export async function ClimateComparison({
  comparison,
  locale,
}: ClimateComparisonProps) {
  const t = await getTranslations("climate");
  const windUnit = await getWindUnitsCookie();
  const period = monthLabel(locale, comparison.year, comparison.month);
  const distance = comparison.distanceKm.toFixed(
    comparison.distanceKm < 10 ? 1 : 0,
  );
  const caution = comparison.distanceKm >= DISTANCE_CAUTION_KM;

  return (
    <section
      aria-labelledby="climate-comparison-heading"
      className="space-y-3"
    >
      <div className="space-y-1">
        <h2
          id="climate-comparison-heading"
          className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
        >
          {t("title")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("subtitle", { period })}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {comparison.metrics.map((metric) => {
          const values = formatMetricValue(metric, windUnit);
          const baselineLabel =
            metric.baselineKind === "climateNormal"
              ? t("baseline.climateNormal", { period: NORMALS_PERIOD_LABEL })
              : metric.baselineKind === "priorYearMonth"
                ? t("baseline.priorYearMonth")
                : t("baseline.stationTypical");

          return (
            <div
              key={metric.kind}
              className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t(`metrics.${metric.kind}`)}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {values.actual}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                {metricVerdict(metric, t)}
                <span className="text-slate-500 dark:text-slate-400">
                  {" "}
                  ({values.delta})
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {baselineLabel}: {values.baseline}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {caution
          ? t("stationFar", {
              station: comparison.station.name,
              distance,
            })
          : t("stationNear", {
              station: comparison.station.name,
              distance,
            })}{" "}
        {t("disclaimer")}{" "}
        <a
          href="https://data.gov.lv/dati/dataset/klimatiskie-dati"
          className="underline hover:text-slate-700 dark:hover:text-slate-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          data.gov.lv
        </a>
        .
      </p>
    </section>
  );
}
