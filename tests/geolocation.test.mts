import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  BrowserGeolocationErrorValue,
  getBrowserPosition,
} from "../src/lib/weather/geolocation.ts";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  } else {
    delete (globalThis as { navigator?: unknown }).navigator;
  }
});

function mockGeolocation(
  handlers: Array<{
    success?: GeolocationPosition;
    error?: { code: number };
  }>,
) {
  const options: PositionOptions[] = [];

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition(
          success: PositionCallback,
          error: PositionErrorCallback,
          option: PositionOptions,
        ) {
          options.push(option);
          const next = handlers.shift();
          if (!next) throw new Error("Unexpected geolocation call");

          queueMicrotask(() => {
            if (next.success) {
              success(next.success);
            } else {
              error(next.error as GeolocationPositionError);
            }
          });
        },
      },
    },
  });

  return options;
}

function position(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 25,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

test("getBrowserPosition returns a cached low-accuracy position first", async () => {
  const options = mockGeolocation([{ success: position(56.95, 24.1) }]);

  const result = await getBrowserPosition();

  assert.equal(result.coords.latitude, 56.95);
  assert.equal(options.length, 1);
  assert.equal(options[0]?.enableHighAccuracy, false);
});

test("getBrowserPosition retries unavailable lookups with high accuracy", async () => {
  const options = mockGeolocation([
    { error: { code: 2 } },
    { success: position(57, 24) },
  ]);

  const result = await getBrowserPosition();

  assert.equal(result.coords.longitude, 24);
  assert.equal(options.length, 2);
  assert.equal(options[0]?.enableHighAccuracy, false);
  assert.equal(options[1]?.enableHighAccuracy, true);
});

test("getBrowserPosition does not retry denied location permission", async () => {
  const options = mockGeolocation([{ error: { code: 1 } }]);

  await assert.rejects(
    getBrowserPosition(),
    (error) =>
      error instanceof BrowserGeolocationErrorValue &&
      error.reason === "permission-denied",
  );
  assert.equal(options.length, 1);
});
