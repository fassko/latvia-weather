import { parseDismissedWarningIds } from "./warning-dismiss-cookie";

const EMPTY_DISMISSED_IDS: string[] = [];

/** Cached parse of the raw cookie value. Invalidate with null so "" (cleared) re-reads. */
export function createDismissedWarningIdsCache() {
  let cachedRaw: string | null = null;
  let cachedIds: string[] = EMPTY_DISMISSED_IDS;

  return {
    read(raw: string): string[] {
      if (cachedRaw !== null && raw === cachedRaw) return cachedIds;

      cachedRaw = raw;
      try {
        const next = parseDismissedWarningIds(
          raw ? decodeURIComponent(raw) : undefined,
        );
        cachedIds = next.length === 0 ? EMPTY_DISMISSED_IDS : next;
      } catch {
        const next = parseDismissedWarningIds(raw || undefined);
        cachedIds = next.length === 0 ? EMPTY_DISMISSED_IDS : next;
      }
      return cachedIds;
    },
    invalidate() {
      cachedRaw = null;
    },
  };
}
