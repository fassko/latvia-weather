import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UIMessage } from "ai";
import {
  parseAssistantHistory,
  serializeAssistantHistory,
} from "../src/lib/weather/assistant-history.ts";

const sampleMessages = [
  {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "Will it rain tomorrow?" }],
  },
  {
    id: "assistant-1",
    role: "assistant",
    parts: [{ type: "text", text: "Light showers are likely after noon." }],
  },
] as UIMessage[];

describe("assistant history persistence", () => {
  it("round-trips valid chat messages", () => {
    const serialized = serializeAssistantHistory(sampleMessages);
    assert.deepEqual(parseAssistantHistory(serialized), sampleMessages);
  });

  it("returns an empty list for invalid storage payloads", () => {
    assert.deepEqual(parseAssistantHistory(null), []);
    assert.deepEqual(parseAssistantHistory("{"), []);
    assert.deepEqual(parseAssistantHistory('"not-an-array"'), []);
    assert.deepEqual(
      parseAssistantHistory(JSON.stringify([{ role: "user" }])),
      [],
    );
  });

  it("keeps only the most recent messages when serializing", () => {
    const many = Array.from({ length: 45 }, (_, index) => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `Message ${index}` }],
    })) as UIMessage[];

    const parsed = parseAssistantHistory(serializeAssistantHistory(many));
    assert.equal(parsed.length, 40);
    assert.equal(parsed[0]?.id, "msg-5");
    assert.equal(parsed.at(-1)?.id, "msg-44");
  });
});
