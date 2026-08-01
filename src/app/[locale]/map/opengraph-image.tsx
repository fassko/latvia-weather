import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { getLocationPoints } from "@/lib/weather/fetch";
import { TEMPERATURE_LEGEND_BANDS } from "@/lib/weather/map-temp";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface MapOpenGraphImageProps {
  params: Promise<{ locale: string }>;
}

export default async function MapOpenGraphImage({
  params,
}: MapOpenGraphImageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "map" });
  const tMetadata = await getTranslations({ locale, namespace: "metadata" });

  let range: string | null = null;
  let locationCount = 0;

  try {
    const locations = await getLocationPoints();
    const temperatures = locations.map((location) => location.temperature);
    locationCount = locations.length;
    range = t("range", {
      min: Math.round(Math.min(...temperatures)),
      max: Math.round(Math.max(...temperatures)),
    });
  } catch {
    // Fall back to static branding when the forecast service is unavailable.
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px",
          background: "linear-gradient(135deg, #0ea5e9 0%, #0f172a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: 40 }}>
          <span>🗺️</span>
          <span style={{ fontWeight: 700 }}>{tMetadata("siteTitle")}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>
            {t("title")}
          </div>
          <div style={{ fontSize: 32, opacity: 0.9 }}>
            {locationCount > 0
              ? t("subtitle", { count: locationCount })
              : t("description")}
          </div>
          {range ? <div style={{ fontSize: 30, opacity: 0.82 }}>{range}</div> : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            {TEMPERATURE_LEGEND_BANDS.map((band) => (
              <div
                key={band.id}
                style={{
                  width: 64,
                  height: 16,
                  borderRadius: 8,
                  background: band.color,
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 26, opacity: 0.72 }}>LVĢMC</div>
        </div>
      </div>
    ),
    size,
  );
}
