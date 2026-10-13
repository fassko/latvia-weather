import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterLocationsByFavoriteIds } from "../src/lib/weather/filter-favorite-locations.ts";
import type { WeatherLocationPoint } from "../src/lib/weather/types.ts";

function point(
  id: string,
  name: string,
): WeatherLocationPoint {
  return {
    id,
    name,
    region: "",
    lat: 56.9,
    lon: 24.1,
    temperature: 10,
    windSpeed: 2,
    windDirection: 90,
    iconCode: "clear",
  };
}

describe("filterLocationsByFavoriteIds", () => {
  const locations = [
    point("P269", "Rīga"),
    point("P364", "Liepāja"),
    point("P400", "Daugavpils"),
  ];

  it("returns an empty list when there are no favorites", () => {
    assert.deepEqual(filterLocationsByFavoriteIds(locations, []), []);
  });

  it("preserves favorite order and drops unknown ids", () => {
    assert.deepEqual(
      filterLocationsByFavoriteIds(locations, ["P400", "missing", "P269"]).map(
        (location) => location.id,
      ),
      ["P400", "P269"],
    );
  });
});
