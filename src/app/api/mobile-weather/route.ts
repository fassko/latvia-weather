import { NextResponse } from "next/server";
import { getWeatherAlarmPolygons } from "@/lib/weather/alarms";
import {
  getHourlyForecast,
  getLocationPoints,
  getWeatherWarnings,
  mergeForecastLocation,
  REVALIDATE_SECONDS,
} from "@/lib/weather/fetch";
import { isValidLocationId } from "@/lib/weather/locations";
import { getAuthoritativeSunTimesByDay } from "@/lib/weather/sun";
import { getLatviaDayKey } from "@/lib/weather/timezone";

export async function GET(request: Request) {
  const locationId = new URL(request.url).searchParams.get("punkts");
  if (!locationId || !isValidLocationId(locationId)) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  }

  const [sun, warnings, alarms] = await Promise.allSettled([
    (async () => {
      const [forecast, locations] = await Promise.all([
        getHourlyForecast(locationId),
        getLocationPoints(),
      ]);
      const data = mergeForecastLocation(forecast, locations);
      if (!data.location.lat || !data.location.lon) return {};
      return getAuthoritativeSunTimesByDay(
        data.forecasts.map((hour) => getLatviaDayKey(hour.time)),
        data.location.lat,
        data.location.lon,
      );
    })(),
    getWeatherWarnings({ throwOnUnavailable: true }),
    getWeatherAlarmPolygons({ throwOnUnavailable: true }),
  ]);

  return NextResponse.json(
    {
      sunTimesByDay: sun.status === "fulfilled" ? sun.value : {},
      warnings: warnings.status === "fulfilled" ? warnings.value : [],
      alarms: alarms.status === "fulfilled" ? alarms.value : [],
      sunTimesAvailable: sun.status === "fulfilled" && Object.keys(sun.value).length > 0,
      warningsAvailable: warnings.status === "fulfilled",
      alarmsAvailable: alarms.status === "fulfilled",
    },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    },
  );
}
