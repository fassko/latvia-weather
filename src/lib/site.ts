const DEFAULT_SITE_URL = "https://latvia-weather.com";

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

export function localizedPath(locale: string, locationId?: string): string {
  const path = `/${locale}`;
  return locationId ? `${path}?punkts=${encodeURIComponent(locationId)}` : path;
}
