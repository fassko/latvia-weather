import { NextResponse } from "next/server";
import {
  getHourlyForecast,
  getLocationPoints,
  mergeForecastLocation,
  REVALIDATE_SECONDS,
} from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { resolveLocationId } from "@/lib/weather/locations";
import {
  LOCATION_QUERY_PARAM,
  pickLocationQueryValue,
  PUNKTS_QUERY_PARAM,
} from "@/lib/weather/location-query";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(
    pickLocationQueryValue(
      searchParams.get(PUNKTS_QUERY_PARAM),
      searchParams.get(LOCATION_QUERY_PARAM),
    ),
    savedPunkts,
  );

  try {
    const [data, locations] = await Promise.all([
      getHourlyForecast(locationId),
      getLocationPoints(),
    ]);

    return NextResponse.json(mergeForecastLocation(data, locations), {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch weather data";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
