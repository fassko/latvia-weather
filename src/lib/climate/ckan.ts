const CKAN_BASE = "https://data.gov.lv/dati/lv/api/3/action";
const CKAN_DUMP_BASE = "https://data.gov.lv/dati/lv/datastore/dump";

export const CLIMATE_RESOURCE_IDS = {
  monthlyStats: "fa97540f-dcee-425d-93b4-b49af7e71cc5",
  normals: "37abd3df-24bb-442a-97ca-d3339633b235",
  stations: "c32c7afd-0d05-44fd-8b24-1de85b4bf11d",
  params: "38b462ac-08b9-4168-9d6e-cbaedc2e775d",
  hourlyArchive: "ecc62e27-2071-483c-bca9-5e53d979faa8",
} as const;

export const STATIONS_REVALIDATE_SECONDS = 86_400;
export const NORMALS_REVALIDATE_SECONDS = 604_800;
export const MONTHLY_REVALIDATE_SECONDS = 43_200;

interface DatastoreSearchResult<T> {
  success: boolean;
  result?: {
    records: T[];
    total: number;
  };
  error?: { message?: string };
}

export async function datastoreSearch<T extends object>(options: {
  resourceId: string;
  filters?: Record<string, string | number>;
  limit?: number;
  offset?: number;
  sort?: string;
  revalidate: number;
}): Promise<T[]> {
  const params = new URLSearchParams({
    resource_id: options.resourceId,
    limit: String(options.limit ?? 100),
  });

  if (options.offset) params.set("offset", String(options.offset));
  if (options.sort) params.set("sort", options.sort);
  if (options.filters) params.set("filters", JSON.stringify(options.filters));

  const response = await fetch(`${CKAN_BASE}/datastore_search?${params}`, {
    next: { revalidate: options.revalidate },
  });

  if (!response.ok) {
    throw new Error(`CKAN datastore_search returned ${response.status}`);
  }

  const payload = (await response.json()) as DatastoreSearchResult<T>;
  if (!payload.success || !payload.result) {
    throw new Error(payload.error?.message ?? "CKAN datastore_search failed");
  }

  return payload.result.records;
}

export async function datastoreDumpCsv(
  resourceId: string,
  revalidate: number,
): Promise<string> {
  const response = await fetch(`${CKAN_DUMP_BASE}/${resourceId}`, {
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`CKAN datastore dump returned ${response.status}`);
  }

  return response.text();
}

/** Minimal CSV parser for CKAN dumps (no embedded newlines in fields we use). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const row: Record<string, string> = {};
    for (let column = 0; column < headers.length; column += 1) {
      row[headers[column]] = values[column] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

export function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
