import assert from "node:assert/strict";
import test from "node:test";

import { buildDiscordInviteUrl, buildTrackedUrl } from "../src/lib/urls.js";

test("buildTrackedUrl preserves route parameters and adds Discord attribution", () => {
  const url = new URL(buildTrackedUrl("https://hikari.example/", "/discover?focus=42", "recommendations"));

  assert.equal(url.origin, "https://hikari.example");
  assert.equal(url.pathname, "/discover");
  assert.equal(url.searchParams.get("focus"), "42");
  assert.equal(url.searchParams.get("utm_source"), "discord_bot");
  assert.equal(url.searchParams.get("utm_medium"), "discord");
  assert.equal(url.searchParams.get("utm_campaign"), "recommendations");
});

test("buildDiscordInviteUrl uses the configured application id", () => {
  const url = new URL(buildDiscordInviteUrl("123456", "https://hikari.example/discord-bot"));

  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.searchParams.get("client_id"), "123456");
  assert.equal(url.searchParams.get("scope"), "bot applications.commands");
});

test("buildDiscordInviteUrl falls back to the landing page without a client id", () => {
  assert.equal(buildDiscordInviteUrl("", "https://hikari.example/discord-bot"), "https://hikari.example/discord-bot");
});
