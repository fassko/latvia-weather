const DEFAULT_SITE_URL = "https://latvia-weather.vercel.app";

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return DEFAULT_SITE_URL;
}

export function localizedPath(locale: string, locationId?: string): string {
  const path = `/${locale}`;
  return locationId ? `${path}?punkts=${encodeURIComponent(locationId)}` : path;
}
