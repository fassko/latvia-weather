import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getHourlyForecast,
  getLocationPoints,
  mergeForecastLocation,
} from "@/lib/weather/fetch";
import { isValidLocationId } from "@/lib/weather/locations";
import { searchLocations } from "@/lib/mcp/search-locations";

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function textError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerMcpTools(server: McpServer) {
  server.tool(
    "list_locations",
    "List all Latvian weather forecast locations with current temperature and coordinates.",
    {},
    async () => {
      try {
        const locations = await getLocationPoints();
        return textResult(
          locations.map(({ id, name, region, lat, lon, temperature, iconCode }) => ({
            id,
            name,
            region,
            lat,
            lon,
            temperature,
            iconCode,
          })),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch location data";
        return textError(message);
      }
    },
  );

  server.tool(
    "search_location",
    "Search forecast locations by city or region name (Latvian names, accent-insensitive).",
    { query: z.string().min(1) },
    async ({ query }) => {
      try {
        const locations = await getLocationPoints();
        return textResult(searchLocations(locations, query));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to search locations";
        return textError(message);
      }
    },
  );

  server.tool(
    "get_forecast",
    'Get hourly weather forecast for a location. Use punkts ID (e.g. "P269" for Rīga). Dates in response are ISO 8601 strings.',
    { punkts: z.string() },
    async ({ punkts }) => {
      if (!isValidLocationId(punkts)) {
        return textError(
          `Invalid location ID "${punkts}". Use list_locations or search_location to find a valid punkts ID.`,
        );
      }

      try {
        const [data, locations] = await Promise.all([
          getHourlyForecast(punkts),
          getLocationPoints(),
        ]);
        return textResult(mergeForecastLocation(data, locations));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch weather data";
        return textError(message);
      }
    },
  );
}
