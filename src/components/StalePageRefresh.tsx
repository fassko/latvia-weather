"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { STALE_REFRESH_MS } from "@/lib/weather/fetch";
import { getLatviaDayKey } from "@/lib/weather/timezone";

const STORAGE_KEY = "latvia-weather-last-refresh";
const DAY_KEY_STORAGE = "latvia-weather-last-day-key";

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

function getLastDayKey(): string | null {
  try {
    return sessionStorage.getItem(DAY_KEY_STORAGE);
  } catch {
    return null;
  }
}

function setLastDayKey(dayKey: string) {
  try {
    sessionStorage.setItem(DAY_KEY_STORAGE, dayKey);
  } catch {
    // sessionStorage may be unavailable
  }
}

function msUntilNextLatviaMidnight(now = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const elapsedMs =
    (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;
  return 24 * 60 * 60 * 1000 - elapsedMs + 250;
}

function checkAndRefresh(
  refresh: () => void,
  refreshedThisMount: { current: boolean },
  options?: { ignoreMountGuard?: boolean },
) {
  if (refreshedThisMount.current && !options?.ignoreMountGuard) return;

  const now = Date.now();
  const lastTime = getLastRefreshTime();
  const todayKey = getLatviaDayKey(new Date(now));
  const lastDayKey = getLastDayKey();

  // Calendar day rolled over in Europe/Riga — always refresh so yesterday
  // does not remain the leading forecast day.
  if (lastDayKey !== null && lastDayKey !== todayKey) {
    refreshedThisMount.current = true;
    setLastRefreshTime(now);
    setLastDayKey(todayKey);
    refresh();
    return;
  }

  if (lastTime !== null) {
    const elapsed = now - lastTime;

    if (elapsed < MIN_REFRESH_INTERVAL_MS) {
      setLastDayKey(todayKey);
      return;
    }

    if (elapsed >= STALE_REFRESH_MS) {
      refreshedThisMount.current = true;
      setLastRefreshTime(now);
      setLastDayKey(todayKey);
      refresh();
      return;
    }
  }

  setLastRefreshTime(now);
  setLastDayKey(todayKey);
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

    let midnightTimer = window.setTimeout(function scheduleMidnightRefresh() {
      checkAndRefresh(refresh, refreshedThisMount, { ignoreMountGuard: true });
      midnightTimer = window.setTimeout(scheduleMidnightRefresh, msUntilNextLatviaMidnight());
    }, msUntilNextLatviaMidnight());

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearTimeout(midnightTimer);
    };
  }, [router]);

  return null;
}
