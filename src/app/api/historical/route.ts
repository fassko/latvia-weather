import { NextResponse } from "next/server";
import {
  ARCHIVE_REVALIDATE_SECONDS,
  getHistoricalClimateForCoordinates,
  getHistoricalClimateForPunkts,
  HistoricalClimateRequestError,
} from "@/lib/climate/historical";
import { getLocationCookie } from "@/lib/weather/location-cookie.server";
import { isValidLocationId, resolveLocationId } from "@/lib/weather/locations";
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
 * Historical climate comparison for a forecast point or coordinates.
 *
 * Query:
 * - `punkts` / `location` — LVĢMC point id (e.g. P269). Falls back to cookie like `/api/weather`.
 * - or `lat` + `lon` — compare nearest station for arbitrary coordinates.
 *
 * Response: last complete month from the hourly observation archive vs
 * 1991–2020 normals (temp/precip) and wind baseline (prior year or typical).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseCoordinate(searchParams.get("lat"));
  const lon = parseCoordinate(searchParams.get("lon"));
  const hasCoordinates = lat !== null || lon !== null;

  try {
    let payload;

    if (hasCoordinates) {
      if (lat === null || lon === null) {
        return NextResponse.json(
          { error: "Provide both lat and lon, or a punkts/location id." },
          { status: 400 },
        );
      }

      const punktsParam = pickLocationQueryValue(
        searchParams.get(PUNKTS_QUERY_PARAM),
        searchParams.get(LOCATION_QUERY_PARAM),
      );

      payload = await getHistoricalClimateForCoordinates({
        lat,
        lon,
        punkts:
          punktsParam && isValidLocationId(punktsParam) ? punktsParam : undefined,
      });
    } else {
      const savedPunkts = await getLocationCookie();
      const locationId = resolveLocationId(
        pickLocationQueryValue(
          searchParams.get(PUNKTS_QUERY_PARAM),
          searchParams.get(LOCATION_QUERY_PARAM),
        ),
        savedPunkts,
      );
      payload = await getHistoricalClimateForPunkts(locationId);
    }

    if (!payload) {
      return NextResponse.json(
        {
          error:
            "Historical climate data is unavailable for this location or period.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${ARCHIVE_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
      },
    });
  } catch (error) {
    if (error instanceof HistoricalClimateRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch historical climate data";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
