const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const buildTrackedUrl = (baseUrl, pathname = "/", campaign = "sharing") => {
  const base = `${trimTrailingSlash(baseUrl)}/`;
  const url = new URL(String(pathname || "/"), base);
  url.searchParams.set("utm_source", "discord_bot");
  url.searchParams.set("utm_medium", "discord");
  url.searchParams.set("utm_campaign", String(campaign || "sharing"));
  return url.toString();
};

export const buildDiscordInviteUrl = (clientId, fallbackUrl) => {
  if (!clientId) return fallbackUrl;
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", String(clientId));
  url.searchParams.set("permissions", "379904");
  url.searchParams.set("scope", "bot applications.commands");
  return url.toString();
};
