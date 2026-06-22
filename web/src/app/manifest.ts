import type { MetadataRoute } from "next"

// PWA manifest — makes Hikari installable to the home screen with the same
// design (navy + banana). Icons reference the brand mark; swap in the kit's
// PNG icon set (192/512 + maskable) when it lands for crisp store-quality icons.
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
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
