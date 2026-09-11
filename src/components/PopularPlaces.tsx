import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  pickPopularLocations,
  popularLocationHref,
} from "@/lib/seo/popular-locations";
import type { WeatherLocationPoint } from "@/lib/weather/types";

interface PopularPlacesProps {
  locations: WeatherLocationPoint[];
  currentLocationId?: string;
}

/** Crawlable city links so location pages are not sitemap-only. */
export async function PopularPlaces({
  locations,
  currentLocationId,
}: PopularPlacesProps) {
  const t = await getTranslations("popularPlaces");
  const popular = pickPopularLocations(locations);

  if (popular.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="popular-places-heading" className="space-y-2">
      <h2
        id="popular-places-heading"
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        {t("title")}
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t("subtitle")}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {popular.map((location) => {
          const isCurrent = location.id === currentLocationId;
          return (
            <li key={location.id}>
              <Link
                href={popularLocationHref(location.id, location.name)}
                className={
                  isCurrent
                    ? "font-semibold text-sky-800 underline dark:text-sky-300"
                    : "text-sky-700 underline decoration-sky-700/30 underline-offset-2 hover:decoration-sky-700 dark:text-sky-400 dark:decoration-sky-400/30 dark:hover:decoration-sky-400"
                }
                aria-current={isCurrent ? "page" : undefined}
              >
                {location.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
