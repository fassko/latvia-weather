import { DEFAULT_LOCATION_ID, isValidLocationId } from "@/lib/weather/locations";
import { localizedPath, locationIdFromSlug, locationSlug } from "@/lib/site";

/**
 * Resolve a `/punkts/{segment}` path to its canonical locale path, or null when
 * the segment is already canonical / unknown.
 *
 * Bare IDs (`P364`) and hybrid slugs (`saulkrasti-P364`) must hard-redirect to
 * the readable name slug so crawlers never keep soft-duplicate URLs.
 */
export function canonicalPunktsPath(
  locale: string,
  segment: string,
  locations: ReadonlyArray<{ id: string; name: string }>,
): string | null {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const legacyId = locationIdFromSlug(segment);
  const directId = /^P\d+$/i.test(segment) ? `P${segment.slice(1)}` : undefined;
  const locationId =
    (legacyId && isValidLocationId(legacyId) ? legacyId : undefined) ??
    (directId && isValidLocationId(directId) ? directId : undefined);

  if (locationId) {
    const location = byId.get(locationId);
    if (!location) return null;
    return localizedPath(
      locale,
      location.id === DEFAULT_LOCATION_ID ? undefined : location.id,
      location.name,
    );
  }

  const matches = locations.filter(
    (location) => locationSlug(location.name) === segment,
  );
  if (matches.length !== 1) return null;

  const location = matches[0];
  const canonical = localizedPath(
    locale,
    location.id === DEFAULT_LOCATION_ID ? undefined : location.id,
    location.name,
  );
  const current = `/${locale}/punkts/${segment}`;
  return current === canonical ? null : canonical;
}

/** True when the path segment is an ID or ID-suffixed hybrid that should 301. */
export function isNonCanonicalPunktsSegment(segment: string): boolean {
  return Boolean(locationIdFromSlug(segment)) || /^P\d+$/i.test(segment);
}
