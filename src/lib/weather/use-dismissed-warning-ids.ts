"use client";

import { useSyncExternalStore } from "react";
import { createDismissedWarningIdsCache } from "./dismissed-warning-ids-cache";
import {
  WARNING_DISMISS_CHANGE_EVENT,
  WARNING_DISMISS_COOKIE_NAME,
} from "./warning-dismiss-cookie";

const dismissedIdsCache = createDismissedWarningIdsCache();
const EMPTY_SERVER_IDS: string[] = [];

function readRawDismissCookie(): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${WARNING_DISMISS_COOKIE_NAME}=([^;]*)`),
  );
  return match?.[1] ?? "";
}

function readDismissedWarningIds(): string[] {
  return dismissedIdsCache.read(readRawDismissCookie());
}

function subscribeToWarningDismiss(callback: () => void) {
  const onChange = () => {
    dismissedIdsCache.invalidate();
    callback();
  };
  window.addEventListener(WARNING_DISMISS_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(WARNING_DISMISS_CHANGE_EVENT, onChange);
}

export function useDismissedWarningIds(serverIds: string[]): string[] {
  // Trust document.cookie on the client. Merging with serverIds broke "Show":
  // expand clears the cookie, but serverIds from the initial render still
  // contained the dismissed key and kept the compact banner stuck closed.
  // getServerSnapshot must return a stable reference (not a fresh [] each call).
  const serverSnapshot =
    serverIds.length === 0 ? EMPTY_SERVER_IDS : serverIds;

  return useSyncExternalStore(
    subscribeToWarningDismiss,
    readDismissedWarningIds,
    () => serverSnapshot,
  );
}
