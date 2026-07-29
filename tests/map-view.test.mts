import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DESKTOP_DEFAULT_ZOOM,
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

  it("uses a wider overview on mobile widths", () => {
    assert.deepEqual(latviaOverviewForWidth(390), {
      mode: "setView",
      center: LATVIA_CENTER,
      zoom: MOBILE_DEFAULT_ZOOM,
    });
  });

  it("zooms in the default overview on wider map panes", () => {
    assert.deepEqual(latviaOverviewForWidth(960), {
      mode: "setView",
      center: LATVIA_CENTER,
      zoom: DESKTOP_DEFAULT_ZOOM,
    });
  });
});
