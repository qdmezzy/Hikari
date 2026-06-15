import { getAnimeByIds, mediaTitle } from "../lib/anilist.js";
import { dbStatusLabels } from "../lib/status.js";
import { supabase } from "../lib/supabase.js";

const profileTable = "public_profiles";
const listTable = "list_entries";

const isMissingColumnError = (error, columnName) => {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return text.includes("does not exist") && text.includes(String(columnName || "").toLowerCase());
};

export const normalizeHandle = (value) =>
  String(value || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");

export const getProfileByHandle = async (handle) => {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;
  const { data, error } = await supabase.from(profileTable).select("*").eq("handle", normalized).maybeSingle();
  if (error) throw error;
  return data;
};

export const getProfileByUserId = async (userId) => {
  const { data, error } = await supabase.from(profileTable).select("*").eq("user_id", String(userId)).maybeSingle();
  if (error) throw error;
  return data;
};

export const getFavoriteMediaIds = async (userId) => {
  const profile = await getProfileByUserId(userId).catch(() => null);
  const ids = profile?.favorite_media_ids;
  return Array.isArray(ids) ? ids.map((id) => Number(id)).filter(Number.isFinite) : [];
};

export const getListEntriesByUser = async (userId, { statuses = [], limit = 100 } = {}) => {
  const baseQuery = (selectFields) => {
    let query = supabase
      .from(listTable)
      .select(selectFields)
      .eq("user_id", String(userId))
      .eq("media_type", "ANIME")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (Array.isArray(statuses) && statuses.length) {
      query = query.in("status", statuses);
    }

    return query;
  };

  const primary = await baseQuery("id, user_id, media_id, media_type, status, progress, updated_at, created_at");
  if (!primary.error) return primary.data || [];
  if (!isMissingColumnError(primary.error, "created_at")) throw primary.error;

  const fallback = await baseQuery("id, user_id, media_id, media_type, status, progress, updated_at");
  if (fallback.error) throw fallback.error;
  return fallback.data || [];
};

export const getListCounts = (entries) => {
  const counts = {
    watching: 0,
    completed: 0,
    dropped: 0,
    on_hold: 0,
    plan_to_watch: 0,
    rewatching: 0,
  };

  for (const entry of entries || []) {
    const key = String(entry?.status || "");
    if (key in counts) counts[key] += 1;
  }

  return counts;
};

export const getTopGenres = async (entries, take = 3) => {
  const ids = Array.from(new Set((entries || []).map((entry) => Number(entry?.media_id)).filter(Number.isFinite))).slice(
    0,
    30,
  );
  if (!ids.length) return [];

  const media = await getAnimeByIds(ids);
  const scoreByGenre = {};
  for (const item of media) {
    for (const genre of item?.genres || []) {
      const key = String(genre || "").trim();
      if (!key) continue;
      scoreByGenre[key] = (scoreByGenre[key] || 0) + 1;
    }
  }

  return Object.entries(scoreByGenre)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([name]) => name);
};

export const buildWatchingLine = async (entries) => {
  const active = (entries || []).find((entry) => ["watching", "rewatching"].includes(String(entry.status)));
  if (!active) return "Nothing currently in progress";
  const media = await getAnimeByIds([active.media_id]);
  const item = media?.[0];
  const progress = Number(active.progress || 0);
  return `${mediaTitle(item)} - Ep ${progress}`;
};

export const buildListPreview = async (entries, max = 10) => {
  const slice = (entries || []).slice(0, max);
  const media = await getAnimeByIds(slice.map((row) => row.media_id));
  const mediaMap = new Map(media.map((item) => [item.id, item]));
  return slice.map((row) => {
    const item = mediaMap.get(Number(row.media_id));
    const title = mediaTitle(item);
    const statusLabel = dbStatusLabels[row.status] || row.status;
    return {
      mediaId: row.media_id,
      title,
      status: statusLabel,
      progress: Number(row.progress || 0),
    };
  });
};
