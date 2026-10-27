import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LATVIA_BOUNDS } from "../src/lib/weather/map-view.ts";
import {
  buildTemperatureField,
  TEMPERATURE_FIELD_STOPS,
  TEMPERATURE_FIELD_WIDTH,
  temperatureFieldColor,
  temperatureFieldHeight,
  type TemperatureField,
} from "../src/lib/weather/temperature-field.ts";

const [[SOUTH, WEST], [NORTH, EAST]] = LATVIA_BOUNDS;

function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
}

function latitudeFromMercatorY(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/** Centre of a grid cell, matching the field's sampling. */
function cellCentre(field: TemperatureField, row: number, col: number) {
  const northY = mercatorY(NORTH);
  const stepY = (northY - mercatorY(SOUTH)) / field.height;
  return {
    lat: latitudeFromMercatorY(northY - (row + 0.5) * stepY),
    lon: WEST + ((col + 0.5) * (EAST - WEST)) / field.width,
  };
}

function cellIndex(field: TemperatureField, lat: number, lon: number): number {
  const northY = mercatorY(NORTH);
  const row = Math.floor(
    ((northY - mercatorY(lat)) / (northY - mercatorY(SOUTH))) * field.height,
  );
  const col = Math.floor(((lon - WEST) / (EAST - WEST)) * field.width);
  return row * field.width + col;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe("temperature field", () => {
  it("keeps the Web Mercator aspect of the bounds", () => {
    const xRange = ((EAST - WEST) * Math.PI) / 180;
    const yRange = mercatorY(NORTH) - mercatorY(SOUTH);
    const expected = Math.round((TEMPERATURE_FIELD_WIDTH * yRange) / xRange);
    const field = buildTemperatureField([]);

    assert.equal(field.width, TEMPERATURE_FIELD_WIDTH);
    assert.equal(field.height, expected);
    assert.equal(temperatureFieldHeight(TEMPERATURE_FIELD_WIDTH), expected);
    assert.equal(field.values.length, field.width * field.height);
    assert.equal(field.alpha.length, field.width * field.height);
  });

  it("uses a place's own value in the cell that holds it", () => {
    const empty = buildTemperatureField([]);
    const centre = cellCentre(empty, 40, 120);
    const field = buildTemperatureField([
      { ...centre, temperature: 7.5 },
      { lat: centre.lat + 0.2, lon: centre.lon + 0.3, temperature: -4 },
    ]);
    const index = 40 * field.width + 120;

    assert.equal(field.values[index], 7.5);
    assert.equal(field.alpha[index], 1);
  });

  it("masks cells with no place within 60 km", () => {
    const field = buildTemperatureField([
      { lat: 57.0, lon: 24.0, temperature: 10 },
    ]);
    const far = cellIndex(field, 56.0, 27.5);

    assert.ok(Number.isNaN(field.values[far]));
    assert.equal(field.alpha[far], 0);
  });

  it("fades out between 8 and 20 km from the nearest place", () => {
    const field = buildTemperatureField([
      { lat: 57.0, lon: 24.0, temperature: 10 },
    ]);
    // About 30 km north: still inside the search radius, but transparent.
    const outside = cellIndex(field, 57.27, 24.0);

    assert.equal(field.values[outside], 10);
    assert.equal(field.alpha[outside], 0);
  });

  it("puts roughly the average halfway between two places", () => {
    const field = buildTemperatureField([
      { lat: 56.9, lon: 23.8, temperature: 0 },
      { lat: 56.9, lon: 24.2, temperature: 10 },
    ]);
    const middle = field.values[cellIndex(field, 56.9, 24.0)];

    assert.ok(Math.abs(middle - 5) < 1, `expected about 5, got ${middle}`);
  });
});

describe("temperature field colour", () => {
  it("matches every stop exactly", () => {
    for (const stop of TEMPERATURE_FIELD_STOPS) {
      assert.deepEqual(temperatureFieldColor(stop.temperature), hexToRgb(stop.color));
    }
  });

  it("clamps at both ends", () => {
    assert.deepEqual(temperatureFieldColor(-40), hexToRgb("#1e3a8a"));
    assert.deepEqual(temperatureFieldColor(45), hexToRgb("#ef4444"));
  });

  it("interpolates in RGB between stops", () => {
    // Halfway from -20 (#1e3a8a) to -10 (#1d4ed8).
    assert.deepEqual(temperatureFieldColor(-15), [30, 68, 177]);
  });
});
