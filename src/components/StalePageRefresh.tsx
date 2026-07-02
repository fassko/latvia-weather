"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { STALE_REFRESH_MS } from "@/lib/weather/fetch";

const STORAGE_KEY = "latvia-weather-last-refresh";

/** Guard against rapid refresh loops. */
const MIN_REFRESH_INTERVAL_MS = 60_000;

function getLastRefreshTime(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setLastRefreshTime(time: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(time));
  } catch {
    // sessionStorage may be unavailable
  }
}

function checkAndRefresh(refresh: () => void, refreshedThisMount: { current: boolean }) {
  if (refreshedThisMount.current) return;

  const now = Date.now();
  const lastTime = getLastRefreshTime();

  if (lastTime !== null) {
    const elapsed = now - lastTime;

    if (elapsed < MIN_REFRESH_INTERVAL_MS) return;

    if (elapsed >= STALE_REFRESH_MS) {
      refreshedThisMount.current = true;
      setLastRefreshTime(now);
      refresh();
      return;
    }
  }

  setLastRefreshTime(now);
}

export function StalePageRefresh() {
  const router = useRouter();
  const refreshedThisMount = useRef(false);

  useEffect(() => {
    const refresh = () => router.refresh();

    checkAndRefresh(refresh, refreshedThisMount);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkAndRefresh(refresh, refreshedThisMount);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [router]);

  return null;
}
