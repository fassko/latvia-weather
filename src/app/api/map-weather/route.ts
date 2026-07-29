import { NextResponse } from "next/server";
import {
  getLocationPoints,
  REVALIDATE_SECONDS,
} from "@/lib/weather/fetch";

const MAX_OFFSET_HOURS = 72;

function parseOffsetHours(value: string | null): number {
  const offset = Number(value ?? 0);
  if (!Number.isFinite(offset)) return 0;
  return Math.min(Math.max(Math.trunc(offset), 0), MAX_OFFSET_HOURS);
}

function getForecastTime(offsetHours: number): Date {
  const time = new Date();
  time.setMinutes(0, 0, 0);
  time.setHours(time.getHours() + offsetHours);
  return time;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offsetHours = parseOffsetHours(searchParams.get("offsetHours"));
  const time = getForecastTime(offsetHours);

  try {
    const locations = await getLocationPoints(time);

    return NextResponse.json(
      {
        offsetHours,
        time: time.toISOString(),
        locations,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch map weather data";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
