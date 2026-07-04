import { ImageResponse } from "next/og"
import { fetchMediaMeta } from "./media-meta"

export const alt = "Anime details on Hikari"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const NAVY = "#0f1133"
const NAVY_SOFT = "#1a1e4a"
const BANANA = "#f2d16b"
const CREAM = "#f7f0d8"

export default async function MediaOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const media = await fetchMediaMeta(id)

  if (!media) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_SOFT} 100%)`,
            color: CREAM,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -2,
          }}
        >
          HIKARI
        </div>
      ),
      { ...size },
    )
  }

  const scoreLabel = media.score ? `★ ${(media.score / 10).toFixed(1)}` : ""
  const countLabel =
    media.type === "Manga"
      ? media.chapters
        ? `${media.chapters} chapters`
        : ""
      : media.episodes
        ? `${media.episodes} episodes`
        : ""
  const metaLine = [media.type, media.year ? String(media.year) : "", countLabel].filter(Boolean).join("  ·  ")

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(120deg, ${NAVY} 0%, ${NAVY_SOFT} 70%, ${NAVY} 100%)`,
          color: CREAM,
          padding: 56,
          alignItems: "center",
        }}
      >
        {media.cover ? (
          <img
            src={media.cover}
            width={340}
            height={510}
            style={{
              borderRadius: 20,
              objectFit: "cover",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            }}
          />
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 56,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: BANANA, letterSpacing: 6 }}>
            HIKARI
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: media.title.length > 40 ? 52 : 64,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            {media.title.length > 70 ? `${media.title.slice(0, 67)}…` : media.title}
          </div>
          {metaLine ? (
            <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: "#aab0d8" }}>{metaLine}</div>
          ) : null}
          <div style={{ display: "flex", marginTop: 20, alignItems: "center", gap: 16 }}>
            {scoreLabel ? (
              <div
                style={{
                  display: "flex",
                  background: BANANA,
                  color: NAVY,
                  fontSize: 30,
                  fontWeight: 800,
                  padding: "8px 22px",
                  borderRadius: 999,
                }}
              >
                {scoreLabel}
              </div>
            ) : null}
            {media.genres.map((genre) => (
              <div
                key={genre}
                style={{
                  display: "flex",
                  border: `2px solid ${BANANA}55`,
                  color: CREAM,
                  fontSize: 26,
                  padding: "6px 20px",
                  borderRadius: 999,
                }}
              >
                {genre}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
