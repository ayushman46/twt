import { ImageResponse } from "next/og";
import { LOGO_FULL_BLEED_DATA_URI } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Full-bleed flat twtdash mark; iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#3D5BD9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
        <img src={LOGO_FULL_BLEED_DATA_URI} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
