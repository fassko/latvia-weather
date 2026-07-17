import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDismissedWarningIds,
  serializeDismissedWarningIds,
} from "../src/lib/weather/warning-dismiss-cookie.ts";

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
});
