import { NextResponse } from "next/server";
import {
  EE_RADAR_ATTRIBUTION,
  EE_RADAR_ATTRIBUTION_TEXT,
  EE_RADAR_LEGEND,
  EE_RADAR_BOUNDS,
  EE_RADAR_NOWCAST_LAYER,
  EE_RADAR_OBSERVED_LAYER,
  EE_RADAR_WMS,
  eeRadarFrames,
  LT_RADAR_ATTRIBUTION,
  LT_RADAR_ATTRIBUTION_TEXT,
  LT_RADAR_BOUNDS,
  LT_RADAR_LEGEND,
  LT_RADAR_PAGE,
  ltRadarFrames,
  ltRadarStamps,
  LVGMC_ORIGIN,
  LVGMC_RADAR_ATTRIBUTION,
  LVGMC_RADAR_ATTRIBUTION_TEXT,
  LVGMC_RADAR_LEGEND,
  LVGMC_RADAR_BOUNDS,
  LVGMC_RADAR_PATH,
  lvgmcRadarFrames,
  parseRadarSource,
  parseWmsTimeExtent,
  type RadarFeed,
  type RadarSource,
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
    attributionText: LVGMC_RADAR_ATTRIBUTION_TEXT,
    legend: LVGMC_RADAR_LEGEND,
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
    attributionText: EE_RADAR_ATTRIBUTION_TEXT,
    legend: EE_RADAR_LEGEND,
  };
}

/** Frames point at our own cleaned copies, absolute so the mobile apps can load them as they are. */
async function getLtFeed(origin: string): Promise<RadarFeed> {
  const html = await (await fetchUpstream(LT_RADAR_PAGE)).text();
  return {
    source: "lt",
    frames: ltRadarFrames(ltRadarStamps(html), (stamp) => `${origin}/api/radar/lt/${stamp}`),
    bounds: LT_RADAR_BOUNDS,
    attribution: LT_RADAR_ATTRIBUTION,
    attributionText: LT_RADAR_ATTRIBUTION_TEXT,
    legend: LT_RADAR_LEGEND,
  };
}

function getFeed(source: RadarSource, origin: string): Promise<RadarFeed> {
  switch (source) {
    case "ee":
      return getEeFeed();
    case "lt":
      return getLtFeed(origin);
    default:
      return getLvgmcFeed();
  }
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const source = parseRadarSource(searchParams.get("source"));

  try {
    const feed = await getFeed(source, origin);
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
