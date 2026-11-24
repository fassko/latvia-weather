import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapLayerSearch, parseMapLayer } from "../src/lib/weather/map-layer.ts";
import {
  EE_RADAR_LEGEND,
  EE_RADAR_NOWCAST_LAYER,
  EE_RADAR_OBSERVED_LAYER,
  eeRadarFrames,
  eeRadarImageSize,
  latestObservedFrameIndex,
  LVGMC_RADAR_LEGEND,
  lvgmcRadarFrames,
  parseLvgmcRadarTime,
  parseRadarSource,
  parseWmsTimeExtent,
  radarLegendGradientCss,
  radarLegendTicks,
  toWebMercator,
} from "../src/lib/weather/radar.ts";

const LV_PREFIX = "Latvija/Latvija_satelits/png/online/RIX/RIX_250.sri";

function lvName(stamp: string): { name: string } {
  return { name: `${LV_PREFIX}/LATVIJA_${stamp}_RADARS.png` };
}

function times(...iso: string[]): Date[] {
  return iso.map((value) => new Date(value));
}

describe("radar layer selection", () => {
  it("parses radar from the URL and keeps it there", () => {
    assert.equal(parseMapLayer("radar"), "radar");
    assert.equal(mapLayerSearch("", "radar"), "?layer=radar");
  });

  it("defaults the source to LVĢMC", () => {
    assert.equal(parseRadarSource("ee"), "ee");
    assert.equal(parseRadarSource("lvgmc"), "lvgmc");
    assert.equal(parseRadarSource("opera"), "lvgmc");
    assert.equal(parseRadarSource(null), "lvgmc");
  });
});

describe("LVĢMC radar frames", () => {
  it("reads file names as Riga wall time in winter and summer", () => {
    // EET (UTC+2)
    assert.equal(
      parseLvgmcRadarTime(lvName("202611242020").name)?.toISOString(),
      "2026-11-24T18:20:00.000Z",
    );
    // EEST (UTC+3)
    assert.equal(
      parseLvgmcRadarTime(lvName("202607011200").name)?.toISOString(),
      "2026-07-01T09:00:00.000Z",
    );
    assert.equal(parseLvgmcRadarTime("Latvija/other.png"), null);
  });

  it("keeps the last window, sorted, de-duplicated, with image URLs", () => {
    const frames = lvgmcRadarFrames(
      [
        lvName("202611242020"),
        lvName("202611241700"),
        lvName("202611242010"),
        lvName("202611242010"),
        { name: "junk.png" },
        {},
      ],
      60,
    );

    assert.deepEqual(
      frames.map((frame) => frame.time),
      ["2026-11-24T18:10:00.000Z", "2026-11-24T18:20:00.000Z"],
    );
    assert.equal(
      frames[1].url,
      `https://videscentrs.lvgmc.lv/kartes-images/${LV_PREFIX}/LATVIJA_202611242020_RADARS.png`,
    );
    assert.ok(frames.every((frame) => !frame.nowcast));
  });

  it("returns nothing for an empty list", () => {
    assert.deepEqual(lvgmcRadarFrames([]), []);
  });
});

describe("Estonian WMS radar frames", () => {
  it("parses a comma-separated time extent", () => {
    const xml = `<Layer><Extent name="time" default="2026-11-24T18:25:00Z">2026-11-24T18:15:00.000Z,2026-11-24T18:20:00.000Z,
      2026-11-24T18:25:00.000Z</Extent></Layer>`;
    assert.deepEqual(
      parseWmsTimeExtent(xml).map((time) => time.toISOString()),
      ["2026-11-24T18:15:00.000Z", "2026-11-24T18:20:00.000Z", "2026-11-24T18:25:00.000Z"],
    );
  });

  it("skips the empty <Dimension> that GeoServer puts before the <Extent>", () => {
    const xml = `<Dimension name="time" units="ISO8601"/>
      <Extent name="time" default="2026-11-24T18:50:00Z">2026-11-24T18:45:00.000Z,2026-11-24T18:50:00.000Z</Extent>`;
    assert.deepEqual(
      parseWmsTimeExtent(xml).map((time) => time.toISOString()),
      ["2026-11-24T18:45:00.000Z", "2026-11-24T18:50:00.000Z"],
    );
  });

  it("expands start/end/period ranges", () => {
    const xml = `<Extent name="time">2026-11-24T18:00:00Z/2026-11-24T18:20:00Z/PT10M</Extent>`;
    assert.deepEqual(
      parseWmsTimeExtent(xml).map((time) => time.toISOString()),
      ["2026-11-24T18:00:00.000Z", "2026-11-24T18:10:00.000Z", "2026-11-24T18:20:00.000Z"],
    );
  });

  it("returns nothing without a time extent", () => {
    assert.deepEqual(parseWmsTimeExtent("<Layer></Layer>"), []);
  });

  it("takes 10-minute observed frames, keeps the newest, then the nowcast after it", () => {
    const observed = times(
      "2026-11-24T15:00:00Z", // outside the window
      "2026-11-24T18:00:00Z",
      "2026-11-24T18:05:00Z",
      "2026-11-24T18:10:00Z",
      "2026-11-24T18:15:00Z",
      "2026-11-24T18:25:00Z",
    );
    const nowcast = times(
      "2026-11-24T18:20:00Z", // before the newest observation
      "2026-11-24T18:30:00Z",
      "2026-11-24T18:35:00Z",
      "2026-11-24T18:40:00Z",
      "2026-11-24T21:00:00Z", // too far ahead
    );

    const frames = eeRadarFrames(observed, nowcast, {
      windowMinutes: 30,
      nowcastMinutes: 60,
      stepMinutes: 10,
    });

    assert.deepEqual(
      frames.map((frame) => [frame.time.slice(11, 16), frame.nowcast]),
      [
        ["18:00", false],
        ["18:10", false],
        ["18:25", false],
        ["18:30", true],
        ["18:40", true],
      ],
    );
    assert.match(frames[0].url, new RegExp(`LAYERS=${encodeURIComponent(EE_RADAR_OBSERVED_LAYER)}`));
    assert.match(frames.at(-1)!.url, new RegExp(`LAYERS=${encodeURIComponent(EE_RADAR_NOWCAST_LAYER)}`));
    assert.match(frames[0].url, /SRS=EPSG%3A3857/);
    assert.match(frames[0].url, /TIME=2026-11-24T18%3A00%3A00.000Z/);
    assert.equal(latestObservedFrameIndex(frames), 2);
  });

  it("returns nothing without observations", () => {
    assert.deepEqual(eeRadarFrames([], times("2026-11-24T18:30:00Z")), []);
  });

  it("sizes the image to the bounds' Web Mercator aspect ratio", () => {
    const [x0, y0] = toWebMercator(0, 0);
    assert.ok(Math.abs(x0) < 1e-6 && Math.abs(y0) < 1e-6);

    const { width, height, bbox } = eeRadarImageSize(
      [
        [53.5, 18],
        [60, 32],
      ],
      1200,
    );
    const [minX, minY, maxX, maxY] = bbox.split(",").map(Number);
    assert.equal(width, 1200);
    assert.ok(Math.abs(height / width - (maxY - minY) / (maxX - minX)) < 0.002);
  });
});

describe("radar legend", () => {
  it("draws one hard-edged band per colour", () => {
    const css = radarLegendGradientCss(EE_RADAR_LEGEND);
    assert.ok(css.startsWith("linear-gradient(to right, #0099CC 0.00% 11.11%"));
    assert.ok(css.endsWith("#FF45FF 88.89% 100.00%)"));
  });

  it("centres labels on their bands", () => {
    const ticks = radarLegendTicks(LVGMC_RADAR_LEGEND);
    assert.deepEqual(ticks[0], { label: "0.3", position: 0.5 / 15 });
    assert.equal(ticks.at(-1)?.label, "50");
  });

  it("starts on the newest observation even when nowcast follows", () => {
    assert.equal(
      latestObservedFrameIndex([
        { time: "a", url: "", nowcast: false },
        { time: "b", url: "", nowcast: false },
        { time: "c", url: "", nowcast: true },
      ]),
      1,
    );
    assert.equal(latestObservedFrameIndex([]), -1);
  });
});
