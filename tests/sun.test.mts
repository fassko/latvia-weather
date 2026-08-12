import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAuthoritativeSunTimesByDay,
  getSunTimes,
  getSunTimesForLatviaDay,
} from "../src/lib/weather/sun.ts";
import { formatLatviaTime } from "../src/lib/weather/timezone.ts";

const RIGA = { lat: 56.9496, lon: 24.1052 };

describe("getSunTimes", () => {
  it("calculates long midsummer daylight for Riga", () => {
    const times = getSunTimes(new Date(Date.UTC(2026, 5, 21, 12)), RIGA.lat, RIGA.lon);

    assert.ok(times);
    assert.match(formatLatviaTime(times.sunrise, "HH:mm"), /^0[34]:/);
    assert.match(formatLatviaTime(times.sunset, "HH:mm"), /^22:/);
  });

  it("calculates short midwinter daylight for Riga", () => {
    const times = getSunTimes(new Date(Date.UTC(2026, 11, 21, 12)), RIGA.lat, RIGA.lon);

    assert.ok(times);
    assert.match(formatLatviaTime(times.sunrise, "HH:mm"), /^0[89]:/);
    assert.match(formatLatviaTime(times.sunset, "HH:mm"), /^15:/);
  });

  it("returns null for missing coordinates", () => {
    assert.equal(getSunTimes(new Date(), Number.NaN, RIGA.lon), null);
  });

  it("anchors Latvia day calculations to the requested local date", () => {
    const times = getSunTimesForLatviaDay("2026-08-19", RIGA.lat, RIGA.lon);

    assert.ok(times);
    assert.equal(formatLatviaTime(times.sunrise, "yyyy-MM-dd"), "2026-08-19");
    assert.equal(formatLatviaTime(times.sunset, "yyyy-MM-dd"), "2026-08-19");
  });

  it("uses API sunrise and sunset values when available", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              date: "2026-08-12",
              sunrise: "05:43:16",
              sunset: "21:11:33",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    try {
      const times = await getAuthoritativeSunTimesByDay(
        ["2026-08-12"],
        RIGA.lat,
        RIGA.lon,
      );

      assert.equal(formatLatviaTime(times["2026-08-12"].sunrise, "HH:mm"), "05:43");
      assert.equal(formatLatviaTime(times["2026-08-12"].sunset, "HH:mm"), "21:11");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to local calculations when the API fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });

    try {
      const times = await getAuthoritativeSunTimesByDay(
        ["2026-08-19"],
        RIGA.lat,
        RIGA.lon,
      );

      assert.ok(times["2026-08-19"]);
      assert.equal(formatLatviaTime(times["2026-08-19"].sunrise, "yyyy-MM-dd"), "2026-08-19");
      assert.equal(formatLatviaTime(times["2026-08-19"].sunset, "yyyy-MM-dd"), "2026-08-19");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
