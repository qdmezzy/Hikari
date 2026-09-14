import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const require = createRequire(import.meta.url)
const source = readFileSync(new URL("../src/components/moderation/ModerationWorkspace.jsx", import.meta.url), "utf8")
const compiled = ts.transpileModule(source + "\nexport { Workspace };", { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
const member = { id: "test-mod", app_metadata: { is_mod: true } }

// Isolated server renders only. No production auth bypass, network calls, or writes.
function render({ user = member, loading = false, section = "reports", rows = [], selected = null, gate = false } = {}) {
  let state = 0
  const states = [section, rows, false, "", "", "", "all", selected]
  const modules = {
    "./DecisionNotes": { DecisionNotes: () => null },
    react: { ...React, useState: (initial) => [state < states.length ? states[state++] : (state++, typeof initial === "function" ? initial() : initial), () => {}] },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "@/hooks/useAuth": () => ({ user, loading }),
    "@/components/common/RequireAuth": ({ children }) => user ? children : React.createElement("p", null, "Authentication required"),
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map((key) => [key, () => null])),
    "@/lib/admin-service": {},
    "@/lib/community-content-service": {},
  }
  const exported = {}
  vm.runInNewContext(compiled, { exports: exported, require: (id) => modules[id] || require(id), URLSearchParams, setInterval, clearInterval })
  return renderToStaticMarkup(React.createElement(gate ? exported.default : exported.Workspace, { user, initialSection: section }))
}

test("moderation gate rejects guests and mutable user-metadata role claims", () => {
  assert.match(render({ user: null, gate: true }), /Authentication required/)
  assert.match(render({ user: { id: "guest", user_metadata: { is_mod: true } }, gate: true }), /Moderators only/)
  assert.match(render({ loading: true, gate: true }), /Checking moderator access/)
  assert.match(render({ gate: true }), /Report queue/)
})

test("community desk has one navigation and no Founding 25 entry", () => {
  const html = render()
  for (const title of ["Report queue", "Appeals", "Feedback", "People", "Announcements", "Forum threads", "Decision log", "Insights", "Workspace"]) assert.match(html, new RegExp(title))
  assert.doesNotMatch(html, /Founding|Quick actions|bg-gradient/)
  assert.match(html, /Context before action/)
  assert.match(html, /Nothing waiting here/)
})

test("report detail includes evidence and only supported actions", () => {
  const row = { id: "report-1", key: "report:report-1", kind: "report", status: "pending", target_type: "social_post", post_id: "post-1", reason: "Unmarked spoiler", social_posts: { content: "Test evidence" } }
  const html = render({ rows: [row], selected: row.key })
  assert.match(html, /Test evidence/)
  assert.match(html, /Unmarked spoiler/)
  assert.match(html, /Mark spoiler/)
  assert.match(html, /Remove content/)
  const history = render({ section: "history", rows: [{ ...row, status: "resolved" }], selected: row.key })
  assert.doesNotMatch(history, />Remove content</)
})

test("unsupported report targets do not offer a misleading remove action", () => {
  const row = { id: "report-2", key: "report:report-2", kind: "report", target_type: "user", target_id: "u-1" }
  assert.doesNotMatch(render({ rows: [row], selected: row.key }), />Remove content</)
})

test("self and unavailable roles do not offer role or ban changes", () => {
  for (const row of [{ id: member.id, rolesAvailable: true }, { id: "other", rolesAvailable: false }]) {
    const item = { ...row, key: `users:${row.id}`, kind: "users", displayName: "Member" }
    assert.doesNotMatch(render({ section: "users", rows: [item], selected: item.key }), />Make moderator<|>Ban account</)
  }
})

test("insights explicitly label snapshot limits and settings have no fake automation", () => {
  assert.match(render({ section: "stats" }), /maximum 300/)
  const html = render({ section: "settings" })
  assert.match(html, /Refresh every minute/)
  assert.match(html, /Safety stays on/)
  assert.doesNotMatch(html, /Escalate repeat offenders/)
})
