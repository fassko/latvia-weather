import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildClimateMonthComparisonFromData,
  classifyPrecipitationDelta,
  classifyTemperatureDelta,
  classifyWindDelta,
  findLatestCompleteMonth,
  typicalMonthlyMean,
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

test("findLatestCompleteMonth skips blank months and requires all series", () => {
  const temperature = [
    { STATION_ID: "S", ABBREVIATION: "HTDRY", FUNCTION: "AVG", YEAR: 2026, MONTH: 9, DECADE: 0, VALUE: " " },
    { STATION_ID: "S", ABBREVIATION: "HTDRY", FUNCTION: "AVG", YEAR: 2026, MONTH: 8, DECADE: 0, VALUE: "17.2" },
    { STATION_ID: "S", ABBREVIATION: "HTDRY", FUNCTION: "AVG", YEAR: 2026, MONTH: 7, DECADE: 0, VALUE: " " },
  ];
  const precipitation = [
    { STATION_ID: "S", ABBREVIATION: "HPRAB", FUNCTION: "SUM", YEAR: 2026, MONTH: 8, DECADE: 0, VALUE: "61.3" },
  ];
  const wind = [
    { STATION_ID: "S", ABBREVIATION: "HWNDS", FUNCTION: "AVG", YEAR: 2026, MONTH: 8, DECADE: 0, VALUE: "1.8" },
  ];

  assert.deepEqual(
    findLatestCompleteMonth({ temperature, precipitation, wind }),
    { year: 2026, month: 8 },
  );
});

test("typicalMonthlyMean excludes the compared year", () => {
  const records = [
    { STATION_ID: "S", ABBREVIATION: "HWNDS", FUNCTION: "AVG", YEAR: 2024, MONTH: 8, DECADE: 0, VALUE: "2.0" },
    { STATION_ID: "S", ABBREVIATION: "HWNDS", FUNCTION: "AVG", YEAR: 2025, MONTH: 8, DECADE: 0, VALUE: "3.0" },
    { STATION_ID: "S", ABBREVIATION: "HWNDS", FUNCTION: "AVG", YEAR: 2026, MONTH: 8, DECADE: 0, VALUE: "9.0" },
  ];
  assert.equal(typicalMonthlyMean(records, 8, 2026), 2.5);
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

test("buildClimateMonthComparisonFromData maps normals and wind typical", () => {
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
        ["RIGASLU|TDRY|8", 16.8],
        ["RIGASLU|PRAB|8", 71.7],
      ]),
      stationIds: new Set(["RIGASLU"]),
      storedAt: Date.now(),
    },
    temperature: [
      {
        STATION_ID: "RIGASLU",
        ABBREVIATION: "HTDRY",
        FUNCTION: "AVG",
        YEAR: 2026,
        MONTH: 8,
        DECADE: 0,
        VALUE: "17.2",
      },
    ],
    precipitation: [
      {
        STATION_ID: "RIGASLU",
        ABBREVIATION: "HPRAB",
        FUNCTION: "SUM",
        YEAR: 2026,
        MONTH: 8,
        DECADE: 0,
        VALUE: "61.3",
      },
    ],
    wind: [
      {
        STATION_ID: "RIGASLU",
        ABBREVIATION: "HWNDS",
        FUNCTION: "AVG",
        YEAR: 2024,
        MONTH: 8,
        DECADE: 0,
        VALUE: "2.0",
      },
      {
        STATION_ID: "RIGASLU",
        ABBREVIATION: "HWNDS",
        FUNCTION: "AVG",
        YEAR: 2026,
        MONTH: 8,
        DECADE: 0,
        VALUE: "1.8",
      },
    ],
  });

  assert.ok(comparison);
  assert.equal(comparison.year, 2026);
  assert.equal(comparison.month, 8);
  assert.equal(comparison.metrics.length, 3);

  const temp = comparison.metrics.find((metric) => metric.kind === "temperature");
  const precip = comparison.metrics.find((metric) => metric.kind === "precipitation");
  const wind = comparison.metrics.find((metric) => metric.kind === "wind");

  assert.ok(temp);
  assert.equal(temp.baselineKind, "climateNormal");
  assert.equal(Number(temp.delta.toFixed(1)), 0.4);

  assert.ok(precip);
  assert.equal(precip.baselineKind, "climateNormal");

  assert.ok(wind);
  assert.equal(wind.baselineKind, "stationTypical");
  assert.equal(wind.baseline, 2.0);
});
