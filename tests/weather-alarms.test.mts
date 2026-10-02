import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alarmCoversPoint,
  buildWeatherAlarmPolygons,
  buildWeatherAlarmRegionLabelsByText,
  filterAlarmsByCoordinates,
  pointInRing,
} from "../src/lib/weather/alarms.ts";
import {
  buildWeatherAlarmsResponse,
  resolveIncludeGeometry,
  serializeWeatherAlarm,
} from "../src/lib/weather/alarms-api.ts";
import type { WeatherAlarmPolygon } from "../src/lib/weather/types.ts";

test("buildWeatherAlarmPolygons joins metadata, ordered rings, and municipality names", () => {
  const alarms = buildWeatherAlarmPolygons(
    [
      {
        WARNING_NO: "8/27",
        WEATHER_WARNING_EV_ID: 27980,
        INTENSITY_LV: "Dzeltens",
        INTENSITY_EN: "Yellow",
        REGIONS: "Rīga",
        REGIONS_EN: "Riga",
        PARADIBA: "Pērkona negaiss",
        PARADIBA_EN: "Thunderstorm",
        TIME_FROM: "2026-08-11T15:00:00",
        TIME_TILL: "2026-08-11T18:00:00",
        TEKSTS_LV: "Rīgā gaidāms pērkona negaiss.",
        TEKSTS_EN: "Thunderstorm is expected in Riga.",
        RISKS_LV: "Esi informēts.",
        RISKS_EN: "Be aware.",
      },
    ],
    [
      {
        WEATHER_WARNING_EV_ID: 27980,
        POLIGON_ID: 1,
        LAT: 56.9,
        LON: 24.1,
        NPK: 2,
      },
      {
        WEATHER_WARNING_EV_ID: 27980,
        POLIGON_ID: 1,
        LAT: 56.8,
        LON: 24,
        NPK: 1,
      },
      {
        WEATHER_WARNING_EV_ID: 27980,
        POLIGON_ID: 1,
        LAT: 57,
        LON: 24.2,
        NPK: 3,
      },
    ],
    [{ WEATHER_WARNING_EV_ID: 27980, NOV_ID: 43 }],
    [{ NOV_ID: 43, NOSAUKUMS_LV: "Rīga", NOSAUKUMS_EN: "Riga" }],
  );

  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].id, "27980");
  assert.equal(alarms[0].level, "yellow");
  assert.deepEqual(alarms[0].municipalityNamesLv, ["Rīga"]);
  assert.deepEqual(alarms[0].rings, [
    [
      [56.8, 24],
      [56.9, 24.1],
      [57, 24.2],
    ],
  ]);
});

test("buildWeatherAlarmRegionLabelsByText indexes localized region labels by warning text", () => {
  const labels = buildWeatherAlarmRegionLabelsByText([
    {
      WARNING_NO: "8/25",
      WEATHER_WARNING_EV_ID: 27978,
      INTENSITY_LV: "Dzeltens",
      INTENSITY_EN: "Yellow",
      REGIONS: "Latvija",
      REGIONS_EN: "Latvia",
      PARADIBA: "Pērkona negaiss",
      PARADIBA_EN: "Thunderstorm",
      TIME_FROM: "2026-08-11T12:00:00",
      TIME_TILL: "2026-08-11T21:00:00",
      TEKSTS_LV: "Latvijā gaidāms pērkona negaiss.",
      TEKSTS_EN: "Thunderstorm is expected in Latvia.",
      RISKS_LV: "Esi informēts.",
      RISKS_EN: "Be aware.",
    },
  ]);

  assert.deepEqual(labels.get("Latvijā gaidāms pērkona negaiss."), {
    lv: ["Latvija"],
    en: ["Latvia"],
  });
  assert.deepEqual(labels.get("Thunderstorm is expected in Latvia."), {
    lv: ["Latvija"],
    en: ["Latvia"],
  });
});

const squareAlarm: WeatherAlarmPolygon = {
  id: "1",
  warningNo: "1/1",
  level: "yellow",
  intensityLv: "Dzeltens",
  intensityEn: "Yellow",
  regionsLv: "Rīga",
  regionsEn: "Riga",
  phenomenonLv: "Migla",
  phenomenonEn: "Fog",
  timeFrom: "2026-10-02T00:00:00",
  timeTill: "2026-10-02T12:00:00",
  textLv: "Migla Rīgā.",
  textEn: "Fog in Riga.",
  risksLv: "Esi informēts.",
  risksEn: "Be aware.",
  municipalityNamesLv: ["Rīga"],
  municipalityNamesEn: ["Riga"],
  // Rough square around central Riga: [lat, lon]
  rings: [
    [
      [56.9, 24.0],
      [56.9, 24.2],
      [57.0, 24.2],
      [57.0, 24.0],
    ],
  ],
};

test("pointInRing detects points inside and outside a closed polygon", () => {
  assert.equal(pointInRing({ lat: 56.95, lon: 24.1 }, squareAlarm.rings[0]), true);
  assert.equal(pointInRing({ lat: 56.5, lon: 24.1 }, squareAlarm.rings[0]), false);
});

test("filterAlarmsByCoordinates keeps only covering alarms", () => {
  const outsideOnly: WeatherAlarmPolygon = {
    ...squareAlarm,
    id: "2",
    rings: [
      [
        [55.0, 21.0],
        [55.0, 21.2],
        [55.2, 21.2],
        [55.2, 21.0],
      ],
    ],
  };

  const matches = filterAlarmsByCoordinates(
    [squareAlarm, outsideOnly],
    { lat: 56.95, lon: 24.1 },
  );

  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.id, "1");
  assert.equal(alarmCoversPoint(outsideOnly, { lat: 56.95, lon: 24.1 }), false);
});

test("serializeWeatherAlarm nests LV/EN fields and can omit geometry", () => {
  const withGeometry = serializeWeatherAlarm(squareAlarm, true);
  assert.equal(withGeometry.intensity.en, "Yellow");
  assert.equal(withGeometry.phenomenon.lv, "Migla");
  assert.equal(withGeometry.text.en, "Fog in Riga.");
  assert.ok(withGeometry.rings);

  const withoutGeometry = serializeWeatherAlarm(squareAlarm, false);
  assert.equal(withoutGeometry.rings, undefined);
});

test("buildWeatherAlarmsResponse filters and shapes the public payload", () => {
  const payload = buildWeatherAlarmsResponse({
    alarms: [squareAlarm],
    filter: {
      punkts: "P269",
      location: {
        id: "P269",
        name: "Rīga",
        region: "Rīga",
        lat: 56.95,
        lon: 24.1,
      },
      lat: 56.95,
      lon: 24.1,
    },
    includeGeometry: false,
    fetchedAt: new Date("2026-10-02T07:00:00.000Z"),
  });

  assert.equal(payload.source, "data.gov.lv / LVĢMC");
  assert.equal(payload.dataset, "hidrometeorologiskie-bridinajumi");
  assert.equal(payload.count, 1);
  assert.equal(payload.filter?.punkts, "P269");
  assert.equal(payload.alarms[0]?.rings, undefined);
  assert.equal(payload.fetchedAt, "2026-10-02T07:00:00.000Z");
});

test("buildWeatherAlarmsResponse returns empty list when point is outside", () => {
  const payload = buildWeatherAlarmsResponse({
    alarms: [squareAlarm],
    filter: { lat: 55.0, lon: 21.0 },
    includeGeometry: true,
  });

  assert.equal(payload.count, 0);
  assert.deepEqual(payload.alarms, []);
});

test("resolveIncludeGeometry defaults to true and accepts falsey flags", () => {
  assert.equal(resolveIncludeGeometry(null, null), true);
  assert.equal(resolveIncludeGeometry("0", null), false);
  assert.equal(resolveIncludeGeometry(null, "false"), false);
  assert.equal(resolveIncludeGeometry("1", "false"), true);
});
