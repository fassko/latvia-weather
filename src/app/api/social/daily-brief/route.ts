import { NextResponse } from "next/server";
import { isSocialBriefAuthorized } from "@/lib/weather/social-brief-auth";
import {
  inferSocialBriefSlot,
  isSocialBriefSlotId,
  listSocialBriefSchedule,
  resolveSocialBriefSlot,
  type SocialBriefSlot,
} from "@/lib/weather/social-brief-schedule";
import {
  buildHyperframesDailyBrief,
  HYPERFRAMES_DAILY_BRIEF_COMPOSITION_ID,
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

const CACHE_HEADERS = {
  "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
};

function parseLocale(value: string | null, slot: SocialBriefSlot): "en" | "lv" {
  if (value === "en" || value === "lv") return value;
  return slot.localeDefault;
}

function unauthorized() {
  return NextResponse.json(
    {
      error: "Unauthorized",
      hint: "Send Authorization: Bearer $SOCIAL_BRIEF_SECRET or x-social-brief-secret",
    },
    { status: 401 },
  );
}

async function buildPayloadForPunkts(
  punkts: string,
  locale: "en" | "lv",
  slot: SocialBriefSlot,
): Promise<HyperframesDailyBriefPayload> {
  const [data, locations] = await Promise.all([
    getHourlyForecast(punkts),
    getLocationPoints(),
  ]);

  return buildHyperframesDailyBrief({
    data: mergeForecastLocation(data, locations),
    locale,
    slot,
  });
}

function slotResponse(
  slot: SocialBriefSlot,
  locale: "en" | "lv",
  payloads: HyperframesDailyBriefPayload[],
) {
  return {
    slot,
    locale,
    count: payloads.length,
    payloads,
  };
}

/**
 * GET /api/social/daily-brief
 *
 * Query:
 * - slot: weekday_morning | friday_weekend_outlook | weekend_morning
 *         (default: inferred from Europe/Riga clock, else weekday_morning)
 * - punkts: single location id (ignored when batch/slot cities are used unless single=1)
 * - single=1: only one city (`punkts` or first slot city)
 * - locale: en | lv (default from slot)
 * - batch=1: force all seed cities (overrides slot location list)
 * - format: json (default) | jsonl | variables
 * - schedule=1: return slot catalog
 * - schema=1: HyperFrames variable declarations
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("schema") === "1") {
    return NextResponse.json(
      {
        compositionId: HYPERFRAMES_DAILY_BRIEF_COMPOSITION_ID,
        variables: HYPERFRAMES_DAILY_BRIEF_VARIABLE_SCHEMA,
      },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  }

  if (searchParams.get("schedule") === "1") {
    return NextResponse.json(listSocialBriefSchedule(), {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  if (!isSocialBriefAuthorized(request)) {
    return unauthorized();
  }

  const slotParam = searchParams.get("slot");
  if (slotParam && !isSocialBriefSlotId(slotParam)) {
    return NextResponse.json(
      {
        error: `Unknown slot: ${slotParam}`,
        slots: listSocialBriefSchedule().slots.map((slot) => slot.id),
      },
      { status: 400 },
    );
  }

  const slot = slotParam
    ? resolveSocialBriefSlot(slotParam)
    : inferSocialBriefSlot();
  const locale = parseLocale(searchParams.get("locale"), slot);
  const format = searchParams.get("format") ?? "json";
  const forceBatch = searchParams.get("batch") === "1";
  const single = searchParams.get("single") === "1";

  try {
    let locationIds: string[];

    if (forceBatch) {
      locationIds = [...listSocialBriefSchedule().seedLocationIds];
    } else if (single) {
      const requested = searchParams.get("punkts") ?? undefined;
      if (requested && !isValidLocationId(requested)) {
        return NextResponse.json(
          { error: `Unknown location id: ${requested}` },
          { status: 400 },
        );
      }
      locationIds = [
        resolveLocationId(requested, slot.locationIds[0] ?? DEFAULT_LOCATION_ID),
      ];
    } else if (searchParams.has("punkts") && !searchParams.get("slot")) {
      // Backward compatible: ?punkts=P269 without slot → one city
      const requested = searchParams.get("punkts") ?? undefined;
      if (requested && !isValidLocationId(requested)) {
        return NextResponse.json(
          { error: `Unknown location id: ${requested}` },
          { status: 400 },
        );
      }
      locationIds = [resolveLocationId(requested, DEFAULT_LOCATION_ID)];
    } else {
      locationIds = [...slot.locationIds];
    }

    const payloads = await Promise.all(
      locationIds.map((punkts) => buildPayloadForPunkts(punkts, locale, slot)),
    );

    if (format === "variables") {
      if (payloads.length === 1) {
        return NextResponse.json(payloads[0].variables, { headers: CACHE_HEADERS });
      }
      return NextResponse.json(
        payloads.map((payload) => ({
          punkts: payload.punkts,
          citySlug: payload.citySlug,
          variables: payload.variables,
        })),
        { headers: CACHE_HEADERS },
      );
    }

    if (format === "jsonl") {
      return new NextResponse(toHyperframesBatchJsonl(payloads), {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          ...CACHE_HEADERS,
        },
      });
    }

    if (payloads.length === 1 && searchParams.has("punkts") && !searchParams.get("slot")) {
      // Legacy single-city shape for earlier clients/tests
      return NextResponse.json(payloads[0], { headers: CACHE_HEADERS });
    }

    return NextResponse.json(slotResponse(slot, locale, payloads), {
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build daily brief";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
