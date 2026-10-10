import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearResourceCaches,
  createResourceCache,
  STALE_REFRESH_MS,
} from "../src/lib/weather/cache.ts";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

test("serves the stored value without calling upstream inside the refresh window", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>();
  let calls = 0;
  const load = async () => {
    calls += 1;
    return `value-${calls}`;
  };

  assert.deepEqual(await cache.read("key", load), {
    value: "value-1",
    isStale: false,
  });

  t.mock.timers.tick(STALE_REFRESH_MS - 1);

  assert.deepEqual(await cache.read("key", load), {
    value: "value-1",
    isStale: false,
  });
  assert.equal(calls, 1);
});

test("refetches once the refresh window has elapsed", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>();
  let calls = 0;
  const load = async () => {
    calls += 1;
    return `value-${calls}`;
  };

  await cache.read("key", load);
  t.mock.timers.tick(STALE_REFRESH_MS);

  assert.deepEqual(await cache.read("key", load), {
    value: "value-2",
    isStale: false,
  });
  assert.equal(calls, 2);
});

test("collapses concurrent misses for the same key into one upstream call", async (t) => {
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>();
  const pending = deferred<string>();
  let calls = 0;
  const load = () => {
    calls += 1;
    return pending.promise;
  };

  const reads = Promise.all([
    cache.read("key", load),
    cache.read("key", load),
    cache.read("key", load),
  ]);
  pending.resolve("value");

  for (const read of await reads) {
    assert.deepEqual(read, { value: "value", isStale: false });
  }
  assert.equal(calls, 1);
});

test("falls back to the stored value when upstream fails", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>();

  await cache.read("key", async () => "value");
  t.mock.timers.tick(STALE_REFRESH_MS);

  assert.deepEqual(
    await cache.read("key", async () => {
      throw new Error("upstream down");
    }),
    { value: "value", isStale: true },
  );
});

test("rethrows once the stored value is older than the fallback window", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>();

  await cache.read("key", async () => "value");
  t.mock.timers.tick(SIX_HOURS_MS + 1);

  await assert.rejects(
    cache.read("key", async () => {
      throw new Error("upstream down");
    }),
    /upstream down/,
  );
});

test("never serves an empty value as the stale fallback", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string[]>({
    isEmpty: (value) => value.length === 0,
  });

  await cache.read("key", async () => []);
  t.mock.timers.tick(STALE_REFRESH_MS);

  await assert.rejects(
    cache.read("key", async () => {
      throw new Error("upstream down");
    }),
    /upstream down/,
  );
});

test("latest fallback serves a neighbouring key when the requested one is missing", async (t) => {
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>({
    limit: 4,
    staleFallback: "latest",
  });

  await cache.read("hour-1", async () => "hour-1-value");

  assert.deepEqual(
    await cache.read("hour-2", async () => {
      throw new Error("upstream down");
    }),
    { value: "hour-1-value", isStale: true },
  );
});

test("exact fallback keeps keys isolated from each other", async (t) => {
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>({ limit: 4 });

  await cache.read("hour-1", async () => "hour-1-value");

  await assert.rejects(
    cache.read("hour-2", async () => {
      throw new Error("upstream down");
    }),
    /upstream down/,
  );
});

test("evicts the least recently used key beyond the limit", async (t) => {
  t.after(() => clearResourceCaches());

  const cache = createResourceCache<string>({ limit: 2 });
  const load = (value: string) => async () => value;

  await cache.read("a", load("a"));
  await cache.read("b", load("b"));
  // Reading "a" makes "b" the least recently used entry.
  await cache.read("a", load("a"));
  await cache.read("c", load("c"));

  await assert.rejects(
    cache.read("b", async () => {
      throw new Error("upstream down");
    }),
    /upstream down/,
  );
  assert.deepEqual(
    await cache.read("a", async () => {
      throw new Error("upstream down");
    }),
    { value: "a", isStale: false },
  );
});
