import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findMentionedLocations,
  resolveAssistantLocationIntent,
} from "../src/lib/weather/assistant-location.ts";

const locations = [
  { id: "P100", name: "Garupe" },
  { id: "P269", name: "Rīga" },
  { id: "P450", name: "Liepāja" },
  { id: "P905", name: "Valmiera" },
];

describe("assistant location intent", () => {
  it("detects a different city named in the question", () => {
    const intent = resolveAssistantLocationIntent(
      "What's the weather tomorrow in Riga?",
      locations,
      "P100",
    );

    assert.deepEqual(intent, {
      kind: "other",
      location: { id: "P269", name: "Rīga" },
    });
  });

  it("keeps the current page location when no other city is named", () => {
    const intent = resolveAssistantLocationIntent(
      "Will it rain today?",
      locations,
      "P100",
    );

    assert.deepEqual(intent, { kind: "current" });
  });

  it("keeps the current location when the named city is the selected one", () => {
    const intent = resolveAssistantLocationIntent(
      "Will it rain in Garupe today?",
      locations,
      "P100",
    );

    assert.deepEqual(intent, { kind: "current" });
  });

  it("matches accented Latvian names case-insensitively", () => {
    const mentioned = findMentionedLocations("Kāda būs liepaja rīt?", locations);
    assert.deepEqual(
      mentioned.map((location) => location.id),
      ["P450"],
    );
  });

  it("does not match location names inside other words", () => {
    const mentioned = findMentionedLocations(
      "The original forecast looks dry.",
      locations,
    );
    assert.deepEqual(mentioned, []);
  });
});
