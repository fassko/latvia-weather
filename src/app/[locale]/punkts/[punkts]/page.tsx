import type { Metadata } from "next";
import Home, { generateMetadata as generateHomeMetadata, type HomeProps } from "../../page";
import { isValidLocationId } from "@/lib/weather/locations";
import { getHourlyForecast, getLocationPoints } from "@/lib/weather/fetch";
import { localizedPath, locationIdFromSlug, locationSlug } from "@/lib/site";
import { notFound, permanentRedirect } from "next/navigation";

interface LocationPageProps {
  params: Promise<{ locale: string; punkts: string }>;
}

async function getLocationId(params: LocationPageProps["params"]): Promise<string | undefined> {
  const { punkts } = await params;
  // Accept existing ID and hybrid URLs so they can be permanently redirected
  // to the concise name-only canonical URL.
  const legacyLocationId = locationIdFromSlug(punkts);
  if (legacyLocationId && isValidLocationId(legacyLocationId)) return legacyLocationId;

  const matches = (await getLocationPoints()).filter(
    (location) => locationSlug(location.name) === punkts,
  );

  // Never silently choose the wrong forecast if the upstream source contains
  // two locations that normalize to the same readable path.
  return matches.length === 1 ? matches[0].id : undefined;
}

function asHomeProps({ params }: LocationPageProps, locationId: string): HomeProps {
  return {
    params: params.then(({ locale }) => ({ locale })),
    searchParams: Promise.resolve({ punkts: locationId }),
  };
}

export async function generateMetadata(props: LocationPageProps): Promise<Metadata> {
  const locationId = await getLocationId(props.params);
  if (!locationId) return {};
  return generateHomeMetadata(asHomeProps(props, locationId));
}

/** A concise, indexable URL based on the LVĢMC location name. */
export default async function LocationPage(props: LocationPageProps) {
  const [{ locale, punkts }, locationId] = await Promise.all([
    props.params,
    getLocationId(props.params),
  ]);
  if (!locationId) notFound();

  const data = await getHourlyForecast(locationId);
  const canonicalPath = localizedPath(
    locale,
    locationId === "P269" ? undefined : locationId,
    data.location.name,
  );

  if (`/${locale}/punkts/${punkts}` !== canonicalPath) {
    permanentRedirect(canonicalPath);
  }

  return Home(asHomeProps(props, locationId));
}
