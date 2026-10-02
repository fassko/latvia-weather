import { getTranslations } from "next-intl/server";
import {
  classifyPrecipitationDelta,
  classifyTemperatureDelta,
  type ClimateMonthComparison,
} from "@/lib/climate/compare";

interface LocationIntroProps {
  locale: string;
  climateComparison: ClimateMonthComparison | null;
}

/**
 * Climate-led intro when comparison data is available.
 * Keeps location pages unique without the generic LVĢMC template sentence.
 */
export async function LocationIntro({
  locale,
  climateComparison,
}: LocationIntroProps) {
  const t = await getTranslations("locationIntro");

  const monthLabel = climateComparison
    ? new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(
        new Date(Date.UTC(climateComparison.year, climateComparison.month - 1, 1)),
      )
    : null;

  const temperature = climateComparison?.metrics.find(
    (metric) => metric.kind === "temperature",
  );
  const precipitation = climateComparison?.metrics.find(
    (metric) => metric.kind === "precipitation",
  );

  let climateSentence: string | null = null;
  if (temperature && monthLabel) {
    const verdict = t(
      `temperature.${classifyTemperatureDelta(temperature.delta)}`,
      {
        month: monthLabel,
        delta: Math.abs(temperature.delta).toFixed(1),
      },
    );
    if (precipitation) {
      const rain = t(
        `precipitation.${classifyPrecipitationDelta(
          precipitation.actual,
          precipitation.baseline,
        )}`,
      );
      climateSentence = `${verdict} ${rain}`;
    } else {
      climateSentence = verdict;
    }
  }

  if (!climateSentence && !climateComparison) return null;

  return (
    <section
      aria-label={t("sectionLabel")}
      className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
    >
      {climateSentence ? <p>{climateSentence}</p> : null}
      {climateComparison ? (
        <p className={`text-xs text-slate-500 dark:text-slate-400 ${climateSentence ? "mt-1" : ""}`}>
          <a href="#climate" className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
            {t("climateLink")}
          </a>
        </p>
      ) : null}
    </section>
  );
}
