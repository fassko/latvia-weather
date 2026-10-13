import { routing, type Locale } from "@/i18n/routing";

/** Open Graph `og:locale` tag values. */
const OG_LOCALES: Record<Locale, string> = {
  lv: "lv_LV",
  en: "en_US",
  ru: "ru_RU",
};

/** BCP 47 / HTML `lang` / JSON-LD `inLanguage` tags. */
const BCP47_TAGS: Record<Locale, string> = {
  lv: "lv-LV",
  en: "en-US",
  ru: "ru-RU",
};

/** Intl.DateTimeFormat / NumberFormat locale identifiers. */
const INTL_LOCALES: Record<Locale, string> = {
  lv: "lv-LV",
  en: "en-US",
  ru: "ru-RU",
};

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

export function getOgLocale(locale: string): string {
  return isLocale(locale) ? OG_LOCALES[locale] : OG_LOCALES.en;
}

/** All OG locales except the current page language. */
export function getOgAlternateLocales(locale: string): string[] {
  const current = getOgLocale(locale);
  return routing.locales
    .map((loc) => OG_LOCALES[loc])
    .filter((tag) => tag !== current);
}

export function getBcp47Tag(locale: string): string {
  return isLocale(locale) ? BCP47_TAGS[locale] : BCP47_TAGS.en;
}

export function getIntlLocale(locale: string): string {
  return isLocale(locale) ? INTL_LOCALES[locale] : INTL_LOCALES.en;
}

/**
 * LVĢMC warning/alarm copy only ships Latvian + English. Use Latvian for `lv`,
 * English for every other UI locale (including Russian).
 */
export function prefersLatvianWeatherCopy(locale: string): boolean {
  return locale === "lv";
}
