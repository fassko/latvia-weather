"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STALE_REFRESH_MS } from "@/lib/weather/fetch";

const STORAGE_KEY = "garupe-weather-last-refresh";

function checkAndRefresh(refresh: () => void) {
  const last = sessionStorage.getItem(STORAGE_KEY);
  const now = Date.now();

  if (last !== null) {
    const elapsed = now - Number(last);
    if (elapsed >= STALE_REFRESH_MS) {
      sessionStorage.setItem(STORAGE_KEY, String(now));
      refresh();
      return;
    }
  }

  sessionStorage.setItem(STORAGE_KEY, String(now));
}

export function StalePageRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();

    checkAndRefresh(refresh);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkAndRefresh(refresh);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [router]);

  return null;
}
