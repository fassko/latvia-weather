"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { distanceKm } from "@/lib/weather/coordinates";
import { setLocationCookie } from "@/lib/weather/location-cookie";
import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import { getConditionEmoji } from "@/lib/weather/parse";
import type { WeatherLocationPoint } from "@/lib/weather/types";

interface LocationComboboxProps {
  selectedId: string;
  selectedName: string;
}

export function LocationCombobox({ selectedId, selectedName }: LocationComboboxProps) {
  const router = useRouter();
  const t = useTranslations("location");
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<WeatherLocationPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "error">("idle");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const loadLocations = useCallback(async () => {
    if (locations !== null || loading) return;

    setLoading(true);
    setError(false);

    try {
      const response = await fetch("/api/locations");
      if (!response.ok) throw new Error("Failed to load locations");
      const data = (await response.json()) as WeatherLocationPoint[];
      setLocations(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locations, loading]);

  const filtered = (locations ?? []).filter((location) => {
    const haystack = `${location.name} ${location.region}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function selectLocation(nextId: string) {
    if (nextId === selectedId) {
      setOpen(false);
      setQuery("");
      return;
    }

    setLocationCookie(nextId);
    const url = nextId === DEFAULT_LOCATION_ID ? "/" : `/?punkts=${nextId}`;
    router.push(url);
    setOpen(false);
    setQuery("");
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }

    setGeoStatus("loading");
    setError(false);

    try {
      let availableLocations = locations;

      if (availableLocations === null) {
        const response = await fetch("/api/locations");
        if (!response.ok) throw new Error("Failed to load locations");
        availableLocations = (await response.json()) as WeatherLocationPoint[];
        setLocations(availableLocations);
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!availableLocations || availableLocations.length === 0) {
            setGeoStatus("error");
            return;
          }

          const currentPosition = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          const nearest = availableLocations.reduce((best, location) => {
            const bestDistance = distanceKm(currentPosition, best);
            const locationDistance = distanceKm(currentPosition, location);
            return locationDistance < bestDistance ? location : best;
          }, availableLocations[0]);

          setGeoStatus("idle");
          selectLocation(nearest.id);
        },
        () => setGeoStatus("error"),
        { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 10_000 },
      );
    } catch {
      setGeoStatus("error");
    }
  }

  function handleOpen() {
    setOpen(true);
    setHighlightIndex(0);
    void loadLocations();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && filtered[highlightIndex]) {
      event.preventDefault();
      selectLocation(filtered[highlightIndex].id);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block max-w-full">
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-1.5 rounded-lg py-1 pr-1 pl-0 text-left text-lg font-bold tracking-tight text-slate-900 transition hover:text-sky-700 focus:text-sky-700 focus:ring-2 focus:ring-sky-500/20 focus:outline-none dark:text-slate-100 dark:hover:text-sky-300 dark:focus:text-sky-300"
      >
        <span className="truncate">{selectedName}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-sky-300 bg-white shadow-lg dark:border-sky-600 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
            <SearchIcon />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={t("searchPlaceholder")}
              aria-controls={listboxId}
              aria-expanded={open}
              aria-autocomplete="list"
              role="combobox"
              className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t("select")}
            className="max-h-72 overflow-y-auto py-1"
          >
            <li className="border-b border-slate-100 px-2 pb-1 dark:border-slate-800">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={geoStatus === "loading"}
                className="w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-wait disabled:text-slate-400 dark:text-sky-300 dark:hover:bg-slate-800"
              >
                {geoStatus === "loading" ? t("locating") : t("useCurrent")}
              </button>
              {geoStatus === "error" && (
                <p className="px-2 pb-2 text-xs text-red-600 dark:text-red-400">
                  {t("locationError")}
                </p>
              )}
            </li>
            {loading && (
              <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {t("loading")}
              </li>
            )}
            {error && (
              <li className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {t("loadError")}
              </li>
            )}
            {!loading && !error && filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {t("noResults")}
              </li>
            )}
            {filtered.map((location, index) => (
              <li key={location.id} role="option" aria-selected={location.id === selectedId}>
                <button
                  type="button"
                  onClick={() => selectLocation(location.id)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition ${
                    index === highlightIndex
                      ? "bg-sky-100 text-slate-900 dark:bg-sky-950 dark:text-slate-100"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  } ${location.id === selectedId ? "font-semibold" : ""}`}
                >
                  <span>
                    <span className="block font-medium">{location.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {location.region}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                    {Math.round(location.temperature)}°C {getConditionEmoji(location.iconCode)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-slate-400"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400"
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
