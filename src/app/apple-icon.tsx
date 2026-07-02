import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0ea5e9, #0369a1)",
          borderRadius: 36,
          fontSize: 96,
        }}
      >
        🌤️
      </div>
    ),
    size,
  );
}
