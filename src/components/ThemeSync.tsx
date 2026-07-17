"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { subscribeToSystemTheme, syncTheme } from "@/lib/theme";

/** Keeps theme across navigations and follows OS light/dark changes. */
export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    syncTheme();
  }, [pathname]);

  useEffect(() => {
    return subscribeToSystemTheme();
  }, []);

  return null;
}
