import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMapTemperature,
  TEMPERATURE_LEGEND_BANDS,
  temperatureMarkerColor,
  temperatureTextColor,
} from "../src/lib/weather/map-temp.ts";

describe("map temperature helpers", () => {
  it("formats signed temperatures", () => {
    assert.equal(formatMapTemperature(12.6), "+13°C");
    assert.equal(formatMapTemperature(-3.2), "-3°C");
    assert.equal(formatMapTemperature(0), "0°C");
  });

  it("picks colder and warmer marker colors", () => {
    assert.equal(temperatureMarkerColor(-20), "#1e3a8a");
    assert.equal(temperatureMarkerColor(12), "#0f766e");
    assert.equal(temperatureMarkerColor(18), "#15803d");
    assert.equal(temperatureMarkerColor(32), "#ef4444");
  });

  it("uses light text on deep cold, mild green, and hot markers", () => {
    assert.equal(temperatureTextColor(-2), "#ffffff");
    assert.equal(temperatureTextColor(8), "#0f172a");
    assert.equal(temperatureTextColor(12), "#ffffff");
    assert.equal(temperatureTextColor(18), "#ffffff");
    assert.equal(temperatureTextColor(23), "#0f172a");
    assert.equal(temperatureTextColor(31), "#ffffff");
  });

  it("defines five contiguous legend bands", () => {
    assert.equal(TEMPERATURE_LEGEND_BANDS.length, 5);
    assert.equal(TEMPERATURE_LEGEND_BANDS[0]?.maxC, 0);
    assert.equal(TEMPERATURE_LEGEND_BANDS.at(-1)?.minC, 26);
  });
});
