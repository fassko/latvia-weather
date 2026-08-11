import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWeatherAlarmPolygons,
  buildWeatherAlarmRegionLabelsByText,
} from "../src/lib/weather/alarms.ts";

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
