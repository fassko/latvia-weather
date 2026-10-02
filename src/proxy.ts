import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  isNonCanonicalPunktsSegment,
} from "./lib/seo/location-canonical";
import { DEFAULT_LOCATION_ID, isValidLocationId } from "./lib/weather/locations";
import {
  hasLocationQueryParam,
  LOCATION_QUERY_PARAM,
  pickLocationQueryValue,
  PUNKTS_QUERY_PARAM,
} from "./lib/weather/location-query";
import { localizedPath, locationIdFromSlug } from "./lib/site";

const handleLocaleRouting = createMiddleware(routing);
const WEATHER_API_BASE = "https://videscentrs.lvgmc.lv/data";

function isLocaleRootPath(pathname: string, locale: string): boolean {
  return pathname === `/${locale}` || pathname === `/${locale}/`;
}

function clearLocationQueryParams(url: URL): void {
  url.searchParams.delete(PUNKTS_QUERY_PARAM);
  url.searchParams.delete(LOCATION_QUERY_PARAM);
}

/** Preference cookies that personalize HTML — skip shared cache when present. */
const PERSONALIZATION_COOKIES = [
  "weather-punkts",
  "weather-wind-units",
  "weather-warnings-dismissed",
];

function hasPersonalizationCookies(request: NextRequest): boolean {
  return PERSONALIZATION_COOKIES.some((name) => request.cookies.has(name));
}

function isHtmlNavigation(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

/**
 * Best-effort anonymous/bot HTML caching. Next.js still marks many pages
 * dynamic (cookies in the React tree), so this mainly helps when the platform
 * honors the header and avoids `no-store` for cookie-free navigations.
 * Residual: personalized visits remain private/no-store.
 */
function withAnonymousHtmlCacheHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (!isHtmlNavigation(request) || hasPersonalizationCookies(request)) {
    return response;
  }

  // Prefer bfcache-friendly directives over no-store for anonymous HTML.
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600",
  );
  return response;
}

/** Hard 308 for bare/hybrid ID path segments before the page can soft-serve. */
async function redirectNonCanonicalPunkts(
  request: NextRequest,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const match = /^\/(en|lv)\/punkts\/([^/]+)\/?$/i.exec(pathname);
  if (!match) return null;

  const locale = match[1].toLowerCase();
  const segment = decodeURIComponent(match[2]);
  if (!isNonCanonicalPunktsSegment(segment)) return null;

  const locationId = locationIdFromSlug(segment);
  if (!locationId || !isValidLocationId(locationId)) return null;

  try {
    const response = await fetch(
      `${WEATHER_API_BASE}/weather_forecast_for_location_hourly?punkts=${encodeURIComponent(locationId)}`,
      {
        headers: { Accept: "application/json" },
        // Name lookup is stable; keep redirects snappy for crawlers.
        next: { revalidate: 86_400 },
      },
    );
    if (!response.ok) return null;

    const raw = (await response.json()) as Array<{ nosaukums?: string }>;
    const name = raw[0]?.nosaukums?.trim();
    if (!name) return null;

    const canonicalPath = localizedPath(
      locale,
      locationId === DEFAULT_LOCATION_ID ? undefined : locationId,
      name,
    );
    if (pathname.replace(/\/$/, "") === canonicalPath) return null;

    const url = request.nextUrl.clone();
    url.pathname = canonicalPath;
    return NextResponse.redirect(url, 308);
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  const punktsRedirect = await redirectNonCanonicalPunkts(request);
  if (punktsRedirect) return punktsRedirect;

  const { pathname, searchParams } = request.nextUrl;
  const locale = pathname.split("/")[1];
  const punkts = searchParams.get(PUNKTS_QUERY_PARAM);
  const location = searchParams.get(LOCATION_QUERY_PARAM);
  const hasLocationQuery = hasLocationQueryParam(punkts, location);

  if (
    !hasLocationQuery ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    const response = handleLocaleRouting(request);
    return withAnonymousHtmlCacheHeaders(request, response);
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

    // Prefer the readable name slug in one hop when the forecast name resolves;
    // otherwise land on the ID path (which redirects to the slug above).
    try {
      const response = await fetch(
        `${WEATHER_API_BASE}/weather_forecast_for_location_hourly?punkts=${encodeURIComponent(selectedId)}`,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 86_400 },
        },
      );
      if (response.ok) {
        const raw = (await response.json()) as Array<{ nosaukums?: string }>;
        const name = raw[0]?.nosaukums?.trim();
        if (name) {
          url.pathname = localizedPath(
            locale,
            selectedId === DEFAULT_LOCATION_ID ? undefined : selectedId,
            name,
          );
          return NextResponse.redirect(url, 308);
        }
      }
    } catch {
      // Fall through to the ID path.
    }

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

  return withAnonymousHtmlCacheHeaders(request, handleLocaleRouting(request));
}

export const config = {
  matcher: ["/", "/(en|lv)/:path*"],
};
