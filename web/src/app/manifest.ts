import type { MetadataRoute } from "next"

// PWA manifest — makes Hikari installable to the home screen with the same
// design (navy + banana).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hikari — Anime Discovery & Tracking",
    short_name: "Hikari",
    description:
      "Discover what to watch next, track your progress, build lists, and import your anime from MyAnimeList & AniList.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1133",
    theme_color: "#0f1133",
    categories: ["entertainment", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
