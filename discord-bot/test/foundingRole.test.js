import assert from "node:assert/strict";
import test from "node:test";

import { decideFoundingRoleSync } from "../src/lib/foundingRoleDecision.js";

const base = { configured: true, linked: true, memberPresent: true, membershipActive: true, hasRole: false };

test("active linked founders receive the configured role", () => {
  assert.deepEqual(decideFoundingRoleSync(base), { action: "add", reason: "active_founder" });
});

test("inactive or revoked founders have the role removed", () => {
  assert.deepEqual(decideFoundingRoleSync({ ...base, membershipActive: false, hasRole: true }), {
    action: "remove",
    reason: "inactive_founder",
  });
});

test("role synchronization fails closed for missing configuration, links, and guild membership", () => {
  assert.deepEqual(decideFoundingRoleSync({ ...base, configured: false }), {
    action: "none",
    reason: "not_configured",
  });
  assert.deepEqual(decideFoundingRoleSync({ ...base, linked: false }), { action: "none", reason: "not_linked" });
  assert.deepEqual(decideFoundingRoleSync({ ...base, memberPresent: false }), {
    action: "none",
    reason: "missing_member",
  });
});

test("already-correct role state does not create Discord churn", () => {
  assert.deepEqual(decideFoundingRoleSync({ ...base, hasRole: true }), { action: "none", reason: "already_synced" });
  assert.deepEqual(decideFoundingRoleSync({ ...base, membershipActive: false, hasRole: false }), {
    action: "none",
    reason: "already_synced",
  });
});
