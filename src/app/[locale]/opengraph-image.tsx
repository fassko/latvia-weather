import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { getOgImageGradient } from "@/lib/weather/header-theme";
import { getHourlyForecast } from "@/lib/weather/fetch";
import { resolveLocationId } from "@/lib/weather/locations";
import { getConditionEmoji, getConditionKey } from "@/lib/weather/parse";
import { formatWindSpeed } from "@/lib/weather/wind-units";
import type { HourlyForecast } from "@/lib/weather/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OpenGraphImageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ punkts?: string }>;
}

function findCurrentForecast(forecasts: HourlyForecast[]): HourlyForecast {
  const now = Date.now();
  const upcoming = forecasts.find((forecast) => forecast.time.getTime() >= now);
  return upcoming ?? forecasts[forecasts.length - 1];
}

export default async function OpenGraphImage({
  params,
  searchParams,
}: OpenGraphImageProps) {
  const { locale } = await params;
  const { punkts } = await searchParams;
  const locationId = resolveLocationId(punkts);
  const t = await getTranslations({ locale, namespace: "metadata" });
  const tConditions = await getTranslations({ locale, namespace: "conditions" });
  const tHeader = await getTranslations({ locale, namespace: "header" });

  let title = t("siteTitle");
  let subtitle = t("siteDescription");
  let emoji = "🌤️";
  let temperature: string | null = null;
  let condition = subtitle;
  let windLine: string | null = null;
  let background = getOgImageGradient("1101");

  try {
    const data = await getHourlyForecast(locationId);
    const current = findCurrentForecast(data.forecasts);

    title = data.location.name;
    subtitle = t("locationDescription", { name: data.location.name });
    emoji = getConditionEmoji(current.iconCode);
    temperature = `${Math.round(current.temperature)}°C`;
    condition = tConditions(getConditionKey(current.iconCode));
    windLine = `${tHeader("wind")}: ${formatWindSpeed(current.windSpeed, "ms")}`;
    background = getOgImageGradient(current.iconCode);
  } catch {
    // Fall back to generic site branding.
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
          background,
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: 40 }}>
          <span>{emoji}</span>
          <span style={{ fontWeight: 700 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {temperature ? (
              <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1 }}>{temperature}</div>
            ) : (
              <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>{subtitle}</div>
            )}
            <div style={{ fontSize: 32, opacity: 0.92 }}>{condition}</div>
            {windLine ? (
              <div style={{ fontSize: 28, opacity: 0.82 }}>{windLine}</div>
            ) : null}
          </div>
          <div style={{ fontSize: 28, opacity: 0.72 }}>LVĢMC</div>
        </div>
      </div>
    ),
    size,
  );
}
