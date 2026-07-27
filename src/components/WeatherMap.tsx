"use client";

import L from "leaflet";
import "leaflet.markercluster";
import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import { findNearestLocation } from "@/lib/weather/coordinates";
import { getConditionEmoji, getConditionKey, getWindDirection } from "@/lib/weather/parse";
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
import { formatWindSpeed, type WindUnit } from "@/lib/weather/wind-units";
import { useWindUnit } from "@/lib/weather/use-wind-unit";
import {
  fetchTodayBrief,
  type TodayBrief,
} from "@/lib/weather/today-brief";
import type { WeatherLocationPoint } from "@/lib/weather/types";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const LATVIA_CENTER: L.LatLngExpression = [56.88, 24.6];
const LATVIA_BOUNDS: L.LatLngBoundsExpression = [
  [55.6, 20.7],
  [58.15, 28.4],
];
const LOCATE_ZOOM = 11;

const TILE_URLS: Record<Theme, string> = {
  // Voyager stays readable; dark mode reuses it with an invert filter in CSS
  // because CARTO Dark Matter is too low-contrast for roads/labels.
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

interface WeatherMapProps {
  locations: WeatherLocationPoint[];
  locale: string;
  selectedId?: string;
}

type MarkersById = Map<string, L.Marker>;

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
    wind: string;
    windDirection: string;
    today: string;
    todayLoading: string;
    todayError: string;
    formatHighLow: (high: number, low: number) => string;
    formatRainChance: (chance: number) => string;
    formatRainAmount: (amount: number) => string;
  },
  windUnit: WindUnit,
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

  const wind = document.createElement("p");
  wind.className = "weather-map-popup__wind";

  const windArrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  windArrow.setAttribute("aria-hidden", "true");
  windArrow.setAttribute("viewBox", "0 0 16 16");
  windArrow.setAttribute("fill", "none");
  windArrow.setAttribute("class", "weather-map-popup__wind-arrow");
  windArrow.style.transform = `rotate(${location.windDirection + 180}deg)`;

  const windArrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  windArrowPath.setAttribute("d", "M8 2v10M8 2L5 7M8 2l3 5");
  windArrowPath.setAttribute("stroke", "currentColor");
  windArrowPath.setAttribute("stroke-width", "1.75");
  windArrowPath.setAttribute("stroke-linecap", "round");
  windArrowPath.setAttribute("stroke-linejoin", "round");
  windArrow.appendChild(windArrowPath);

  const windText = document.createElement("span");
  windText.textContent = `${labels.wind} ${formatWindSpeed(location.windSpeed, windUnit)} · ${labels.windDirection}`;

  wind.appendChild(windArrow);
  wind.appendChild(windText);
  root.appendChild(wind);

  const today = document.createElement("p");
  today.className = "weather-map-popup__today";
  today.setAttribute("aria-live", "polite");
  today.textContent = `${labels.today} · ${labels.todayLoading}`;
  root.appendChild(today);

  const link = document.createElement("a");
  link.className = "weather-map-popup__link";
  link.href = forecastHref(locale, location.id);
  link.textContent = labels.openForecast;
  root.appendChild(link);

  void fillTodayBrief(location.id, today, labels);

  return root;
}

function formatTodayBriefLine(
  brief: TodayBrief,
  labels: {
    today: string;
    formatHighLow: (high: number, low: number) => string;
    formatRainChance: (chance: number) => string;
    formatRainAmount: (amount: number) => string;
  },
): string {
  const parts = [labels.today, labels.formatHighLow(brief.high, brief.low)];

  if (brief.rainChance > 0) {
    parts.push(labels.formatRainChance(brief.rainChance));
  }

  if (brief.precipMm >= 0.1) {
    parts.push(labels.formatRainAmount(brief.precipMm));
  }

  return parts.join(" · ");
}

async function fillTodayBrief(
  locationId: string,
  target: HTMLElement,
  labels: {
    today: string;
    todayLoading: string;
    todayError: string;
    formatHighLow: (high: number, low: number) => string;
    formatRainChance: (chance: number) => string;
    formatRainAmount: (amount: number) => string;
  },
) {
  try {
    const brief = await fetchTodayBrief(locationId);
    if (!target.isConnected) return;
    target.textContent = formatTodayBriefLine(brief, labels);
  } catch {
    if (!target.isConnected) return;
    target.textContent = `${labels.today} · ${labels.todayError}`;
  }
}

function LocationMarkers({
  locations,
  locale,
  selectedId,
  markersByIdRef,
  clusterRef,
}: WeatherMapProps & {
  markersByIdRef: MutableRefObject<MarkersById>;
  clusterRef: MutableRefObject<L.MarkerClusterGroup | null>;
}) {
  const map = useMap();
  const tConditions = useTranslations("conditions");
  const tMap = useTranslations("map");
  const tHero = useTranslations("hero");
  const tWind = useTranslations("wind");
  const windUnit = useWindUnit();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 11,
    });
    const markersById: MarkersById = new Map();

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
          createPopupContent(
            location,
            locale,
            {
              openForecast: tMap("openForecast"),
              condition: tConditions(getConditionKey(location.iconCode)),
              wind: tMap("wind"),
              windDirection: tWind(
                `directions.${getWindDirection(location.windDirection)}`,
              ),
              today: tMap("today"),
              todayLoading: tMap("todayLoading"),
              todayError: tMap("todayError"),
              formatHighLow: (high, low) => tHero("highLow", { high, low }),
              formatRainChance: (chance) =>
                tMap("todayRainChance", { chance }),
              formatRainAmount: (amount) =>
                tMap("todayRainAmount", { amount: amount.toFixed(1) }),
            },
            windUnit,
          ),
        { maxWidth: 280 },
      );

      cluster.addLayer(marker);
      markersById.set(location.id, marker);
    }

    markersByIdRef.current = markersById;
    clusterRef.current = cluster;
    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
      if (clusterRef.current === cluster) {
        clusterRef.current = null;
      }
      markersByIdRef.current = new Map();
    };
  }, [
    clusterRef,
    locations,
    locale,
    map,
    markersByIdRef,
    selectedId,
    tConditions,
    tHero,
    tMap,
    tWind,
    windUnit,
  ]);

  return null;
}

function FitLatvia() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(LATVIA_BOUNDS, { padding: [24, 24], maxZoom: 8 });
  }, [map]);

  return null;
}

function LocateIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {spinning ? (
        <path d="M12 3a9 9 0 1 1-9 9" />
      ) : (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" />
        </>
      )}
    </svg>
  );
}

function LocateMeControl({
  locations,
  markersByIdRef,
  clusterRef,
}: {
  locations: WeatherLocationPoint[];
  markersByIdRef: RefObject<MarkersById>;
  clusterRef: RefObject<L.MarkerClusterGroup | null>;
}) {
  const map = useMap();
  const tMap = useTranslations("map");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [corner, setCorner] = useState<HTMLElement | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controlCorner = map
      .getContainer()
      .querySelector<HTMLElement>(".leaflet-top.leaflet-left");
    setCorner(controlCorner);
  }, [map]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.disableScrollPropagation(wrap);
  }, [corner]);

  useEffect(() => {
    return () => {
      if (userLayerRef.current) {
        map.removeLayer(userLayerRef.current);
        userLayerRef.current = null;
      }
    };
  }, [map]);

  function showUserPosition(lat: number, lon: number, accuracyMeters: number) {
    if (userLayerRef.current) {
      map.removeLayer(userLayerRef.current);
    }

    const layer = L.layerGroup();
    const accuracyRadius = Math.min(Math.max(accuracyMeters, 40), 2500);

    L.circle([lat, lon], {
      radius: accuracyRadius,
      color: "#0284c7",
      weight: 1,
      opacity: 0.45,
      fillColor: "#38bdf8",
      fillOpacity: 0.15,
      interactive: false,
    }).addTo(layer);

    L.circleMarker([lat, lon], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#0284c7",
      fillOpacity: 1,
      interactive: false,
    }).addTo(layer);

    layer.addTo(map);
    userLayerRef.current = layer;
  }

  function openNearestPopup(locationId: string) {
    const marker = markersByIdRef.current?.get(locationId);
    const cluster = clusterRef.current;
    if (!marker || !cluster) return;

    cluster.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const origin = { lat: latitude, lon: longitude };
        const nearest = findNearestLocation(origin, locations);

        showUserPosition(latitude, longitude, accuracy);
        map.flyTo([latitude, longitude], LOCATE_ZOOM, { duration: 0.85 });

        if (nearest) {
          map.once("moveend", () => {
            openNearestPopup(nearest.id);
          });
        }

        setStatus("idle");
      },
      () => setStatus("error"),
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 10_000,
      },
    );
  }

  const label =
    status === "loading"
      ? tMap("locating")
      : status === "error"
        ? tMap("locateError")
        : tMap("locateMe");

  if (!corner) return null;

  return createPortal(
    <div ref={wrapRef} className="weather-map-locate-wrap">
      <div className="leaflet-bar leaflet-control weather-map-locate">
        <button
          type="button"
          className="weather-map-locate__button"
          onClick={handleLocate}
          disabled={status === "loading"}
          title={label}
          aria-label={label}
          aria-busy={status === "loading"}
        >
          <LocateIcon spinning={status === "loading"} />
        </button>
      </div>
      {status === "error" ? (
        <p className="weather-map-locate__error" role="status">
          {tMap("locateError")}
        </p>
      ) : null}
    </div>,
    corner,
  );
}

export function WeatherMap({ locations, locale, selectedId }: WeatherMapProps) {
  const tMap = useTranslations("map");
  const [theme, setTheme] = useState<Theme>(() => getActiveTheme());
  const markersByIdRef = useRef<MarkersById>(new Map());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

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
        markersByIdRef={markersByIdRef}
        clusterRef={clusterRef}
      />
      <LocateMeControl
        locations={locations}
        markersByIdRef={markersByIdRef}
        clusterRef={clusterRef}
      />
      <span className="sr-only">
        {tMap("markerCount", { count: locations.length })}
      </span>
    </MapContainer>
  );
}
