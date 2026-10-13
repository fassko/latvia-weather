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
      className="h-3 w-3"
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
    <nav
      aria-label={t("favorites")}
      className="favorites-rail -mx-4 -mt-2 min-w-0 sm:-mx-6"
    >
      <ul className="favorites-rail__track">
        {favorites.map((location) => {
          const temperature = formatMapTemperature(location.temperature);
          const emoji = getConditionEmoji(location.iconCode);
          const condition = tConditions(getConditionKey(location.iconCode));

          return (
            <li key={location.id} className="shrink-0">
              <div className="favorites-rail__chip">
                <Link
                  href={locationHref(location)}
                  aria-label={t("favoriteChip", {
                    name: location.name,
                    temperature,
                    condition,
                  })}
                  className="favorites-rail__link"
                >
                  <span aria-hidden="true" className="favorites-rail__emoji">
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
                  className="favorites-rail__remove"
                  onClick={() => removeFavoriteLocationId(location.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <span aria-hidden="true" className="favorites-rail__remove-hit" />
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
