"use client";

import L from "leaflet";
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
  formatMapTemperatureLabel,
  temperatureMarkerColor,
  temperatureTextColor,
} from "@/lib/weather/map-temp";
import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import { getIntlLocale, prefersLatvianWeatherCopy } from "@/lib/locale";
import { localizedPath } from "@/lib/site";
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
  DEFAULT_PLACE_RANK,
  MOBILE_DEFAULT_ZOOM,
  isPlaceLabelVisible,
  latviaOverviewForWidth,
} from "@/lib/weather/map-view";
import { resolveMapTiles } from "@/lib/weather/map-tiles";
import {
  buildTemperatureField,
  temperatureFieldColor,
} from "@/lib/weather/temperature-field";
import "leaflet/dist/leaflet.css";

const LOCATE_ZOOM = 11;
/** Below the warning polygons (overlayPane, 400) and the labels (markerPane, 600). */
const TEMPERATURE_FIELD_PANE = "temperatureFieldPane";
const TEMPERATURE_FIELD_PANE_Z_INDEX = 350;
const TEMPERATURE_FIELD_OPACITY = 0.55;

/** Colorful OSM/Voyager tiles; dark mode uses CSS invert on the tile pane. */
function mapTilesForTheme(theme: Theme) {
  return resolveMapTiles(theme);
}

interface WeatherMapProps {
  locations: WeatherLocationPoint[];
  alarms: WeatherAlarmPolygon[];
  locale: string;
  selectedId?: string;
  focusLocationId?: string;
  initialShowAlarms?: boolean;
  /** When true, fit the map to the provided locations instead of Latvia overview. */
  fitToLocations?: boolean;
  /** Places for the temperature wash; defaults to `locations`. */
  fieldLocations?: WeatherLocationPoint[];
  /** Label every place in `locations`, whatever its rank (the favourites filter). */
  showAllLabels?: boolean;
}

type MarkersById = Map<string, L.Marker>;

function forecastHref(locale: string, locationId: string, locationName: string): string {
  return localizedPath(
    locale,
    locationId === DEFAULT_LOCATION_ID ? undefined : locationId,
    locationName,
  );
}

function createLabelIcon(location: WeatherLocationPoint): L.DivIcon {
  const bg = temperatureMarkerColor(location.temperature);
  const fg = temperatureTextColor(location.temperature);
  const temp = formatMapTemperatureLabel(location.temperature);

  return L.divIcon({
    className: "weather-map-label",
    html: `<span class="weather-map-label__chip" style="background:${bg};color:${fg}">${temp}</span>`,
    iconSize: [36, 22],
    iconAnchor: [18, 11],
    popupAnchor: [0, -10],
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
  link.href = forecastHref(locale, location.id, location.name);
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

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function getAlarmAreaText(alarm: WeatherAlarmPolygon, locale: string): string {
  const useLv = prefersLatvianWeatherCopy(locale);
  const regionSummary = useLv ? alarm.regionsLv : alarm.regionsEn;
  if (regionSummary.trim()) return regionSummary.trim();

  const municipalityNames = useLv
    ? alarm.municipalityNamesLv
    : alarm.municipalityNamesEn;

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
  const useLv = prefersLatvianWeatherCopy(locale);
  title.textContent = useLv
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
  text.textContent = useLv ? alarm.textLv : alarm.textEn;
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

  if (brief.rainChance !== null && brief.rainChance > 0) {
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

/** Open a place's popup, showing its label first if its rank hides it at this zoom. */
function openLabelPopup(labels: L.LayerGroup, marker: L.Marker) {
  if (!labels.hasLayer(marker)) labels.addLayer(marker);
  marker.openPopup();
}

function LocationMarkers({
  locations,
  locale,
  selectedId,
  focusLocationId,
  showAllLabels = false,
  markersByIdRef,
  labelsRef,
}: Pick<
  WeatherMapProps,
  "locations" | "locale" | "selectedId" | "focusLocationId" | "showAllLabels"
> & {
  markersByIdRef: MutableRefObject<MarkersById>;
  labelsRef: MutableRefObject<L.LayerGroup | null>;
}) {
  const map = useMap();
  const tConditions = useTranslations("conditions");
  const tMap = useTranslations("map");
  const tHero = useTranslations("hero");
  const tWind = useTranslations("wind");
  const windUnit = useWindUnit();

  useEffect(() => {
    const labels = L.layerGroup();
    const markersById: MarkersById = new Map();
    const rankByMarker = new Map<L.Marker, number | null | undefined>();

    for (const location of locations) {
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
        continue;
      }

      const marker = L.marker([location.lat, location.lon], {
        icon: createLabelIcon(location),
        title: `${location.name}: ${formatMapTemperature(location.temperature)}, ${tConditions(getConditionKey(location.iconCode))}`,
        riseOnHover: true,
        // Where chips overlap, the selected place and then bigger places stay on top.
        zIndexOffset:
          location.id === selectedId
            ? 1000
            : (5 - (location.rank ?? DEFAULT_PLACE_RANK)) * 100,
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
        { maxWidth: 280, className: "weather-map-popup-pane" },
      );

      rankByMarker.set(marker, location.rank);
      markersById.set(location.id, marker);
    }

    function syncLabels() {
      const zoom = map.getZoom();

      for (const [marker, rank] of rankByMarker) {
        const visible =
          showAllLabels ||
          isPlaceLabelVisible(rank, zoom) ||
          marker.isPopupOpen();

        if (visible && !labels.hasLayer(marker)) labels.addLayer(marker);
        else if (!visible && labels.hasLayer(marker)) labels.removeLayer(marker);
      }
    }

    syncLabels();
    markersByIdRef.current = markersById;
    labelsRef.current = labels;
    map.addLayer(labels);
    map.on("zoomend", syncLabels);
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
          openLabelPopup(labels, focusMarker);
        };
        map.once("moveend", handleFocusMoveEnd);
      }
    }

    return () => {
      if (handleFocusMoveEnd) {
        map.off("moveend", handleFocusMoveEnd);
      }
      map.off("zoomend", syncLabels);
      map.removeLayer(labels);
      if (labelsRef.current === labels) {
        labelsRef.current = null;
      }
      markersByIdRef.current = new Map();
    };
  }, [
    focusLocationId,
    labelsRef,
    locations,
    locale,
    map,
    markersByIdRef,
    selectedId,
    showAllLabels,
    tConditions,
    tHero,
    tMap,
    tWind,
    windUnit,
  ]);

  return null;
}

function TemperatureFieldLayer({
  locations,
}: {
  locations: WeatherLocationPoint[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane(TEMPERATURE_FIELD_PANE)) {
      const pane = map.createPane(TEMPERATURE_FIELD_PANE);
      pane.style.zIndex = String(TEMPERATURE_FIELD_PANE_Z_INDEX);
      pane.style.pointerEvents = "none";
    }

    const field = buildTemperatureField(locations);
    const canvas = document.createElement("canvas");
    canvas.width = field.width;
    canvas.height = field.height;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = context.createImageData(field.width, field.height);
    for (let cell = 0; cell < field.values.length; cell += 1) {
      const value = field.values[cell];
      if (Number.isNaN(value)) continue;

      const [r, g, b] = temperatureFieldColor(value);
      const offset = cell * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = Math.round(field.alpha[cell] * 255);
    }
    context.putImageData(image, 0, 0);

    const overlay = L.imageOverlay(canvas.toDataURL("image/png"), LATVIA_BOUNDS, {
      opacity: TEMPERATURE_FIELD_OPACITY,
      interactive: false,
      pane: TEMPERATURE_FIELD_PANE,
      className: "weather-map-temperature-field",
    });
    overlay.addTo(map);

    return () => {
      map.removeLayer(overlay);
    };
  }, [locations, map]);

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

function FitLatvia({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    function applyOverview() {
      map.invalidateSize();
      const width = map.getSize().x;
      if (width <= 0) return;

      const overview = latviaOverviewForWidth(width);
      map.fitBounds(LATVIA_BOUNDS, {
        padding: overview.padding,
        maxZoom: overview.maxZoom,
        animate: false,
      });
    }

    applyOverview();
    const frame = requestAnimationFrame(applyOverview);
    return () => cancelAnimationFrame(frame);
  }, [enabled, map]);

  return null;
}

function FitLocations({
  locations,
  enabled,
}: {
  locations: WeatherLocationPoint[];
  enabled: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || locations.length === 0) return;

    const points = locations.filter(
      (location) =>
        Number.isFinite(location.lat) && Number.isFinite(location.lon),
    );
    if (points.length === 0) return;

    function applyFit() {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lon], LOCATE_ZOOM, {
          animate: false,
        });
        return;
      }

      const bounds = L.latLngBounds(
        points.map((location) => [location.lat, location.lon] as [number, number]),
      );
      map.fitBounds(bounds, {
        padding: [48, 48],
        maxZoom: LOCATE_ZOOM,
        animate: false,
      });
    }

    applyFit();
    const frame = requestAnimationFrame(applyFit);
    return () => cancelAnimationFrame(frame);
  }, [enabled, locations, map]);

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
  labelsRef,
}: {
  locations: WeatherLocationPoint[];
  markersByIdRef: RefObject<MarkersById>;
  labelsRef: RefObject<L.LayerGroup | null>;
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
    const labels = labelsRef.current;
    if (!marker || !labels || !map.hasLayer(labels)) return;

    openLabelPopup(labels, marker);
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
  fitToLocations = false,
  fieldLocations,
  showAllLabels = false,
}: WeatherMapProps) {
  const tMap = useTranslations("map");
  const [theme, setTheme] = useState<Theme>(() => getActiveTheme());
  const [showAlarms, setShowAlarms] = useState(initialShowAlarms);
  const markersByIdRef = useRef<MarkersById>(new Map());
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const mapTiles = mapTilesForTheme(theme);
  const shouldFitLocations = fitToLocations && !focusLocationId;

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
        key={`${theme}-${mapTiles.provider}`}
        attribution={mapTiles.attribution}
        url={mapTiles.url}
        maxZoom={19}
      />
      <FitLatvia enabled={!focusLocationId && !shouldFitLocations} />
      <FitLocations locations={locations} enabled={shouldFitLocations} />
      <InvalidateSizeOnContainerResize />
      <TemperatureFieldLayer locations={fieldLocations ?? locations} />
      {showAlarms ? <AlarmPolygons alarms={alarms} locale={locale} /> : null}
      <LocationMarkers
        locations={locations}
        locale={locale}
        selectedId={selectedId}
        focusLocationId={focusLocationId}
        showAllLabels={showAllLabels}
        markersByIdRef={markersByIdRef}
        labelsRef={labelsRef}
      />
      <AlarmLayerControl
        alarmCount={alarms.length}
        showAlarms={showAlarms}
        onToggle={() => setShowAlarms((current) => !current)}
      />
      <LocateMeControl
        locations={locations}
        markersByIdRef={markersByIdRef}
        labelsRef={labelsRef}
      />
      <span className="sr-only">
        {tMap("markerCount", { count: locations.length })}
      </span>
    </MapContainer>
  );
}
