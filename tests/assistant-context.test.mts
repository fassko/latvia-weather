import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAssistantTimingContext,
  getForecastHoursOverlappingWindow,
  summarizeNextHourRain,
} from "../src/lib/weather/assistant-context.ts";
import { parseLaiks } from "../src/lib/weather/timezone.ts";
import type { HourlyForecast } from "../src/lib/weather/types.ts";

function makeForecast(
  laiks: string,
  precipitation: number,
  precipitationProbability: number,
): HourlyForecast {
  return {
    time: parseLaiks(laiks),
    temperature: 18,
    feelsLike: 18,
    precipitation,
    snow: 0,
    humidity: 70,
    windSpeed: 3,
    windGust: 5,
    windDirection: 180,
    pressure: 1013,
    cloudCover: 50,
    iconCode: "1100",
    precipitationProbability,
    uvIndex: 3,
    thunderProbability: 0,
  };
}

test("getForecastHoursOverlappingWindow includes current and next buckets at 16:45", () => {
  const forecasts = [
    makeForecast("202608191400", 0, 10),
    makeForecast("202608191500", 0, 15),
    makeForecast("202608191600", 0, 20),
    makeForecast("202608191700", 0.4, 65),
    makeForecast("202608191800", 0.2, 40),
  ];

  const now = parseLaiks("202608191645");
  const overlapping = getForecastHoursOverlappingWindow(forecasts, now);

  assert.deepEqual(
    overlapping.map((forecast) => forecast.time.toISOString()),
    [forecasts[2].time.toISOString(), forecasts[3].time.toISOString()],
  );
});

test("summarizeNextHourRain is true when rain starts at 17:00 and now is 16:45", () => {
  const forecasts = [
    makeForecast("202608191500", 0, 10),
    makeForecast("202608191600", 0, 20),
    makeForecast("202608191700", 0.4, 65),
    makeForecast("202608191800", 0.2, 40),
  ];

  const summary = summarizeNextHourRain(forecasts, parseLaiks("202608191645"));

  assert.equal(summary.willRain, true);
  assert.equal(summary.earliestRainTime, forecasts[2].time.toISOString());
  assert.equal(summary.overlappingHours.length, 2);
});

test("summarizeNextHourRain is false when no overlapping hour has rain", () => {
  const forecasts = [
    makeForecast("202608191600", 0, 20),
    makeForecast("202608191700", 0, 15),
    makeForecast("202608191800", 0.5, 80),
  ];

  const summary = summarizeNextHourRain(forecasts, parseLaiks("202608191645"));

  assert.equal(summary.willRain, false);
  assert.equal(summary.earliestRainTime, null);
});

test("buildAssistantTimingContext exposes now and upcoming rain windows", () => {
  const forecasts = [
    makeForecast("202608191600", 0, 20),
    makeForecast("202608191700", 0.4, 65),
    makeForecast("202608191800", 0.2, 40),
    makeForecast("202608191900", 0, 10),
  ];

  const context = buildAssistantTimingContext(forecasts, parseLaiks("202608191645"));

  assert.equal(context.nowLocalTime, "16:45");
  assert.equal(context.nextHour.willRain, true);
  assert.equal(context.upcomingRainWindows.length, 1);
  assert.equal(context.upcomingRainWindows[0]?.startLocalTime, "17:00");
  assert.equal(context.upcomingRainWindows[0]?.endLocalTime, "19:00");
});
