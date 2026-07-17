import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveThemeFrom } from "../src/lib/theme.ts";

describe("resolveThemeFrom", () => {
  it("follows the OS preference when set to system", () => {
    assert.equal(resolveThemeFrom("system", true), "dark");
    assert.equal(resolveThemeFrom("system", false), "light");
  });

  it("keeps an explicit light or dark preference", () => {
    assert.equal(resolveThemeFrom("light", true), "light");
    assert.equal(resolveThemeFrom("dark", false), "dark");
  });
});
