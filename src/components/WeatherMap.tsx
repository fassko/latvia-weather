"use client";

import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import { getConditionEmoji, getConditionKey } from "@/lib/weather/parse";
import {
  formatMapTemperature,
  temperatureMarkerColor,
  temperatureTextColor,
} from "@/lib/weather/map-temp";
import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import {
  getActiveTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from "@/lib/theme";
import type { WeatherLocationPoint } from "@/lib/weather/types";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const LATVIA_CENTER: L.LatLngExpression = [56.88, 24.6];
const LATVIA_BOUNDS: L.LatLngBoundsExpression = [
  [55.6, 20.7],
  [58.15, 28.4],
];

const TILE_URLS: Record<Theme, string> = {
  // Voyager keeps labels/roads readable in light mode (Positron is too washed out).
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

interface WeatherMapProps {
  locations: WeatherLocationPoint[];
  locale: string;
  selectedId?: string;
}

function forecastHref(locale: string, locationId: string): string {
  if (locationId === DEFAULT_LOCATION_ID) return `/${locale}`;
  return `/${locale}?punkts=${encodeURIComponent(locationId)}`;
}

function createWeatherIcon(location: WeatherLocationPoint): L.DivIcon {
  const bg = temperatureMarkerColor(location.temperature);
  const fg = temperatureTextColor(location.temperature);
  const temp = formatMapTemperature(location.temperature);
  const emoji = getConditionEmoji(location.iconCode);

  return L.divIcon({
    className: "weather-map-marker",
    html: `<span class="weather-map-marker__pill" style="background:${bg};color:${fg}"><span class="weather-map-marker__emoji" aria-hidden="true">${emoji}</span><span class="weather-map-marker__temp">${temp}</span></span>`,
    iconSize: [64, 28],
    iconAnchor: [32, 14],
    popupAnchor: [0, -12],
  });
}

function createPopupContent(
  location: WeatherLocationPoint,
  locale: string,
  labels: {
    openForecast: string;
    condition: string;
  },
): HTMLElement {
  const root = document.createElement("div");
  root.className = "weather-map-popup";

  const title = document.createElement("p");
  title.className = "weather-map-popup__title";
  title.textContent = location.name;
  root.appendChild(title);

  if (location.region.trim() && location.region.trim() !== location.name.trim()) {
    const region = document.createElement("p");
    region.className = "weather-map-popup__region";
    region.textContent = location.region;
    root.appendChild(region);
  }

  const stats = document.createElement("p");
  stats.className = "weather-map-popup__stats";
  const emoji = getConditionEmoji(location.iconCode);
  stats.textContent = `${formatMapTemperature(location.temperature)} · ${emoji} ${labels.condition}`;
  root.appendChild(stats);

  const link = document.createElement("a");
  link.className = "weather-map-popup__link";
  link.href = forecastHref(locale, location.id);
  link.textContent = labels.openForecast;
  root.appendChild(link);

  return root;
}

function LocationMarkers({
  locations,
  locale,
  selectedId,
}: WeatherMapProps) {
  const map = useMap();
  const tConditions = useTranslations("conditions");
  const tMap = useTranslations("map");

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 11,
    });

    for (const location of locations) {
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
        continue;
      }

      const marker = L.marker([location.lat, location.lon], {
        icon: createWeatherIcon(location),
        title: `${location.name}: ${formatMapTemperature(location.temperature)}`,
        riseOnHover: true,
        zIndexOffset: location.id === selectedId ? 1000 : 0,
      });

      marker.bindPopup(
        () =>
          createPopupContent(location, locale, {
            openForecast: tMap("openForecast"),
            condition: tConditions(getConditionKey(location.iconCode)),
          }),
        { maxWidth: 260 },
      );

      cluster.addLayer(marker);
    }

    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [locations, locale, map, selectedId, tConditions, tMap]);

  return null;
}

function FitLatvia() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(LATVIA_BOUNDS, { padding: [24, 24], maxZoom: 8 });
  }, [map]);

  return null;
}

export function WeatherMap({ locations, locale, selectedId }: WeatherMapProps) {
  const tMap = useTranslations("map");
  const [theme, setTheme] = useState<Theme>(() => getActiveTheme());

  useEffect(() => {
    const sync = () => setTheme(getActiveTheme());
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      observer.disconnect();
    };
  }, []);

  return (
    <MapContainer
      center={LATVIA_CENTER}
      zoom={7}
      className="weather-map h-full w-full rounded-xl"
      scrollWheelZoom
      worldCopyJump={false}
      maxBounds={[
        [53.5, 18],
        [60, 32],
      ]}
      maxBoundsViscosity={0.8}
      attributionControl
    >
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={TILE_URLS[theme]}
      />
      <FitLatvia />
      <LocationMarkers
        locations={locations}
        locale={locale}
        selectedId={selectedId}
      />
      <span className="sr-only">
        {tMap("markerCount", { count: locations.length })}
      </span>
    </MapContainer>
  );
}
