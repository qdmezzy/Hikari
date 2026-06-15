import { getLinkByDiscordId } from "./links.js";
import { getProfileByHandle, getProfileByUserId, normalizeHandle } from "./profiles.js";

export const resolveTarget = async ({
  requesterDiscordId,
  mentionDiscordId,
  username,
  requireLinkedSelf = false,
}) => {
  if (username) {
    const profile = await getProfileByHandle(username);
    if (!profile) {
      return { ok: false, message: `Could not find a Hikari profile for @${normalizeHandle(username)}.` };
    }
    return {
      ok: true,
      target: {
        hikariUserId: profile.user_id,
        handle: profile.handle,
        profile,
      },
    };
  }

  if (mentionDiscordId) {
    const link = await getLinkByDiscordId(mentionDiscordId);
    if (!link?.hikari_user_id) {
      return { ok: false, message: "That Discord user has not linked their Hikari account yet." };
    }
    const profile = await getProfileByUserId(link.hikari_user_id);
    return {
      ok: true,
      target: {
        hikariUserId: link.hikari_user_id,
        handle: profile?.handle || link.hikari_username || null,
        profile: profile || null,
      },
    };
  }

  const selfLink = await getLinkByDiscordId(requesterDiscordId);
  if (!selfLink?.hikari_user_id) {
    const fallback = requireLinkedSelf
      ? "Your account is not linked. Use /link first."
      : "Not linked. Use /link or /profile <username>.";
    return { ok: false, message: fallback };
  }

  const profile = await getProfileByUserId(selfLink.hikari_user_id);
  return {
    ok: true,
    target: {
      hikariUserId: selfLink.hikari_user_id,
      handle: profile?.handle || selfLink.hikari_username || null,
      profile: profile || null,
    },
  };
};

