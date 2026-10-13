import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const ICON_DATA_URI = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/brand/icon.png"),
).toString("base64")}`;

/**
 * Maskable icons are cropped to a circle by Android launchers, so the mark is
 * kept inside the inner ~80% safe zone and the background bleeds to the edges.
 *
 * The brand PNG is embedded as a data URI because next/og (Satori) cannot load
 * arbitrary local files by path.
 */
export function renderAppIcon(size: number, maskable = false) {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <SatoriBrandMark size={size} shape={maskable ? "square" : "rounded"} safe={maskable} />
      </div>
    ),
    { width: size, height: size },
  );
}

export function SatoriBrandMark({
  size,
  shape = "rounded",
  safe = false,
}: {
  size: number;
  shape?: "rounded" | "square";
  safe?: boolean;
}) {
  const inset = safe ? 0.8 : 1;
  const markSize = Math.round(size * inset);
  const offset = Math.round((size - markSize) / 2);
  const radius = shape === "rounded" ? Math.round(markSize * 0.23) : 0;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        overflow: "hidden",
        background: "linear-gradient(165deg, #2f78ff 0%, #1a68d8 48%, #004ca3 100%)",
      }}
    >
      <img
        alt=""
        src={ICON_DATA_URI}
        width={markSize}
        height={markSize}
        style={{
          position: "absolute",
          left: offset,
          top: offset,
          borderRadius: radius,
        }}
      />
    </div>
  );
}
