import assert from "node:assert/strict";
import test from "node:test";

import { createDiscordLinkToken } from "../src/lib/linkToken.js";

test("bot link tokens contain a signed, short-lived Discord identity", () => {
  const now = Date.UTC(2026, 6, 21, 12, 0, 0);
  const token = createDiscordLinkToken(
    { discordUserId: "123456789012345678", discordName: "mezzy" },
    "test-only-secret-with-at-least-32-bytes",
    { now, ttlSeconds: 300 },
  );
  const [payload, signature] = token.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  assert.equal(decoded.sub, "123456789012345678");
  assert.equal(decoded.name, "mezzy");
  assert.equal(decoded.exp - decoded.iat, 300);
  assert.ok(signature.length > 20);
});
