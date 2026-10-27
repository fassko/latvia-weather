import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LATVIA_FIT_MAX_ZOOM,
  LATVIA_FIT_PADDING,
  MOBILE_MAP_MAX_WIDTH,
  isMobileMapWidth,
  isPlaceLabelVisible,
  maxLabelRankForZoom,
  latviaOverviewForWidth,
} from "../src/lib/weather/map-view.ts";

describe("map overview helpers", () => {
  it("treats widths below the breakpoint as mobile", () => {
    assert.equal(isMobileMapWidth(390), true);
    assert.equal(isMobileMapWidth(MOBILE_MAP_MAX_WIDTH - 1), true);
    assert.equal(isMobileMapWidth(MOBILE_MAP_MAX_WIDTH), false);
    assert.equal(isMobileMapWidth(1024), false);
    assert.equal(isMobileMapWidth(0), false);
  });

  it("fits the full Latvia bounds on mobile widths", () => {
    assert.deepEqual(latviaOverviewForWidth(390), {
      mode: "fitBounds",
      padding: LATVIA_FIT_PADDING,
      maxZoom: LATVIA_FIT_MAX_ZOOM,
    });
  });

  it("fits the full Latvia bounds on wider map panes", () => {
    assert.deepEqual(latviaOverviewForWidth(960), {
      mode: "fitBounds",
      padding: LATVIA_FIT_PADDING,
      maxZoom: LATVIA_FIT_MAX_ZOOM,
    });
  });
});

describe("map place labels", () => {
  it("shows more ranks as the map zooms in", () => {
    assert.equal(maxLabelRankForZoom(6), 1);
    assert.equal(maxLabelRankForZoom(7), 1);
    assert.equal(maxLabelRankForZoom(8), 2);
    assert.equal(maxLabelRankForZoom(9), 3);
    assert.equal(maxLabelRankForZoom(10), 4);
    assert.equal(maxLabelRankForZoom(11), Number.POSITIVE_INFINITY);
  });

  it("treats an unknown rank as 4", () => {
    assert.equal(isPlaceLabelVisible(null, 9), false);
    assert.equal(isPlaceLabelVisible(undefined, 10), true);
    assert.equal(isPlaceLabelVisible(0, 6), true);
    assert.equal(isPlaceLabelVisible(5, 10), false);
    assert.equal(isPlaceLabelVisible(5, 11), true);
  });
});
