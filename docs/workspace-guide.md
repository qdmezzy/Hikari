# Workspace map

## Active app

`web/` is the current Next.js application. Run it from that directory with `npm run dev`; the intended preview is http://localhost:3000. Do not start the separate `hikari-new/` prototype when working on this redesign.

- `web/src/components/moderation/ModerationWorkspace.jsx`: unified moderation interface, including the access gate.
- `web/src/app/moderation.css`: moderation-only visual system.
- `web/src/app/mod/`: thin entry routes for that shared workspace.
- `web/src/components/discover/DiscoverScreen.tsx`: immersive discovery presentation.
- `docs/product-roadmap.md`: current improvement and promotion proposals.
- `docs/archive/legacy-bug-report.md`: earlier findings, retained for reference rather than treated as current facts.

## Cleanup performed in this pass

- Replaced the old moderation page implementations with shared workspace entry routes.
- Removed the unused duplicate `ModNavigation.jsx` component. Git history retains the previous version.
- Removed the unreferenced Founding roster/member screens and membership lookup hooks. These source files remain recoverable from Git history.
- Retired the Founding 25 entry screens and removed its navigation/sitemap entry. Badge/name compatibility components keep existing callers working without presenting the program.
- Moved the loose root `fixes` notes into the documentation archive; contents preserved.

## Deliberately retained

`hikari-new/`, `mobile/`, `Hikari Extension/`, and `discord-bot/` are separate projects, not disposable build output. Their code, installed dependencies, environment files, and active logs were not deleted. Neither were Supabase records or Founding backend/migration history. Decommissioning the old program's API and Discord role behavior is a separate coordinated backend change.

Do not clear `.next/` while the dev server is using it. Build caches and runtime logs are already ignored. There is no benefit to deleting them merely to make the directory look tidier during active development.

## Verification

From `web/`: `npm run typecheck`, `npm test`, and `npm run build`. Browser checks of protected pages require a suitable signed-in account. Never add an authentication bypass or mutate real accounts just to get a screenshot.
