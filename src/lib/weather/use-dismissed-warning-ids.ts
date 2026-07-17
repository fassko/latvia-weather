"use client";

import { useSyncExternalStore } from "react";
import {
  WARNING_DISMISS_CHANGE_EVENT,
  WARNING_DISMISS_COOKIE_NAME,
  parseDismissedWarningIds,
} from "./warning-dismiss-cookie";

let cachedRaw = "";
let cachedIds: string[] = [];

function readRawDismissCookie(): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${WARNING_DISMISS_COOKIE_NAME}=([^;]*)`),
  );
  return match?.[1] ?? "";
}

function readDismissedWarningIds(): string[] {
  const raw = readRawDismissCookie();
  if (raw === cachedRaw) return cachedIds;

  cachedRaw = raw;
  try {
    cachedIds = parseDismissedWarningIds(
      raw ? decodeURIComponent(raw) : undefined,
    );
  } catch {
    cachedIds = parseDismissedWarningIds(raw || undefined);
  }
  return cachedIds;
}

function subscribeToWarningDismiss(callback: () => void) {
  const onChange = () => {
    cachedRaw = "";
    callback();
  };
  window.addEventListener(WARNING_DISMISS_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(WARNING_DISMISS_CHANGE_EVENT, onChange);
}

export function useDismissedWarningIds(serverIds: string[]): string[] {
  const clientIds = useSyncExternalStore(
    subscribeToWarningDismiss,
    readDismissedWarningIds,
    () => serverIds,
  );

  if (clientIds.length === 0) return serverIds;
  if (serverIds.length === 0) return clientIds;

  const merged = [...serverIds];
  for (const id of clientIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}
