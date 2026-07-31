import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWeekendDayToken,
  splitWeekendDayParts,
} from "../src/lib/weather/weekend-highlight.ts";

function highlightedParts(text: string): string[] {
  return splitWeekendDayParts(text).filter(isWeekendDayToken);
}

describe("weekend day highlighting", () => {
  it("highlights full Saturday and Sunday names", () => {
    assert.deepEqual(highlightedParts("This Saturday and Sunday look wet."), [
      "Saturday",
      "Sunday",
    ]);
  });

  it("highlights Sat/Sun abbreviations including with a period", () => {
    assert.deepEqual(highlightedParts("Fri 30° ↓ Sat 22° ↑ Sun. 23°"), [
      "Sat",
      "Sun.",
    ]);
  });

  it("does not highlight sunny or other partial matches", () => {
    assert.deepEqual(
      highlightedParts("A sunny day on Sunday afternoon."),
      ["Sunday"],
    );
    assert.deepEqual(
      highlightedParts("It stays sunny through Saturday morning."),
      ["Saturday"],
    );
    assert.deepEqual(
      highlightedParts("The sun is out on Saturday."),
      ["Saturday"],
    );
  });

  it("only treats capitalized Sat/Sun as abbreviations", () => {
    assert.deepEqual(highlightedParts("Fri 30° ↓ Sat 22° ↑ Sun 23°"), [
      "Sat",
      "Sun",
    ]);
    assert.deepEqual(highlightedParts("this sat stays dry"), []);
  });

  it("highlights Latvian weekend day forms", () => {
    assert.deepEqual(
      highlightedParts("Sestdiena būs vēsa, svētdienā siltāka."),
      ["Sestdiena", "svētdienā"],
    );
  });

  it("recognizes only whole weekend day tokens", () => {
    assert.equal(isWeekendDayToken("Saturday"), true);
    assert.equal(isWeekendDayToken("Sun"), true);
    assert.equal(isWeekendDayToken("sunny"), false);
    assert.equal(isWeekendDayToken("Sat"), true);
  });
});
