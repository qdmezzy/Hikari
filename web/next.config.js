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
  async redirects() {
    return [
      { source: "/schedule", destination: "/calendar", permanent: true },
      // Temporary until the browser extension is ready. Remove this entry to restore its landing page.
      { source: "/extension", destination: "/discord-bot", permanent: false },
    ];
  },
};

module.exports = nextConfig;
