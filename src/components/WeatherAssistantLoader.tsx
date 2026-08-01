"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { WeatherAssistant } from "@/components/WeatherAssistant";

/**
 * The assistant pulls in the AI SDK chat runtime, which most visitors never
 * use, so it is kept out of the initial page bundle.
 */
const LazyWeatherAssistant = dynamic(
  () => import("@/components/WeatherAssistant").then((mod) => mod.WeatherAssistant),
  { ssr: false },
);

export function WeatherAssistantLoader(
  props: ComponentProps<typeof WeatherAssistant>,
) {
  return <LazyWeatherAssistant {...props} />;
}
