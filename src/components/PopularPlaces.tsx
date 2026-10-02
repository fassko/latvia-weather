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

/** Crawlable city chips so location pages are not sitemap-only. */
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2
            id="popular-places-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {t("title")}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("subtitle")}</p>
        </div>
        <Link
          href="/about"
          className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
        >
          {t("aboutData")}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {popular.map((location) => {
          const isCurrent = location.id === currentLocationId;
          return (
            <li key={location.id}>
              <Link
                href={popularLocationHref(location.id, location.name)}
                className={
                  isCurrent
                    ? "inline-flex min-h-11 items-center rounded-full border border-sky-600 bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white dark:border-sky-400 dark:bg-sky-500 dark:text-slate-950"
                    : "inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:border-sky-600 dark:hover:bg-slate-800"
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
