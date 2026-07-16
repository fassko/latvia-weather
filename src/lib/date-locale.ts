import { enUS, lv, type Locale } from "date-fns/locale";

const DATE_PATTERNS = {
  headerDateTime: { en: "EEEE, d MMMM · HH:mm", lv: "cccc, d. LLLL · HH:mm" },
  longDate: { en: "EEEE, MMMM d", lv: "cccc, d. LLLL" },
  shortDate: { en: "EEE, MMM d", lv: "ccc, d. LLL" },
  chartDay: { en: "EEE d", lv: "d. ccc" },
  chartTooltip: { en: "EEE, MMM d · HH:mm", lv: "ccc, d. LLL · HH:mm" },
  dailyWeekday: { en: "EEE", lv: "ccc" },
  dailyDate: { en: "d MMM", lv: "d. LLL" },
} as const;

export type DatePatternKey = keyof typeof DATE_PATTERNS;

export function getDateFnsLocale(locale: string): Locale {
  return locale === "lv" ? lv : enUS;
}

/** Locale-aware format pattern (LV uses nominative cccc/LLLL, not locative EEEE/MMMM). */
export function getDatePattern(locale: string, key: DatePatternKey): string {
  return locale === "lv" ? DATE_PATTERNS[key].lv : DATE_PATTERNS[key].en;
}
