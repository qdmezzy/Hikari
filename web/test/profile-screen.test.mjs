import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

// Render the actual view without auth, network calls, or any account writes.
const require = createRequire(import.meta.url)
const pass = ({ children }) => React.createElement(React.Fragment, null, children)
const modules = {
  "next/link": ({ children, ...props }) => React.createElement("a", props, children),
  "@/components/layout/Navigation": { Navigation: () => null },
  "@/components/common/ScrollReveal": { ScrollReveal: pass },
  "@/components/ui/button": { Button: ({ children, asChild, variant, ...props }) => asChild ? children : React.createElement("button", props, children) },
  "@/components/founding/FoundingName": { FoundingName: pass },
  "@/components/founding/FoundingBadge": { FoundingBadge: () => null },
  "@/lib/anilist": { getMediaHref: id => "/media/"+id },
}
const source = readFileSync(new URL("../src/components/profile/ProfileScreen.tsx", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
const exported = {}
vm.runInNewContext(compiled, { exports: exported, require: id => modules[id] || require(id), URL })
const profile = {
  name: "Test member", username: "test-member", website: "example.com", location: "", joinedDate: "September 2026", bio: "Anime and manga.",
  avatar: "", banner: "", isPremium: false, level: 2, xp: 100, xpToNext: 1000,
  stats: { totalEpisodes: 24, completed: 2, meanScore: 8, daysWatched: .4, currentStreak: 1, longestStreak: 2, rewatches: 0, planToWatch: 3, watching: 1, onHold: 0, dropped: 0 },
  favorites: [{ id: 100, title: "Favorite title", image: "/placeholder.svg", score: 8 }],
  recentActivity: [{ id: 101, anime: "Reading title", manga: true, episode: 12, status: "watching", image: "", time: "Sep 5" }],
  achievements: [],
}
function render(activeTab, patch = {}) {
  return renderToStaticMarkup(React.createElement(exported.ProfileScreen, { model: {
    profile: { ...profile, ...patch }, activeTab, setActiveTab() {}, xpPercentage: 10, sharingReady: true,
    topGenres: [{ name: "Action", count: 2 }], customLists: [{ id: "test-collection", name: "Weekend watches" }],
  } }))
}

test("profile overview keeps Japanese identity, favorites, and linked chapter activity", () => {
  const html = render("overview")
  assert.match(html, /lang="ja">プロフィール/)
  assert.match(html, /Favorite title/)
  assert.match(html, /href="\/media\/101"/)
  assert.match(html, /Chapter/)
  assert.match(html, /href="\/settings\?section=profile"/)
})

test("profile library links to real status filters and collections", () => {
  const html = render("lists")
  assert.match(html, /href="\/lists\?status=plan_to_watch"/)
  assert.match(html, /href="\/lists\/test-collection"/)
  assert.match(html, /Weekend watches/)
})

test("profile statistics label viewing time as an estimate", () => {
  const html = render("stats")
  assert.match(html, /Estimated days watched/)
  assert.match(html, /24 minutes per episode/)
  assert.doesNotMatch(html, /Moderator preview/)
})

test("profile website links accept HTTPS and reject executable URLs", () => {
  assert.match(render("overview"), /href="https:\/\/example.com\/"/)
  assert.doesNotMatch(render("overview", { website: "javascript:alert(1)" }), /href="[^"]*javascript:/)
})
