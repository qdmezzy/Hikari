const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s1.anilist.co" },
      { protocol: "https", hostname: "s2.anilist.co" },
      { protocol: "https", hostname: "s3.anilist.co" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  async headers() {
    const noIndexRoutes = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/onboarding",
      "/profile",
      "/settings",
      "/lists/:path*",
      "/favorites",
      "/history",
      "/import",
      "/discord/link",
      "/founding/join",
      "/wrapped",
      "/banned",
      "/mod/:path*",
      "/community/:path*",
    ];
    return noIndexRoutes.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
    }));
  },
  async redirects() {
    const wrappedRedirects = process.env.NEXT_PUBLIC_ENABLE_WRAPPED === "true"
      ? []
      : [{ source: "/wrapped", destination: "/profile", permanent: false }];
    return [
      { source: "/schedule", destination: "/calendar", permanent: true },
      // Temporary until the browser extension is ready. Remove this entry to restore its landing page.
      { source: "/extension", destination: "/discord-bot", permanent: false },
      ...wrappedRedirects,
    ];
  },
};

module.exports = nextConfig;
