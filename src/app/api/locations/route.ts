import { NextResponse } from "next/server";
import { getLocationPoints, REVALIDATE_SECONDS } from "@/lib/weather/fetch";

export async function GET() {
  try {
    const locations = await getLocationPoints();

    return NextResponse.json(locations, {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch location data";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
