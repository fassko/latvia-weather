import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 8,
          fontSize: 20,
        }}
      >
        🌤️
      </div>
    ),
    size,
  );
}
