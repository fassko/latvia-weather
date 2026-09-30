import { NextResponse } from "next/server";
import {
  buildHyperframesDailyBrief,
  DAILY_BRIEF_SEED_LOCATION_IDS,
  HYPERFRAMES_DAILY_BRIEF_VARIABLE_SCHEMA,
  toHyperframesBatchJsonl,
  type HyperframesDailyBriefPayload,
} from "@/lib/weather/hyperframes-daily-brief";
import {
  getHourlyForecast,
  getLocationPoints,
  mergeForecastLocation,
  REVALIDATE_SECONDS,
} from "@/lib/weather/fetch";
import {
  DEFAULT_LOCATION_ID,
  isValidLocationId,
  resolveLocationId,
} from "@/lib/weather/locations";

export const runtime = "nodejs";

function parseLocale(value: string | null): "en" | "lv" {
  return value === "lv" ? "lv" : "en";
}

async function buildPayloadForPunkts(
  punkts: string,
  locale: "en" | "lv",
): Promise<HyperframesDailyBriefPayload> {
  const [data, locations] = await Promise.all([
    getHourlyForecast(punkts),
    getLocationPoints(),
  ]);

  return buildHyperframesDailyBrief({
    data: mergeForecastLocation(data, locations),
    locale,
  });
}

/**
 * GET /api/social/daily-brief
 *
 * Query:
 * - punkts: location id (default Rīga)
 * - locale: en | lv (default lv for social)
 * - batch: 1 → seed cities (Rīga + major towns)
 * - format: json (default) | jsonl | variables
 * - schema: 1 → return HyperFrames variable declarations only
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("schema") === "1") {
    return NextResponse.json(
      {
        compositionId: "latvia-weather-daily-brief",
        variables: HYPERFRAMES_DAILY_BRIEF_VARIABLE_SCHEMA,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400",
        },
      },
    );
  }

  const locale = parseLocale(searchParams.get("locale") ?? "lv");
  const format = searchParams.get("format") ?? "json";
  const batch = searchParams.get("batch") === "1";

  try {
    if (batch) {
      const payloads = await Promise.all(
        DAILY_BRIEF_SEED_LOCATION_IDS.map((punkts) =>
          buildPayloadForPunkts(punkts, locale),
        ),
      );

      if (format === "jsonl") {
        return new NextResponse(toHyperframesBatchJsonl(payloads), {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
          },
        });
      }

      return NextResponse.json(
        {
          locale,
          count: payloads.length,
          payloads,
        },
        {
          headers: {
            "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
          },
        },
      );
    }

    const requested = searchParams.get("punkts") ?? undefined;
    if (requested && !isValidLocationId(requested)) {
      return NextResponse.json(
        { error: `Unknown location id: ${requested}` },
        { status: 400 },
      );
    }

    const locationId = resolveLocationId(requested, DEFAULT_LOCATION_ID);
    const payload = await buildPayloadForPunkts(locationId, locale);

    if (format === "variables") {
      return NextResponse.json(payload.variables, {
        headers: {
          "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
        },
      });
    }

    if (format === "jsonl") {
      return new NextResponse(toHyperframesBatchJsonl([payload]), {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
        },
      });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build daily brief";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
