import assert from "node:assert/strict";
import { test } from "node:test";
import {
  POPULAR_LOCATION_IDS,
  pickPopularLocations,
  popularLocationHref,
} from "../src/lib/seo/popular-locations.ts";
import { isValidLocationId, DEFAULT_LOCATION_ID } from "../src/lib/weather/locations.ts";
import type { WeatherLocationPoint } from "../src/lib/weather/types.ts";

test("popular location IDs are valid forecast points", () => {
  for (const id of POPULAR_LOCATION_IDS) {
    assert.equal(isValidLocationId(id), true, id);
  }
  assert.equal(POPULAR_LOCATION_IDS[0], DEFAULT_LOCATION_ID);
});

test("pickPopularLocations preserves curated order and skips missing", () => {
  const locations: WeatherLocationPoint[] = [
    {
      id: "P450",
      name: "Daugavpils",
      region: "Daugavpils",
      lat: 55.87,
      lon: 26.53,
      temperature: 17,
      windSpeed: 3,
      windDirection: 180,
      iconCode: "1101",
    },
    {
      id: "P269",
      name: "Rīga",
      region: "Rīga",
      lat: 56.95,
      lon: 24.1,
      temperature: 18,
      windSpeed: 3,
      windDirection: 180,
      iconCode: "1101",
    },
  ];

  const picked = pickPopularLocations(locations);
  assert.deepEqual(
    picked.map((location) => location.id),
    ["P269", "P450"],
  );
});

test("popularLocationHref omits punkts for the default city", () => {
  assert.equal(popularLocationHref(DEFAULT_LOCATION_ID), "/");
  assert.equal(popularLocationHref("P770"), "/?punkts=P770");
});
