import { NextResponse } from "next/server";
import {
  EE_RADAR_ATTRIBUTION,
  EE_RADAR_BOUNDS,
  EE_RADAR_NOWCAST_LAYER,
  EE_RADAR_OBSERVED_LAYER,
  EE_RADAR_WMS,
  eeRadarFrames,
  LVGMC_ORIGIN,
  LVGMC_RADAR_ATTRIBUTION,
  LVGMC_RADAR_BOUNDS,
  LVGMC_RADAR_PATH,
  lvgmcRadarFrames,
  parseRadarSource,
  parseWmsTimeExtent,
  type RadarFeed,
} from "@/lib/weather/radar";

/** New frames arrive every 5–10 minutes; two minutes keeps the newest one close. */
const RADAR_REVALIDATE_SECONDS = 120;
const FETCH_TIMEOUT_MS = 15_000;

async function fetchUpstream(url: string): Promise<Response> {
  const response = await fetch(url, {
    next: { revalidate: RADAR_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Radar upstream returned ${response.status}`);
  }
  return response;
}

async function getLvgmcFeed(): Promise<RadarFeed> {
  const url = `${LVGMC_ORIGIN}/data/static_maps?name=${encodeURIComponent(LVGMC_RADAR_PATH)}`;
  const entries = (await (await fetchUpstream(url)).json()) as unknown;
  if (!Array.isArray(entries)) {
    throw new Error("LVĢMC radar list is not an array");
  }

  return {
    source: "lvgmc",
    frames: lvgmcRadarFrames(entries),
    bounds: LVGMC_RADAR_BOUNDS,
    attribution: LVGMC_RADAR_ATTRIBUTION,
  };
}

function eeCapabilitiesUrl(layer: string): string {
  // The per-layer endpoint returns one layer's capabilities instead of the whole workspace.
  // EE_RADAR_WMS is …/geoserver/ilm/wms, so ilm:cmp_cap becomes …/geoserver/ilm/cmp_cap/wms.
  const name = layer.split(":")[1];
  return `${EE_RADAR_WMS.replace(/\/wms$/, `/${name}/wms`)}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;
}

async function getEeFeed(): Promise<RadarFeed> {
  const [observedXml, nowcastXml] = await Promise.all([
    fetchUpstream(eeCapabilitiesUrl(EE_RADAR_OBSERVED_LAYER)).then((r) => r.text()),
    // The nowcast is a bonus; observed frames still show without it.
    fetchUpstream(eeCapabilitiesUrl(EE_RADAR_NOWCAST_LAYER))
      .then((r) => r.text())
      .catch(() => ""),
  ]);

  return {
    source: "ee",
    frames: eeRadarFrames(parseWmsTimeExtent(observedXml), parseWmsTimeExtent(nowcastXml)),
    bounds: EE_RADAR_BOUNDS,
    attribution: EE_RADAR_ATTRIBUTION,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = parseRadarSource(searchParams.get("source"));

  try {
    const feed = source === "ee" ? await getEeFeed() : await getLvgmcFeed();
    if (feed.frames.length === 0) {
      return NextResponse.json({ error: "No radar frames available" }, { status: 502 });
    }

    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": `public, s-maxage=${RADAR_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch radar data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
