import { routing, type Locale } from "@/i18n/routing";
import { renderForecastOgImage } from "@/lib/seo/render-og-image";
import {
  LOCATION_QUERY_PARAM,
  pickLocationQueryValue,
  PUNKTS_QUERY_PARAM,
} from "@/lib/weather/location-query";

// Must be a numeric literal for Next segment config static analysis.
export const revalidate = 900;

/**
 * Location-aware OG images. File-based `opengraph-image` routes do not receive
 * `searchParams`, so shared links with `?punkts=` / `?location=` use this route.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedLocale = searchParams.get("locale");
  const locale = routing.locales.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : routing.defaultLocale;

  return renderForecastOgImage({
    locale,
    punkts: pickLocationQueryValue(
      searchParams.get(PUNKTS_QUERY_PARAM),
      searchParams.get(LOCATION_QUERY_PARAM),
    ),
  });
}
