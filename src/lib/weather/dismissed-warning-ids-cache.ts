import { parseDismissedWarningIds } from "./warning-dismiss-cookie";

/** Cached parse of the raw cookie value. Invalidate with null so "" (cleared) re-reads. */
export function createDismissedWarningIdsCache() {
  let cachedRaw: string | null = null;
  let cachedIds: string[] = [];

  return {
    read(raw: string): string[] {
      if (cachedRaw !== null && raw === cachedRaw) return cachedIds;

      cachedRaw = raw;
      try {
        cachedIds = parseDismissedWarningIds(
          raw ? decodeURIComponent(raw) : undefined,
        );
      } catch {
        cachedIds = parseDismissedWarningIds(raw || undefined);
      }
      return cachedIds;
    },
    invalidate() {
      cachedRaw = null;
    },
  };
}
