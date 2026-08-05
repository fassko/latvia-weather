import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLatviaDayKey, parseLaiks } from "../src/lib/weather/timezone.ts";
import { summarizeTodayBrief } from "../src/lib/weather/today-brief.ts";
import type { HourlyForecast } from "../src/lib/weather/types.ts";

/** Build a forecast at a fixed Latvia wall-clock hour on today's Latvia date. */
function todayHour(
  hourOfDay: number,
  overrides: Partial<HourlyForecast> = {},
): HourlyForecast {
  const dayKey = getLatviaDayKey(new Date()).replaceAll("-", "");
  const laiks = `${dayKey}${String(hourOfDay).padStart(2, "0")}00`;

  return {
    time: parseLaiks(laiks),
    temperature: 18,
    feelsLike: 17,
    precipitation: 0,
    snow: 0,
    humidity: 70,
    windSpeed: 3,
    windGust: 5,
    windDirection: 180,
    pressure: 1013,
    cloudCover: 40,
    iconCode: "1101",
    precipitationProbability: 10,
    uvIndex: 3,
    thunderProbability: 0,
    ...overrides,
  };
}

describe("summarizeTodayBrief", () => {
  it("returns high, low, and rain summary for today hours", () => {
    // Use midday Latvia hours so the summary stays on today's day key even when
    // CI runs near Europe/Riga midnight (local Date offsets can spill into tomorrow).
    const brief = summarizeTodayBrief([
      todayHour(10, { temperature: 14, precipitationProbability: 20, precipitation: 0.2 }),
      todayHour(14, { temperature: 21, precipitationProbability: 65, precipitation: 1.4 }),
      todayHour(18, { temperature: 17, precipitationProbability: 40, precipitation: 0.3 }),
    ]);

    assert.deepEqual(brief, {
      high: 21,
      low: 14,
      rainChance: 65,
      precipMm: 1.9,
    });
  });

  it("returns null for an empty forecast list", () => {
    assert.equal(summarizeTodayBrief([]), null);
  });
});
