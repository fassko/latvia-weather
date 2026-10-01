import assert from "node:assert/strict";
import { test } from "node:test";
import { serializeHistoricalClimate } from "../src/lib/climate/historical.ts";
import type { ClimateMonthComparison } from "../src/lib/climate/compare.ts";
import type { WeatherLocationPoint } from "../src/lib/weather/types.ts";

const location: WeatherLocationPoint = {
  id: "P269",
  name: "Rīga",
  region: "Rīga",
  lat: 56.977884,
  lon: 24.127176,
  temperature: 11,
  windSpeed: 2,
  windDirection: 130,
  iconCode: "2101",
};

const comparison: ClimateMonthComparison = {
  year: 2026,
  month: 9,
  station: {
    id: "RIGASLU",
    name: "Rīga Universitāte",
    lat: 56.954797,
    lon: 24.104686,
    active: true,
  },
  distanceKm: 2.9066732570196185,
  hasClimateNormals: true,
  source: "hourlyArchive",
  metrics: [
    {
      kind: "temperature",
      baselineKind: "climateNormal",
      actual: 14.722841225626746,
      baseline: 13.4,
      delta: 1.322841225626746,
      unit: "°C",
    },
    {
      kind: "precipitation",
      baselineKind: "climateNormal",
      actual: 80.7,
      baseline: 67.1,
      delta: 13.6,
      unit: "mm",
    },
    {
      kind: "wind",
      baselineKind: "stationTypical",
      actual: 3.1923398328690817,
      baseline: 2.98,
      delta: 0.21233983286908176,
      unit: "m/s",
    },
  ],
};

test("serializeHistoricalClimate shapes a stable API payload", () => {
  const payload = serializeHistoricalClimate(comparison, location);

  assert.equal(payload.punkts, "P269");
  assert.equal(payload.location.name, "Rīga");
  assert.deepEqual(payload.period, {
    year: 2026,
    month: 9,
    start: "2026-09-01T00:00:00",
    end: "2026-10-01T00:00:00",
  });
  assert.equal(payload.station.id, "RIGASLU");
  assert.equal(payload.station.distanceKm, 2.907);
  assert.equal(payload.source, "hourlyArchive");
  assert.equal(payload.normalsPeriod, "1991–2020");
  assert.equal(payload.metrics.length, 3);
  assert.equal(payload.metrics[0]?.actual, 14.723);
  assert.equal(payload.metrics[2]?.baselineKind, "stationTypical");
});
