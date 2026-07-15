import assert from "node:assert/strict";
import { after, test } from "node:test";
import { distanceKm } from "../src/lib/weather/coordinates.ts";
import { groupForecastsByDay } from "../src/lib/weather/daily.ts";
import { formatLaiks, getHourlyForecast } from "../src/lib/weather/fetch.ts";
import { getUpcomingHourlyForecasts, getUpcomingTodayForecasts } from "../src/lib/weather/forecast-period.ts";
import {
  getConditionKey,
  getWindDirection,
  parseHourlyForecast,
  parseNumber,
} from "../src/lib/weather/parse.ts";

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
});

test("formatLaiks formats Europe/Riga local hours across midnight and DST", () => {
  assert.equal(formatLaiks(new Date("2026-01-01T22:30:00.000Z")), "202601020000");
  assert.equal(formatLaiks(new Date("2026-03-29T00:30:00.000Z")), "202603290200");
  assert.equal(formatLaiks(new Date("2026-03-29T01:30:00.000Z")), "202603290400");
});

test("parseNumber safely normalizes empty and invalid numeric values", () => {
  assert.equal(parseNumber("12.5"), 12.5);
  assert.equal(parseNumber(""), 0);
  assert.equal(parseNumber(null), 0);
  assert.equal(parseNumber("not-a-number"), 0);
});

test("parseHourlyForecast maps raw LVGMC fields", () => {
  const forecast = parseHourlyForecast({
    punkts: "P269",
    nosaukums: "Rīga",
    novads: "Rīga",
    laiks: "202607061200",
    temperatura: "24.7",
    veja_atrums: "3.4",
    veja_virziens: "225",
    brazmas: "7.8",
    nokrisni_1h: "0.3",
    relativais_mitrums: "61",
    laika_apstaklu_ikona: "1102",
    spiediens: "1012.4",
    sajutu_temperatura: "25.1",
    sniegs: "1.2",
    makoni: "34",
    nokrisnu_varbutiba: "42",
    uvi_indekss: "5",
    perkons: "7",
  });

  assert.equal(forecast.temperature, 24.7);
  assert.equal(forecast.feelsLike, 25.1);
  assert.equal(forecast.precipitationProbability, 42);
  assert.equal(forecast.snow, 1.2);
  assert.equal(forecast.uvIndex, 5);
  assert.equal(forecast.thunderProbability, 7);
});

test("condition and wind helpers map display values", () => {
  assert.equal(getConditionKey("1101"), "101_day");
  assert.equal(getConditionKey("2101"), "101_night");
  assert.equal(getConditionKey("1402"), "402");
  assert.equal(getWindDirection(0), "N");
  assert.equal(getWindDirection(225), "SW");
  assert.equal(getWindDirection(359), "N");
});

test("groupForecastsByDay uses Latvia day keys and wall-clock dates", () => {
  const forecasts = ["202607092100", "202607100100", "202607100300"].map((laiks) =>
    parseHourlyForecast({
      punkts: "P269",
      nosaukums: "Rīga",
      novads: "Rīga",
      laiks,
      temperatura: "21",
      veja_atrums: "2",
      veja_virziens: "180",
      brazmas: "4",
      nokrisni_1h: "0",
      relativais_mitrums: "70",
      laika_apstaklu_ikona: "1101",
      spiediens: "1010",
      sajutu_temperatura: "21",
      sniegs: null,
      makoni: "10",
      nokrisnu_varbutiba: "5",
      uvi_indekss: null,
      perkons: "0",
    }),
  );

  const groups = groupForecastsByDay(forecasts);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.dayKey),
    ["2026-07-09", "2026-07-10"],
  );
  assert.deepEqual(
    groups.map((group) => group.forecasts.length),
    [1, 2],
  );
});

test("hourly forecast list starts from the current Latvia hour", () => {
  const forecasts = [
    "202607090300",
    "202607090400",
    "202607090500",
    "202607090600",
    "202607090700",
  ].map((laiks) =>
    parseHourlyForecast({
      punkts: "P269",
      nosaukums: "Rīga",
      novads: "Rīga",
      laiks,
      temperatura: "21",
      veja_atrums: "2",
      veja_virziens: "180",
      brazmas: "4",
      nokrisni_1h: "0",
      relativais_mitrums: "70",
      laika_apstaklu_ikona: "1101",
      spiediens: "1010",
      sajutu_temperatura: "21",
      sniegs: null,
      makoni: "10",
      nokrisnu_varbutiba: "5",
      uvi_indekss: null,
      perkons: "0",
    }),
  );

  const upcoming = getUpcomingHourlyForecasts(
    forecasts,
    new Date("2026-07-09T03:45:00.000Z"),
  );

  assert.deepEqual(
    upcoming.map((forecast) => formatLaiks(forecast.time)),
    ["202607090600", "202607090700"],
  );
});

test("hourly forecast list starts from the current hour", () => {
  const forecasts = [
    "202607080800",
    "202607081000",
    "202607081200",
    "202607081400",
    "202607090000",
  ].map((laiks) =>
    parseHourlyForecast({
      punkts: "P269",
      nosaukums: "Rīga",
      novads: "Rīga",
      laiks,
      temperatura: "21",
      veja_atrums: "2",
      veja_virziens: "180",
      brazmas: "4",
      nokrisni_1h: "0",
      relativais_mitrums: "70",
      laika_apstaklu_ikona: "1101",
      spiediens: "1010",
      sajutu_temperatura: "21",
      sniegs: null,
      makoni: "10",
      nokrisnu_varbutiba: "5",
      uvi_indekss: null,
      perkons: "0",
    }),
  );

  const upcoming = getUpcomingHourlyForecasts(
    forecasts,
    new Date("2026-07-08T07:30:00.000Z"),
  );

  assert.deepEqual(
    upcoming.map((forecast) => formatLaiks(forecast.time)),
    ["202607081000", "202607081200", "202607081400", "202607090000"],
  );
});

test("24h forecasts cover the next 24 hours from the current hour", () => {
  const forecasts = [
    "202607080800",
    "202607081000",
    "202607081200",
    "202607081400",
    "202607090000",
  ].map((laiks) =>
    parseHourlyForecast({
      punkts: "P269",
      nosaukums: "Rīga",
      novads: "Rīga",
      laiks,
      temperatura: "21",
      veja_atrums: "2",
      veja_virziens: "180",
      brazmas: "4",
      nokrisni_1h: "0",
      relativais_mitrums: "70",
      laika_apstaklu_ikona: "1101",
      spiediens: "1010",
      sajutu_temperatura: "21",
      sniegs: null,
      makoni: "10",
      nokrisnu_varbutiba: "5",
      uvi_indekss: null,
      perkons: "0",
    }),
  );

  const upcoming = getUpcomingTodayForecasts(
    forecasts,
    new Date("2026-07-08T07:30:00.000Z"),
  );

  assert.deepEqual(
    upcoming.map((forecast) => formatLaiks(forecast.time)),
    ["202607081000", "202607081200", "202607081400", "202607090000"],
  );
});

test("distanceKm returns near-zero for identical coordinates and realistic Riga distance", () => {
  assert.equal(distanceKm({ lat: 56.9496, lon: 24.1052 }, { lat: 56.9496, lon: 24.1052 }), 0);
  const rigaToDaugavpils = distanceKm(
    { lat: 56.9496, lon: 24.1052 },
    { lat: 55.8714, lon: 26.5161 },
  );
  assert.ok(rigaToDaugavpils > 185 && rigaToDaugavpils < 200);
});

test("getHourlyForecast falls back to last successful data on transient API failure", async () => {
  const rawForecast = [
    {
      punkts: "P269",
      nosaukums: "Rīga",
      novads: "Rīga",
      laiks: "202607061200",
      temperatura: "21",
      veja_atrums: "2",
      veja_virziens: "180",
      brazmas: "4",
      nokrisni_1h: "0",
      relativais_mitrums: "70",
      laika_apstaklu_ikona: "1101",
      spiediens: "1010",
      sajutu_temperatura: "21",
      sniegs: null,
      makoni: "10",
      nokrisnu_varbutiba: "5",
      uvi_indekss: null,
      perkons: "0",
    },
  ];

  globalThis.fetch = async () =>
    new Response(JSON.stringify(rawForecast), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const fresh = await getHourlyForecast("P269");
  assert.equal(fresh.forecasts[0].temperature, 21);

  globalThis.fetch = async () => new Response("Service unavailable", { status: 503 });

  const stale = await getHourlyForecast("P269");
  assert.equal(stale.forecasts[0].temperature, 21);
});
