import { ImageResponse } from "next/og";

const BRAND_GRADIENT = "linear-gradient(135deg, #0ea5e9, #0369a1)";

/**
 * Maskable icons are cropped to a circle by Android launchers, so the glyph is
 * kept inside the inner 80% safe zone and the background bleeds to the edges.
 */
export function renderAppIcon(size: number, maskable = false) {
  const glyphScale = maskable ? 0.46 : 0.62;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: BRAND_GRADIENT,
          borderRadius: maskable ? 0 : size * 0.22,
          fontSize: Math.round(size * glyphScale),
        }}
      >
        🌤️
      </div>
    ),
    { width: size, height: size },
  );
}
