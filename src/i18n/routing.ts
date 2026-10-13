import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["lv", "en", "ru"],
  defaultLocale: "lv",
  localePrefix: "always",
  // Latvian is the primary locale: `/` always resolves to `/lv`. English and
  // Russian stay available via `/en`, `/ru`, and the language switcher.
  localeDetection: false,
  // Location pages supply their own hreflang metadata, including the active
  // forecast point, so middleware-generated alternates stay disabled.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
