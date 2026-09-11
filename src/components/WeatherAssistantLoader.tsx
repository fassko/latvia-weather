"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";
import type { WeatherAssistant } from "@/components/WeatherAssistant";

/**
 * The assistant pulls in the AI SDK chat runtime, which most visitors never
 * use. Defer the dynamic import until idle or the first FAB tap so it stays
 * out of the critical mobile main-thread window.
 */
const LazyWeatherAssistant = dynamic(
  () => import("@/components/WeatherAssistant").then((mod) => mod.WeatherAssistant),
  { ssr: false },
);

export function WeatherAssistantLoader(
  props: ComponentProps<typeof WeatherAssistant>,
) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(enable, { timeout: 6000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(enable, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <button
        type="button"
        onClick={() => setReady(true)}
        aria-label={`${props.labels.send} · ${props.labels.title}`}
        aria-haspopup="dialog"
        aria-expanded={false}
        className="fixed right-4 bottom-5 z-30 flex h-14 items-center gap-2 rounded-full bg-[#477dd8] px-5 text-base font-semibold text-white shadow-[0_18px_40px_rgba(71,125,216,0.35)] transition hover:bg-[#3d72cb] focus-visible:ring-4 focus-visible:ring-[#477dd8]/25 focus-visible:outline-none sm:right-8 sm:bottom-7 sm:h-16 sm:px-7 sm:text-lg dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
        >
          <span className="translate-y-[1px] text-[1.65em] leading-none">🌤️</span>
        </span>
        {props.labels.send}
      </button>
    );
  }

  return <LazyWeatherAssistant {...props} />;
}
