/**
 * Upstream weather data is refreshed on a fixed 15 minute cadence. The same
 * window drives the in-memory caches created here and the `next: { revalidate }`
 * option on every upstream `fetch`, so the two layers never disagree about how
 * old a value may be.
 */
export const REVALIDATE_SECONDS = 900;

export const STALE_REFRESH_MS = REVALIDATE_SECONDS * 1000;

/** How long a stored value may still be served once upstream starts failing. */
const STALE_FALLBACK_MS = 6 * 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

export interface CachedRead<T> {
  value: T;
  /** True when upstream failed and a previously stored value was served. */
  isStale: boolean;
}

export interface ResourceCacheOptions<T> {
  /** Retained key count; the least recently used entry is evicted first. */
  limit?: number;
  /** Values reported as empty are never served as a stale fallback. */
  isEmpty?: (value: T) => boolean;
  /**
   * `"latest"` allows any recently stored entry to serve as the fallback when
   * the requested key has none. Use it for keys that only differ by forecast
   * hour, where slightly misaligned data still beats an error page.
   */
  staleFallback?: "exact" | "latest";
}

export interface ResourceCache<T> {
  read(key: string, load: () => Promise<T>): Promise<CachedRead<T>>;
  clear(): void;
}

const resourceCaches = new Set<ResourceCache<unknown>>();

/** Drops every stored value. Tests use this to isolate cases. */
export function clearResourceCaches(): void {
  for (const cache of resourceCaches) {
    cache.clear();
  }
}

/**
 * Keeps upstream responses in process memory for one refresh window.
 *
 * The Next.js data cache already deduplicates upstream calls across instances,
 * but it is still consulted on every render. Holding the parsed value here
 * means a warm instance answers repeat requests without any cache round trip,
 * and it bounds upstream traffic even where the data cache is unavailable.
 */
export function createResourceCache<T>({
  limit = 1,
  isEmpty = () => false,
  staleFallback = "exact",
}: ResourceCacheOptions<T> = {}): ResourceCache<T> {
  const entries = new Map<string, CacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  function touch(key: string, entry: CacheEntry<T>) {
    // Re-inserting keeps the Map ordered from least to most recently used.
    entries.delete(key);
    entries.set(key, entry);
  }

  function remember(key: string, value: T) {
    touch(key, { value, storedAt: Date.now() });

    while (entries.size > limit) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) break;
      entries.delete(oldestKey);
    }
  }

  function isUsable(entry: CacheEntry<T>): boolean {
    return (
      !isEmpty(entry.value) && Date.now() - entry.storedAt <= STALE_FALLBACK_MS
    );
  }

  function findFallback(key: string): CacheEntry<T> | undefined {
    const exact = entries.get(key);
    if (exact && isUsable(exact)) return exact;
    if (staleFallback === "exact") return undefined;

    let latest: CacheEntry<T> | undefined;

    for (const entry of entries.values()) {
      if (isUsable(entry) && (!latest || entry.storedAt > latest.storedAt)) {
        latest = entry;
      }
    }

    return latest;
  }

  function refresh(key: string, load: () => Promise<T>): Promise<T> {
    // Concurrent renders that miss together share a single upstream request.
    const pending = inFlight.get(key);
    if (pending) return pending;

    const request = load()
      .then((value) => {
        remember(key, value);
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, request);
    return request;
  }

  const cache: ResourceCache<T> = {
    async read(key, load) {
      const entry = entries.get(key);

      if (entry && Date.now() - entry.storedAt < STALE_REFRESH_MS) {
        touch(key, entry);
        return { value: entry.value, isStale: false };
      }

      try {
        return { value: await refresh(key, load), isStale: false };
      } catch (error) {
        const fallback = findFallback(key);
        if (fallback) return { value: fallback.value, isStale: true };

        throw error;
      }
    },
    clear() {
      entries.clear();
      inFlight.clear();
    },
  };

  resourceCaches.add(cache as ResourceCache<unknown>);
  return cache;
}
