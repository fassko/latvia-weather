import { NextResponse } from "next/server";
import { getHourlyForecast, REVALIDATE_SECONDS } from "@/lib/weather/fetch";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { resolveLocationId } from "@/lib/weather/locations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const savedPunkts = await getLocationCookie();
  const locationId = resolveLocationId(
    searchParams.get("punkts") ?? undefined,
    savedPunkts,
  );

  try {
    const data = await getHourlyForecast(locationId);

    return NextResponse.json(data, {
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
