import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeMvt, tilePointToLonLat, type MvtFeature } from "../src/lib/weather/mvt.ts";
import {
  decodeRoadWeatherImage,
  isRoadWeatherStale,
  parseRoadWeather,
  parseRoadWeatherTime,
  plausibleRoadTemperature,
  plausibleVisibility,
  ROAD_WEATHER_IMAGE_ID_PATTERN,
  roadTemperatureTone,
} from "../src/lib/weather/road-weather.ts";

describe("road weather sensor checks", () => {
  it("drops a road temperature that is far from the air temperature", () => {
    // Station 1078 on the A8 reported +20.42 °C road with −1.42 °C air.
    assert.equal(plausibleRoadTemperature(20.42, -1.42), null);
    assert.equal(plausibleRoadTemperature(-0.9, -0.75), -0.9);
    assert.equal(plausibleRoadTemperature(8, -1.5), 8);
    assert.equal(plausibleRoadTemperature(-0.4, null), -0.4);
    assert.equal(plausibleRoadTemperature(null, 1), null);
  });

  it("treats zero visibility as no reading", () => {
    assert.equal(plausibleVisibility(0), null);
    assert.equal(plausibleVisibility(907), 907);
    assert.equal(plausibleVisibility(null), null);
  });
});

// --- a tiny protobuf writer, just enough to build a vector tile ---

function varint(value: number): number[] {
  const out: number[] = [];
  while (value >= 0x80) {
    out.push((value % 0x80) | 0x80);
    value = Math.floor(value / 0x80);
  }
  out.push(value);
  return out;
}

function key(field: number, wire: number): number[] {
  return varint(field * 8 + wire);
}

function bytesField(field: number, bytes: number[]): number[] {
  return [...key(field, 2), ...varint(bytes.length), ...bytes];
}

function stringField(field: number, text: string): number[] {
  return bytesField(field, [...new TextEncoder().encode(text)]);
}

function zigzag(value: number): number {
  return value >= 0 ? value * 2 : -value * 2 - 1;
}

function doubleValue(value: number): number[] {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setFloat64(0, value, true);
  return [...key(3, 1), ...buf];
}

type Prop = string | number;

function buildTile(name: string, features: { props: Record<string, Prop>; x: number; y: number }[]): Uint8Array {
  const keys: string[] = [];
  const values: Prop[] = [];
  const index = <T,>(list: T[], item: T) => {
    const found = list.indexOf(item);
    if (found >= 0) return found;
    list.push(item);
    return list.length - 1;
  };

  const featureBytes = features.map(({ props, x, y }, i) => {
    const tags = Object.entries(props).flatMap(([k, v]) => [index(keys, k), index(values, v)]);
    const geometry = [9, zigzag(x), zigzag(y)];
    return bytesField(2, [
      ...key(1, 0),
      ...varint(i + 1),
      ...bytesField(2, tags.flatMap(varint)),
      ...key(3, 0),
      ...varint(1),
      ...bytesField(4, geometry.flatMap(varint)),
    ]);
  });

  const layer = [
    ...stringField(1, name),
    ...featureBytes.flat(),
    ...keys.flatMap((k) => stringField(3, k)),
    ...values.flatMap((v) =>
      bytesField(4, typeof v === "string" ? stringField(1, v) : doubleValue(v)),
    ),
    ...key(5, 0),
    ...varint(4096),
    ...key(15, 0),
    ...varint(2),
  ];
  return new Uint8Array(bytesField(3, layer));
}

const JPEG_HEX = "\\xffd8ffe000104a464946";
const TILE = { z: 5, x: 18, y: 9 };

describe("vector tile reader", () => {
  it("reads properties and the point position", () => {
    const tile = buildTile("public.kafkamessages_cms", [
      { props: { id: "1131", t1: "0.95", status: "active", gr: 0.76 }, x: 1024, y: 2048 },
    ]);
    const layers = decodeMvt(tile, TILE);
    const [feature] = layers.get("public.kafkamessages_cms") ?? [];
    assert.ok(feature);
    assert.deepEqual(feature.properties, { id: "1131", t1: "0.95", status: "active", gr: 0.76 });
    const expected = tilePointToLonLat(TILE, 4096, 1024, 2048);
    assert.equal(feature.lon, expected.lon);
    assert.equal(feature.lat, expected.lat);
  });

  it("puts the tile corners where web mercator does", () => {
    assert.deepEqual(tilePointToLonLat({ z: 0, x: 0, y: 0 }, 4096, 2048, 2048), { lon: 0, lat: 0 });
    const { lon, lat } = tilePointToLonLat(TILE, 4096, 0, 0);
    assert.equal(lon, 22.5);
    assert.ok(Math.abs(lat - 61.60640) < 1e-4);
  });
});

function feature(props: Record<string, string | number | boolean | null>, lat = 56.95, lon = 24.1): MvtFeature {
  return { properties: props, lat, lon };
}

describe("road weather parsing", () => {
  it("keeps active points in Latvia once each and reads their readings", () => {
    const station = {
      id: "1131",
      status: "active",
      t1: "0.95",
      ts1dst111: "-0.70",
      td1: "0.64",
      pr: "0.14",
      vi: "2000",
      gr: "0.76",
      minutemark: "2026-11-25 06:46:00+00",
      linear_reference: "A1 (96.999km)",
      has_warnings: "False",
      file_field: JPEG_HEX,
    };
    const parsed = parseRoadWeather(
      [
        feature(station),
        feature(station), // repeated in a neighbouring tile's buffer
        feature({ ...station, id: "2", status: "inactive" }),
        feature({ ...station, id: "3" }, 54.6, 25.3), // Vilnius
      ],
      [feature({ id: "6", status: "active", linear_reference: "A5 (40km)", file_field: "not an image" })],
      (imageId) => `/img/${imageId}`,
    );

    assert.equal(parsed.stations.length, 1);
    assert.deepEqual(parsed.stations[0], {
      id: "1131",
      kind: "station",
      lat: 56.95,
      lon: 24.1,
      road: "A1 (96.999km)",
      observedAt: "2026-11-25T06:46:00.000Z",
      airTemperature: 0.95,
      roadTemperature: -0.7,
      dewPoint: 0.64,
      precipitation: 0.14,
      visibility: 2000,
      grip: 0.76,
      hasWarnings: false,
      imageUrl: "/img/station-1131",
    });
    assert.deepEqual(parsed.cameras, [
      { id: "6", kind: "camera", lat: 56.95, lon: 24.1, road: "A5 (40km)", imageUrl: null },
    ]);
    assert.deepEqual([...parsed.images.keys()], ["station-1131"]);
    assert.deepEqual([...parsed.images.get("station-1131")!.slice(0, 2)], [0xff, 0xd8]);
  });

  it("reads Postgres times and bytea images", () => {
    assert.equal(parseRoadWeatherTime("2026-11-25 06:46:00+02"), "2026-11-25T04:46:00.000Z");
    assert.equal(parseRoadWeatherTime(""), null);
    assert.equal(parseRoadWeatherTime("soon"), null);
    assert.equal(decodeRoadWeatherImage("\\x89504e47"), null);
    assert.equal(decodeRoadWeatherImage("\\xffd8ffzz"), null);
    assert.deepEqual([...decodeRoadWeatherImage("\\xffd8ffe0")!], [0xff, 0xd8, 0xff, 0xe0]);
  });

  it("validates image ids, staleness and road temperature tones", () => {
    assert.ok(ROAD_WEATHER_IMAGE_ID_PATTERN.test("station-1131"));
    assert.ok(ROAD_WEATHER_IMAGE_ID_PATTERN.test("camera-6"));
    assert.ok(!ROAD_WEATHER_IMAGE_ID_PATTERN.test("../secret"));

    const now = new Date("2026-11-25T07:00:00Z");
    assert.equal(isRoadWeatherStale("2026-11-25T06:46:00Z", now), false);
    assert.equal(isRoadWeatherStale("2026-11-25T05:30:00Z", now), true);
    assert.equal(isRoadWeatherStale(null, now), true);

    assert.equal(roadTemperatureTone(-0.7), "ice");
    assert.equal(roadTemperatureTone(0), "ice");
    assert.equal(roadTemperatureTone(2.5), "near");
    assert.equal(roadTemperatureTone(8), "ok");
    assert.equal(roadTemperatureTone(null), "none");
  });
});
