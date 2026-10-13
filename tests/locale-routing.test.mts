import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { routing } from "../src/i18n/routing.ts";
import {
  getBcp47Tag,
  getOgAlternateLocales,
  getOgLocale,
  isLocale,
} from "../src/lib/locale.ts";
import { canonicalPunktsPath } from "../src/lib/seo/location-canonical.ts";

const locations = [
  { id: "P269", name: "Rīga" },
  { id: "P364", name: "Saulkrasti" },
];

function messageKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    messageKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

test("routing includes lv, en, and ru with Latvian default", () => {
  assert.deepEqual([...routing.locales], ["lv", "en", "ru"]);
  assert.equal(routing.defaultLocale, "lv");
  assert.equal(isLocale("ru"), true);
  assert.equal(isLocale("de"), false);
});

test("message catalogs share the same key tree across locales", () => {
  const catalogs = Object.fromEntries(
    routing.locales.map((locale) => [
      locale,
      JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")),
    ]),
  );

  const expected = messageKeys(catalogs.en).sort();
  for (const locale of routing.locales) {
    assert.deepEqual(
      messageKeys(catalogs[locale]).sort(),
      expected,
      `${locale} message keys should match en`,
    );
  }

  assert.equal(catalogs.ru.language.ru, "RU");
  assert.equal(catalogs.ru.language.ruName, "русский");
  assert.match(catalogs.ru.metadata.siteTitle, /Латвии|погода/i);
});

test("OG and BCP47 helpers cover Russian", () => {
  assert.equal(getOgLocale("ru"), "ru_RU");
  assert.equal(getBcp47Tag("ru"), "ru-RU");
  assert.deepEqual(getOgAlternateLocales("ru").sort(), ["en_US", "lv_LV"]);
  assert.deepEqual(getOgAlternateLocales("lv").sort(), ["en_US", "ru_RU"]);
});

test("canonicalPunktsPath works for Russian locale prefixes", () => {
  assert.equal(
    canonicalPunktsPath("ru", "P364", locations),
    "/ru/punkts/saulkrasti",
  );
  assert.equal(canonicalPunktsPath("ru", "P269", locations), "/ru");
  assert.equal(canonicalPunktsPath("ru", "saulkrasti", locations), null);
});
