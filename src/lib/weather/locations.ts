export const DEFAULT_LOCATION_ID = "P269";

/** Latvian weather point IDs available for location switching. */
export const LOCATION_POINT_IDS = [
  "P1134",
  "P1352",
  "P364",
  "P450",
  "P269",
  "P905",
  "P992",
  "P768",
  "P458",
  "P862",
  "P915",
  "P770",
  "P206",
  "P322",
  "P449",
  "P359",
  "P766",
  "P868",
  "P863",
  "P215",
  "P361",
  "P317",
  "P170",
  "P125",
  "P213",
  "P467",
  "P123",
  "P211",
  "P748",
  "P866",
  "P323",
  "P117",
  "P1098",
  "P1580",
  "P6992",
  "P362",
  "P363",
  "P122",
  "P126",
  "P6674",
] as const;

export type LocationPointId = (typeof LOCATION_POINT_IDS)[number];

export function isValidLocationId(id: string): id is LocationPointId {
  return (LOCATION_POINT_IDS as readonly string[]).includes(id);
}

export function resolveLocationId(
  punkts: string | undefined,
  savedPunkts?: string | undefined,
): LocationPointId {
  if (punkts && isValidLocationId(punkts)) {
    return punkts;
  }
  if (savedPunkts && isValidLocationId(savedPunkts)) {
    return savedPunkts;
  }
  return DEFAULT_LOCATION_ID;
}

/** Region/address line when it adds detail beyond the location name. */
export function getLocationSubtitle(
  name: string,
  region: string,
  locale: string,
): string | null {
  const trimmedName = name.trim();
  const trimmedRegion = region.trim();

  if (!trimmedRegion) return null;

  if (
    trimmedRegion.localeCompare(trimmedName, locale, { sensitivity: "accent" }) === 0
  ) {
    return null;
  }

  const namePrefix = new RegExp(
    `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,\\s*`,
    "iu",
  );
  const withoutNamePrefix = trimmedRegion.replace(namePrefix, "").trim();

  if (withoutNamePrefix && withoutNamePrefix !== trimmedRegion) {
    return withoutNamePrefix;
  }

  return trimmedRegion;
}
