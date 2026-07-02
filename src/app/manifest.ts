import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Latvia Weather",
    short_name: "LV Weather",
    description: "Hourly weather forecast for locations across Latvia",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f9ff",
    theme_color: "#0284c7",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
