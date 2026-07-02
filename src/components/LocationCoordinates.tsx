"use client";

import { useEffect, useState } from "react";
import { formatCoordinates, openStreetMapUrl } from "@/lib/weather/coordinates";
import type { WeatherLocationPoint } from "@/lib/weather/types";

interface LocationCoordinatesProps {
  locationId: string;
}

export function LocationCoordinates({ locationId }: LocationCoordinatesProps) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/locations");
        if (!response.ok) return;
        const locations = (await response.json()) as WeatherLocationPoint[];
        const match = locations.find((location) => location.id === locationId);
        if (!cancelled && match) {
          setCoords({ lat: match.lat, lon: match.lon });
        }
      } catch {
        // Coordinates are optional enhancement
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  if (!coords) return null;

  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
        ·
      </span>
      <a
        href={openStreetMapUrl(coords.lat, coords.lon)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono underline decoration-slate-300 underline-offset-2 hover:text-slate-700 dark:decoration-slate-600 dark:hover:text-slate-200"
      >
        {formatCoordinates(coords.lat, coords.lon)}
      </a>
    </span>
  );
}
