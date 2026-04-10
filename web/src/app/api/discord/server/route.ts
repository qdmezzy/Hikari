import { NextResponse } from "next/server";

const DEFAULT_GUILD_ID = "785953129820717066";
const INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "";
const GUILD_ID = process.env.NEXT_PUBLIC_DISCORD_SERVER_ID || DEFAULT_GUILD_ID;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const getGuildAssetUrl = (type: "icons" | "splashes" | "discovery-splashes", guildId: string, hash: string | null | undefined, size = 512) => {
  if (!guildId || !hash) return null;
  return `https://cdn.discordapp.com/${type}/${guildId}/${hash}.png?size=${size}`;
};

const parseInviteCode = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const directMatch = raw.match(/discord(?:app)?\.(?:gg|com\/invite)\/([A-Za-z0-9-]+)/i);
  if (directMatch?.[1]) return directMatch[1];

  if (/^[A-Za-z0-9-]+$/.test(raw)) return raw;
  return "";
};

const jsonHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  const inviteCode = parseInviteCode(INVITE_URL);

  let memberCount: number | null = null;
  let onlineCount: number | null = null;
  let guildName: string | null = null;
  let inviteUrl: string | null = INVITE_URL || null;
  let inviteCodeOut: string | null = inviteCode || null;
  let description: string | null = null;
  let iconUrl: string | null = null;
  let bannerUrl: string | null = null;

  try {
    if (inviteCode) {
      const inviteRes = await fetch(
        `https://discord.com/api/v9/invites/${inviteCode}?with_counts=true&with_expiration=true`,
        { cache: "no-store" }
      );

      if (inviteRes.ok) {
        const inviteJson = await inviteRes.json();
        memberCount = Number(inviteJson?.approximate_member_count || 0) || null;
        onlineCount = Number(inviteJson?.approximate_presence_count || 0) || null;
        guildName = inviteJson?.guild?.name || guildName;
        inviteUrl = inviteJson?.code ? `https://discord.gg/${inviteJson.code}` : inviteUrl;
        inviteCodeOut = inviteJson?.code || inviteCodeOut;
        description = inviteJson?.guild?.description || description;
        iconUrl =
          getGuildAssetUrl("icons", inviteJson?.guild?.id || GUILD_ID, inviteJson?.guild?.icon, 256) || iconUrl;
        bannerUrl =
          getGuildAssetUrl("discovery-splashes", inviteJson?.guild?.id || GUILD_ID, inviteJson?.guild?.discovery_splash, 1024) ||
          getGuildAssetUrl("splashes", inviteJson?.guild?.id || GUILD_ID, inviteJson?.guild?.splash, 1024) ||
          bannerUrl;
      }
    }

    if (memberCount == null || onlineCount == null) {
      const previewRes = await fetch(`https://discord.com/api/v9/guilds/${GUILD_ID}/preview`, {
        cache: "no-store",
      });

      if (previewRes.ok) {
        const previewJson = await previewRes.json();
        const previewMemberCount = Number(previewJson?.approximate_member_count || 0) || null;
        const previewOnlineCount = Number(previewJson?.approximate_presence_count || 0) || null;
        memberCount = memberCount ?? previewMemberCount;
        onlineCount = onlineCount ?? previewOnlineCount;
        guildName = previewJson?.name || guildName;
        description = previewJson?.description || description;
        iconUrl = getGuildAssetUrl("icons", previewJson?.id || GUILD_ID, previewJson?.icon, 256) || iconUrl;
        bannerUrl =
          getGuildAssetUrl("discovery-splashes", previewJson?.id || GUILD_ID, previewJson?.discovery_splash, 1024) ||
          getGuildAssetUrl("splashes", previewJson?.id || GUILD_ID, previewJson?.splash, 1024) ||
          bannerUrl;
      }
    }

    if (onlineCount == null) {
      const widgetRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/widget.json`, {
        cache: "no-store",
      });

      if (widgetRes.ok) {
        const widgetJson = await widgetRes.json();
        onlineCount = Number(widgetJson?.presence_count || 0) || null;
        memberCount =
          memberCount ??
          (Array.isArray(widgetJson?.members) ? widgetJson.members.length : null);
        guildName = widgetJson?.name || guildName;
        inviteUrl = widgetJson?.instant_invite || inviteUrl;
        iconUrl = widgetJson?.instant_invite ? iconUrl : iconUrl;
      }
    }
  } catch {
    // Fall through to the graceful fallback payload below.
  }

  return NextResponse.json(
    {
      guildId: GUILD_ID,
      guildName,
      inviteUrl,
      inviteCode: inviteCodeOut,
      memberCount,
      onlineCount,
      description,
      iconUrl,
      bannerUrl,
    },
    { headers: jsonHeaders }
  );
}
