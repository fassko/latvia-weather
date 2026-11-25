import { NextResponse } from "next/server";
import { getRoadWeather, ROAD_WEATHER_TTL_SECONDS } from "@/lib/weather/road-weather.server";
import {
  ROAD_WEATHER_ATTRIBUTION,
  ROAD_WEATHER_ATTRIBUTION_TEXT,
  type RoadWeatherFeed,
} from "@/lib/weather/road-weather";

/**
 * Road weather stations and traffic cameras from Latvijas Valsts ceļi. Photo URLs are absolute so the mobile
 * apps can load them as they are.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const absolute = (url: string | null) => (url ? `${origin}${url}` : null);

  try {
    const { stations, cameras } = await getRoadWeather();
    const feed: RoadWeatherFeed = {
      stations: stations.map((station) => ({ ...station, imageUrl: absolute(station.imageUrl) })),
      cameras: cameras.map((camera) => ({ ...camera, imageUrl: absolute(camera.imageUrl) })),
      attribution: ROAD_WEATHER_ATTRIBUTION,
      attributionText: ROAD_WEATHER_ATTRIBUTION_TEXT,
    };

    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": `public, s-maxage=${ROAD_WEATHER_TTL_SECONDS}, stale-while-revalidate=600`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch road weather";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
