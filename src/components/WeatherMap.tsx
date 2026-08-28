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
import { getBrowserPosition } from "@/lib/weather/geolocation";
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
import type {
  WeatherAlarmPolygon,
  WeatherLocationPoint,
  WeatherWarningLevel,
} from "@/lib/weather/types";
import {
  LATVIA_BOUNDS,
  LATVIA_CENTER,
  MAP_ZOOM_SNAP,
  MOBILE_DEFAULT_ZOOM,
  latviaOverviewForWidth,
} from "@/lib/weather/map-view";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const LOCATE_ZOOM = 11;
const DETAILED_MARKER_ZOOM = 11;

const TILE_URLS: Record<Theme, string> = {
  // Voyager stays readable; dark mode reuses it with an invert filter in CSS
  // because CARTO Dark Matter is too low-contrast for roads/labels.
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

interface WeatherMapProps {
  locations: WeatherLocationPoint[];
  alarms: WeatherAlarmPolygon[];
  locale: string;
  selectedId?: string;
  focusLocationId?: string;
  initialShowAlarms?: boolean;
}

type MarkersById = Map<string, L.Marker>;

function forecastHref(locale: string, locationId: string): string {
  if (locationId === DEFAULT_LOCATION_ID) return `/${locale}`;
  return `/${locale}?punkts=${encodeURIComponent(locationId)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMarkerWindSpeed(speedMs: number, windUnit: WindUnit): string {
  if (windUnit === "kmh") return `${Math.round(speedMs * 3.6)}km/h`;
  return `${Math.round(speedMs)}m/s`;
}

function createWeatherIcon(
  location: WeatherLocationPoint,
  windUnit: WindUnit,
): L.DivIcon {
  const bg = temperatureMarkerColor(location.temperature);
  const fg = temperatureTextColor(location.temperature);
  const temp = formatMapTemperature(location.temperature);
  const emoji = getConditionEmoji(location.iconCode);
  const name = escapeHtml(location.name);
  const wind = escapeHtml(formatMarkerWindSpeed(location.windSpeed, windUnit));
  const windArrowRotation = (location.windDirection + 180 + 360) % 360;

  return L.divIcon({
    className: "weather-map-marker",
    html: `<span class="weather-map-marker__pill" style="background:${bg};color:${fg}"><span class="weather-map-marker__main"><span class="weather-map-marker__emoji" aria-hidden="true">${emoji}</span><span class="weather-map-marker__temp">${temp}</span></span><span class="weather-map-marker__wind"><span class="weather-map-marker__wind-arrow" aria-hidden="true" style="transform:rotate(${windArrowRotation}deg)">↑</span><span>${wind}</span></span><span class="weather-map-marker__name">${name}</span></span>`,
    iconSize: [82, 42],
    iconAnchor: [41, 21],
    popupAnchor: [0, -18],
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

function warningColor(level: WeatherWarningLevel): string {
  switch (level) {
    case "yellow":
      return "#eab308";
    case "orange":
      return "#f97316";
    case "red":
      return "#dc2626";
    default:
      return "#64748b";
  }
}

function formatAlarmTime(locale: string, value: string): string {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-US", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function getAlarmAreaText(alarm: WeatherAlarmPolygon, locale: string): string {
  const regionSummary = locale === "lv" ? alarm.regionsLv : alarm.regionsEn;
  if (regionSummary.trim()) return regionSummary.trim();

  const municipalityNames =
    locale === "lv" ? alarm.municipalityNamesLv : alarm.municipalityNamesEn;

  return municipalityNames.length <= 3 ? municipalityNames.join(", ") : "";
}

function estimateRingArea(ring: [number, number][]): number {
  if (ring.length < 3) return 0;

  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [latA, lonA] = ring[index];
    const [latB, lonB] = ring[(index + 1) % ring.length];
    area += lonA * latB - lonB * latA;
  }

  return Math.abs(area) / 2;
}

function createAlarmPopupContent(
  alarm: WeatherAlarmPolygon,
  locale: string,
  labels: {
    warning: string;
    valid: string;
    municipalities: string;
  },
): HTMLElement {
  const root = document.createElement("div");
  root.className = "weather-map-popup weather-map-alarm-popup";

  const title = document.createElement("p");
  title.className = "weather-map-popup__title";
  title.textContent =
    locale === "lv"
      ? `${alarm.intensityLv}: ${alarm.phenomenonLv}`
      : `${alarm.intensityEn}: ${alarm.phenomenonEn}`;
  root.appendChild(title);

  const number = document.createElement("p");
  number.className = "weather-map-popup__region";
  number.textContent = `${labels.warning} ${alarm.warningNo}`;
  root.appendChild(number);

  const valid = document.createElement("p");
  valid.className = "weather-map-popup__stats";
  valid.textContent = `${labels.valid} ${formatAlarmTime(locale, alarm.timeFrom)}-${formatAlarmTime(locale, alarm.timeTill)}`;
  root.appendChild(valid);

  const text = document.createElement("p");
  text.className = "weather-map-popup__today";
  text.textContent = locale === "lv" ? alarm.textLv : alarm.textEn;
  root.appendChild(text);

  const areaText = getAlarmAreaText(alarm, locale);
  if (areaText) {
    const areas = document.createElement("p");
    areas.className = "weather-map-popup__region";
    areas.textContent = `${labels.municipalities} ${areaText}`;
    root.appendChild(areas);
  }

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

function createClusterIcon(
  cluster: L.MarkerCluster,
  temperatureByMarker: WeakMap<L.Marker, number>,
  iconCodeByMarker: WeakMap<L.Marker, string>,
  windSpeedByMarker: WeakMap<L.Marker, number>,
  windDirectionByMarker: WeakMap<L.Marker, number>,
  windUnit: WindUnit,
): L.DivIcon {
  const childCount = cluster.getChildCount();
  const childMarkers = cluster.getAllChildMarkers();
  let temperatureSum = 0;
  let temperatureCount = 0;
  let windSpeedSum = 0;
  let windSpeedCount = 0;
  let windVectorX = 0;
  let windVectorY = 0;
  let windDirectionCount = 0;
  const iconCounts = new Map<string, number>();

  for (const marker of childMarkers) {
    const temperature = temperatureByMarker.get(marker);
    if (temperature != null && Number.isFinite(temperature)) {
      temperatureSum += temperature;
      temperatureCount += 1;
    }

    const iconCode = iconCodeByMarker.get(marker);
    if (iconCode) {
      iconCounts.set(iconCode, (iconCounts.get(iconCode) ?? 0) + 1);
    }

    const windSpeed = windSpeedByMarker.get(marker);
    if (windSpeed != null && Number.isFinite(windSpeed)) {
      windSpeedSum += windSpeed;
      windSpeedCount += 1;
    }

    const windDirection = windDirectionByMarker.get(marker);
    if (windDirection != null && Number.isFinite(windDirection)) {
      const radians = (windDirection * Math.PI) / 180;
      windVectorX += Math.sin(radians);
      windVectorY += Math.cos(radians);
      windDirectionCount += 1;
    }
  }

  const averageTemperature =
    temperatureCount > 0 ? temperatureSum / temperatureCount : 15;
  const averageWindSpeed = windSpeedCount > 0 ? windSpeedSum / windSpeedCount : 0;
  const averageWindDirection =
    windDirectionCount > 0
      ? (Math.atan2(windVectorX, windVectorY) * 180) / Math.PI
      : 0;
  const windArrowRotation = (averageWindDirection + 180 + 360) % 360;
  let dominantIconCode = "";
  let dominantIconCount = 0;

  for (const [iconCode, count] of iconCounts) {
    if (count > dominantIconCount) {
      dominantIconCode = iconCode;
      dominantIconCount = count;
    }
  }

  const emoji = getConditionEmoji(dominantIconCode);
  const fill = temperatureMarkerColor(averageTemperature);
  const text = temperatureTextColor(averageTemperature);
  const tempLabel = formatMapTemperature(averageTemperature);
  const windLabel = escapeHtml(formatMarkerWindSpeed(averageWindSpeed, windUnit));
  const sizeClass =
    childCount < 10
      ? "weather-map-cluster--small"
      : childCount < 25
        ? "weather-map-cluster--medium"
        : "weather-map-cluster--large";
  const dimension = childCount < 10 ? 56 : childCount < 25 ? 62 : 68;

  return L.divIcon({
    html: `<div class="weather-map-cluster__core" style="background:${fill};color:${text};box-shadow:0 0 0 6px ${fill}33"><span class="weather-map-cluster__top"><span class="weather-map-cluster__emoji" aria-hidden="true">${emoji}</span><span class="weather-map-cluster__temp">${tempLabel}</span></span><span class="weather-map-cluster__wind"><span class="weather-map-cluster__wind-arrow" aria-hidden="true" style="transform:rotate(${windArrowRotation}deg)">↑</span><span>${windLabel}</span></span><span class="weather-map-cluster__count" aria-label="${childCount} locations">${childCount}</span></div>`,
    className: `weather-map-cluster ${sizeClass}`,
    iconSize: L.point(dimension, dimension),
  });
}

function openClusteredMarkerPopup(
  map: L.Map,
  cluster: L.MarkerClusterGroup,
  marker: L.Marker,
) {
  if (!map.hasLayer(cluster)) return;

  cluster.zoomToShowLayer(marker, () => {
    if (!map.hasLayer(cluster)) return;
    marker.openPopup();
  });
}

function LocationMarkers({
  locations,
  locale,
  selectedId,
  focusLocationId,
  markersByIdRef,
  clusterRef,
}: Pick<
  WeatherMapProps,
  "locations" | "locale" | "selectedId" | "focusLocationId"
> & {
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
    const temperatureByMarker = new WeakMap<L.Marker, number>();
    const iconCodeByMarker = new WeakMap<L.Marker, string>();
    const windSpeedByMarker = new WeakMap<L.Marker, number>();
    const windDirectionByMarker = new WeakMap<L.Marker, number>();
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: (zoom) => (zoom <= 8 ? 72 : zoom <= 10 ? 56 : 44),
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 11,
      iconCreateFunction: (markerCluster) =>
        createClusterIcon(
          markerCluster,
          temperatureByMarker,
          iconCodeByMarker,
          windSpeedByMarker,
          windDirectionByMarker,
          windUnit,
        ),
    });
    const markersById: MarkersById = new Map();

    for (const location of locations) {
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
        continue;
      }

      const marker = L.marker([location.lat, location.lon], {
        icon: createWeatherIcon(location, windUnit),
        title: `${location.name}: ${formatMapTemperature(location.temperature)}, ${tConditions(getConditionKey(location.iconCode))}`,
        riseOnHover: true,
        zIndexOffset: location.id === selectedId ? 1000 : 0,
      });
      temperatureByMarker.set(marker, location.temperature);
      iconCodeByMarker.set(marker, location.iconCode);
      windSpeedByMarker.set(marker, location.windSpeed);
      windDirectionByMarker.set(marker, location.windDirection);

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
        { maxWidth: 280, className: "weather-map-popup-pane" },
      );

      cluster.addLayer(marker);
      markersById.set(location.id, marker);
    }

    markersByIdRef.current = markersById;
    clusterRef.current = cluster;
    map.addLayer(cluster);
    let handleFocusMoveEnd: (() => void) | null = null;

    if (focusLocationId) {
      const focusLocation = locations.find(
        (location) => location.id === focusLocationId,
      );
      const focusMarker = markersById.get(focusLocationId);

      if (
        focusLocation &&
        focusMarker &&
        Number.isFinite(focusLocation.lat) &&
        Number.isFinite(focusLocation.lon)
      ) {
        map.flyTo([focusLocation.lat, focusLocation.lon], LOCATE_ZOOM, {
          duration: 0.75,
        });
        handleFocusMoveEnd = () => {
          openClusteredMarkerPopup(map, cluster, focusMarker);
        };
        map.once("moveend", handleFocusMoveEnd);
      }
    }

    return () => {
      if (handleFocusMoveEnd) {
        map.off("moveend", handleFocusMoveEnd);
      }
      map.removeLayer(cluster);
      if (clusterRef.current === cluster) {
        clusterRef.current = null;
      }
      markersByIdRef.current = new Map();
    };
  }, [
    clusterRef,
    focusLocationId,
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

function AlarmPolygons({
  alarms,
  locale,
}: Pick<WeatherMapProps, "alarms" | "locale">) {
  const map = useMap();
  const tMap = useTranslations("map");

  useEffect(() => {
    const layer = L.layerGroup();
    const polygonEntries = alarms
      .flatMap((alarm) =>
        alarm.rings.map((ring) => ({
          alarm,
          ring,
          area: estimateRingArea(ring),
        })),
      )
      .toSorted((a, b) => b.area - a.area);

    for (const { alarm, ring } of polygonEntries) {
      const color = warningColor(alarm.level);

      const polygon = L.polygon(ring, {
        color,
        fillColor: color,
        fillOpacity: alarm.level === "yellow" ? 0.18 : 0.22,
        opacity: 0.9,
        weight: alarm.level === "red" ? 3 : 2,
        pane: "overlayPane",
        className: `weather-map-alarm weather-map-alarm--${alarm.level}`,
      });

      polygon.bindPopup(
        () =>
          createAlarmPopupContent(alarm, locale, {
            warning: tMap("warning"),
            valid: tMap("warningValid"),
            municipalities: tMap("warningMunicipalities"),
          }),
        { maxWidth: 320, className: "weather-map-popup-pane" },
      );
      polygon.addTo(layer);
    }

    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [alarms, locale, map, tMap]);

  return null;
}

function AlarmToggleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.9 2.7 17.1A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function AlarmLayerControl({
  alarmCount,
  showAlarms,
  onToggle,
}: {
  alarmCount: number;
  showAlarms: boolean;
  onToggle: () => void;
}) {
  const map = useMap();
  const tMap = useTranslations("map");
  const wrapRef = useRef<HTMLDivElement>(null);
  const corner = map
    .getContainer()
    .querySelector<HTMLElement>(".leaflet-top.leaflet-left");

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.disableScrollPropagation(wrap);
  }, [corner]);

  if (!corner || alarmCount === 0) return null;

  const label = showAlarms ? tMap("hideAlarms") : tMap("showAlarms");

  return createPortal(
    <div ref={wrapRef} className="weather-map-locate-wrap">
      <div className="leaflet-bar leaflet-control weather-map-locate weather-map-layer-toggle">
        <button
          type="button"
          className="weather-map-locate__button weather-map-layer-toggle__button"
          data-active={showAlarms ? "true" : "false"}
          onClick={onToggle}
          title={label}
          aria-label={label}
          aria-pressed={showAlarms}
        >
          <AlarmToggleIcon />
        </button>
      </div>
    </div>,
    corner,
  );
}

function MapZoomDetailClass() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    function syncDetailClass() {
      container.classList.toggle(
        "weather-map--detail",
        map.getZoom() >= DETAILED_MARKER_ZOOM,
      );
    }

    syncDetailClass();
    map.on("zoomend", syncDetailClass);

    return () => {
      map.off("zoomend", syncDetailClass);
      container.classList.remove("weather-map--detail");
    };
  }, [map]);

  return null;
}

function InvalidateSizeOnContainerResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const parent = container.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function applyLatviaOverview(map: L.Map) {
  map.invalidateSize({ animate: false });
  const width = map.getSize().x;
  if (width <= 0) return;

  const overview = latviaOverviewForWidth(width);
  if (overview.mode === "setView") {
    map.setView(overview.center, overview.zoom, { animate: false });
    return;
  }

  map.fitBounds(LATVIA_BOUNDS, {
    padding: overview.padding,
    maxZoom: overview.maxZoom,
    animate: false,
  });
}

function FitLatvia({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    function applyOverview() {
      applyLatviaOverview(map);
    }

    applyOverview();
    const frame = requestAnimationFrame(applyOverview);

    const container = map.getContainer();
    const parent = container.parentElement;
    let observer: ResizeObserver | undefined;
    if (parent) {
      observer = new ResizeObserver(() => {
        applyOverview();
      });
      observer.observe(parent);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [enabled, map]);

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
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const corner = map
    .getContainer()
    .querySelector<HTMLElement>(".leaflet-top.leaflet-left");

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

    openClusteredMarkerPopup(map, cluster, marker);
  }

  async function handleLocate() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      const position = await getBrowserPosition();
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
    } catch {
      setStatus("error");
    }
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

export function WeatherMap({
  locations,
  alarms,
  locale,
  selectedId,
  focusLocationId,
  initialShowAlarms = true,
}: WeatherMapProps) {
  const tMap = useTranslations("map");
  const [theme, setTheme] = useState<Theme>(() => getActiveTheme());
  const [showAlarms, setShowAlarms] = useState(initialShowAlarms);
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
      zoom={MOBILE_DEFAULT_ZOOM}
      zoomSnap={MAP_ZOOM_SNAP}
      className="weather-map h-full w-full"
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
      <FitLatvia enabled={!focusLocationId} />
      <InvalidateSizeOnContainerResize />
      <MapZoomDetailClass />
      {showAlarms ? <AlarmPolygons alarms={alarms} locale={locale} /> : null}
      <LocationMarkers
        locations={locations}
        locale={locale}
        selectedId={selectedId}
        focusLocationId={focusLocationId}
        markersByIdRef={markersByIdRef}
        clusterRef={clusterRef}
      />
      <AlarmLayerControl
        alarmCount={alarms.length}
        showAlarms={showAlarms}
        onToggle={() => setShowAlarms((current) => !current)}
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
