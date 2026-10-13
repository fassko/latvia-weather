import { enUS, lv, ru, type Locale } from "date-fns/locale";

const DATE_PATTERNS = {
  headerDateTime: {
    en: "EEEE, d MMMM · HH:mm",
    lv: "cccc, d. LLLL · HH:mm",
    ru: "EEEE, d MMMM · HH:mm",
  },
  longDate: {
    en: "EEEE, MMMM d",
    lv: "cccc, d. LLLL",
    ru: "EEEE, d MMMM",
  },
  shortDate: {
    en: "EEE, MMM d",
    lv: "ccc, d. LLL",
    ru: "EEE, d MMM",
  },
  chartDay: {
    en: "EEE d",
    lv: "d. ccc",
    ru: "EEE d",
  },
  chartTooltip: {
    en: "EEE, MMM d · HH:mm",
    lv: "ccc, d. LLL · HH:mm",
    ru: "EEE, d MMM · HH:mm",
  },
  dailyWeekday: {
    en: "EEE",
    lv: "ccc",
    ru: "EEE",
  },
  dailyDate: {
    en: "d MMM",
    lv: "d. LLL",
    ru: "d MMM",
  },
} as const;

export type DatePatternKey = keyof typeof DATE_PATTERNS;

export function getDateFnsLocale(locale: string): Locale {
  if (locale === "lv") return lv;
  if (locale === "ru") return ru;
  return enUS;
}

/** Locale-aware format pattern (LV uses nominative cccc/LLLL, not locative EEEE/MMMM). */
export function getDatePattern(locale: string, key: DatePatternKey): string {
  if (locale === "lv") return DATE_PATTERNS[key].lv;
  if (locale === "ru") return DATE_PATTERNS[key].ru;
  return DATE_PATTERNS[key].en;
}
