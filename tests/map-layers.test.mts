import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildField, createWindSampler } from "../src/lib/weather/map-field.ts";
import {
  mapLayerSearch,
  parseMapLayer,
} from "../src/lib/weather/map-layer.ts";
import {
  hasAnyRain,
  RAIN_FIELD_STOPS,
  rainChip,
  rainFieldAlpha,
  rainFieldColor,
  rainFieldLegendPosition,
} from "../src/lib/weather/rain-field.ts";
import {
  WIND_FIELD_STOPS,
  windArrowLength,
  windArrowRotation,
  windFieldColor,
} from "../src/lib/weather/wind-field.ts";

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe("wind layer", () => {
  it("matches every colour stop and clamps at the ends", () => {
    for (const stop of WIND_FIELD_STOPS) {
      assert.deepEqual(windFieldColor(stop.value), hexToRgb(stop.color));
    }
    assert.deepEqual(windFieldColor(-1), hexToRgb("#e0f2fe"));
    assert.deepEqual(windFieldColor(35), hexToRgb("#a21caf"));
  });

  it("points the arrow south for a north wind at a single place", () => {
    const { windAt } = createWindSampler([
      { lat: 57, lon: 24, windSpeed: 5, windDirection: 0 },
    ]);
    const here = windAt(57, 24);

    assert.ok(here);
    assert.equal(here.bearing, 180);
    assert.equal(here.direction, 0);
    assert.equal(here.speed, 5);
    assert.equal(here.alpha, 1);
    assert.equal(windArrowRotation(0), 180);
  });

  it("averages directions as vectors", () => {
    const { windAt } = createWindSampler([
      { lat: 57, lon: 23.9, windSpeed: 4, windDirection: 350 },
      { lat: 57, lon: 24.1, windSpeed: 4, windDirection: 10 },
    ]);
    const middle = windAt(57, 24);

    assert.ok(middle);
    // From north on both sides, not from the south (the mean of 350 and 10).
    assert.ok(Math.abs(middle.direction) < 0.5 || Math.abs(middle.direction - 360) < 0.5);
    assert.ok(Math.abs(middle.bearing - 180) < 0.5);
  });

  it("points east for a west wind and has nothing far from places", () => {
    const { windAt } = createWindSampler([
      { lat: 57, lon: 24, windSpeed: 8, windDirection: 270 },
    ]);

    assert.ok(Math.abs(windAt(57.05, 24.05)!.bearing - 90) < 1e-9);
    assert.equal(windAt(56, 27.5), null);
    // About 30 km away: inside the search radius, but faded out.
    assert.equal(windAt(57.27, 24)!.alpha, 0);
  });

  it("grows arrows from 10 to 22 px up to 15 m/s", () => {
    assert.equal(windArrowLength(0), 10);
    assert.equal(windArrowLength(7.5), 16);
    assert.equal(windArrowLength(15), 22);
    assert.equal(windArrowLength(30), 22);
  });
});

describe("rain layer", () => {
  it("matches every colour stop and clamps at the ends", () => {
    for (const stop of RAIN_FIELD_STOPS) {
      assert.deepEqual(rainFieldColor(stop.value), hexToRgb(stop.color));
    }
    assert.deepEqual(rainFieldColor(0.05), hexToRgb("#a5f3fc"));
    assert.deepEqual(rainFieldColor(40), hexToRgb("#db2777"));
  });

  it("is transparent below 0.05 mm and keeps drizzle light", () => {
    assert.equal(rainFieldAlpha(0, 1), 0);
    assert.equal(rainFieldAlpha(0.049, 1), 0);
    assert.equal(rainFieldAlpha(Number.NaN, 1), 0);
    assert.ok(Math.abs(rainFieldAlpha(0.1, 1) - 0.4) < 1e-9);
    assert.ok(Math.abs(rainFieldAlpha(1, 0.5) - 0.425) < 1e-9);
    assert.equal(rainFieldAlpha(1.3, 1), 1);
    assert.equal(rainFieldAlpha(5, 0), 0);
  });

  it("keeps rain local by interpolating the zeros", () => {
    const field = buildField(
      [
        { lat: 57, lon: 24, precipitation: 2 },
        { lat: 57, lon: 24.4, precipitation: 0 },
        { lat: 57, lon: 23.6, precipitation: 0 },
        { lat: 57, lon: 25, precipitation: undefined },
      ],
      (point) => point.precipitation,
    );
    const finite = Array.from(field.values).filter((value) => Number.isFinite(value));

    assert.ok(Math.max(...finite) <= 2);
    assert.ok(finite.some((value) => value < 0.05));
  });

  it("spaces the legend on a log scale", () => {
    assert.equal(rainFieldLegendPosition(0.1), 0);
    assert.equal(rainFieldLegendPosition(1), 0.5);
    assert.equal(rainFieldLegendPosition(10), 1);
  });

  it("labels chips by amount, then chance, then 0", () => {
    assert.deepEqual(rainChip({ precipitation: 1.24, precipitationProbability: 80 }), {
      kind: "amount",
      text: "1.2 mm",
      mm: 1.24,
    });
    assert.deepEqual(rainChip({ precipitation: 0.1 }), { kind: "amount", text: "0.1 mm", mm: 0.1 });
    assert.deepEqual(rainChip({ precipitation: 0.05, precipitationProbability: 30 }), {
      kind: "chance",
      text: "30%",
    });
    assert.deepEqual(rainChip({ precipitation: 0, precipitationProbability: 0.3 }), {
      kind: "none",
      text: "0",
    });
    assert.deepEqual(rainChip({ precipitation: 0, precipitationProbability: 0 }), {
      kind: "none",
      text: "0",
    });
    // The data.gov.lv fallback has no chance of rain.
    assert.deepEqual(rainChip({ precipitation: 0, precipitationProbability: null }), {
      kind: "none",
      text: "0",
    });
    assert.deepEqual(rainChip({}), { kind: "none", text: "0" });
  });

  it("notices when nowhere has rain", () => {
    assert.equal(hasAnyRain([{ precipitation: 0 }, { precipitation: 0.04 }, {}]), false);
    assert.equal(hasAnyRain([{ precipitation: 0 }, { precipitation: 0.05 }]), true);
  });
});

describe("map layer in the URL", () => {
  it("parses the layer and defaults to temperature", () => {
    assert.equal(parseMapLayer("wind"), "wind");
    assert.equal(parseMapLayer("rain"), "rain");
    assert.equal(parseMapLayer(["rain", "wind"]), "rain");
    assert.equal(parseMapLayer("temperature"), "temperature");
    assert.equal(parseMapLayer("snow"), "temperature");
    assert.equal(parseMapLayer(undefined), "temperature");
    assert.equal(parseMapLayer(null), "temperature");
  });

  it("writes the layer and keeps other parameters", () => {
    assert.equal(mapLayerSearch("?alarms=0", "wind"), "?alarms=0&layer=wind");
    assert.equal(mapLayerSearch("?layer=wind&alarms=0", "rain"), "?layer=rain&alarms=0");
    assert.equal(mapLayerSearch("?layer=rain", "temperature"), "");
    assert.equal(mapLayerSearch("", "temperature"), "");
  });
});
