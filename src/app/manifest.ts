import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export default function manifest(): MetadataRoute.Manifest {
  const defaultLocale = routing.defaultLocale;

  return {
    id: "/",
    name: "Latvia Weather",
    short_name: "LV Weather",
    description:
      "Hourly and 10-day weather forecast for locations across Latvia, powered by LVĢMC data",
    lang: defaultLocale,
    dir: "ltr",
    // `/` keeps the middleware language negotiation instead of pinning installs
    // to one locale.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    categories: ["weather", "navigation", "utilities"],
    background_color: "#f0f9ff",
    theme_color: "#0284c7",
    shortcuts: [
      {
        name: "Weather map",
        short_name: "Map",
        url: `/${defaultLocale}/map`,
      },
    ],
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
