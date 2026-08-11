import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DESKTOP_FIT_MAX_ZOOM,
  DESKTOP_FIT_PADDING,
  LATVIA_CENTER,
  MOBILE_DEFAULT_ZOOM,
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

  it("uses a fixed zoom on mobile widths so Latvia is not under-zoomed", () => {
    assert.deepEqual(latviaOverviewForWidth(390), {
      mode: "setView",
      center: LATVIA_CENTER,
      zoom: MOBILE_DEFAULT_ZOOM,
    });
    assert.equal(MOBILE_DEFAULT_ZOOM, 7);
  });

  it("fits the full Latvia bounds on wider map panes", () => {
    assert.deepEqual(latviaOverviewForWidth(960), {
      mode: "fitBounds",
      padding: DESKTOP_FIT_PADDING,
      maxZoom: DESKTOP_FIT_MAX_ZOOM,
    });
  });
});
