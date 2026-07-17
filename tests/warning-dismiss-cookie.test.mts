import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getWarningDismissKey,
  isWarningDismissed,
  parseDismissedWarningIds,
  serializeDismissedWarningIds,
  toRelevantDismissKeys,
} from "../src/lib/weather/warning-dismiss-cookie.ts";

const sampleWarning = {
  id: "414734420",
  level: "yellow" as const,
  type: "weather",
  textLv:
    "17.07.2026. no dienas vidus Latvijas dienvidu daļā gaidāms stiprs karstums - gaisa temperatūra paaugstināsies līdz +27...+28º.",
};

describe("warning dismiss cookie helpers", () => {
  it("parses comma-separated warning ids", () => {
    assert.deepEqual(parseDismissedWarningIds("a,b,c"), ["a", "b", "c"]);
  });

  it("decodes uri-encoded cookie values", () => {
    assert.deepEqual(
      parseDismissedWarningIds(encodeURIComponent("warn-1,warn-2")),
      ["warn-1", "warn-2"],
    );
  });

  it("returns an empty list for missing values", () => {
    assert.deepEqual(parseDismissedWarningIds(undefined), []);
    assert.deepEqual(parseDismissedWarningIds(""), []);
  });

  it("serializes unique ids", () => {
    assert.equal(serializeDismissedWarningIds(["a", "a", "b"]), "a,b");
  });

  it("builds a stable dismiss key across id changes", () => {
    const keyA = getWarningDismissKey(sampleWarning);
    const keyB = getWarningDismissKey({ ...sampleWarning, id: "414734428" });

    assert.equal(keyA, keyB);
    assert.match(keyA, /^yellow:weather:[0-9a-z]+$/);
  });

  it("changes dismiss key when warning text changes", () => {
    const original = getWarningDismissKey(sampleWarning);
    const updated = getWarningDismissKey({
      ...sampleWarning,
      textLv: sampleWarning.textLv.replace("+28", "+29"),
    });

    assert.notEqual(original, updated);
  });

  it("matches dismissals by stable key or legacy raw id", () => {
    const key = getWarningDismissKey(sampleWarning);

    assert.equal(isWarningDismissed(sampleWarning, new Set([key])), true);
    assert.equal(
      isWarningDismissed(sampleWarning, new Set([sampleWarning.id])),
      true,
    );
    assert.equal(
      isWarningDismissed(
        { ...sampleWarning, id: "414734428" },
        new Set([key]),
      ),
      true,
    );
    assert.equal(isWarningDismissed(sampleWarning, new Set(["other"])), false);
  });

  it("normalizes legacy raw ids to stable keys for current warnings", () => {
    const key = getWarningDismissKey(sampleWarning);
    assert.deepEqual(
      toRelevantDismissKeys(
        [sampleWarning, { ...sampleWarning, id: "414734428" }],
        [sampleWarning.id, "unrelated"],
      ),
      [key],
    );
  });
});
