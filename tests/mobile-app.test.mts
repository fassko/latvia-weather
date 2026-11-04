import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANDROID_PACKAGE,
  buildAndroidIntentUrl,
  detectMobilePlatform,
  PLAY_STORE_URL,
} from "../src/lib/mobile-app.ts";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  iosInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0",
  iPadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
};

describe("detectMobilePlatform", () => {
  it("leaves iOS Safari to the native Smart App Banner", () => {
    assert.equal(detectMobilePlatform(UA.iosSafari), "ios-safari");
    assert.equal(detectMobilePlatform(UA.iPadDesktop, 5), "ios-safari");
  });

  it("flags iOS browsers that ignore the Smart App Banner", () => {
    assert.equal(detectMobilePlatform(UA.iosChrome), "ios-other");
    assert.equal(detectMobilePlatform(UA.iosInstagram), "ios-other");
  });

  it("uses intents only in Android browsers that support them", () => {
    assert.equal(detectMobilePlatform(UA.androidChrome), "android-intent");
    assert.equal(detectMobilePlatform(UA.androidWebView), "android-other");
    assert.equal(detectMobilePlatform(UA.androidFirefox), "android-other");
  });

  it("ignores desktop browsers", () => {
    assert.equal(detectMobilePlatform(UA.macSafari, 0), "other");
  });
});

describe("buildAndroidIntentUrl", () => {
  it("keeps the page path and falls back to Google Play", () => {
    const url = buildAndroidIntentUrl("https://latvia-weather.com/lv/punkts/riga?x=1");

    assert.ok(url.startsWith("intent://latvia-weather.com/lv/punkts/riga?x=1#Intent;"));
    assert.ok(url.includes("scheme=https;"));
    assert.ok(url.includes(`package=${ANDROID_PACKAGE};`));
    assert.ok(url.endsWith(";end"));

    const fallback = decodeURIComponent(/S\.browser_fallback_url=([^;]+)/.exec(url)![1]);
    assert.ok(fallback.startsWith(PLAY_STORE_URL));
    assert.ok(fallback.includes("referrer=utm_source%3Dweb_banner"));
  });
});
