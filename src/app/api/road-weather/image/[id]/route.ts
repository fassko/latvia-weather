import sharp from "sharp";
import { getRoadWeather, ROAD_WEATHER_TTL_SECONDS } from "@/lib/weather/road-weather.server";
import { ROAD_WEATHER_IMAGE_ID_PATTERN } from "@/lib/weather/road-weather";

/** Popups show the photo at most 320 px wide, so 640 px covers high-density screens. */
const IMAGE_WIDTH = 640;

/** The latest photo from one road weather station or camera, re-encoded smaller. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ROAD_WEATHER_IMAGE_ID_PATTERN.test(id)) {
    return Response.json({ error: "Invalid image id" }, { status: 400 });
  }

  try {
    const { images } = await getRoadWeather();
    const original = images.get(id);
    if (!original) {
      return Response.json({ error: "No image for this station" }, { status: 404 });
    }

    const jpeg = await sharp(original)
      .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": `public, max-age=60, s-maxage=${ROAD_WEATHER_TTL_SECONDS}, stale-while-revalidate=600`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load image";
    return Response.json({ error: message }, { status: 502 });
  }
}
