import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  buildSummaryContext,
  cleanSummary,
  getFallbackSummaryKeys,
  getSummaryInstructions,
  type SummaryLocale,
} from "@/lib/weather/ai-summary";
import { getHourlyForecast, getLocationPoints, mergeForecastLocation } from "@/lib/weather/fetch";
import { isValidLocationId } from "@/lib/weather/locations";

export const maxDuration = 20;

const model = process.env.AI_SUMMARY_MODEL ?? process.env.AI_MODEL ?? "deepseek/deepseek-v4-flash";

const LOCALES: readonly SummaryLocale[] = ["en", "lv", "ru"];

/**
 * The CDN caches each location and language for half an hour, so a summary costs one model call per half hour
 * however many people open the app. Any other query parameter is rejected so it can't be used to skip that cache.
 */
const CACHE_SECONDS = 1800;

/** A rule-based fallback is cached only briefly so the AI summary comes back soon after the model recovers. */
const FALLBACK_CACHE_SECONDS = 300;

function logSummaryEvent(event: string, data: Record<string, unknown>): void {
  console.info(JSON.stringify({ event, route: "/api/weather-summary", ...data }));
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const params = new URL(request.url).searchParams;
  const locationId = params.get("punkts");
  const locale = params.get("locale") as SummaryLocale | null;

  const unexpected = [...params.keys()].filter((key) => key !== "punkts" && key !== "locale");
  if (
    unexpected.length > 0 ||
    !locationId ||
    !isValidLocationId(locationId) ||
    !locale ||
    !LOCALES.includes(locale)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let data;
  try {
    const [forecast, locations] = await Promise.all([getHourlyForecast(locationId), getLocationPoints()]);
    data = mergeForecastLocation(forecast, locations);
  } catch (error) {
    logSummaryEvent("summary_forecast_error", {
      locationId,
      locale,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    // Without a forecast there is nothing to summarize; the app keeps its own sentence.
    return NextResponse.json({ error: "Forecast unavailable" }, { status: 503 });
  }

  const now = new Date();
  const context = buildSummaryContext(data.location, data.forecasts, now);
  const current = data.forecasts.find((hour) => hour.time.getTime() + 3_600_000 > now.getTime());
  if (context.hours.length === 0 || !current) {
    return NextResponse.json({ error: "No forecast" }, { status: 503 });
  }

  try {
    const { text } = await generateText({
      model,
      instructions: getSummaryInstructions(locale),
      prompt: JSON.stringify(context),
      maxOutputTokens: 120,
      temperature: 0.4,
      abortSignal: request.signal,
    });
    const summary = cleanSummary(text);
    if (!summary) throw new Error("Empty summary");

    logSummaryEvent("summary_ok", { locationId, locale, durationMs: Date.now() - startedAt });
    return NextResponse.json(
      { summary, source: "ai", generatedAt: now.toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=600` } },
    );
  } catch (error) {
    logSummaryEvent("summary_fallback", {
      locationId,
      locale,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    const t = await getTranslations({ locale, namespace: "summary" });
    const { conditionKey, adviceKey } = getFallbackSummaryKeys(current, context.isNightNow);
    return NextResponse.json(
      { summary: `${t(`cond.${conditionKey}`)}. ${t(`advice.${adviceKey}`)}`, source: "rules", generatedAt: now.toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${FALLBACK_CACHE_SECONDS}` } },
    );
  }
}
