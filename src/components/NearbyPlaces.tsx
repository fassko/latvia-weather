import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  pickNearbyLocations,
  pickRegionLocations,
} from "@/lib/seo/nearby-locations";
import type { WeatherLocationPoint } from "@/lib/weather/types";

interface NearbyPlacesProps {
  current: WeatherLocationPoint;
  locations: WeatherLocationPoint[];
}

/** Crawlable nearby + same-region links so location pages are not sitemap-orphans. */
export async function NearbyPlaces({ current, locations }: NearbyPlacesProps) {
  const t = await getTranslations("nearbyPlaces");
  const nearby = pickNearbyLocations(current, locations);
  const nearbyIds = new Set(nearby.map((location) => location.id));
  const region = pickRegionLocations(current, locations, nearbyIds);

  if (nearby.length === 0 && region.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="nearby-places-heading" className="space-y-4">
      {nearby.length > 0 ? (
        <div className="space-y-2">
          <h2
            id="nearby-places-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {t("nearbyTitle")}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("nearbySubtitle", { name: current.name })}
          </p>
          <ul className="flex flex-wrap gap-2">
            {nearby.map((location) => (
              <li key={location.id}>
                <Link
                  href={location.href}
                  className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:border-sky-600 dark:hover:bg-slate-800"
                >
                  {location.name}
                  <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                    {t("distanceKm", { value: Math.max(1, Math.round(location.distanceKm)) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {region.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t("regionTitle", { region: current.region })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {region.map((location) => (
              <li key={location.id}>
                <Link
                  href={location.href}
                  className="inline-flex min-h-11 items-center rounded-full border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-sm font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-sky-300 dark:hover:border-sky-600 dark:hover:bg-slate-800"
                >
                  {location.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
