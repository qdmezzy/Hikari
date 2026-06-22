import "./globals.css"

import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google"
import { Toaster } from "sonner"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/context/AuthProvider"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { EmailVerificationBanner } from "@/components/common/EmailVerificationBanner"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

// Japanese accent typeface — used for kana/kanji flourishes throughout the app.
const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jp",
  display: "swap",
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hikari.raycodes.net"

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hikari — Anime Discovery & Tracking",
    template: "%s · Hikari",
  },
  description:
    "Discover what to watch next, track your progress, build lists, and import your anime from MyAnimeList & AniList — all in one clean, modern app.",
  applicationName: "Hikari",
  keywords: ["anime", "anime tracker", "anime list", "MyAnimeList", "AniList", "manga", "watchlist"],
  openGraph: {
    type: "website",
    siteName: "Hikari",
    url: siteUrl,
    title: "Hikari — Anime Discovery & Tracking",
    description: "Discover, track & share your anime. Import from MyAnimeList & AniList in one click.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hikari — Anime Discovery & Tracking",
    description: "Discover, track & share your anime.",
  },
  appleWebApp: {
    capable: true,
    title: "Hikari",
    statusBarStyle: "black-translucent",
  },
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1133" },
    { media: "(prefers-color-scheme: light)", color: "#faf6ea" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="force-motion" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} ${notoJp.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <EmailVerificationBanner />
            {children}
          </AuthProvider>
          <Toaster theme="system" position="bottom-right" richColors closeButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
