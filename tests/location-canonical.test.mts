import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalPunktsPath,
  isNonCanonicalPunktsSegment,
} from "../src/lib/seo/location-canonical.ts";

const locations = [
  { id: "P269", name: "Rīga" },
  { id: "P364", name: "Saulkrasti" },
  { id: "P770", name: "Liepāja" },
];

test("bare and hybrid ID segments are non-canonical", () => {
  assert.equal(isNonCanonicalPunktsSegment("P364"), true);
  assert.equal(isNonCanonicalPunktsSegment("saulkrasti-P364"), true);
  assert.equal(isNonCanonicalPunktsSegment("saulkrasti"), false);
});

test("canonicalPunktsPath redirects ID segments to name slugs", () => {
  assert.equal(
    canonicalPunktsPath("en", "P364", locations),
    "/en/punkts/saulkrasti",
  );
  assert.equal(
    canonicalPunktsPath("lv", "saulkrasti-P364", locations),
    "/lv/punkts/saulkrasti",
  );
  assert.equal(canonicalPunktsPath("en", "P269", locations), "/en");
});

test("canonicalPunktsPath returns null for already-canonical name slugs", () => {
  assert.equal(canonicalPunktsPath("en", "saulkrasti", locations), null);
  assert.equal(canonicalPunktsPath("en", "liepaja", locations), null);
});
