import { isValidLocationId } from "./locations";

/** Legacy LVĢMC-style query key still accepted for shared links. */
export const PUNKTS_QUERY_PARAM = "punkts";

/** English-friendly alias for the same location id query value. */
export const LOCATION_QUERY_PARAM = "location";

/**
 * Canonical query key for non-path uses (map focus, OG image route, APIs).
 * Forecast pages themselves canonicalize to `/[locale]/punkts/[slug]`.
 */
export const CANONICAL_LOCATION_QUERY_PARAM = PUNKTS_QUERY_PARAM;

/**
 * Pick a location id from `punkts` / `location` query values.
 *
 * Precedence: when both are present, a valid `punkts` wins. If `punkts` is
 * missing or invalid, a valid `location` is used. Callers should redirect or
 * strip leftover query keys so only the path (or canonical query key) remains.
 */
export function pickLocationQueryValue(
  punkts: string | null | undefined,
  location: string | null | undefined,
): string | undefined {
  if (punkts != null && punkts !== "" && isValidLocationId(punkts)) {
    return punkts;
  }
  if (location != null && location !== "" && isValidLocationId(location)) {
    return location;
  }
  return undefined;
}

/** True when either location query key is present on the URL (even if empty/invalid). */
export function hasLocationQueryParam(
  punkts: string | null | undefined,
  location: string | null | undefined,
): boolean {
  return punkts !== null && punkts !== undefined
    ? true
    : location !== null && location !== undefined;
}
