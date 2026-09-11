import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "lv"],
  defaultLocale: "en",
  localePrefix: "always",
  // Location pages supply their own hreflang metadata, including the active
  // forecast point, so middleware-generated alternates stay disabled.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
