import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeTodayBrief } from "../src/lib/weather/today-brief.ts";
import type { HourlyForecast } from "../src/lib/weather/types.ts";

function hour(laiksOffsetHours: number, overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  const time = new Date();
  time.setMinutes(0, 0, 0);
  time.setHours(time.getHours() + laiksOffsetHours);

  return {
    time,
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
    const brief = summarizeTodayBrief([
      hour(0, { temperature: 14, precipitationProbability: 20, precipitation: 0.2 }),
      hour(1, { temperature: 21, precipitationProbability: 65, precipitation: 1.4 }),
      hour(2, { temperature: 17, precipitationProbability: 40, precipitation: 0.3 }),
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
