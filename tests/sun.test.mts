import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSunTimes, getSunTimesForLatviaDay } from "../src/lib/weather/sun.ts";
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
});
