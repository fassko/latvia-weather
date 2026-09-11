import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site";

/** Locale + x-default hreflang map for a path under each locale prefix. */
export function buildLanguageAlternates(path = ""): Record<string, string> {
  const baseUrl = getSiteUrl();
  const normalized = path.startsWith("/") || path === "" ? path : `/${path}`;
  const suffix = normalized === "/" ? "" : normalized;

  return {
    ...Object.fromEntries(
      routing.locales.map((locale) => [
        locale,
        `${baseUrl}/${locale}${suffix}`,
      ]),
    ),
    "x-default": `${baseUrl}/${routing.defaultLocale}${suffix}`,
  };
}

export function buildLocalePageUrl(locale: string, path = ""): string {
  const baseUrl = getSiteUrl();
  const normalized = path.startsWith("/") || path === "" ? path : `/${path}`;
  const suffix = normalized === "/" ? "" : normalized;
  return `${baseUrl}/${locale}${suffix}`;
}
