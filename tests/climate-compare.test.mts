import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateArchiveMean,
  aggregateArchiveSum,
  buildClimateMonthComparisonFromData,
  classifyPrecipitationDelta,
  classifyTemperatureDelta,
  classifyWindDelta,
  latestCompleteMonth,
  monthBounds,
} from "../src/lib/climate/compare.ts";
import { findNearestClimateStation } from "../src/lib/climate/stations.ts";
import { parseCsv, parseOptionalNumber } from "../src/lib/climate/ckan.ts";

test("parseOptionalNumber treats blank climate VALUE cells as missing", () => {
  assert.equal(parseOptionalNumber(" "), null);
  assert.equal(parseOptionalNumber(""), null);
  assert.equal(parseOptionalNumber("17.2"), 17.2);
  assert.equal(parseOptionalNumber(6.5), 6.5);
});

test("parseCsv reads simple CKAN dumps", () => {
  const rows = parseCsv("STATION_ID,NAME\nRIGASLU,Rīga Universitāte\n");
  assert.deepEqual(rows, [{ STATION_ID: "RIGASLU", NAME: "Rīga Universitāte" }]);
});

test("findNearestClimateStation prefers stations with climate normals", () => {
  const stations = [
    { id: "FAR", name: "Far", lat: 56.0, lon: 21.0, active: true },
    { id: "NEAR", name: "Near", lat: 56.95, lon: 24.1, active: true },
    { id: "NEAR_NO_NORMAL", name: "Closer but no normal", lat: 56.96, lon: 24.11, active: true },
  ];
  const nearest = findNearestClimateStation(
    { lat: 56.95, lon: 24.1 },
    stations,
    new Set(["NEAR", "FAR"]),
  );
  assert.ok(nearest);
  assert.equal(nearest.station.id, "NEAR");
});

test("latestCompleteMonth is the previous Europe/Riga calendar month", () => {
  const october = latestCompleteMonth(new Date("2026-10-01T12:00:00.000Z"));
  assert.deepEqual(
    { year: october.year, month: october.month, start: october.start, end: october.end },
    {
      year: 2026,
      month: 9,
      start: "2026-09-01T00:00:00",
      end: "2026-10-01T00:00:00",
    },
  );

  const january = latestCompleteMonth(new Date("2026-01-05T10:00:00.000Z"));
  assert.equal(january.year, 2025);
  assert.equal(january.month, 12);
});

test("monthBounds and archive aggregates", () => {
  assert.deepEqual(monthBounds(2026, 12), {
    year: 2026,
    month: 12,
    start: "2026-12-01T00:00:00",
    end: "2027-01-01T00:00:00",
  });

  const values = Array.from({ length: 200 }, () => 2);
  values.push(4);
  assert.equal(aggregateArchiveMean(values)?.toFixed(4), (404 / 201).toFixed(4));
  assert.equal(aggregateArchiveSum(values), 404);
  assert.equal(aggregateArchiveMean([1, 2, 3]), null);
});

test("delta classifiers use honest thresholds", () => {
  assert.equal(classifyTemperatureDelta(0.8), "warmer");
  assert.equal(classifyTemperatureDelta(-0.8), "colder");
  assert.equal(classifyTemperatureDelta(0.2), "usual");
  assert.equal(classifyPrecipitationDelta(80, 60), "rainier");
  assert.equal(classifyPrecipitationDelta(40, 60), "drier");
  assert.equal(classifyPrecipitationDelta(62, 60), "usual");
  assert.equal(classifyWindDelta(0.5), "windier");
  assert.equal(classifyWindDelta(-0.5), "calmer");
});

test("buildClimateMonthComparisonFromData maps normals and wind baselines", () => {
  const comparison = buildClimateMonthComparisonFromData({
    nearest: {
      station: {
        id: "RIGASLU",
        name: "Rīga Universitāte",
        lat: 56.95,
        lon: 24.1,
        active: true,
      },
      distanceKm: 1.2,
    },
    normals: {
      byStationMonth: new Map([
        ["RIGASLU|TDRY|9", 12.5],
        ["RIGASLU|PRAB|9", 60],
      ]),
      stationIds: new Set(["RIGASLU"]),
      storedAt: Date.now(),
    },
    year: 2026,
    month: 9,
    actualTemperature: 14.7,
    actualPrecipitation: 80.7,
    actualWind: 3.2,
    windBaseline: { baseline: 2.8, kind: "stationTypical" },
  });

  assert.ok(comparison);
  assert.equal(comparison.source, "hourlyArchive");
  assert.equal(comparison.year, 2026);
  assert.equal(comparison.month, 9);
  assert.equal(comparison.metrics.length, 3);

  const temp = comparison.metrics.find((metric) => metric.kind === "temperature");
  const precip = comparison.metrics.find((metric) => metric.kind === "precipitation");
  const wind = comparison.metrics.find((metric) => metric.kind === "wind");

  assert.ok(temp);
  assert.equal(temp.baselineKind, "climateNormal");
  assert.equal(Number(temp.delta.toFixed(1)), 2.2);

  assert.ok(precip);
  assert.equal(precip.baselineKind, "climateNormal");

  assert.ok(wind);
  assert.equal(wind.baselineKind, "stationTypical");
  assert.equal(Number(wind.delta.toFixed(1)), 0.4);
});
