import {
  convertToModelMessages,
  isStepCount,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  getHourlyForecast,
  getLocationPoints,
  mergeForecastLocation,
} from "@/lib/weather/fetch";
import { DEFAULT_LOCATION_ID, isValidLocationId } from "@/lib/weather/locations";
import { searchLocations } from "@/lib/mcp/search-locations";

export const maxDuration = 30;

const model = process.env.AI_MODEL ?? "openai/gpt-5-mini";

function getLocaleInstructions(locale: string): string {
  if (locale === "lv") {
    return [
      "Answer only in Latvian.",
      "Do not use English labels, recommendation words, or mixed-language phrases.",
      'Translate recommendation labels: use "Labi", "Izvairies", "Labākais laiks", "Paņem lietussargu", and "Nav nepieciešams lietussargs" instead of English.',
      'Use "Laiks: Eiropa/Rīga" instead of "Time (Europe/Riga)".',
      'Use "Balstīts uz šīs lietotnes LVĢMC prognozi" for the source line.',
    ].join(" ");
  }

  return [
    "Answer only in English.",
    "Use English labels and recommendation words.",
    'Use "Based on this app’s LVGMC forecast" for the source line.',
  ].join(" ");
}

function compactForecast(punkts: string) {
  return Promise.all([getHourlyForecast(punkts), getLocationPoints()]).then(
    ([data, locations]) => {
      const forecast = mergeForecastLocation(data, locations);

      return {
        location: forecast.location,
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
  try {
    const {
      messages,
      locale = "en",
      locationId = DEFAULT_LOCATION_ID,
    }: {
      messages: UIMessage[];
      locale?: string;
      locationId?: string;
    } = await request.json();

    const currentLocationId = isValidLocationId(locationId)
      ? locationId
      : DEFAULT_LOCATION_ID;

    const result = streamText({
      model,
      instructions: [
        "You are a concise weather assistant for Latvia.",
        "The weather data from this app is the source of truth.",
        "Always use the provided tools for location lookup and forecast data before answering.",
        "Prefer get_current_page_forecast when the user does not explicitly ask about another Latvian location.",
        "Do not answer weather questions from general model knowledge, memory, or assumptions.",
        "If forecast tool data is unavailable, say that the app forecast could not be loaded instead of guessing.",
        "In every weather answer, mention that it is based on this app's LVGMC forecast data and name the forecast location from the tool result.",
        getLocaleInstructions(locale),
        "Keep answers practical and cite forecast times using Europe/Riga local context.",
        "Format answers as compact Markdown: start with one relevant weather emoji and a bold one-line summary, then use short bullet points for timing, risk, and advice.",
        "Use **bold** for important temperatures, rain chances, wind, and recommendation words.",
        "When discussing a week or multi-day forecast, mention Saturday/Sunday or sestdiena/svētdiena by name so the UI can highlight weekend days.",
        "Do not use tables. Keep the response easy to scan on a phone.",
        `Current page locale: ${locale}. Current selected punkts ID: ${currentLocationId}.`,
      ].join(" "),
      messages: await convertToModelMessages(messages),
      stopWhen: isStepCount(4),
      prepareStep: ({ stepNumber }) => ({
        toolChoice:
          stepNumber === 0
            ? { type: "tool", toolName: "get_current_page_forecast" }
            : "auto",
      }),
      tools: {
        list_weather_locations: {
          description:
            "List Latvian forecast locations with punkts IDs, names, regions, coordinates, and current temperature.",
          inputSchema: z.object({}),
          execute: async () => {
            const locations = await getLocationPoints();
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
            const locations = await getLocationPoints();
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

            return compactForecast(punkts);
          },
        },
        get_current_page_forecast: {
          description:
            "Get the next 72 hours of weather forecast for the location currently selected on the page.",
          inputSchema: z.object({}),
          execute: async () => compactForecast(currentLocationId),
        },
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate weather answer";
    return Response.json({ error: message }, { status: 500 });
  }
}
