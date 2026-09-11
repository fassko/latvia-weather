import { DEFAULT_LOCATION_ID } from "@/lib/weather/locations";
import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderForecastOgImage,
} from "@/lib/seo/render-og-image";

export const alt = "Latvia Weather";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Must be a numeric literal for Next segment config static analysis.
export const revalidate = 900;

interface OpenGraphImageProps {
  params: Promise<{ locale: string }>;
}

/** Default locale OG image (no searchParams — Next only passes `params` here). */
export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { locale } = await params;
  return renderForecastOgImage({
    locale,
    punkts: DEFAULT_LOCATION_ID,
  });
}
