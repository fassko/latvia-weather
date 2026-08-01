import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isValidLocationId } from "./lib/weather/locations";

const handleLocaleRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const punkts = request.nextUrl.searchParams.get("punkts");

  // Unknown location ids would otherwise render the default forecast under a
  // URL that crawlers treat as a separate page.
  if (punkts !== null && !isValidLocationId(punkts)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("punkts");
    return NextResponse.redirect(url, 307);
  }

  return handleLocaleRouting(request);
}

export const config = {
  matcher: ["/", "/(en|lv)/:path*"],
};
