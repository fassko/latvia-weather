import {
  convertToModelMessages,
  isStepCount,
  isTextUIPart,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  getHourlyForecast,
  getLocationPoints,
  mergeForecastLocation,
} from "@/lib/weather/fetch";
import { groupForecastsByDay, summarizeDay } from "@/lib/weather/daily";
import { checkChatRateLimit } from "@/lib/rate-limit";
import { resolveAssistantLocationIntent } from "@/lib/weather/assistant-location";
import { DEFAULT_LOCATION_ID, isValidLocationId } from "@/lib/weather/locations";
import { searchLocations } from "@/lib/mcp/search-locations";
import type { HourlyForecast } from "@/lib/weather/types";

export const maxDuration = 30;

const model = process.env.AI_MODEL ?? "deepseek/deepseek-v4-flash";

function getMaxAssistantSteps(): number {
  const value = Number(process.env.AI_MAX_STEPS ?? 2);
  if (!Number.isFinite(value)) return 2;
  return Math.min(Math.max(Math.trunc(value), 1), 4);
}

function parseJwtExpiration(token: string): number | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };

    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getGatewayConfigurationError(): string | null {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return null;

  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (oidcToken) {
    const expiresAt = parseJwtExpiration(oidcToken);
    if (expiresAt !== null && expiresAt <= Date.now()) {
      return [
        "The local VERCEL_OIDC_TOKEN has expired.",
        "Run `vercel env pull` to refresh it, use `vercel dev`, or set AI_GATEWAY_API_KEY in .env.local.",
      ].join(" ");
    }

    return null;
  }

  if (process.env.VERCEL === "1") return null;

  return [
    "Missing AI Gateway credentials.",
    "Set AI_GATEWAY_API_KEY in .env.local or run the app with `vercel dev`.",
  ].join(" ");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to generate weather answer";
}

function logAssistantEvent(event: string, data: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      event,
      route: "/api/chat",
      ...data,
    }),
  );
}

function getLocaleInstructions(locale: string): string {
  if (locale === "lv") {
    return [
      "Answer only in Latvian.",
      "Do not use English labels, recommendation words, or mixed-language phrases.",
      'Translate recommendation labels: use "Labi", "Izvairies", "Labākais laiks", "Paņem lietussargu", and "Nav nepieciešams lietussargs" instead of English.',
      'Use "pēc Latvijas laika" for time context. Do not write "Eiropa/Rīga" in user-facing answers.',
    ].join(" ");
  }

  return [
    "Answer only in English.",
    "Use English labels and recommendation words.",
  ].join(" ");
}

function getTrendStrip(forecasts: HourlyForecast[], locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-US", {
    timeZone: "Europe/Riga",
    weekday: "short",
  });

  const daily = groupForecastsByDay(forecasts)
    .slice(0, 5)
    .map((group) => {
      const summary = summarizeDay(group.forecasts);
      return {
        label: formatter.format(group.date).replace(".", ""),
        temperature: Math.round(summary.maxTemperature),
      };
    });

  return daily
    .map((day, index) => {
      if (index === 0) return `${day.label} ${day.temperature}°`;

      const previous = daily[index - 1];
      const arrow =
        day.temperature > previous.temperature
          ? "↑"
          : day.temperature < previous.temperature
            ? "↓"
            : "→";

      return `${arrow} ${day.label} ${day.temperature}°`;
    })
    .join(" ");
}

function getSourceCaption(locationName: string, locale: string): string {
  if (locale === "lv") {
    return `Balstīts uz šīs lietotnes LVĢMC prognozi — ${locationName}.`;
  }

  return `Based on this app’s LVGMC forecast — ${locationName}.`;
}

function getRateLimitError(locale: string): string {
  if (locale === "lv") {
    return "Pārāk daudz jautājumu asistentam. Lūdzu, mēģini vēlāk.";
  }

  return "Too many assistant messages. Please try again later.";
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function getLatestUserMessageText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      return getMessageText(message);
    }
  }

  return "";
}

function compactForecast(punkts: string, locale: string) {
  return Promise.all([getHourlyForecast(punkts), getLocationPoints()]).then(
    ([data, locations]) => {
      const forecast = mergeForecastLocation(data, locations);

      return {
        location: forecast.location,
        sourceCaption: getSourceCaption(forecast.location.name, locale),
        trendStrip: getTrendStrip(forecast.forecasts, locale),
        fetchedAt: forecast.fetchedAt.toISOString(),
        isStale: Boolean(forecast.isStale),
        hourly: forecast.forecasts.slice(0, 72).map((hour) => ({
          time: hour.time.toISOString(),
          temperature: hour.temperature,
          feelsLike: hour.feelsLike,
          precipitation: hour.precipitation,
          snow: hour.snow,
          humidity: hour.humidity,
          windSpeed: hour.windSpeed,
          windGust: hour.windGust,
          windDirection: hour.windDirection,
          pressure: hour.pressure,
          cloudCover: hour.cloudCover,
          precipitationProbability: hour.precipitationProbability,
          uvIndex: hour.uvIndex,
          thunderProbability: hour.thunderProbability,
          iconCode: hour.iconCode,
        })),
      };
    },
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let locale = "en";

  try {
    const gatewayConfigurationError = getGatewayConfigurationError();
    if (gatewayConfigurationError) {
      logAssistantEvent("chat_config_error", {
        error: gatewayConfigurationError,
        durationMs: Date.now() - startedAt,
      });
      return Response.json({ error: gatewayConfigurationError }, { status: 500 });
    }

    const {
      messages,
      locale: requestLocale = "en",
      locationId = DEFAULT_LOCATION_ID,
    }: {
      messages: UIMessage[];
      locale?: string;
      locationId?: string;
    } = await request.json();
    locale = requestLocale;

    const rateLimit = await checkChatRateLimit(request);
    if (!rateLimit.allowed) {
      logAssistantEvent("chat_rate_limited", {
        locale,
        locationId,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt.toISOString(),
        durationMs: Date.now() - startedAt,
      });
      return Response.json(
        { error: getRateLimitError(locale) },
        { status: 429, headers: rateLimit.headers },
      );
    }

    const currentLocationId = isValidLocationId(locationId)
      ? locationId
      : DEFAULT_LOCATION_ID;

    const locations = await getLocationPoints();
    const locationIntent = resolveAssistantLocationIntent(
      getLatestUserMessageText(messages),
      locations,
      currentLocationId,
    );
    const asksAboutOtherLocation = locationIntent.kind === "other";
    const targetLocationId =
      locationIntent.kind === "other"
        ? locationIntent.location.id
        : currentLocationId;
    const maxAssistantSteps = asksAboutOtherLocation
      ? Math.max(getMaxAssistantSteps(), 3)
      : getMaxAssistantSteps();

    logAssistantEvent("chat_start", {
      locale,
      locationId: currentLocationId,
      targetLocationId,
      asksAboutOtherLocation,
      messageCount: messages.length,
      remaining: rateLimit.remaining,
    });

    const result = streamText({
      model,
      instructions: [
        "You are a concise weather assistant for Latvia.",
        "The weather data from this app is the source of truth.",
        "Always use the provided tools for location lookup and forecast data before answering.",
        "Prefer get_current_page_forecast when the user does not explicitly ask about another Latvian location.",
        "When the user explicitly names another Latvian location, use search_weather_locations and/or get_weather_forecast for that place instead of get_current_page_forecast.",
        "Do not answer weather questions from general model knowledge, memory, or assumptions.",
        "If forecast tool data is unavailable, say that the app forecast could not be loaded instead of guessing.",
        "The app UI renders the forecast source caption from tool output. Do not write a source line yourself.",
        getLocaleInstructions(locale),
        "Keep answers practical and cite forecast times as Latvia local time. Treat Europe/Riga as an internal timezone identifier only; do not write it in user-facing answers.",
        "Format answers as compact Markdown: start with one relevant weather emoji and a bold one-line summary, then use two or three short paragraphs for timing, risk, and advice.",
        "Use **bold** for important temperatures, rain chances, wind, and recommendation words.",
        "When discussing a week or multi-day forecast, mention Saturday/Sunday or sestdiena/svētdiena by name so the UI can highlight weekend days.",
        "For weather trend questions, copy the exact trendStrip from the forecast tool output into the answer. Do not invent another chart. Do not use a code block.",
        "Do not use bullet points, numbered lists, or tables. Keep the response easy to scan on a phone.",
        `Current page locale: ${locale}. Current selected punkts ID: ${currentLocationId}.`,
        locationIntent.kind === "other"
          ? `The latest user message asks about ${locationIntent.location.name}, which is different from the currently selected page location. Use get_named_location_forecast for that place. Do not use get_current_page_forecast for this turn.`
          : "The latest user message does not name a different Latvian location, so use get_current_page_forecast for the selected page location.",
      ].join(" "),
      messages: await convertToModelMessages(messages),
      stopWhen: isStepCount(maxAssistantSteps),
      onError({ error }) {
        logAssistantEvent("chat_error", {
          error: getErrorMessage(error),
          locale,
          locationId: currentLocationId,
          targetLocationId,
          durationMs: Date.now() - startedAt,
        });
      },
      onFinish() {
        logAssistantEvent("chat_finish", {
          locale,
          locationId: currentLocationId,
          targetLocationId,
          durationMs: Date.now() - startedAt,
        });
      },
      prepareStep: ({ stepNumber }) => ({
        toolChoice:
          stepNumber === 0
            ? {
                type: "tool",
                toolName: asksAboutOtherLocation
                  ? "get_named_location_forecast"
                  : "get_current_page_forecast",
              }
            : "auto",
      }),
      tools: {
        list_weather_locations: {
          description:
            "List Latvian forecast locations with punkts IDs, names, regions, coordinates, and current temperature.",
          inputSchema: z.object({}),
          execute: async () => {
            return locations.map(
              ({ id, name, region, lat, lon, temperature, iconCode }) => ({
                id,
                name,
                region,
                lat,
                lon,
                temperature,
                iconCode,
              }),
            );
          },
        },
        search_weather_locations: {
          description:
            "Search Latvian forecast locations by city or region name. Search is accent-insensitive.",
          inputSchema: z.object({
            query: z.string().min(1).describe("City, town, or region name."),
          }),
          execute: async ({ query }: { query: string }) => {
            return searchLocations(locations, query);
          },
        },
        get_weather_forecast: {
          description:
            "Get the next 72 hours of weather forecast for a Latvian location by punkts ID.",
          inputSchema: z.object({
            punkts: z
              .string()
              .describe('LVGMC punkts ID. Example: "P269" for Rīga.'),
          }),
          execute: async ({ punkts }: { punkts: string }) => {
            if (!isValidLocationId(punkts)) {
              return {
                error:
                  "Invalid punkts ID. Use search_weather_locations or list_weather_locations first.",
              };
            }

            return compactForecast(punkts, locale);
          },
        },
        get_current_page_forecast: {
          description:
            "Get the next 72 hours of weather forecast for the location currently selected on the page.",
          inputSchema: z.object({}),
          execute: async () => compactForecast(currentLocationId, locale),
        },
        get_named_location_forecast: {
          description:
            "Get the next 72 hours of weather forecast for the Latvian location named in the latest user message. The server resolves the location automatically.",
          inputSchema: z.object({}),
          execute: async () => {
            if (locationIntent.kind !== "other") {
              return {
                error:
                  "No different location was detected in the latest user message. Use get_current_page_forecast instead.",
              };
            }

            return compactForecast(locationIntent.location.id, locale);
          },
        },
      },
    });

    return result.toUIMessageStreamResponse({
      headers: rateLimit.headers,
      onError: getErrorMessage,
    });
  } catch (error) {
    logAssistantEvent("chat_error", {
      error: getErrorMessage(error),
      locale,
      durationMs: Date.now() - startedAt,
    });
    return Response.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
