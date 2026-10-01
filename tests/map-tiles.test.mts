import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CARTO_DARK_MATTER_TILE_URL,
  CARTO_POSITRON_TILE_URL,
  CARTO_TILE_ATTRIBUTION,
  ESRI_DARK_GRAY_REFERENCE_URL,
  ESRI_DARK_GRAY_TILE_URL,
  ESRI_LIGHT_GRAY_REFERENCE_URL,
  ESRI_LIGHT_GRAY_TILE_URL,
  ESRI_TILE_ATTRIBUTION,
  resolveMapTiles,
} from "../src/lib/weather/map-tiles.ts";

describe("resolveMapTiles", () => {
  it("defaults to Esri light gray canvas (no green forests)", () => {
    const tiles = resolveMapTiles("light", {});
    assert.equal(tiles.provider, "esri-gray");
    assert.equal(tiles.url, ESRI_LIGHT_GRAY_TILE_URL);
    assert.equal(tiles.referenceUrl, ESRI_LIGHT_GRAY_REFERENCE_URL);
    assert.equal(tiles.attribution, ESRI_TILE_ATTRIBUTION);
  });

  it("uses Esri dark gray canvas in dark mode", () => {
    const tiles = resolveMapTiles("dark", {});
    assert.equal(tiles.provider, "esri-gray");
    assert.equal(tiles.url, ESRI_DARK_GRAY_TILE_URL);
    assert.equal(tiles.referenceUrl, ESRI_DARK_GRAY_REFERENCE_URL);
  });

  it("ignores blank CARTO keys and still uses Esri gray", () => {
    const tiles = resolveMapTiles("light", {
      NEXT_PUBLIC_CARTO_API_KEY: "   ",
    });
    assert.equal(tiles.provider, "esri-gray");
    assert.equal(tiles.url, ESRI_LIGHT_GRAY_TILE_URL);
  });

  it("uses CARTO Positron / Dark Matter when a key is set", () => {
    const key = "test-key/with spaces";
    const light = resolveMapTiles("light", {
      NEXT_PUBLIC_CARTO_API_KEY: key,
    });
    const dark = resolveMapTiles("dark", {
      NEXT_PUBLIC_CARTO_API_KEY: key,
    });
    assert.equal(light.provider, "carto-gray");
    assert.equal(
      light.url,
      `${CARTO_POSITRON_TILE_URL}?key=${encodeURIComponent(key)}`,
    );
    assert.equal(
      dark.url,
      `${CARTO_DARK_MATTER_TILE_URL}?key=${encodeURIComponent(key)}`,
    );
    assert.equal(light.attribution, CARTO_TILE_ATTRIBUTION);
    assert.equal(light.referenceUrl, undefined);
  });

  it("prefers a custom tile URL template over CARTO/Esri", () => {
    const tiles = resolveMapTiles("dark", {
      NEXT_PUBLIC_CARTO_API_KEY: "ignored",
      NEXT_PUBLIC_MAP_TILE_URL:
        "https://example.test/{z}/{x}/{y}.png?token=abc",
      NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: "Example tiles",
    });
    assert.equal(tiles.provider, "custom");
    assert.equal(tiles.url, "https://example.test/{z}/{x}/{y}.png?token=abc");
    assert.equal(tiles.attribution, "Example tiles");
  });

  it("uses Esri attribution when a custom URL has none", () => {
    const tiles = resolveMapTiles("light", {
      NEXT_PUBLIC_MAP_TILE_URL: "https://example.test/{z}/{x}/{y}.png",
    });
    assert.equal(tiles.provider, "custom");
    assert.equal(tiles.attribution, ESRI_TILE_ATTRIBUTION);
  });
});
