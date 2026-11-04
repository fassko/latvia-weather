export const APP_STORE_ID = "6820900202";
export const ANDROID_PACKAGE = "com.fassko.latviaweather.lv";

export const APP_STORE_URL = `https://apps.apple.com/us/app/latvia-weather/id${APP_STORE_ID}`;
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * - `ios-safari`: Safari renders the native Smart App Banner from the
 *   `apple-itunes-app` meta tag, so the custom banner must stay hidden.
 * - `ios-other`: Chrome, Firefox and in-app browsers on iOS ignore that tag.
 * - `android-intent`: browsers that resolve `intent://` URLs, which open the
 *   app at the same page when installed and fall back to Google Play.
 * - `android-other`: WebViews and browsers without reliable intent support.
 */
export type MobilePlatform =
  | "ios-safari"
  | "ios-other"
  | "android-intent"
  | "android-other"
  | "other";

const IOS_NON_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser/;

export function detectMobilePlatform(userAgent: string, maxTouchPoints = 0): MobilePlatform {
  const isIPadDesktopMode = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(userAgent) || isIPadDesktopMode) {
    const isSafari =
      /Version\/[\d.]+.*Safari\//.test(userAgent) && !IOS_NON_SAFARI.test(userAgent);
    return isSafari ? "ios-safari" : "ios-other";
  }

  if (/Android/.test(userAgent)) {
    const isWebView = /; wv\)/.test(userAgent);
    const supportsIntents = /Chrome\/|SamsungBrowser\//.test(userAgent) && !/Firefox\//.test(userAgent);
    return supportsIntents && !isWebView ? "android-intent" : "android-other";
  }

  return "other";
}

/**
 * Opens `pageUrl` inside the Android app when it is installed and handles the
 * link, otherwise Chrome follows `browser_fallback_url` to the Play listing.
 */
export function buildAndroidIntentUrl(pageUrl: string, referrer = "web_banner"): string {
  const url = new URL(pageUrl);
  const fallback = `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`utm_source=${referrer}`)}`;
  return (
    `intent://${url.host}${url.pathname}${url.search}` +
    `#Intent;scheme=${url.protocol.replace(":", "")};package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  );
}
