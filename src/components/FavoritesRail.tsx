"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import {
  FAVORITE_LOCATION_STORAGE_KEY,
  getEmptyFavoriteLocationIds,
  notifyFavoriteLocationIdsChanged,
  readFavoriteLocationIds,
  subscribeFavoriteLocationIds,
} from "@/lib/weather/favorite-location-ids";
import { formatMapTemperature } from "@/lib/weather/map-temp";
import { getConditionEmoji, getConditionKey } from "@/lib/weather/parse";
import { locationSlug } from "@/lib/site";
import type { WeatherLocationPoint } from "@/lib/weather/types";

interface FavoritesRailProps {
  currentLocationId: string;
  locations: WeatherLocationPoint[];
}

function locationHref(location: Pick<WeatherLocationPoint, "id" | "name">): string {
  return location.id === DEFAULT_LOCATION_ID
    ? "/"
    : `/punkts/${encodeURIComponent(locationSlug(location.name))}`;
}

function removeFavoriteLocationId(id: string) {
  const next = readFavoriteLocationIds().filter((favoriteId) => favoriteId !== id);
  localStorage.setItem(FAVORITE_LOCATION_STORAGE_KEY, JSON.stringify(next));
  notifyFavoriteLocationIdsChanged();
}

function RemoveIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** Persistent favorites chips under the hero for one-handed city switching. */
export function FavoritesRail({ currentLocationId, locations }: FavoritesRailProps) {
  const t = useTranslations("location");
  const tConditions = useTranslations("conditions");
  const favoriteIds = useSyncExternalStore(
    subscribeFavoriteLocationIds,
    readFavoriteLocationIds,
    getEmptyFavoriteLocationIds,
  );

  const favorites = favoriteIds
    .map((id) => locations.find((location) => location.id === id))
    .filter((location): location is WeatherLocationPoint => Boolean(location))
    .filter((location) => location.id !== currentLocationId)
    .slice(0, 5);

  if (favorites.length === 0) return null;

  return (
    <nav aria-label={t("favorites")} className="-mt-2">
      <ul className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {favorites.map((location) => {
          const temperature = formatMapTemperature(location.temperature);
          const emoji = getConditionEmoji(location.iconCode);
          const condition = tConditions(getConditionKey(location.iconCode));

          return (
            <li key={location.id} className="shrink-0">
              <div className="inline-flex min-h-11 items-stretch overflow-hidden rounded-full border border-amber-200/80 bg-amber-50 text-sm font-medium text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
                <Link
                  href={locationHref(location)}
                  aria-label={t("favoriteChip", {
                    name: location.name,
                    temperature,
                    condition,
                  })}
                  className="inline-flex items-center gap-1.5 py-2 pr-2 pl-3.5 transition hover:bg-amber-100 dark:hover:bg-amber-900/50"
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {emoji}
                  </span>
                  <span aria-hidden="true" className="tabular-nums">
                    {temperature}
                  </span>
                  <span aria-hidden="true">{location.name}</span>
                </Link>
                <button
                  type="button"
                  aria-label={t("removeFavoriteNamed", { name: location.name })}
                  className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center border-l border-amber-200/80 text-amber-800/80 transition hover:bg-amber-100 hover:text-amber-950 dark:border-amber-500/30 dark:text-amber-200/80 dark:hover:bg-amber-900/50 dark:hover:text-amber-50"
                  onClick={() => removeFavoriteLocationId(location.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <RemoveIcon />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
