import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSummaryContext,
  cleanSummary,
  getFallbackSummaryKeys,
  getSummaryInstructions,
  MAX_SUMMARY_LENGTH,
  SUMMARY_HOURS,
} from "../src/lib/weather/ai-summary.ts";
import type { HourlyForecast } from "../src/lib/weather/types.ts";

const RIGA = { id: "P269", name: "Rīga", region: "Rīga", lat: 56.9496, lon: 24.1052 };

function hour(time: Date, overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time,
    temperature: 5.24,
    feelsLike: 3.1,
    precipitation: 0,
    snow: 0,
    humidity: 80,
    windSpeed: 3,
    windGust: 7,
    windDirection: 112,
    pressure: 1030,
    cloudCover: 40,
    iconCode: "1102",
    precipitationProbability: 5,
    uvIndex: null,
    thunderProbability: 0,
    ...overrides,
  };
}

function hoursFrom(start: Date, count: number): HourlyForecast[] {
  return Array.from({ length: count }, (_, index) => hour(new Date(start.getTime() + index * 3_600_000)));
}

describe("buildSummaryContext", () => {
  // 20 Oct 2026, 23:32 in Rīga (UTC+3): after sunset.
  const lateEvening = new Date(Date.UTC(2026, 9, 20, 20, 32));

  it("marks a late October evening as night", () => {
    const context = buildSummaryContext(RIGA, hoursFrom(new Date(Date.UTC(2026, 9, 20, 18)), 24), lateEvening);

    assert.equal(context.isNightNow, true);
    assert.equal(context.nowLocalTime, "23:32");
    assert.match(context.sunset ?? "", /^18:/);
    assert.equal(context.hours[0].isNight, true);
  });

  it("starts at the current hour and keeps only the next hours", () => {
    const context = buildSummaryContext(RIGA, hoursFrom(new Date(Date.UTC(2026, 9, 20, 18)), 48), lateEvening);

    assert.equal(context.hours[0].time, "23:00");
    assert.equal(context.hours.length, SUMMARY_HOURS);
  });

  it("marks a midday hour as day and rounds values", () => {
    const noon = new Date(Date.UTC(2026, 9, 21, 9));
    const context = buildSummaryContext(RIGA, [hour(noon)], noon);

    assert.equal(context.isNightNow, false);
    assert.equal(context.hours[0].isNight, false);
    assert.equal(context.hours[0].temperature, 5.2);
    assert.equal(context.hours[0].windDirection, "ESE");
  });
});

describe("getSummaryInstructions", () => {
  it("asks for the requested language and forbids sun at night", () => {
    const instructions = getSummaryInstructions("lv");

    assert.match(instructions, /Latvian only/);
    assert.match(instructions, /at night never mention sun/);
  });
});

describe("cleanSummary", () => {
  it("removes Markdown, quotes and line breaks", () => {
    assert.equal(
      cleanSummary('"**Cloudy** tonight,\nrain from 03:00. Take an umbrella."'),
      "Cloudy tonight, rain from 03:00. Take an umbrella.",
    );
  });

  it("cuts a long summary at a sentence end", () => {
    const first = "Clouds with clear spells tonight and a light breeze from the south-east.";
    const second = " Rain moves in after 04:00 and lasts most of the morning, so keep an umbrella by the door for tomorrow.";
    const summary = cleanSummary(first + second);

    assert.equal(summary, first);
    assert.ok(summary.length <= MAX_SUMMARY_LENGTH);
  });
});

describe("getFallbackSummaryKeys", () => {
  it("never says sun at night", () => {
    const night = getFallbackSummaryKeys(hour(new Date(), { iconCode: "1102", temperature: 18 }), true);

    assert.deepEqual(night, { conditionKey: "partlyCloudyNight", adviceKey: "mildNight" });
  });

  it("uses day phrases and keeps weather advice by day", () => {
    assert.deepEqual(getFallbackSummaryKeys(hour(new Date(), { iconCode: "1102", temperature: 18 }), false), {
      conditionKey: "partlyCloudy",
      adviceKey: "mild",
    });
    assert.equal(getFallbackSummaryKeys(hour(new Date(), { iconCode: "1504" }), true).adviceKey, "rain");
  });

  it("follows sunset for clear skies even when the icon is still the day one", () => {
    assert.equal(getFallbackSummaryKeys(hour(new Date(), { iconCode: "1101" }), true).conditionKey, "clearNight");
  });
});
