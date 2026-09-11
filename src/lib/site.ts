const DEFAULT_SITE_URL = "https://latvia-weather.com";

/** Preview and development deployments must never be indexed as duplicates. */
export function isIndexableDeployment(): boolean {
  return !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";
}

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  // Preview/dev deployments get their own ephemeral URL; production resolves
  // to the custom domain so canonical, sitemap, and OG URLs stay correct.
  if (process.env.VERCEL_ENV !== "production" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return DEFAULT_SITE_URL;
}

export function locationSlug(name: string): string {
  const readableName = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("lv")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return readableName || "location";
}

export function locationIdFromSlug(value: string): string | undefined {
  const match = /(?:^|-)(P\d+)$/i.exec(value);
  return match ? `P${match[1].slice(1)}` : undefined;
}

export function localizedPath(
  locale: string,
  locationId?: string,
  locationName?: string,
): string {
  const path = `/${locale}`;
  if (!locationId) return path;

  const segment = locationName ? locationSlug(locationName) : locationId;
  return `${path}/punkts/${encodeURIComponent(segment)}`;
}
