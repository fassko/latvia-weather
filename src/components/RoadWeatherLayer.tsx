"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import { getIntlLocale } from "@/lib/locale";
import { LATVIA_TIME_ZONE } from "@/lib/weather/timezone";
import {
  isRoadWeatherStale,
  ROAD_WEATHER_ATTRIBUTION,
  roadTemperatureTone,
  type RoadCamera,
  type RoadWeatherFeed,
  type RoadWeatherPoint,
  type RoadWeatherStation,
} from "@/lib/weather/road-weather";

/** Matches the API's cache, so a long-open map keeps the readings current. */
const REFRESH_MS = 5 * 60_000;
/** Above the place labels, so a station on top of a town can still be clicked. */
const ROAD_MARKER_Z_OFFSET = 1000;

type RoadLabels = {
  station: string;
  camera: string;
  surface: string;
  air: string;
  dewPoint: string;
  precipitation: string;
  visibility: string;
  grip: string;
  observed: string;
  stale: string;
  warning: string;
  photoAlt: string;
  photoMissing: string;
};

function formatNumber(locale: string, value: number, digits: number): string {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    signDisplay: "auto",
  }).format(value);
}

function formatTemperature(locale: string, value: number | null): string | null {
  return value === null ? null : `${formatNumber(locale, value, 1)}°C`;
}

function formatObservedAt(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: LATVIA_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function chipHtml(point: RoadWeatherPoint, locale: string): string {
  if (point.kind === "camera") {
    return `<span class="road-weather-chip road-weather-chip--camera" aria-hidden="true">${CAMERA_SVG}</span>`;
  }
  const tone = roadTemperatureTone(point.roadTemperature);
  const text =
    point.roadTemperature === null ? "–" : `${formatNumber(locale, point.roadTemperature, 1)}°`;
  const warn = point.hasWarnings ? " road-weather-chip--warn" : "";
  return `<span class="road-weather-chip road-weather-chip--${tone}${warn}">${ROAD_SVG}${text}</span>`;
}

const ROAD_SVG =
  '<svg aria-hidden="true" viewBox="0 0 16 16" class="road-weather-chip__icon"><path d="M5.5 2 3 14M10.5 2 13 14M8 3v2M8 7.5v2M8 12v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const CAMERA_SVG =
  '<svg aria-hidden="true" viewBox="0 0 16 16" class="road-weather-chip__icon"><path d="M2 5.5h8.5v6H2zM10.5 7.5l3.5-2v6l-3.5-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

function appendText(parent: HTMLElement, className: string, text: string) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
}

function stationStats(station: RoadWeatherStation, locale: string, labels: RoadLabels): string[] {
  const rows: [string, string | null][] = [
    [labels.surface, formatTemperature(locale, station.roadTemperature)],
    [labels.air, formatTemperature(locale, station.airTemperature)],
    [labels.dewPoint, formatTemperature(locale, station.dewPoint)],
    [
      labels.precipitation,
      station.precipitation === null ? null : `${formatNumber(locale, station.precipitation, 1)} mm/h`,
    ],
    [
      labels.visibility,
      station.visibility === null
        ? null
        : station.visibility >= 1000
          ? `${formatNumber(locale, station.visibility / 1000, 1)} km`
          : `${Math.round(station.visibility)} m`,
    ],
    [labels.grip, station.grip === null ? null : formatNumber(locale, station.grip, 2)],
  ];
  return rows.filter((row): row is [string, string] => row[1] !== null).map(([k, v]) => `${k}: ${v}`);
}

function createRoadPopup(point: RoadWeatherPoint, locale: string, labels: RoadLabels): HTMLElement {
  const root = document.createElement("div");
  root.className = "weather-map-popup road-weather-popup";

  appendText(root, "weather-map-popup__title", point.road ?? (point.kind === "station" ? labels.station : labels.camera));
  appendText(root, "weather-map-popup__region", point.kind === "station" ? labels.station : labels.camera);

  if (point.imageUrl) {
    const image = document.createElement("img");
    image.className = "road-weather-popup__photo";
    image.src = point.imageUrl;
    image.alt = labels.photoAlt;
    image.width = 320;
    image.height = 240;
    image.decoding = "async";
    root.appendChild(image);
  } else {
    appendText(root, "weather-map-popup__region", labels.photoMissing);
  }

  if (point.kind === "station") {
    if (point.hasWarnings) appendText(root, "road-weather-popup__warning", labels.warning);
    const stats = document.createElement("ul");
    stats.className = "road-weather-popup__stats";
    for (const line of stationStats(point, locale, labels)) {
      const item = document.createElement("li");
      item.textContent = line;
      stats.appendChild(item);
    }
    root.appendChild(stats);

    if (point.observedAt) {
      const stale = isRoadWeatherStale(point.observedAt, new Date());
      appendText(
        root,
        stale ? "road-weather-popup__time road-weather-popup__time--stale" : "road-weather-popup__time",
        `${labels.observed} ${formatObservedAt(locale, point.observedAt)}${stale ? ` · ${labels.stale}` : ""}`,
      );
    }
  }

  return root;
}

function useRoadLabels(): RoadLabels {
  const t = useTranslations("map");
  return {
    station: t("roadStation"),
    camera: t("roadCamera"),
    surface: t("roadSurface"),
    air: t("roadAir"),
    dewPoint: t("roadDewPoint"),
    precipitation: t("roadPrecipitation"),
    visibility: t("roadVisibility"),
    grip: t("roadGrip"),
    observed: t("roadObserved"),
    stale: t("roadStale"),
    warning: t("roadWarning"),
    photoAlt: t("roadPhotoAlt"),
    photoMissing: t("roadPhotoMissing"),
  };
}

export type RoadWeatherStatus = "idle" | "loading" | "ready" | "error";

/**
 * Road weather stations (surface temperature chips) and traffic cameras. Loads when first shown and refreshes
 * every few minutes while visible.
 */
export function RoadWeatherLayer({
  locale,
  onStatusChange,
}: {
  locale: string;
  onStatusChange?: (status: RoadWeatherStatus) => void;
}) {
  const map = useMap();
  const labels = useRoadLabels();
  const labelsKey = JSON.stringify(labels);
  const [feed, setFeed] = useState<RoadWeatherFeed | null>(null);
  const statusRef = useRef(onStatusChange);

  useEffect(() => {
    statusRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load(first: boolean) {
      if (first) statusRef.current?.("loading");
      try {
        const response = await fetch("/api/road-weather", { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as RoadWeatherFeed;
        if (cancelled) return;
        setFeed(next);
        statusRef.current?.("ready");
      } catch {
        // A failed refresh keeps the markers already on the map.
        if (!cancelled && first) statusRef.current?.("error");
      }
    }

    void load(true);
    const timer = window.setInterval(() => void load(false), REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
      statusRef.current?.("idle");
    };
  }, []);

  useEffect(() => {
    if (!feed) return;
    const popupLabels = JSON.parse(labelsKey) as RoadLabels;
    const group = L.layerGroup([], { attribution: ROAD_WEATHER_ATTRIBUTION });
    const points: (RoadWeatherStation | RoadCamera)[] = [...feed.cameras, ...feed.stations];

    for (const point of points) {
      const isStation = point.kind === "station";
      const marker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({
          className: "road-weather-marker",
          html: chipHtml(point, locale),
          iconSize: isStation ? [54, 22] : [26, 22],
          iconAnchor: isStation ? [27, 11] : [13, 11],
          popupAnchor: [0, -10],
        }),
        keyboard: true,
        title: point.road ?? "",
        zIndexOffset: ROAD_MARKER_Z_OFFSET,
      });
      marker.bindPopup(() => createRoadPopup(point, locale, popupLabels), {
        maxWidth: 340,
        minWidth: 240,
        autoPanPadding: [16, 16],
      });
      group.addLayer(marker);
    }

    group.addTo(map);
    return () => {
      map.removeLayer(group);
    };
  }, [feed, labelsKey, locale, map]);

  return null;
}

function RoadToggleIcon() {
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
      <path d="M8 3 4 21M16 3l4 18M12 4v3M12 11v2M12 17v3" />
    </svg>
  );
}

/** Map button that shows or hides road weather; sits between the warnings toggle and "locate me". */
export function RoadWeatherControl({
  active,
  status,
  onToggle,
}: {
  active: boolean;
  status: RoadWeatherStatus;
  onToggle: () => void;
}) {
  const map = useMap();
  const tMap = useTranslations("map");
  const wrapRef = useRef<HTMLDivElement>(null);
  const corner = map.getContainer().querySelector<HTMLElement>(".leaflet-top.leaflet-left");

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.disableScrollPropagation(wrap);
  }, [corner]);

  if (!corner) return null;

  const label = active ? tMap("hideRoadWeather") : tMap("showRoadWeather");

  return createPortal(
    <div ref={wrapRef} className="weather-map-locate-wrap">
      <div className="leaflet-bar leaflet-control weather-map-locate">
        <button
          type="button"
          className="weather-map-locate__button road-weather-toggle"
          data-active={active ? "true" : "false"}
          data-status={status}
          onClick={onToggle}
          title={label}
          aria-label={label}
          aria-pressed={active}
          aria-busy={status === "loading"}
        >
          <RoadToggleIcon />
        </button>
      </div>
      {active && status === "error" ? (
        <p className="weather-map-locate__error" role="status">
          {tMap("roadWeatherError")}
        </p>
      ) : null}
    </div>,
    corner,
  );
}
