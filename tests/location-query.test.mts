import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CANONICAL_LOCATION_QUERY_PARAM,
  hasLocationQueryParam,
  pickLocationQueryValue,
} from "../src/lib/weather/location-query.ts";

test("pickLocationQueryValue prefers a valid punkts over location", () => {
  assert.equal(pickLocationQueryValue("P364", "P269"), "P364");
  assert.equal(pickLocationQueryValue("P364", null), "P364");
  assert.equal(pickLocationQueryValue(undefined, "P269"), "P269");
});

test("pickLocationQueryValue falls back to location when punkts is invalid", () => {
  assert.equal(pickLocationQueryValue("not-a-point", "P364"), "P364");
  assert.equal(pickLocationQueryValue("", "P364"), "P364");
  assert.equal(pickLocationQueryValue("bad", "also-bad"), undefined);
});

test("hasLocationQueryParam detects either key", () => {
  assert.equal(hasLocationQueryParam("P364", null), true);
  assert.equal(hasLocationQueryParam(null, "P364"), true);
  assert.equal(hasLocationQueryParam("", null), true);
  assert.equal(hasLocationQueryParam(null, null), false);
  assert.equal(hasLocationQueryParam(undefined, undefined), false);
});

test("canonical location query param stays punkts for non-path URLs", () => {
  assert.equal(CANONICAL_LOCATION_QUERY_PARAM, "punkts");
});
