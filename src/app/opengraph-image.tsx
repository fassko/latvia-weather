import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0284c7 0%, #0f172a 100%)",
          color: "white",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ fontSize: "76px" }}>☀️</div>
          <div style={{ fontSize: "32px", opacity: 0.82 }}>Latvia Weather</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ maxWidth: "850px", fontSize: "82px", fontWeight: 800 }}>
            Hourly weather forecast for Latvia
          </div>
          <div style={{ marginTop: "28px", fontSize: "34px", opacity: 0.82 }}>
            Temperature, precipitation, wind, and daily outlooks
          </div>
        </div>
        <div style={{ fontSize: "26px", opacity: 0.72 }}>Data from LVGMC</div>
      </div>
    ),
    size,
  );
}
