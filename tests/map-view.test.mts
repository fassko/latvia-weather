import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LATVIA_FIT_MAX_ZOOM,
  LATVIA_FIT_PADDING,
  MOBILE_MAP_MAX_WIDTH,
  isMobileMapWidth,
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
