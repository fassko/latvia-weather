import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMapTemperature,
  temperatureMarkerColor,
  temperatureTextColor,
} from "../src/lib/weather/map-temp.ts";

describe("map temperature helpers", () => {
  it("formats signed temperatures", () => {
    assert.equal(formatMapTemperature(12.6), "+13°");
    assert.equal(formatMapTemperature(-3.2), "-3°");
    assert.equal(formatMapTemperature(0), "0°");
  });

  it("picks colder and warmer marker colors", () => {
    assert.equal(temperatureMarkerColor(-20), "#1e3a8a");
    assert.equal(temperatureMarkerColor(12), "#14b8a6");
    assert.equal(temperatureMarkerColor(32), "#ef4444");
  });

  it("uses light text on deep cold and hot markers", () => {
    assert.equal(temperatureTextColor(-2), "#ffffff");
    assert.equal(temperatureTextColor(12), "#0f172a");
    assert.equal(temperatureTextColor(31), "#ffffff");
  });
});
