import { NextResponse } from "next/server";
import {
  ALARMS_REVALIDATE_SECONDS,
  getWeatherAlarmsPayload,
  resolveIncludeGeometry,
  WeatherAlarmsRequestError,
} from "@/lib/weather/alarms-api";
import {
  LOCATION_QUERY_PARAM,
  pickLocationQueryValue,
  PUNKTS_QUERY_PARAM,
} from "@/lib/weather/location-query";

function parseCoordinate(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Active LVĢMC weather alarms / warnings (hydrometeorological alerts).
 *
 * Query:
 * - (none) — all currently active alarms
 * - `punkts` / `location` — filter to alarms whose polygon covers that forecast point
 * - `lat` + `lon` — filter by arbitrary coordinates (point-in-polygon)
 * - `geometry=0` / `includeGeometry=false` — omit polygon rings for a lighter payload
 *
 * Upstream: data.gov.lv dataset `hidrometeorologiskie-bridinajumi` (same source as the map).
 * Each alarm includes LV + EN text fields from the official open data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseCoordinate(searchParams.get("lat"));
  const lon = parseCoordinate(searchParams.get("lon"));
  const punkts = pickLocationQueryValue(
    searchParams.get(PUNKTS_QUERY_PARAM),
    searchParams.get(LOCATION_QUERY_PARAM),
  );
  const includeGeometry = resolveIncludeGeometry(
    searchParams.get("geometry"),
    searchParams.get("includeGeometry"),
  );

  try {
    const payload = await getWeatherAlarmsPayload({
      punkts,
      lat,
      lon,
      includeGeometry,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${ALARMS_REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  } catch (error) {
    if (error instanceof WeatherAlarmsRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch weather alarms";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
