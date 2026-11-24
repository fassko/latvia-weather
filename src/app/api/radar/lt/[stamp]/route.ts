import sharp from "sharp";
import {
  cleanLtRadarPixels,
  LT_RADAR_IMAGE_WIDTH,
  LT_RADAR_STAMP_PATTERN,
  ltRadarCrop,
  ltRadarSourceUrl,
} from "@/lib/weather/radar";

const FETCH_TIMEOUT_MS = 20_000;

/**
 * One meteo.lt radar composite, cropped to the map's area, shrunk from 4000 px wide and with the out-of-range mask
 * lightened. A frame never changes once published, so CDNs and clients may keep it for good.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ stamp: string }> },
) {
  const { stamp } = await ctx.params;
  if (!LT_RADAR_STAMP_PATTERN.test(stamp)) {
    return Response.json({ error: "Invalid radar frame" }, { status: 400 });
  }

  try {
    const upstream = await fetch(ltRadarSourceUrl(stamp), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!upstream.ok) {
      return Response.json(
        { error: `Radar upstream returned ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const source = sharp(Buffer.from(await upstream.arrayBuffer()));
    const { width = 0, height = 0 } = await source.metadata();
    if (!width || !height) throw new Error("Radar image has no size");

    // Nearest-neighbour keeps meteo.lt's exact palette instead of blending shades into new colours.
    const { data, info } = await source
      .extract(ltRadarCrop(width, height))
      .resize({ width: LT_RADAR_IMAGE_WIDTH, kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    cleanLtRadarPixels(data);

    const png = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ palette: true, compressionLevel: 9, effort: 7 })
      .toBuffer();

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process radar image";
    return Response.json({ error: message }, { status: 502 });
  }
}
