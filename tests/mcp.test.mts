import assert from "node:assert/strict";
import { test } from "node:test";
import { searchLocations } from "../src/lib/mcp/search-locations.ts";
import { isValidLocationId } from "../src/lib/weather/locations.ts";
import type { WeatherLocationPoint } from "../src/lib/weather/types.ts";

const sampleLocations: WeatherLocationPoint[] = [
  {
    id: "P269",
    name: "Rīga",
    region: "Rīga",
    lat: 56.95,
    lon: 24.1,
    temperature: 18,
    iconCode: "1101",
  },
  {
    id: "P450",
    name: "Liepāja",
    region: "Liepāja",
    lat: 56.51,
    lon: 21.01,
    temperature: 16,
    iconCode: "1102",
  },
  {
    id: "P364",
    name: "Daugavpils",
    region: "Augšdaugava",
    lat: 55.87,
    lon: 26.53,
    temperature: 17,
    iconCode: "1101",
  },
];

test("searchLocations returns matches for Latvian and accent-stripped queries", () => {
  const rigaMatches = searchLocations(sampleLocations, "Rīga");
  assert.equal(rigaMatches.length, 1);
  assert.equal(rigaMatches[0]?.id, "P269");

  const rigaAsciiMatches = searchLocations(sampleLocations, "riga");
  assert.equal(rigaAsciiMatches.length, 1);
  assert.equal(rigaAsciiMatches[0]?.name, "Rīga");
});

test("searchLocations matches region names", () => {
  const matches = searchLocations(sampleLocations, "Augšdaugava");
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.id, "P364");
});

test("searchLocations returns empty array for no match", () => {
  assert.deepEqual(searchLocations(sampleLocations, "Valmiera"), []);
  assert.deepEqual(searchLocations(sampleLocations, "   "), []);
});

test("searchLocations respects the result limit", () => {
  const matches = searchLocations(sampleLocations, "a", 2);
  assert.equal(matches.length, 2);
});

test("isValidLocationId accepts known location IDs and rejects unknown IDs", () => {
  assert.equal(isValidLocationId("P269"), true);
  assert.equal(isValidLocationId("P999"), false);
  assert.equal(isValidLocationId(""), false);
});
