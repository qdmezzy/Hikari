# Hikari — Mobile

iOS-first React Native (Expo) app for Hikari. Shares the same Supabase backend
and AniList GraphQL catalog as the [web app](../web), and mirrors its design
language: dark-first glacier palette, glassmorphism, gradient brand text, kana
flourishes (ヒカリ / 視聴中), and animated sparkles.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Expo (React Native) + expo-router (file-based) |
| Language | TypeScript |
| Styling | Hand-rolled design tokens (no NativeWind) — see `src/theme` |
| Data | AniList GraphQL (direct), Supabase (auth + `list_entries`) |
| Animation | react-native-reanimated, expo-linear-gradient, expo-blur |
| Fonts | Geist (sans) + Noto Sans JP (kana) — bundled in `assets/fonts` |

## Design system

The token files in `src/theme/` are a 1:1 port of the web app's
`globals.css` oklch palette, converted to hex (RN doesn't support oklch).
Each color has a comment with the original oklch value so the two surfaces
can stay in sync.

- `tokens.ts` — colors (dark/light), radii, spacing, type scale, easing
- `ThemeProvider.tsx` — theme context + `useTheme()` hook (dark by default)
- `src/components/primitives/` — `Text`, `Button`, `Card`, `Badge`, `Sparkle`

Signature patterns ported from the web:
- `.glass-card` → `Card glass` prop (BlurView + translucent tint)
- `.text-brand` → `Text brand` prop (solid primary on native)
- `.brand-glow` → `<BrandGlow />` component
- `font-jp` kana labels → `Text jp` prop (Noto Sans JP)
- gradient progress bars → `LinearGradient` (primary → accent → primary)

## Screens

| Route | What |
| --- | --- |
| `(tabs)/index` | Home — rotating featured hero, search, continue watching, trending, airing schedule |
| `(tabs)/discover` | TikTok-style vertical trailer feed with vibe filters (For You / Hype / Action / Chill / Dark / Romance) |
| `(tabs)/search` | Browse + search with genre chips, 3-col grid |
| `(tabs)/lists` | My lists — 6 state chips (watching/completed/…), sign-in gate |
| `(tabs)/calendar` | Seasonal airing schedule grouped by day |
| `anime/[id]` | Detail — banner hero, genres, synopsis, streaming link, next-ep alert |

## Getting started

```bash
cd mobile
cp .env.example .env  # optional — fill in Supabase creds for auth/tracking
npm install --legacy-peer-deps
npm run ios
```

The app runs in browse-only mode without Supabase credentials — the AniList
catalog, discover feed, search, and schedule all work; only list tracking and
continue-watching require sign-in.

## Notes

- `--legacy-peer-deps` is needed because `react-native-web` pins an older
  react-dom peer range; it doesn't affect native builds.
- Fonts are committed directly in `assets/fonts/` (Geist from Vercel, Noto
  Sans JP from Google Noto) so there's no runtime fetch or git dependency.
