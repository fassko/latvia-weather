import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CARTO_TILE_ATTRIBUTION,
  CARTO_VOYAGER_TILE_URL,
  OSM_FRANCE_TILE_ATTRIBUTION,
  OSM_FRANCE_TILE_URL,
  resolveMapTiles,
} from "../src/lib/weather/map-tiles.ts";

describe("resolveMapTiles", () => {
  it("defaults to OSM France classic colors (high zoom, no key)", () => {
    const tiles = resolveMapTiles("light", {});
    assert.equal(tiles.provider, "osm-fr");
    assert.equal(tiles.url, OSM_FRANCE_TILE_URL);
    assert.equal(tiles.attribution, OSM_FRANCE_TILE_ATTRIBUTION);
  });

  it("uses the same OSM France URL in dark mode (CSS invert handles theme)", () => {
    const tiles = resolveMapTiles("dark", {});
    assert.equal(tiles.provider, "osm-fr");
    assert.equal(tiles.url, OSM_FRANCE_TILE_URL);
  });

  it("ignores blank CARTO keys and still uses OSM France", () => {
    const tiles = resolveMapTiles("light", {
      NEXT_PUBLIC_CARTO_API_KEY: "   ",
    });
    assert.equal(tiles.provider, "osm-fr");
    assert.equal(tiles.url, OSM_FRANCE_TILE_URL);
  });

  it("appends the CARTO key query param for Voyager tiles", () => {
    const tiles = resolveMapTiles("light", {
      NEXT_PUBLIC_CARTO_API_KEY: "test-key/with spaces",
    });
    assert.equal(tiles.provider, "carto");
    assert.equal(
      tiles.url,
      `${CARTO_VOYAGER_TILE_URL}?key=${encodeURIComponent("test-key/with spaces")}`,
    );
    assert.equal(tiles.attribution, CARTO_TILE_ATTRIBUTION);
  });

  it("prefers a custom tile URL template over CARTO", () => {
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

  it("uses OSM France attribution when a custom URL has none", () => {
    const tiles = resolveMapTiles("light", {
      NEXT_PUBLIC_MAP_TILE_URL: "https://example.test/{z}/{x}/{y}.png",
    });
    assert.equal(tiles.provider, "custom");
    assert.equal(tiles.attribution, OSM_FRANCE_TILE_ATTRIBUTION);
  });
});
