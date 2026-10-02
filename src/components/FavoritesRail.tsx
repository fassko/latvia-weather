"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import {
  getEmptyFavoriteLocationIds,
  readFavoriteLocationIds,
  subscribeFavoriteLocationIds,
} from "@/lib/weather/favorite-location-ids";
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

/** Persistent favorites chips under the hero for one-handed city switching. */
export function FavoritesRail({ currentLocationId, locations }: FavoritesRailProps) {
  const t = useTranslations("location");
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
        {favorites.map((location) => (
          <li key={location.id} className="shrink-0">
            <Link
              href={locationHref(location)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-950 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
            >
              <span aria-hidden="true">★</span>
              {location.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
