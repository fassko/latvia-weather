import { normalizeForLocationSearch } from "@/lib/weather/location-search";

export interface AssistantLocationRef {
  id: string;
  name: string;
}

export type AssistantLocationIntent =
  | { kind: "current" }
  | { kind: "other"; location: AssistantLocationRef };

const MIN_LOCATION_NAME_LENGTH = 3;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsLocationName(text: string, locationName: string): boolean {
  const normalizedText = normalizeForLocationSearch(text);
  const normalizedName = normalizeForLocationSearch(locationName.trim());

  if (normalizedName.length < MIN_LOCATION_NAME_LENGTH) return false;

  const pattern = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(normalizedName)}(?=$|[^\\p{L}\\p{N}])`,
    "u",
  );

  return pattern.test(normalizedText);
}

/** Find Latvian forecast locations explicitly named in free-form assistant text. */
export function findMentionedLocations<T extends AssistantLocationRef>(
  text: string,
  locations: T[],
): T[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const matches = locations.filter((location) =>
    mentionsLocationName(trimmed, location.name),
  );

  // Prefer longer names so "Jūrmala" wins over a shorter overlapping alias.
  return matches.sort((a, b) => {
    const lengthDiff = b.name.length - a.name.length;
    if (lengthDiff !== 0) return lengthDiff;
    return a.name.localeCompare(b.name, "lv");
  });
}

/**
 * Decide whether the latest user question targets the page location or another
 * Latvian forecast point named in the message (e.g. Garupe selected, asking about Riga).
 */
export function resolveAssistantLocationIntent(
  text: string,
  locations: AssistantLocationRef[],
  currentLocationId: string,
): AssistantLocationIntent {
  const mentioned = findMentionedLocations(text, locations);
  const other = mentioned.find((location) => location.id !== currentLocationId);

  if (other) {
    return {
      kind: "other",
      location: { id: other.id, name: other.name },
    };
  }

  return { kind: "current" };
}
