import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  hasLocationQueryParam,
  LOCATION_QUERY_PARAM,
  pickLocationQueryValue,
  PUNKTS_QUERY_PARAM,
} from "./lib/weather/location-query";

const handleLocaleRouting = createMiddleware(routing);

function isLocaleRootPath(pathname: string, locale: string): boolean {
  return pathname === `/${locale}` || pathname === `/${locale}/`;
}

function clearLocationQueryParams(url: URL): void {
  url.searchParams.delete(PUNKTS_QUERY_PARAM);
  url.searchParams.delete(LOCATION_QUERY_PARAM);
}

export default function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const locale = pathname.split("/")[1];
  const punkts = searchParams.get(PUNKTS_QUERY_PARAM);
  const location = searchParams.get(LOCATION_QUERY_PARAM);
  const hasLocationQuery = hasLocationQueryParam(punkts, location);

  if (
    !hasLocationQuery ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    return handleLocaleRouting(request);
  }

  const selectedId = pickLocationQueryValue(punkts, location);

  // Only rewrite legacy forecast query URLs on the locale home. Map (and other)
  // pages keep `?punkts=` / `?location=` for in-page focus without leaving /map.
  if (isLocaleRootPath(pathname, locale)) {
    const url = request.nextUrl.clone();
    clearLocationQueryParams(url);

    // Unknown location ids would otherwise render the default forecast under a
    // URL that crawlers treat as a separate page.
    if (!selectedId) {
      return NextResponse.redirect(url, 307);
    }

    // Preserve existing shared links while consolidating their SEO signals on
    // the location's permanent, crawlable path (`/punkts/...`).
    url.pathname = `/${locale}/punkts/${encodeURIComponent(selectedId)}`;
    return NextResponse.redirect(url, 308);
  }

  // Elsewhere: drop invalid location query keys, and collapse `location` onto
  // the canonical `punkts` query key when both would otherwise diverge.
  if (!selectedId) {
    const url = request.nextUrl.clone();
    clearLocationQueryParams(url);
    return NextResponse.redirect(url, 307);
  }

  const hasCanonical = searchParams.get(PUNKTS_QUERY_PARAM) === selectedId;
  const hasAlias = searchParams.has(LOCATION_QUERY_PARAM);
  if (!hasCanonical || hasAlias) {
    const url = request.nextUrl.clone();
    clearLocationQueryParams(url);
    url.searchParams.set(PUNKTS_QUERY_PARAM, selectedId);
    return NextResponse.redirect(url, 308);
  }

  return handleLocaleRouting(request);
}

export const config = {
  matcher: ["/", "/(en|lv)/:path*"],
};
