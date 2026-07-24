import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareLocationsBySearchRank,
  getLocationSearchRank,
  searchAndRankLocations,
} from "../src/lib/weather/location-search.ts";
import type { WeatherLocationPoint } from "../src/lib/weather/types.ts";

const valmieraAreaLocations: WeatherLocationPoint[] = [
  {
    id: "P1",
    name: "Bērzaine",
    region: "Bērzaine, Bērzaines pag., Valmieras nov.",
    lat: 57.5,
    lon: 25.4,
    temperature: 20,
    iconCode: "1101",
  },
  {
    id: "P2",
    name: "Brenguļi",
    region: "Brenguļi, Brenguļu pag., Valmieras nov.",
    lat: 57.51,
    lon: 25.41,
    temperature: 20,
    iconCode: "1101",
  },
  {
    id: "P3",
    name: "Burtnieki",
    region: "Burtnieki, Burtnieku pag., Valmieras nov.",
    lat: 57.7,
    lon: 25.2,
    temperature: 20,
    iconCode: "1101",
  },
  {
    id: "P4",
    name: "Valmiera",
    region: "Valmiera",
    lat: 57.54,
    lon: 25.42,
    temperature: 20,
    iconCode: "1101",
  },
  {
    id: "P5",
    name: "Dikļi",
    region: "Dikļi, Dikļu pag., Valmieras nov.",
    lat: 57.6,
    lon: 25.1,
    temperature: 20,
    iconCode: "1101",
  },
  {
    id: "P6",
    name: "Rīga",
    region: "Rīga",
    lat: 56.95,
    lon: 24.1,
    temperature: 18,
    iconCode: "1101",
  },
];

test("exact city name ranks above region-only Valmiera matches", () => {
  assert.equal(getLocationSearchRank(valmieraAreaLocations[3]!, "Valmiera"), 0);
  assert.ok(getLocationSearchRank(valmieraAreaLocations[0]!, "Valmiera") > 0);
  assert.ok(
    compareLocationsBySearchRank(
      valmieraAreaLocations[3]!,
      valmieraAreaLocations[0]!,
      "Valmiera",
    ) < 0,
  );
});

test("searchAndRankLocations lists Valmiera city first, then region locations", () => {
  const matches = searchAndRankLocations(valmieraAreaLocations, "Valmiera");

  assert.equal(matches[0]?.name, "Valmiera");
  assert.deepEqual(
    matches.slice(1).map((location) => location.name),
    ["Bērzaine", "Brenguļi", "Burtnieki", "Dikļi"],
  );
});

test("searchAndRankLocations keeps accent-insensitive matching", () => {
  const matches = searchAndRankLocations(valmieraAreaLocations, "valmiera");
  assert.equal(matches[0]?.name, "Valmiera");
  assert.equal(matches.length, 5);
});

test("name prefix matches rank above region-only matches", () => {
  const locations = [
    {
      id: "P10",
      name: "Salacgrīva",
      region: "Limbažu nov.",
      lat: 1,
      lon: 1,
      temperature: 1,
      iconCode: "1101",
    },
    {
      id: "P11",
      name: "Aloja",
      region: "Salacgrīvas nov.",
      lat: 1,
      lon: 1,
      temperature: 1,
      iconCode: "1101",
    },
  ] satisfies WeatherLocationPoint[];

  const matches = searchAndRankLocations(locations, "Sala");
  assert.equal(matches[0]?.name, "Salacgrīva");
  assert.equal(matches[1]?.name, "Aloja");
});
