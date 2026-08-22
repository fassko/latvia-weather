import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSunEventsByForecastTime,
  isSunEventInForecastHour,
} from "../src/lib/weather/sun-events.ts";
import { parseHourlyForecast } from "../src/lib/weather/parse.ts";
import { parseLaiks } from "../src/lib/weather/timezone.ts";

const rawTemplate = {
  punkts: "P269",
  nosaukums: "Garupe",
  novads: "Jūrmala",
  temperatura: "15",
  veja_atrums: "10",
  veja_virziens: "270",
  brazmas: "20",
  nokrisni_1h: "0",
  relativais_mitrums: "99",
  laika_apstaklu_ikona: "2101",
  spiediens: "1001",
  sajutu_temperatura: "15",
  sniegs: null,
  makoni: "90",
  nokrisnu_varbutiba: "100",
  uvi_indekss: null,
  perkons: "0",
};

function makeForecasts(laiksList: string[]) {
  return laiksList.map((laiks) =>
    parseHourlyForecast({
      ...rawTemplate,
      laiks,
    }),
  );
}

test("sun events match against full-day forecasts, not a limited strip subset", () => {
  const dayKey = "2026-08-22";
  const fullDayForecasts = makeForecasts([
    "202608220600",
    "202608220700",
    "202608220800",
    "202608220900",
    "202608221000",
    "202608221100",
    "202608221200",
    "202608221300",
    "202608221400",
    "202608221500",
    "202608221600",
    "202608221700",
    "202608221800",
    "202608221900",
    "202608222000",
    "202608222100",
    "202608222200",
    "202608222300",
  ]);
  const stripOnly = makeForecasts(["202608220800", "202608220900"]);

  const sunTimesByDay = {
    [dayKey]: {
      sunrise: parseLaiks("202608220606"),
      sunset: parseLaiks("202608222043"),
    },
  };

  const sparseDayMatch = getSunEventsByForecastTime(stripOnly, sunTimesByDay);
  const correctMatch = getSunEventsByForecastTime(fullDayForecasts, sunTimesByDay);

  const nineAmKey = makeForecasts(["202608220900"])[0].time.toISOString();
  const eightPmKey = makeForecasts(["202608222000"])[0].time.toISOString();
  const ninePmKey = makeForecasts(["202608222100"])[0].time.toISOString();
  const sixAmKey = makeForecasts(["202608220600"])[0].time.toISOString();

  assert.equal(
    sparseDayMatch.get(nineAmKey),
    undefined,
    "sparse day data does not attach distant sunset to 09:00",
  );
  assert.equal(
    correctMatch.get(nineAmKey),
    undefined,
    "full-day matching keeps 09:00 free of sunset",
  );
  assert.deepEqual(
    correctMatch.get(eightPmKey)?.map((event) => event.event),
    ["sunset"],
    "sunset at 20:43 belongs to the 20:00 hour bucket",
  );
  assert.equal(
    correctMatch.get(ninePmKey),
    undefined,
    "sunset does not attach to 21:00 when 20:00 contains it",
  );
  assert.deepEqual(
    correctMatch.get(sixAmKey)?.map((event) => event.event),
    ["sunrise"],
  );
});

test("isSunEventInForecastHour matches events within the forecast hour bucket", () => {
  const sixAm = makeForecasts(["202608220600"])[0];
  const sunrise = { event: "sunrise" as const, time: parseLaiks("202608220606") };
  const sunset = { event: "sunset" as const, time: parseLaiks("202608222043") };

  assert.equal(isSunEventInForecastHour(sunrise, sixAm), true);
  assert.equal(isSunEventInForecastHour(sunset, sixAm), false);
});
