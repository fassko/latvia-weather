import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  getEmptyFavoriteLocationIds,
  readFavoriteLocationIds,
  resetFavoriteLocationIdsCacheForTests,
} from "../src/lib/weather/favorite-location-ids.ts";

describe("favorite location ids snapshot", () => {
  beforeEach(() => {
    resetFavoriteLocationIdsCacheForTests();
  });

  it("returns a stable empty reference across reads (React #185)", () => {
    const a = readFavoriteLocationIds(() => "[]");
    const b = readFavoriteLocationIds(() => "[]");
    assert.equal(a, b);
    assert.equal(a, getEmptyFavoriteLocationIds());
  });

  it("returns a stable reference for the same non-empty storage string", () => {
    const raw = JSON.stringify(["P269", "P364"]);
    const a = readFavoriteLocationIds(() => raw);
    const b = readFavoriteLocationIds(() => raw);
    assert.equal(a, b);
    assert.deepEqual(a, ["P269", "P364"]);
  });

  it("updates the snapshot when storage content changes", () => {
    const first = readFavoriteLocationIds(() => JSON.stringify(["P269"]));
    const second = readFavoriteLocationIds(() =>
      JSON.stringify(["P269", "P364"]),
    );
    assert.notEqual(first, second);
    assert.deepEqual(second, ["P269", "P364"]);
  });
});
