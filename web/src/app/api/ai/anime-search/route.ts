import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AniListMedia = {
  id: number;
  title?: { english?: string | null; romaji?: string | null; native?: string | null } | null;
  coverImage?: { large?: string | null } | null;
  averageScore?: number | null;
  genres?: string[] | null;
  tags?: { name: string; rank?: number | null }[] | null;
  format?: string | null;
  episodes?: number | null;
  popularity?: number | null;
  season?: string | null;
  seasonYear?: number | null;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type LlmPlan = {
  assistant_reply: string;
  should_search: boolean;
  query_text: string;
  like_title: string | null;
  include_genres: string[];
  exclude_genres: string[];
  include_tags: string[];
  exclude_tags: string[];
  format_in: string[];
  max_episodes: number | null;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_REFERER =
  process.env.OPENROUTER_REFERER || process.env.NEXTAUTH_URL || "http://localhost:3000";
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || "Hikari";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let openAiQuotaExceeded = false;

type LlmProvider = {
  name: "openai" | "openrouter";
  apiKey: string;
  model: string;
  endpoint: string;
  extraHeaders?: Record<string, string>;
};

type HikariContext = {
  user_id: string | null;
  list_summary?: {
    total_titles: number;
    completed: number;
    watching: number;
    plan_to_watch: number;
    dropped: number;
    on_hold: number;
    recent_media_ids: number[];
  };
  taste_summary?: {
    top_genres: string[];
    top_tags: string[];
    not_interested_count: number;
  };
  client_summary?: {
    top_genres?: string[];
    top_tags?: string[];
    list_summary?: Record<string, number>;
    not_interested_count?: number;
    last_results?: Array<{
      title: string;
      genres: string[];
      tags: string[];
    }>;
  };
};

const SEARCH_QUERY = `
query (
  $search: String,
  $page: Int,
  $perPage: Int,
  $genreIn: [String],
  $genreNotIn: [String],
  $tagIn: [String],
  $tagNotIn: [String],
  $formatIn: [MediaFormat],
  $episodesLesser: Int
) {
  Page(page: $page, perPage: $perPage) {
    media(
      type: ANIME,
      search: $search,
      sort: POPULARITY_DESC,
      genre_in: $genreIn,
      genre_not_in: $genreNotIn,
      tag_in: $tagIn,
      tag_not_in: $tagNotIn,
      format_in: $formatIn,
      episodes_lesser: $episodesLesser,
      isAdult: false
    ) {
      id
      title { romaji english native }
      coverImage { large }
      averageScore
      genres
      tags { name rank }
      format
      episodes
      popularity
      season
      seasonYear
    }
  }
}
`;

const SEED_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 5) {
    media(type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
      id
      title { romaji english native }
      genres
      tags { name rank }
    }
  }
}
`;

const RECS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    recommendations(sort: RATING_DESC, perPage: 30) {
      nodes {
        mediaRecommendation {
          id
          title { romaji english native }
          coverImage { large }
          averageScore
          genres
          tags { name rank }
          format
          episodes
          popularity
          season
          seasonYear
        }
      }
    }
  }
}
`;

const normalize = (s: string) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const GREETING_RE = /^(hi+|hello+|hey+|yo+|sup+|what'?s up)\b/i;
const HELP_RE = /^(help|\?)$/i;
const DISLIKE_RE =
  /\b(i\s+don'?t\s+like|i\s+do\s+not\s+like|not\s+into|don'?t\s+really\s+like|didn'?t\s+like|not\s+those|something\s+else|different\s+ones?)\b/i;
const WATCH_REQUEST_RE =
  /\b(recommend|suggest|find me|give me|what should i watch|something like|similar to|more like|picks?|need anime)\b/i;
const CHAT_INFO_RE =
  /\b(explain|why|what makes|thoughts|opinion|analy[sz]e|review|meaning|themes?|character|ending|plot|story|talk about)\b/i;

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

const normalizeRole = (role: string | undefined): "user" | "assistant" =>
  role === "assistant" ? "assistant" : "user";

const extractMentionedTitle = (message: string) => {
  const raw = String(message || "").trim();
  const cleaned = raw
    .replace(/^(can you|could you|please|why|what|how|is|are)\s+/i, "")
    .replace(/\?+$/g, "")
    .trim();
  if (!cleaned) return null;
  const titleLike = cleaned
    .replace(/\b(people|like|about|think|good|great|bad|better|best)\b/gi, "")
    .trim();
  return titleLike.length >= 2 ? titleLike : null;
};

const fallbackChatReply = (message: string) => {
  const text = normalize(message);
  if (/\b(love|like|good|great|fire|peak|amazing)\b/.test(text)) {
    const titleFromCopula = String(message || "")
      .match(/^(.+?)\s+(is|was|seems)\s+/i)?.[1]
      ?.trim();
    const maybeTitle = titleFromCopula || extractMentionedTitle(message);
    if (maybeTitle) {
      return `${maybeTitle} has strong appeal. If you tell me what you liked most (fights, characters, worldbuilding, pacing), I can tailor better picks.`;
    }
    return "That makes sense. Tell me what you liked most (fights, characters, worldbuilding, pacing), and I will tailor picks.";
  }
  if (/\b(why|explain|what makes)\b/.test(text)) {
    const maybeTitle = extractMentionedTitle(message);
    if (maybeTitle) {
      return `People usually like ${maybeTitle} for character growth, emotional payoff, and memorable moments. If you want, I can break down themes, writing style, and similar anime.`;
    }
    return "People usually connect through character growth, emotional payoff, pacing, and tone. Name one anime and I can break down exactly why it works.";
  }
  if (/\b(hello|hey|hi|yo)\b/.test(text)) {
    return "Hey. Tell me an anime mood or title and I will chat about it or find similar picks.";
  }
  return "I can still help right now. Tell me an anime/title and what you want more or less of (darker, less romance, short, etc.).";
};

const isLikelyInfoChat = (message: string, normalizedMessage: string) => {
  const asksQuestion = /\?\s*$/.test(message) || /^(why|what|how|who|when)\b/i.test(normalizedMessage);
  const hasInfoSignal = CHAT_INFO_RE.test(normalizedMessage);
  const hasWatchSignal = WATCH_REQUEST_RE.test(normalizedMessage) || DISLIKE_RE.test(normalizedMessage);
  return !hasWatchSignal && (hasInfoSignal || asksQuestion);
};

const HIKARI_KNOWLEDGE = [
  "Hikari has AI Picks, Discover, Search, Dashboard, Social, and profile sharing with privacy toggles.",
  "When recommending anime, avoid titles already watched, planned, or hidden as not interested.",
  "Use short explanations and offer follow-up refinement questions when user asks broad requests.",
  "If user asks to save/add, suggest using Add to plan in the UI and keep recommendations aligned with prior likes/dislikes.",
  "When user gives constraints like no romance/short/darker, preserve those constraints in returned results.",
];

const retrieveHikariKnowledge = (text: string) => {
  const query = normalize(text);
  const scored = HIKARI_KNOWLEDGE.map((item) => {
    const tokens = normalize(item).split(" ").filter(Boolean);
    const score = tokens.reduce((sum, token) => (query.includes(token) ? sum + 1 : sum), 0);
    return { item, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.item);
  return scored.length ? scored : HIKARI_KNOWLEDGE.slice(0, 2);
};

const topKeys = (weights: Record<string, unknown>, limit: number) =>
  Object.entries(weights || {})
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([key]) => key);

const extractLastResultsExclusions = (ctx: HikariContext["client_summary"]) => {
  const rows = Array.isArray(ctx?.last_results) ? ctx!.last_results : [];
  if (!rows.length) return { genres: [] as string[], tags: [] as string[] };

  const genreCount: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  rows.forEach((row) => {
    (row?.genres || []).forEach((genre) => {
      const key = String(genre || "").trim();
      if (!key) return;
      genreCount[key] = (genreCount[key] || 0) + 1;
    });
    (row?.tags || []).forEach((tag) => {
      const key = String(tag || "").trim();
      if (!key) return;
      tagCount[key] = (tagCount[key] || 0) + 1;
    });
  });

  const genres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);
  const tags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  return { genres, tags };
};

const getVerifiedUserId = async (accessToken: string | null): Promise<string | null> => {
  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data?.user?.id) return null;
  return data.user.id;
};

const buildServerHikariContext = async (
  userId: string | null,
): Promise<Pick<HikariContext, "list_summary" | "taste_summary">> => {
  if (!userId || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return {};

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [
    { data: entries },
    { data: taste },
    { data: hidden },
  ] = await Promise.all([
    admin
      .from("list_entries")
      .select("media_id, status, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(2000),
    admin
      .from("user_taste_profiles")
      .select("genre_weights, tag_weights")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("user_not_interested_media")
      .select("media_id", { count: "exact" })
      .eq("user_id", userId),
  ]);

  const safeEntries = Array.isArray(entries) ? entries : [];
  const listSummary = {
    total_titles: safeEntries.length,
    completed: safeEntries.filter((entry) => entry?.status === "completed").length,
    watching: safeEntries.filter((entry) => entry?.status === "watching" || entry?.status === "rewatching").length,
    plan_to_watch: safeEntries.filter((entry) => entry?.status === "plan_to_watch").length,
    dropped: safeEntries.filter((entry) => entry?.status === "dropped").length,
    on_hold: safeEntries.filter((entry) => entry?.status === "on_hold").length,
    recent_media_ids: safeEntries
      .slice(0, 25)
      .map((entry) => Number(entry?.media_id))
      .filter((id) => Number.isFinite(id)),
  };

  const topGenres = topKeys((taste as any)?.genre_weights || {}, 5);
  const topTags = topKeys((taste as any)?.tag_weights || {}, 5);
  const notInterestedCount = Array.isArray(hidden) ? hidden.length : 0;

  return {
    list_summary: listSummary,
    taste_summary: {
      top_genres: topGenres,
      top_tags: topTags,
      not_interested_count: notInterestedCount,
    },
  };
};

const buildLlmPlan = (raw: any): LlmPlan => ({
  assistant_reply:
    typeof raw?.assistant_reply === "string" && raw.assistant_reply.trim()
      ? raw.assistant_reply.trim()
      : "Got it. I can help you find anime. Tell me the vibe you want.",
  should_search: Boolean(raw?.should_search),
  query_text: typeof raw?.query_text === "string" ? raw.query_text.trim() : "",
  like_title: typeof raw?.like_title === "string" && raw.like_title.trim() ? raw.like_title.trim() : null,
  include_genres: uniq(toStringArray(raw?.include_genres)),
  exclude_genres: uniq(toStringArray(raw?.exclude_genres)),
  include_tags: uniq(toStringArray(raw?.include_tags)),
  exclude_tags: uniq(toStringArray(raw?.exclude_tags)),
  format_in: uniq(
    toStringArray(raw?.format_in).map((item) => item.toUpperCase()),
  ),
  max_episodes:
    Number.isFinite(Number(raw?.max_episodes)) && Number(raw?.max_episodes) > 0
      ? Math.min(Math.round(Number(raw.max_episodes)), 1000)
      : null,
});

const getLlmProviders = (): LlmProvider[] => {
  const providers: LlmProvider[] = [];
  if (OPENAI_API_KEY && !openAiQuotaExceeded) {
    providers.push({
      name: "openai",
      apiKey: OPENAI_API_KEY,
      model: OPENAI_CHAT_MODEL,
      endpoint: "https://api.openai.com/v1/chat/completions",
    });
  }
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: "openrouter",
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL,
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      extraHeaders: {
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": OPENROUTER_APP_NAME,
      },
    });
  }
  return providers;
};

const callProviderChatCompletion = async (
  provider: LlmProvider,
  body: Record<string, unknown>,
): Promise<any | null> => {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const providerLabel = provider.name === "openrouter" ? "OpenRouter" : "OpenAI";
    console.error(`${providerLabel} request failed:`, response.status, errorText.slice(0, 500));
    if (provider.name === "openai" && response.status === 429 && /insufficient_quota/i.test(errorText)) {
      openAiQuotaExceeded = true;
    }
    return null;
  }

  return response.json().catch(() => null);
};

const callOpenAiChatReply = async (
  message: string,
  history: ChatTurn[],
  hikariContext: HikariContext,
): Promise<string | null> => {
  const providers = getLlmProviders();
  if (!providers.length) return null;

  const kb = retrieveHikariKnowledge(message);
  const messages = [
    {
      role: "system",
      content: [
        "You are Hikari AI, an anime assistant inside the Hikari app.",
        "Chat naturally like ChatGPT about anime and recommendations.",
        "Keep responses concise (max 90 words), useful, and friendly.",
        "If user asks for recommendations, ask one clarifying question unless constraints are already clear.",
        "If user rejects prior picks, acknowledge and ask what to avoid or what vibe they want.",
      ].join(" "),
    },
    {
      role: "system",
      content: `Hikari context: ${JSON.stringify(hikariContext).slice(0, 1800)}`,
    },
    {
      role: "system",
      content: `Relevant Hikari knowledge: ${kb.join(" | ")}`,
    },
    ...history.slice(-12).map((turn) => ({
      role: normalizeRole(turn.role),
      content: String(turn.content || "").slice(0, 1000),
    })),
    {
      role: "user",
      content: message.slice(0, 1200),
    },
  ];

  for (const provider of providers) {
    const json = await callProviderChatCompletion(provider, {
      model: provider.model,
      temperature: 0.5,
      messages,
    });
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (trimmed) return trimmed;
  }

  return null;
};

const callOpenAiPlanner = async (
  message: string,
  history: ChatTurn[],
  hikariContext: HikariContext,
): Promise<LlmPlan | null> => {
  const providers = getLlmProviders();
  if (!providers.length) return null;

  const kb = retrieveHikariKnowledge(message);
  const systemPrompt = [
    "You are Hikari AI, the in-app anime assistant for the Hikari product.",
    "Goal: understand free-form chat and return a JSON plan for anime search.",
    "Be conversational like ChatGPT, but concise and actionable.",
    "If user is just chatting, set should_search=false and provide assistant_reply.",
    "If user asks to explain/discuss an anime (why people like it, themes, characters), set should_search=false.",
    "If user asks for anime recommendations, set should_search=true and fill filters.",
    "Use short, clear assistant_reply in casual style.",
    "Use these format enums only when relevant: TV, MOVIE, OVA, ONA, TV_SHORT, SPECIAL.",
    "Respect user context and avoid recommending already watched/planned/hidden content when possible.",
    "Do not invent long explanations.",
  ].join(" ");

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content: `Hikari context: ${JSON.stringify(hikariContext).slice(0, 1800)}`,
    },
    {
      role: "system",
      content: `Relevant Hikari knowledge: ${kb.join(" | ")}`,
    },
    ...history.slice(-10).map((turn) => ({
      role: normalizeRole(turn.role),
      content: String(turn.content || "").slice(0, 1000),
    })),
    { role: "user", content: message.slice(0, 1200) },
  ];

  const strictSchema = {
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "anime_chat_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            assistant_reply: { type: "string" },
            should_search: { type: "boolean" },
            query_text: { type: "string" },
            like_title: { type: ["string", "null"] },
            include_genres: { type: "array", items: { type: "string" } },
            exclude_genres: { type: "array", items: { type: "string" } },
            include_tags: { type: "array", items: { type: "string" } },
            exclude_tags: { type: "array", items: { type: "string" } },
            format_in: { type: "array", items: { type: "string" } },
            max_episodes: { type: ["integer", "null"] },
          },
          required: [
            "assistant_reply",
            "should_search",
            "query_text",
            "like_title",
            "include_genres",
            "exclude_genres",
            "include_tags",
            "exclude_tags",
            "format_in",
            "max_episodes",
          ],
        },
      },
    },
  };

  for (const provider of providers) {
    const basePayload = {
      model: provider.model,
      temperature: 0.3,
      messages,
    };

    const attempts: Record<string, unknown>[] =
      provider.name === "openai"
        ? [
            { ...basePayload, ...strictSchema },
            { ...basePayload, response_format: { type: "json_object" } },
          ]
        : [
            { ...basePayload, response_format: { type: "json_object" } },
            basePayload,
          ];

    for (const requestBody of attempts) {
      const json = await callProviderChatCompletion(provider, requestBody);
      if (!json) continue;
      const content = json?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") continue;

      try {
        return buildLlmPlan(JSON.parse(content));
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) continue;
        try {
          return buildLlmPlan(JSON.parse(match[0]));
        } catch {
          continue;
        }
      }
    }
  }

  return null;
};

const extractLikeTitle = (message: string) => {
  const text = String(message || "");
  const m =
    text.match(/(?:something\s+)?like\s+([^,.;]+?)(?:\s+but|\s+with|\s+no\s+|\s+without\s+|$)/i) ||
    text.match(/similar\s+to\s+([^,.;]+?)(?:\s+but|\s+with|\s+no\s+|\s+without\s+|$)/i);
  const title = m?.[1]?.trim();
  return title && title.length >= 2 ? title : null;
};

// Minimal keyword -> filter mapping (no LLM needed).
const GENRE_KEYWORDS: Record<string, string> = {
  action: "Action",
  adventure: "Adventure",
  comedy: "Comedy",
  drama: "Drama",
  romance: "Romance",
  horror: "Horror",
  thriller: "Thriller",
  mystery: "Mystery",
  fantasy: "Fantasy",
  "slice of life": "Slice of Life",
  scifi: "Sci-Fi",
  "sci fi": "Sci-Fi",
  mecha: "Mecha",
  sports: "Sports",
  music: "Music",
  psychological: "Psychological",
  supernatural: "Supernatural",
};

const TAG_KEYWORDS: Record<string, string> = {
  isekai: "Isekai",
  shounen: "Shounen",
  seinen: "Seinen",
  gore: "Gore",
  "dark fantasy": "Dark Fantasy",
  "time travel": "Time Travel",
  "martial arts": "Martial Arts",
  "post apocalyptic": "Post-Apocalyptic",
  "coming of age": "Coming of Age",
  "found family": "Found Family",
  "anti hero": "Anti-Hero",
};

const parseFilters = (message: string) => {
  const text = normalize(message);

  const includeGenres: string[] = [];
  const excludeGenres: string[] = [];
  const includeTags: string[] = [];
  const excludeTags: string[] = [];
  const formatIn: string[] = [];
  let episodesLesser: number | null = null;

  // Episodes / length heuristics.
  if (/\b(very\s+short|super\s+short)\b/.test(text)) episodesLesser = 12;
  else if (/\bshort\b/.test(text) || /\bnot\s+too\s+long\b/.test(text)) episodesLesser = 24;
  else if (/\bone\s+cour\b/.test(text)) episodesLesser = 13;

  // Format heuristics.
  if (/\bmovie\b/.test(text)) formatIn.push("MOVIE");
  if (/\b(tv|series)\b/.test(text)) formatIn.push("TV");

  // Phrase match for multi-word genres/tags first.
  Object.entries(GENRE_KEYWORDS)
    .filter(([k]) => k.includes(" "))
    .forEach(([k, genre]) => {
      if (text.includes(k)) includeGenres.push(genre);
      if (text.includes(`no ${k}`) || text.includes(`without ${k}`)) excludeGenres.push(genre);
    });

  Object.entries(TAG_KEYWORDS)
    .filter(([k]) => k.includes(" "))
    .forEach(([k, tag]) => {
      if (text.includes(k)) includeTags.push(tag);
      if (text.includes(`no ${k}`) || text.includes(`without ${k}`)) excludeTags.push(tag);
    });

  // Token-ish match for single-word genres/tags.
  const words = text.split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const prev = words[i - 1];
    const isNegated = prev === "no" || prev === "without";

    if (GENRE_KEYWORDS[w]) {
      const genre = GENRE_KEYWORDS[w];
      if (isNegated) excludeGenres.push(genre);
      else includeGenres.push(genre);
    }
    if (TAG_KEYWORDS[w]) {
      const tag = TAG_KEYWORDS[w];
      if (isNegated) excludeTags.push(tag);
      else includeTags.push(tag);
    }
  }

  // "darker" vibe: bias into dark fantasy / psychological if user asks for it.
  if (/\bdarker\b/.test(text) || /\bdark\b/.test(text)) {
    if (!includeTags.includes("Dark Fantasy") && !excludeTags.includes("Dark Fantasy")) includeTags.push("Dark Fantasy");
    if (!includeGenres.includes("Psychological") && !excludeGenres.includes("Psychological")) includeGenres.push("Psychological");
  }

  return {
    includeGenres: uniq(includeGenres),
    excludeGenres: uniq(excludeGenres),
    includeTags: uniq(includeTags),
    excludeTags: uniq(excludeTags),
    formatIn: uniq(formatIn),
    episodesLesser,
  };
};

const anilist = async (req: Request, query: string, variables: Record<string, unknown>) => {
  const url = new URL("/api/anilist", req.url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) return { ok: false as const, status: 429, data: null as any };
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.errors) {
    return {
      ok: false as const,
      status: res.status,
      data: null as any,
      error: json?.errors?.[0]?.message || "AniList request failed.",
    };
  }
  return { ok: true as const, status: 200, data: json?.data };
};

const mediaTitle = (m: AniListMedia) =>
  m?.title?.english || m?.title?.romaji || m?.title?.native || "Untitled";

const toResult = (m: AniListMedia, reason: string) => ({
  id: m.id,
  title: mediaTitle(m),
  image: m.coverImage?.large || "",
  score: m.averageScore ? m.averageScore / 10 : null,
  reason,
  genres: m.genres || [],
  tags: (m.tags || []).map((t) => ({ name: t.name, rank: t.rank ?? 50 })),
  format: m.format || null,
  episodes: typeof m.episodes === "number" ? m.episodes : null,
  season: m.season || null,
  seasonYear: typeof m.seasonYear === "number" ? m.seasonYear : null,
});

const passesFilters = (m: AniListMedia, filters: ReturnType<typeof parseFilters>) => {
  const genres = new Set((m.genres || []).map((g) => String(g)));
  const tags = new Set((m.tags || []).map((t) => t.name));

  if (filters.excludeGenres.some((g) => genres.has(g))) return false;
  if (filters.excludeTags.some((t) => tags.has(t))) return false;
  if (filters.includeGenres.length && !filters.includeGenres.some((g) => genres.has(g))) return false;
  if (filters.includeTags.length && !filters.includeTags.some((t) => tags.has(t))) return false;
  if (filters.episodesLesser && typeof m.episodes === "number" && m.episodes > filters.episodesLesser) return false;
  if (filters.formatIn.length && m.format && !filters.formatIn.includes(m.format)) return false;
  return true;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      message?: string;
      history?: ChatTurn[];
      userId?: string;
      accessToken?: string;
      context?: HikariContext["client_summary"];
    } | null;
    const message = String(body?.message || "").trim();
    if (!message) return NextResponse.json({ error: "Missing message." }, { status: 400 });
    const normalizedMessage = normalize(message);
    const history = Array.isArray(body?.history)
      ? body!.history
          .filter((turn) => turn && typeof turn.content === "string")
          .map((turn) => ({
            role: normalizeRole(turn.role),
            content: String(turn.content || "").trim(),
          }))
          .filter((turn) => turn.content.length > 0)
      : [];

    const requestedUserId = typeof body?.userId === "string" ? body.userId : null;
    const verifiedUserId = await getVerifiedUserId(typeof body?.accessToken === "string" ? body.accessToken : null);
    const effectiveUserId = verifiedUserId && requestedUserId === verifiedUserId ? verifiedUserId : null;
    const serverContext = await buildServerHikariContext(effectiveUserId);
    const hikariContext: HikariContext = {
      user_id: effectiveUserId,
      ...serverContext,
      client_summary:
        body?.context && typeof body.context === "object"
          ? {
              top_genres: toStringArray((body.context as any).top_genres),
              top_tags: toStringArray((body.context as any).top_tags),
              list_summary:
                (body.context as any).list_summary && typeof (body.context as any).list_summary === "object"
                  ? (body.context as any).list_summary
                  : undefined,
              not_interested_count:
                Number.isFinite(Number((body.context as any).not_interested_count))
                  ? Number((body.context as any).not_interested_count)
                  : undefined,
              last_results: Array.isArray((body.context as any).last_results)
                ? (body.context as any).last_results
                    .slice(0, 12)
                    .map((row: any) => ({
                      title: String(row?.title || "").trim(),
                      genres: toStringArray(row?.genres),
                      tags: toStringArray(row?.tags),
                    }))
                    .filter((row: any) => row.title.length > 0)
                : undefined,
            }
          : undefined,
    };

    // Handle basic chat so "hi" doesn't feel broken (always, even with OpenAI enabled).
    if (GREETING_RE.test(normalizedMessage)) {
      return NextResponse.json({
        reply:
          "Hey. Tell me what you want to watch and I'll help, like: 'dark fantasy, no romance, short' or 'like JJK but darker'.",
        results: [],
      });
    }
    if (HELP_RE.test(normalizedMessage)) {
      return NextResponse.json({
        reply:
          "Try prompts like: 'something like JJK but darker', 'chill slice of life no gore', or 'short thriller anime'.",
        results: [],
      });
    }

    if (isLikelyInfoChat(message, normalizedMessage)) {
      const chatReply = await callOpenAiChatReply(message, history, hikariContext);
      return NextResponse.json({
        reply:
          chatReply || fallbackChatReply(message),
        results: [],
      });
    }

    const llmPlan = await callOpenAiPlanner(message, history, hikariContext);
    let conversationalReply: string | null = null;
    if (llmPlan && !llmPlan.should_search) {
      return NextResponse.json({
        reply: llmPlan.assistant_reply,
        results: [],
      });
    }

    const heuristicFilters = parseFilters(message);
    const historyUserText = history
      .filter((turn) => turn.role === "user")
      .slice(-4)
      .map((turn) => turn.content)
      .join(" ");
    const historyFilters = historyUserText ? parseFilters(historyUserText) : parseFilters("");
    const filters = {
      includeGenres: uniq([...(heuristicFilters.includeGenres || []), ...(llmPlan?.include_genres || [])]),
      excludeGenres: uniq([...(heuristicFilters.excludeGenres || []), ...(llmPlan?.exclude_genres || [])]),
      includeTags: uniq([...(heuristicFilters.includeTags || []), ...(llmPlan?.include_tags || [])]),
      excludeTags: uniq([...(heuristicFilters.excludeTags || []), ...(llmPlan?.exclude_tags || [])]),
      formatIn: uniq([...(heuristicFilters.formatIn || []), ...(llmPlan?.format_in || [])]),
      episodesLesser: llmPlan?.max_episodes || heuristicFilters.episodesLesser,
    };

    const likeTitle = llmPlan?.like_title || extractLikeTitle(message);
    let queryText = llmPlan?.query_text?.trim() || message;

    const hasExplicitCurrentIntent =
      Boolean(likeTitle) ||
      filters.includeGenres.length > 0 ||
      filters.excludeGenres.length > 0 ||
      filters.includeTags.length > 0 ||
      filters.excludeTags.length > 0 ||
      filters.formatIn.length > 0 ||
      Boolean(filters.episodesLesser);
    const shouldClarifyInsteadOfSearch =
      !hasExplicitCurrentIntent &&
      !DISLIKE_RE.test(normalizedMessage);

    if (!llmPlan && shouldClarifyInsteadOfSearch) {
      conversationalReply = await callOpenAiChatReply(message, history, hikariContext);
      return NextResponse.json({
        reply:
          conversationalReply || fallbackChatReply(message),
        results: [],
      });
    }

    // If user sent a short follow-up ("something else", etc.), keep prior context constraints.
    if (!hasExplicitCurrentIntent && historyUserText) {
      filters.includeGenres = uniq([...(filters.includeGenres || []), ...(historyFilters.includeGenres || [])]);
      filters.excludeGenres = uniq([...(filters.excludeGenres || []), ...(historyFilters.excludeGenres || [])]);
      filters.includeTags = uniq([...(filters.includeTags || []), ...(historyFilters.includeTags || [])]);
      filters.excludeTags = uniq([...(filters.excludeTags || []), ...(historyFilters.excludeTags || [])]);
      filters.formatIn = uniq([...(filters.formatIn || []), ...(historyFilters.formatIn || [])]);
      if (!filters.episodesLesser && historyFilters.episodesLesser) {
        filters.episodesLesser = historyFilters.episodesLesser;
      }
    }

    let dislikeAutoReply = "";
    if (DISLIKE_RE.test(normalizedMessage)) {
      const autoExclude = extractLastResultsExclusions(hikariContext.client_summary);
      if (autoExclude.genres.length || autoExclude.tags.length) {
        filters.excludeGenres = uniq([...(filters.excludeGenres || []), ...autoExclude.genres]);
        filters.excludeTags = uniq([...(filters.excludeTags || []), ...autoExclude.tags]);
        queryText = "";
        dislikeAutoReply = `Got it. I'll avoid similar picks (${[...autoExclude.genres.slice(0, 2), ...autoExclude.tags.slice(0, 2)].join(", ")}).`;
      } else if (!hasExplicitCurrentIntent) {
        return NextResponse.json({
          reply:
            "Got you. Tell me what to avoid or what vibe you want instead (for example: no romance, more action, short, darker, etc.).",
          results: [],
        });
      }
    }

    const describeBits: string[] = [];
    if (filters.includeGenres.length) describeBits.push(`genres: ${filters.includeGenres.join(", ")}`);
    if (filters.includeTags.length) describeBits.push(`tags: ${filters.includeTags.join(", ")}`);
    if (filters.excludeGenres.length) describeBits.push(`excluding: ${filters.excludeGenres.join(", ")}`);
    if (filters.excludeTags.length) describeBits.push(`excluding tags: ${filters.excludeTags.join(", ")}`);
    if (filters.episodesLesser) describeBits.push(`<= ${filters.episodesLesser} eps`);

    if (!llmPlan?.assistant_reply) {
      conversationalReply = await callOpenAiChatReply(message, history, hikariContext);
    }

    const baseReply = dislikeAutoReply
      ? dislikeAutoReply
      : llmPlan?.assistant_reply && llmPlan.assistant_reply.trim()
      ? llmPlan.assistant_reply
      : conversationalReply && conversationalReply.trim()
      ? conversationalReply
      : describeBits.length > 0
      ? `Here are picks matching ${describeBits.join(" | ")}.`
      : "Got it. I pulled picks from your request. If these miss, tell me what to avoid and I will refine.";
    const blockedMediaIds = new Set<number>(
      (hikariContext.list_summary?.recent_media_ids || []).filter((id) => Number.isFinite(Number(id))),
    );

    // 1) If user referenced a seed title, try recommendations first.
    if (likeTitle) {
      const seed = await anilist(req, SEED_QUERY, { search: likeTitle });
      const seedMedia: AniListMedia | null =
        seed.ok ? (seed.data?.Page?.media?.[0] as AniListMedia | undefined) || null : null;

      if (seed.status === 429) {
        return NextResponse.json({ error: "Rate limited. Try again in a few seconds." }, { status: 429 });
      }

      if (seedMedia?.id) {
        const recs = await anilist(req, RECS_QUERY, { id: seedMedia.id });
        if (recs.status === 429) {
          return NextResponse.json({ error: "Rate limited. Try again in a few seconds." }, { status: 429 });
        }

        const nodes = (recs.ok ? recs.data?.Media?.recommendations?.nodes : null) || [];
        const pool: AniListMedia[] = (nodes as any[])
          .map((n) => n?.mediaRecommendation)
          .filter(Boolean);

        const filtered = pool.filter((m) => !blockedMediaIds.has(m.id) && passesFilters(m, filters));
        const results = filtered.slice(0, 8).map((m) => toResult(m, `Because you liked ${mediaTitle(seedMedia)}.`));
        if (results.length) {
          return NextResponse.json({ reply: baseReply, results });
        }
      }
    }

    // 2) Fallback: structured search with filters.
    const searchRes = await anilist(req, SEARCH_QUERY, {
      search: likeTitle ? null : queryText.trim() || null, // If they said "like X", use recs path; otherwise let search work.
      page: 1,
      perPage: 25,
      genreIn: filters.includeGenres.length ? filters.includeGenres : null,
      genreNotIn: filters.excludeGenres.length ? filters.excludeGenres : null,
      tagIn: filters.includeTags.length ? filters.includeTags : null,
      tagNotIn: filters.excludeTags.length ? filters.excludeTags : null,
      formatIn: filters.formatIn.length ? (filters.formatIn as any) : null,
      episodesLesser: filters.episodesLesser,
    });

    if (searchRes.status === 429) {
      return NextResponse.json({ error: "Rate limited. Try again in a few seconds." }, { status: 429 });
    }

    const media = (searchRes.ok ? searchRes.data?.Page?.media : null) || [];
    const results = (media as AniListMedia[])
      .filter((m) => !blockedMediaIds.has(m.id) && passesFilters(m, filters))
      .slice(0, 8)
      .map((m) => {
        const reasons: string[] = [];
        if (filters.includeGenres.length) {
          const hit = (m.genres || []).filter((g) => filters.includeGenres.includes(g));
          if (hit.length) reasons.push(`Matches: ${hit.slice(0, 3).join(", ")}`);
        }
        if (filters.includeTags.length) {
          const tset = new Set((m.tags || []).map((t) => t.name));
          const hit = filters.includeTags.filter((t) => tset.has(t));
          if (hit.length) reasons.push(`Matches: ${hit.slice(0, 3).join(", ")}`);
        }
        if (!reasons.length) reasons.push("Picked from your prompt.");
        return toResult(m, reasons.join(" | "));
      });

    return NextResponse.json({
      reply: results.length
        ? baseReply
        : `${baseReply} I couldn't find strong matches. Try adding a genre (horror, romance) or constraints (no comedy, short).`,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: "AI search failed.", details: String(err) }, { status: 500 });
  }
}
