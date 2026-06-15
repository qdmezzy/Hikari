import { ImageResponse } from "next/og"

export const alt = "Hikari — Anime discovery & tracking"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0e131c 0%, #141b27 55%, #0b1018 100%)",
          color: "#e6ebf2",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 460,
            height: 460,
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(59,130,246,0.30), rgba(59,130,246,0))",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            right: -120,
            width: 460,
            height: 460,
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(34,211,238,0.22), rgba(34,211,238,0))",
          }}
        />
        <div style={{ display: "flex", fontSize: 112, fontWeight: 800, letterSpacing: -3, color: "#34c8ee" }}>
          Hikari
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 26, letterSpacing: 14, color: "#5b6b85" }}>
          ひかり
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: "#9aa6b8" }}>
          Discover, track &amp; share your anime
        </div>
      </div>
    ),
    { ...size },
  )
}
