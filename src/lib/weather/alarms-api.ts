import {
  ALARMS_DATASET_SLUG,
  ALARMS_REVALIDATE_SECONDS,
  ALARMS_SOURCE_LABEL,
  filterAlarmsByCoordinates,
  getWeatherAlarmPolygons,
} from "@/lib/weather/alarms";
import { findNearestLocation } from "@/lib/weather/coordinates";
import { getLocationPoints } from "@/lib/weather/fetch";
import { isValidLocationId } from "@/lib/weather/locations";
import type { WeatherAlarmPolygon, WeatherLocationPoint } from "@/lib/weather/types";

export { ALARMS_REVALIDATE_SECONDS };

export interface LocalizedString {
  lv: string;
  en: string;
}

export interface LocalizedStringList {
  lv: string[];
  en: string[];
}

export interface WeatherAlarmApiItem {
  id: string;
  warningNo: string;
  level: WeatherAlarmPolygon["level"];
  intensity: LocalizedString;
  phenomenon: LocalizedString;
  regions: LocalizedString;
  text: LocalizedString;
  risks: LocalizedString;
  timeFrom: string;
  timeTill: string;
  municipalities: LocalizedStringList;
  /** Polygon rings as `[lat, lon][][]`. Omitted when `includeGeometry` is false. */
  rings?: [number, number][][];
  isStale?: boolean;
}

export interface WeatherAlarmsFilter {
  punkts?: string;
  location?: {
    id: string;
    name: string;
    region: string;
    lat: number;
    lon: number;
  };
  lat: number;
  lon: number;
}

export interface WeatherAlarmsResponse {
  source: string;
  dataset: string;
  datasetUrl: string;
  fetchedAt: string;
  filter: WeatherAlarmsFilter | null;
  count: number;
  alarms: WeatherAlarmApiItem[];
}

export class WeatherAlarmsRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "WeatherAlarmsRequestError";
    this.status = status;
  }
}

export function serializeWeatherAlarm(
  alarm: WeatherAlarmPolygon,
  includeGeometry: boolean,
): WeatherAlarmApiItem {
  const item: WeatherAlarmApiItem = {
    id: alarm.id,
    warningNo: alarm.warningNo,
    level: alarm.level,
    intensity: { lv: alarm.intensityLv, en: alarm.intensityEn },
    phenomenon: { lv: alarm.phenomenonLv, en: alarm.phenomenonEn },
    regions: { lv: alarm.regionsLv, en: alarm.regionsEn },
    text: { lv: alarm.textLv, en: alarm.textEn },
    risks: { lv: alarm.risksLv, en: alarm.risksEn },
    timeFrom: alarm.timeFrom,
    timeTill: alarm.timeTill,
    municipalities: {
      lv: alarm.municipalityNamesLv,
      en: alarm.municipalityNamesEn,
    },
  };

  if (includeGeometry) {
    item.rings = alarm.rings;
  }

  if (alarm.isStale) {
    item.isStale = true;
  }

  return item;
}

export function buildWeatherAlarmsResponse(options: {
  alarms: readonly WeatherAlarmPolygon[];
  filter: WeatherAlarmsFilter | null;
  includeGeometry: boolean;
  fetchedAt?: Date;
}): WeatherAlarmsResponse {
  const { alarms, filter, includeGeometry, fetchedAt = new Date() } = options;
  const filtered = filter
    ? filterAlarmsByCoordinates(alarms, { lat: filter.lat, lon: filter.lon })
    : [...alarms];

  return {
    source: ALARMS_SOURCE_LABEL,
    dataset: ALARMS_DATASET_SLUG,
    datasetUrl: `https://data.gov.lv/dati/dataset/${ALARMS_DATASET_SLUG}`,
    fetchedAt: fetchedAt.toISOString(),
    filter,
    count: filtered.length,
    alarms: filtered.map((alarm) =>
      serializeWeatherAlarm(alarm, includeGeometry),
    ),
  };
}

function toFilterLocation(
  location: Pick<WeatherLocationPoint, "id" | "name" | "region" | "lat" | "lon">,
): NonNullable<WeatherAlarmsFilter["location"]> {
  return {
    id: location.id,
    name: location.name,
    region: location.region,
    lat: location.lat,
    lon: location.lon,
  };
}

function parseIncludeGeometry(value: string | null | undefined): boolean {
  if (value == null || value === "") return true;
  const normalized = value.trim().toLowerCase();
  return !(
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no"
  );
}

export function resolveIncludeGeometry(
  geometry: string | null | undefined,
  includeGeometry: string | null | undefined,
): boolean {
  if (geometry != null && geometry !== "") {
    return parseIncludeGeometry(geometry);
  }
  return parseIncludeGeometry(includeGeometry);
}

/**
 * Resolve active weather alarms, optionally filtered to a forecast point or
 * arbitrary coordinates (point-in-polygon against LVĢMC alarm rings).
 */
export async function getWeatherAlarmsPayload(options: {
  punkts?: string;
  lat?: number | null;
  lon?: number | null;
  includeGeometry?: boolean;
}): Promise<WeatherAlarmsResponse> {
  const includeGeometry = options.includeGeometry !== false;
  const hasLat = options.lat != null;
  const hasLon = options.lon != null;

  if (hasLat !== hasLon) {
    throw new WeatherAlarmsRequestError(
      "Provide both lat and lon, or omit coordinates.",
    );
  }

  if (options.punkts && !isValidLocationId(options.punkts)) {
    throw new WeatherAlarmsRequestError(
      `Invalid location ID "${options.punkts}".`,
    );
  }

  if (
    options.lat != null &&
    options.lon != null &&
    (!Number.isFinite(options.lat) || !Number.isFinite(options.lon))
  ) {
    throw new WeatherAlarmsRequestError(
      "Query params lat and lon must be finite numbers.",
    );
  }

  const needsLocations = Boolean(options.punkts) || (hasLat && hasLon);
  const [alarms, locations] = await Promise.all([
    getWeatherAlarmPolygons(),
    needsLocations
      ? getLocationPoints()
      : Promise.resolve([] as WeatherLocationPoint[]),
  ]);

  let filter: WeatherAlarmsFilter | null = null;

  if (options.punkts) {
    const location = locations.find((item) => item.id === options.punkts);
    if (!location) {
      throw new WeatherAlarmsRequestError(
        `Location "${options.punkts}" was not found in the forecast network.`,
        404,
      );
    }

    // Explicit lat/lon override the punkts coordinates when both are given.
    const lat = options.lat ?? location.lat;
    const lon = options.lon ?? location.lon;

    filter = {
      punkts: location.id,
      location: toFilterLocation(location),
      lat,
      lon,
    };
  } else if (options.lat != null && options.lon != null) {
    const nearest = findNearestLocation(
      { lat: options.lat, lon: options.lon },
      locations,
    );

    filter = {
      punkts: nearest?.id,
      location: nearest ? toFilterLocation(nearest) : undefined,
      lat: options.lat,
      lon: options.lon,
    };
  }

  return buildWeatherAlarmsResponse({
    alarms,
    filter,
    includeGeometry,
  });
}
