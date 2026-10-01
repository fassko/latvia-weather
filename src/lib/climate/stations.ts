import { distanceKm, findNearestLocation } from "@/lib/weather/coordinates";
import {
  CLIMATE_RESOURCE_IDS,
  STATIONS_REVALIDATE_SECONDS,
  datastoreDumpCsv,
  parseCsv,
  parseOptionalNumber,
} from "./ckan";

export interface ClimateStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  active: boolean;
}

interface CachedStations {
  value: ClimateStation[];
  storedAt: number;
}

const STALE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
const stationsCache: CachedStations = { value: [], storedAt: 0 };

const STILL_ACTIVE_YEAR = 3900;

function parseStationRow(row: Record<string, string>): ClimateStation | null {
  const id = row.STATION_ID?.trim();
  const name = row.NAME?.trim();
  const lat = parseOptionalNumber(row.GEOGR2);
  const lon = parseOptionalNumber(row.GEOGR1);
  if (!id || !name || lat === null || lon === null) return null;

  const endDate = row.END_DATE?.trim() ?? "";
  const endYear = Number(endDate.slice(0, 4));
  const active = !Number.isFinite(endYear) || endYear >= STILL_ACTIVE_YEAR;

  return { id, name, lat, lon, active };
}

export async function getClimateStations(): Promise<ClimateStation[]> {
  try {
    const csv = await datastoreDumpCsv(
      CLIMATE_RESOURCE_IDS.stations,
      STATIONS_REVALIDATE_SECONDS,
    );
    const stations = parseCsv(csv)
      .map(parseStationRow)
      .filter((station): station is ClimateStation => station !== null);

    if (stations.length === 0) {
      throw new Error("Climate stations dump was empty");
    }

    stationsCache.value = stations;
    stationsCache.storedAt = Date.now();
    return stations;
  } catch (error) {
    if (
      stationsCache.value.length > 0 &&
      Date.now() - stationsCache.storedAt <= STALE_FALLBACK_MS
    ) {
      return stationsCache.value;
    }
    throw error;
  }
}

export interface NearestClimateStation {
  station: ClimateStation;
  distanceKm: number;
}

/** Prefer stations that have climate normals; fall back to any active station. */
export function findNearestClimateStation(
  origin: { lat: number; lon: number },
  stations: readonly ClimateStation[],
  normalsStationIds: ReadonlySet<string>,
): NearestClimateStation | null {
  const withNormals = stations.filter(
    (station) => station.active && normalsStationIds.has(station.id),
  );
  const pool = withNormals.length > 0 ? withNormals : stations.filter((s) => s.active);
  const nearest = findNearestLocation(origin, pool);
  if (!nearest) return null;

  return {
    station: nearest,
    distanceKm: distanceKm(origin, nearest),
  };
}
