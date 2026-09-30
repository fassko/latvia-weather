import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHyperframesDailyBrief,
  toHyperframesBatchJsonl,
  toHyperframesVariablesJson,
} from "../src/lib/weather/hyperframes-daily-brief.ts";
import { getLatviaDayKey, parseLaiks } from "../src/lib/weather/timezone.ts";
import type { HourlyForecast, WeatherData } from "../src/lib/weather/types.ts";

function todayHour(
  hourOfDay: number,
  overrides: Partial<HourlyForecast> = {},
): HourlyForecast {
  const dayKey = getLatviaDayKey(new Date()).replaceAll("-", "");
  const laiks = `${dayKey}${String(hourOfDay).padStart(2, "0")}00`;

  return {
    time: parseLaiks(laiks),
    temperature: 12,
    feelsLike: 11,
    precipitation: 0,
    snow: 0,
    humidity: 70,
    windSpeed: 4,
    windGust: 7,
    windDirection: 225,
    pressure: 1013,
    cloudCover: 40,
    iconCode: "1102",
    precipitationProbability: 15,
    uvIndex: 2,
    thunderProbability: 0,
    ...overrides,
  };
}

function sampleData(forecasts: HourlyForecast[]): WeatherData {
  return {
    location: {
      id: "P269",
      name: "Rīga",
      region: "Rīga",
      lat: 56.95,
      lon: 24.11,
    },
    forecasts,
    fetchedAt: forecasts[0].time,
  };
}

describe("buildHyperframesDailyBrief", () => {
  it("builds HyperFrames variables and social captions for Rīga", () => {
    const now = todayHour(10).time;
    const payload = buildHyperframesDailyBrief({
      data: sampleData([
        todayHour(8, { temperature: 8, precipitationProbability: 20 }),
        todayHour(12, {
          temperature: 16,
          precipitationProbability: 70,
          precipitation: 1.2,
          iconCode: "1501",
        }),
        todayHour(18, { temperature: 11, precipitationProbability: 40 }),
      ]),
      locale: "lv",
      now,
      platform: "instagram",
    });

    assert.equal(payload.compositionId, "latvia-weather-daily-brief");
    assert.equal(payload.punkts, "P269");
    assert.equal(payload.citySlug, "riga");
    assert.equal(payload.slotId, "weekday_morning");
    assert.equal(payload.variables.cityName, "Rīga");
    assert.equal(payload.variables.locale, "lv");
    assert.equal(payload.variables.tempHigh, "16°");
    assert.equal(payload.variables.tempLow, "8°");
    assert.equal(payload.variables.rainChance, "70%");
    assert.match(payload.variables.headline, /^Rīga, /);
    assert.match(payload.variables.deepLink, /utm_campaign=weekday_morning/);
    assert.match(payload.variables.deepLink, /utm_source=instagram/);
    assert.equal(payload.render.width, 1080);
    assert.equal(payload.render.height, 1920);
    assert.equal(payload.render.aspectRatio, "9:16");
    assert.match(
      payload.render.outputKey,
      /renders\/.+\/weekday_morning\/riga-lv\.mp4$/,
    );
    assert.ok(payload.hourly.length >= 3);
    assert.match(payload.captions.instagram, /Rīga/);
    assert.ok(payload.captions.hashtags.includes("#Latvija"));
    assert.equal(payload.batchRow.outputKey, payload.render.outputKey);
    assert.equal(payload.publish.interesting, true);
    assert.ok(payload.publish.selected.includes("facebook"));
  });

  it("uses umbrella hook when rain chance is high", () => {
    const now = todayHour(9).time;
    const payload = buildHyperframesDailyBrief({
      data: sampleData([
        todayHour(9, {
          temperature: 10,
          precipitationProbability: 80,
          iconCode: "1501",
        }),
      ]),
      locale: "en",
      now,
    });

    assert.equal(payload.variables.hook, "Rīga — take an umbrella");
    assert.equal(payload.variables.brandName, "Latvia Weather");
  });

  it("uses weekend-plan copy for friday outlook slot", () => {
    const now = todayHour(16).time;
    const payload = buildHyperframesDailyBrief({
      data: sampleData([
        todayHour(12, { temperature: 14, precipitationProbability: 10 }),
      ]),
      locale: "lv",
      now,
      slot: "friday_weekend_outlook",
    });

    assert.equal(payload.slotId, "friday_weekend_outlook");
    assert.equal(payload.variables.hook, "Rīga — brīvdienu laiks");
    assert.match(payload.captions.instagram, /brīvdienās/);
    assert.match(payload.variables.deepLink, /utm_campaign=weekend_outlook/);
  });

  it("serializes variables and batch JSONL for HyperFrames CLI", () => {
    const now = todayHour(11).time;
    const payload = buildHyperframesDailyBrief({
      data: sampleData([todayHour(11)]),
      locale: "en",
      now,
    });

    const variables = JSON.parse(toHyperframesVariablesJson(payload));
    assert.equal(variables.cityName, "Rīga");

    const jsonl = toHyperframesBatchJsonl([payload]);
    const row = JSON.parse(jsonl);
    assert.equal(row.outputKey, payload.render.outputKey);
    assert.equal(row.variables.cityName, "Rīga");
  });

  it("rejects empty forecasts", () => {
    assert.throws(
      () =>
        buildHyperframesDailyBrief({
          data: {
            location: {
              id: "P269",
              name: "Rīga",
              region: "Rīga",
              lat: 56.95,
              lon: 24.11,
            },
            forecasts: [],
            fetchedAt: new Date(),
          },
          locale: "en",
        }),
      /No forecast hours/,
    );
  });
});
