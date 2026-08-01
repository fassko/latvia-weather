import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "lv"],
  defaultLocale: "en",
  localePrefix: "always",
  // The middleware `Link` header drops the `?punkts=` location, which would
  // contradict the hreflang tags rendered from page metadata.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
