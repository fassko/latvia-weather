import type { WeatherAlarmPolygon, WeatherWarningLevel } from "./types";

const DATASTORE_API =
  "https://data.gov.lv/dati/api/3/action/datastore_search";
const PAGE_SIZE = 5000;
const STALE_FALLBACK_MS = 6 * 60 * 60 * 1000;

const RESOURCE_IDS = {
  metadata: "59c111fb-8c9a-4a63-8284-0a64a2920681",
  polygons: "01dc7d3c-34e5-4cc3-8f1a-aaf022872a02",
  municipalitiesByWarning: "995139f7-ec05-489a-b2bb-732d5cf7ca7b",
  municipalities: "50aba289-6571-4ba7-9331-a7c1f5f9e19e",
} as const;

interface CachedValue<T> {
  value: T;
  storedAt: number;
}

interface DatastoreResponse<T> {
  success: boolean;
  result?: {
    records?: T[];
    total?: number;
  };
}

interface AlarmMetadataRecord {
  WARNING_NO: string;
  WEATHER_WARNING_EV_ID: number | string;
  INTENSITY_LV: string;
  INTENSITY_EN: string;
  REGIONS: string;
  REGIONS_EN: string;
  PARADIBA: string;
  PARADIBA_EN: string;
  TIME_FROM: string;
  TIME_TILL: string;
  TEKSTS_LV: string;
  TEKSTS_EN: string;
  RISKS_LV: string;
  RISKS_EN: string;
}

interface AlarmPolygonRecord {
  WEATHER_WARNING_EV_ID: number | string;
  POLIGON_ID: number | string;
  LAT: number | string;
  LON: number | string;
  NPK: number | string;
}

interface WarningMunicipalityRecord {
  WEATHER_WARNING_EV_ID: number | string;
  NOV_ID: number | string;
}

interface MunicipalityRecord {
  NOV_ID: number | string;
  NOSAUKUMS_LV: string;
  NOSAUKUMS_EN: string;
}

const weatherAlarmPolygonsCache: CachedValue<WeatherAlarmPolygon[]> = {
  value: [],
  storedAt: 0,
};
const weatherAlarmRegionLabelsCache: CachedValue<
  Map<string, { lv: string[]; en: string[] }>
> = {
  value: new Map(),
  storedAt: 0,
};

function rememberWeatherAlarmPolygons(value: WeatherAlarmPolygon[]) {
  weatherAlarmPolygonsCache.value = value;
  weatherAlarmPolygonsCache.storedAt = Date.now();
}

function rememberWeatherAlarmRegionLabels(
  value: Map<string, { lv: string[]; en: string[] }>,
) {
  weatherAlarmRegionLabelsCache.value = value;
  weatherAlarmRegionLabelsCache.storedAt = Date.now();
}

function hasUsableStaleAlarms(): boolean {
  return (
    weatherAlarmPolygonsCache.value.length > 0 &&
    Date.now() - weatherAlarmPolygonsCache.storedAt <= STALE_FALLBACK_MS
  );
}

function hasUsableStaleRegionLabels(): boolean {
  return (
    weatherAlarmRegionLabelsCache.value.size > 0 &&
    Date.now() - weatherAlarmRegionLabelsCache.storedAt <= STALE_FALLBACK_MS
  );
}

function getWarningLevel(intensity: string): WeatherWarningLevel {
  const normalized = intensity.toLocaleLowerCase("lv");

  if (normalized.includes("dzelten") || normalized.includes("yellow")) {
    return "yellow";
  }
  if (normalized.includes("oran") || normalized.includes("orange")) {
    return "orange";
  }
  if (normalized.includes("sarkan") || normalized.includes("red")) {
    return "red";
  }

  return "unknown";
}

function normalizeId(value: number | string): string {
  return String(value);
}

function normalizeWarningText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitRegionNames(value: string): string[] {
  return value
    .split(",")
    .map((region) => region.trim())
    .filter(Boolean);
}

function parseCoordinate(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchDatastorePage<T>(
  resourceId: string,
  offset: number,
): Promise<{ records: T[]; total: number }> {
  const url = new URL(DATASTORE_API);
  url.searchParams.set("resource_id", resourceId);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Datastore API returned ${response.status}`);
  }

  const payload = (await response.json()) as DatastoreResponse<T>;
  const records = payload.result?.records;
  const total = payload.result?.total;

  if (!payload.success || !Array.isArray(records) || typeof total !== "number") {
    throw new Error("Datastore API returned invalid data");
  }

  return { records, total };
}

async function fetchDatastoreRecords<T>(resourceId: string): Promise<T[]> {
  const records: T[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await fetchDatastorePage<T>(resourceId, offset);
    records.push(...page.records);
    total = page.total;
    offset += page.records.length;
  } while (offset < total);

  return records;
}

function indexMunicipalityNames(records: MunicipalityRecord[]) {
  const namesById = new Map<
    string,
    { lv: string; en: string }
  >();

  for (const record of records) {
    namesById.set(normalizeId(record.NOV_ID), {
      lv: record.NOSAUKUMS_LV,
      en: record.NOSAUKUMS_EN,
    });
  }

  return namesById;
}

function groupMunicipalitiesByWarning(
  warningMunicipalities: WarningMunicipalityRecord[],
  municipalities: MunicipalityRecord[],
) {
  const namesById = indexMunicipalityNames(municipalities);
  const namesByWarningId = new Map<
    string,
    { lv: string[]; en: string[] }
  >();

  for (const record of warningMunicipalities) {
    const warningId = normalizeId(record.WEATHER_WARNING_EV_ID);
    const names = namesById.get(normalizeId(record.NOV_ID));
    if (!names) continue;

    const group = namesByWarningId.get(warningId) ?? { lv: [], en: [] };
    group.lv.push(names.lv);
    group.en.push(names.en);
    namesByWarningId.set(warningId, group);
  }

  for (const group of namesByWarningId.values()) {
    group.lv.sort((a, b) => a.localeCompare(b, "lv"));
    group.en.sort((a, b) => a.localeCompare(b, "en"));
  }

  return namesByWarningId;
}

function groupPolygonRings(records: AlarmPolygonRecord[]) {
  const ringsByWarningId = new Map<string, Map<string, AlarmPolygonRecord[]>>();

  for (const record of records) {
    const warningId = normalizeId(record.WEATHER_WARNING_EV_ID);
    const polygonId = normalizeId(record.POLIGON_ID);
    const polygonsForWarning =
      ringsByWarningId.get(warningId) ?? new Map<string, AlarmPolygonRecord[]>();
    const points = polygonsForWarning.get(polygonId) ?? [];

    points.push(record);
    polygonsForWarning.set(polygonId, points);
    ringsByWarningId.set(warningId, polygonsForWarning);
  }

  const rings = new Map<string, [number, number][][]>();

  for (const [warningId, polygons] of ringsByWarningId) {
    const warningRings: [number, number][][] = [];

    for (const points of polygons.values()) {
      const ring = points
        .toSorted((a, b) => Number(a.NPK) - Number(b.NPK))
        .map((point): [number, number] | null => {
          const lat = parseCoordinate(point.LAT);
          const lon = parseCoordinate(point.LON);
          return lat == null || lon == null ? null : [lat, lon];
        })
        .filter((point): point is [number, number] => point != null);

      if (ring.length >= 3) {
        warningRings.push(ring);
      }
    }

    if (warningRings.length > 0) {
      rings.set(warningId, warningRings);
    }
  }

  return rings;
}

export function buildWeatherAlarmPolygons(
  metadataRecords: AlarmMetadataRecord[],
  polygonRecords: AlarmPolygonRecord[],
  warningMunicipalities: WarningMunicipalityRecord[],
  municipalities: MunicipalityRecord[],
): WeatherAlarmPolygon[] {
  const ringsByWarningId = groupPolygonRings(polygonRecords);
  const municipalitiesByWarningId = groupMunicipalitiesByWarning(
    warningMunicipalities,
    municipalities,
  );

  return metadataRecords
    .map((metadata): WeatherAlarmPolygon | null => {
      const id = normalizeId(metadata.WEATHER_WARNING_EV_ID);
      const rings = ringsByWarningId.get(id);
      if (!rings) return null;

      const municipalityNames = municipalitiesByWarningId.get(id) ?? {
        lv: [],
        en: [],
      };

      return {
        id,
        warningNo: metadata.WARNING_NO,
        level: getWarningLevel(metadata.INTENSITY_LV || metadata.INTENSITY_EN),
        intensityLv: metadata.INTENSITY_LV,
        intensityEn: metadata.INTENSITY_EN,
        regionsLv: metadata.REGIONS,
        regionsEn: metadata.REGIONS_EN,
        phenomenonLv: metadata.PARADIBA,
        phenomenonEn: metadata.PARADIBA_EN,
        timeFrom: metadata.TIME_FROM,
        timeTill: metadata.TIME_TILL,
        textLv: metadata.TEKSTS_LV,
        textEn: metadata.TEKSTS_EN,
        risksLv: metadata.RISKS_LV,
        risksEn: metadata.RISKS_EN,
        municipalityNamesLv: municipalityNames.lv,
        municipalityNamesEn: municipalityNames.en,
        rings,
      };
    })
    .filter((alarm): alarm is WeatherAlarmPolygon => alarm != null);
}

export function buildWeatherAlarmRegionLabelsByText(
  metadataRecords: AlarmMetadataRecord[],
): Map<string, { lv: string[]; en: string[] }> {
  const labelsByText = new Map<string, { lv: string[]; en: string[] }>();

  for (const record of metadataRecords) {
    const labels = {
      lv: splitRegionNames(record.REGIONS),
      en: splitRegionNames(record.REGIONS_EN),
    };

    labelsByText.set(normalizeWarningText(record.TEKSTS_LV), labels);
    if (record.TEKSTS_EN.trim()) {
      labelsByText.set(normalizeWarningText(record.TEKSTS_EN), labels);
    }
  }

  return labelsByText;
}

export async function getWeatherAlarmRegionLabelsByText(): Promise<
  Map<string, { lv: string[]; en: string[] }>
> {
  try {
    const metadataRecords = await fetchDatastoreRecords<AlarmMetadataRecord>(
      RESOURCE_IDS.metadata,
    );
    const labelsByText = buildWeatherAlarmRegionLabelsByText(metadataRecords);
    rememberWeatherAlarmRegionLabels(labelsByText);
    return labelsByText;
  } catch {
    if (hasUsableStaleRegionLabels()) {
      return weatherAlarmRegionLabelsCache.value;
    }

    return new Map();
  }
}

export async function getWeatherAlarmPolygons(): Promise<WeatherAlarmPolygon[]> {
  try {
    const [
      metadataRecords,
      polygonRecords,
      warningMunicipalities,
      municipalities,
    ] = await Promise.all([
      fetchDatastoreRecords<AlarmMetadataRecord>(RESOURCE_IDS.metadata),
      fetchDatastoreRecords<AlarmPolygonRecord>(RESOURCE_IDS.polygons),
      fetchDatastoreRecords<WarningMunicipalityRecord>(
        RESOURCE_IDS.municipalitiesByWarning,
      ),
      fetchDatastoreRecords<MunicipalityRecord>(RESOURCE_IDS.municipalities),
    ]);

    const alarms = buildWeatherAlarmPolygons(
      metadataRecords,
      polygonRecords,
      warningMunicipalities,
      municipalities,
    );
    rememberWeatherAlarmPolygons(alarms);
    return alarms;
  } catch {
    if (hasUsableStaleAlarms()) {
      return weatherAlarmPolygonsCache.value.map((alarm) => ({
        ...alarm,
        isStale: true,
      }));
    }

    return [];
  }
}
