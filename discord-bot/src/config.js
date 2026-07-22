import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDiscordInviteUrl, buildTrackedUrl } from "./lib/urls.js";
import { createDiscordLinkToken } from "./lib/linkToken.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
dotenv.config({ path: path.join(projectRoot, ".env") });

const readEnv = (name, { required = false, fallback = "" } = {}) => {
  const value = process.env[name] ?? fallback;
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

// Discord link buttons require a fully-qualified http(s) URL. If the env value
// omits the scheme (e.g. "hikari.raycodes.net"), default it to https so buttons
// don't fail validation ("Received one or more errors").
const normalizeBaseUrl = (value, fallback) => {
  let url = trimTrailingSlash(value);
  if (!url) return fallback;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
};

const hikariWebBaseUrl = normalizeBaseUrl(readEnv("HIKARI_WEB_BASE_URL"), "http://localhost:3000");

export const config = {
  discordToken: readEnv("DISCORD_BOT_TOKEN", { required: true }),
  discordClientId: readEnv("DISCORD_CLIENT_ID", { required: true }),
  discordGuildId: readEnv("DISCORD_GUILD_ID"),
  supabaseUrl: readEnv("SUPABASE_URL", { required: true }),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY", { required: true }),
  discordLinkSigningSecret: readEnv("DISCORD_LINK_SIGNING_SECRET", { required: true }),
  discordSupportUrl: normalizeBaseUrl(readEnv("DISCORD_SUPPORT_URL"), ""),
  discordFoundingRoleId: readEnv("DISCORD_FOUNDING_ROLE_ID"),
  hikariWebBaseUrl,
  hikariLinkPath: readEnv("HIKARI_LINK_PATH", { fallback: "/discord/link" }),
};

export const buildHikariUrl = (pathname = "/", campaign = "sharing") =>
  buildTrackedUrl(config.hikariWebBaseUrl, pathname, campaign);

export const buildDiscordBotInviteUrl = () =>
  buildDiscordInviteUrl(config.discordClientId, buildHikariUrl("/discord-bot", "help"));

export const getDiscordSupportUrl = () =>
  config.discordSupportUrl || buildHikariUrl("/discord-bot", "help");

export const buildHikariLinkUrl = (discordUserId, discordName) => {
  const url = new URL(buildHikariUrl(config.hikariLinkPath, "help"));
  url.searchParams.set(
    "token",
    createDiscordLinkToken(
      { discordUserId, discordName },
      config.discordLinkSigningSecret,
    ),
  );
  return url.toString();
};
