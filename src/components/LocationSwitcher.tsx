"use client";

import { useRouter } from "next/navigation";
import { setLocationCookie } from "@/lib/weather/location-cookie";
import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import { getConditionEmoji } from "@/lib/weather/parse";
import type { WeatherLocationPoint } from "@/lib/weather/types";

interface LocationSwitcherProps {
  locations: WeatherLocationPoint[];
  selectedId: string;
}

export function LocationSwitcher({ locations, selectedId }: LocationSwitcherProps) {
  const router = useRouter();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    if (nextId === selectedId) return;

    setLocationCookie(nextId);

    const url = nextId === DEFAULT_LOCATION_ID ? "/" : `/?punkts=${nextId}`;
    router.push(url);
  }

  return (
    <label className="block">
      <span className="sr-only">Select location</span>
      <div className="relative inline-flex w-full max-w-md items-center">
        <select
          value={selectedId}
          onChange={handleChange}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-lg font-bold tracking-tight text-slate-900 shadow-sm transition hover:border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-600 dark:focus:border-sky-500"
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} · {Math.round(location.temperature)}°C{" "}
              {getConditionEmoji(location.iconCode)}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
    </label>
  );
}

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="pointer-events-none absolute right-3 h-5 w-5 text-slate-500 dark:text-slate-400"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
