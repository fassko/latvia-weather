import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pickNearbyLocations,
  pickRegionLocations,
} from "../src/lib/seo/nearby-locations.ts";
import type { WeatherLocationPoint } from "../src/lib/weather/types.ts";

function point(
  id: string,
  name: string,
  region: string,
  lat: number,
  lon: number,
): WeatherLocationPoint {
  return {
    id,
    name,
    region,
    lat,
    lon,
    temperature: 10,
    windSpeed: 2,
    windDirection: 90,
    iconCode: "1101",
  };
}

const locations = [
  point("P269", "Rīga", "Rīga", 56.95, 24.1),
  point("P364", "Saulkrasti", "Saulkrasti", 57.26, 24.41),
  point("P117", "Sigulda", "Sigulda", 57.15, 24.85),
  point("P768", "Jūrmala", "Jūrmala", 56.97, 23.77),
  point("P770", "Liepāja", "Liepāja", 56.51, 21.01),
];

test("pickNearbyLocations returns nearest points with crawlable hrefs", () => {
  const nearby = pickNearbyLocations(locations[0], locations, 3);
  assert.equal(nearby.length, 3);
  assert.equal(nearby[0].id, "P768");
  assert.equal(nearby[0].href, "/punkts/jurmala");
  assert.ok(nearby.every((item) => item.id !== "P269"));
  assert.ok(nearby[0].distanceKm < nearby[1].distanceKm);
});

test("pickRegionLocations excludes current and nearby ids", () => {
  const coastal = [
    point("P1", "A", "Kurzeme", 57, 21),
    point("P2", "B", "Kurzeme", 57.1, 21.1),
    point("P3", "C", "Vidzeme", 57.2, 25),
  ];
  const region = pickRegionLocations(coastal[0], coastal, new Set(["P2"]));
  assert.deepEqual(
    region.map((item) => item.id),
    [],
  );
  const allRegion = pickRegionLocations(coastal[0], coastal);
  assert.deepEqual(
    allRegion.map((item) => item.id),
    ["P2"],
  );
});
