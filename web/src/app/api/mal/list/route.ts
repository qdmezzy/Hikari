import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID
const MAL_CLIENT_SECRET = process.env.MAL_CLIENT_SECRET

const buildEntries = (items: any[], mediaType: "ANIME" | "MANGA") =>
  items.map((item) => ({
    sourceId: item?.node?.id,
    mediaType,
    status: item?.list_status?.status,
    progress:
      mediaType === "ANIME"
        ? Number(item?.list_status?.num_episodes_watched) || 0
        : Number(item?.list_status?.num_chapters_read) || 0,
    score: Number(item?.list_status?.score) || null,
  }))

const fetchList = async (token: string, mediaType: "ANIME" | "MANGA") => {
  const base =
    mediaType === "ANIME"
      ? "https://api.myanimelist.net/v2/users/@me/animelist"
      : "https://api.myanimelist.net/v2/users/@me/mangalist"

  let url = `${base}?fields=list_status&limit=1000`
  const results: any[] = []

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(MAL_CLIENT_ID ? { "X-MAL-CLIENT-ID": MAL_CLIENT_ID } : {}),
      },
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json?.message || "MAL API error.")
    }
    results.push(...(json?.data || []))
    url = json?.paging?.next || ""
  }

  return results
}

const refreshToken = async (refreshTokenValue: string) => {
  if (!MAL_CLIENT_ID || !MAL_CLIENT_SECRET) {
    throw new Error("Missing MAL_CLIENT_ID or MAL_CLIENT_SECRET.")
  }

  const body = new URLSearchParams({
    client_id: MAL_CLIENT_ID,
    client_secret: MAL_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
  })

  const res = await fetch("https://myanimelist.net/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error("Failed to refresh MAL token.")
  }
  return json
}

export async function GET() {
  const cookieStore = cookies()
  let accessToken = cookieStore.get("mal_access_token")?.value || ""
  const refreshTokenValue = cookieStore.get("mal_refresh_token")?.value || ""
  const expiresAt = Number(cookieStore.get("mal_expires_at")?.value || "0")
  let refreshedMeta: { accessToken: string; refreshToken: string; expiresIn: number } | null = null

  if (!accessToken && !refreshTokenValue) {
    return NextResponse.json({ error: "MAL is not connected." }, { status: 401 })
  }

  if (expiresAt && Date.now() > expiresAt - 60_000 && refreshTokenValue) {
    try {
      const refreshed = await refreshToken(refreshTokenValue)
      accessToken = refreshed.access_token
      refreshedMeta = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || refreshTokenValue,
        expiresIn: Number(refreshed?.expires_in) || 3600,
      }
    } catch (error) {
      return NextResponse.json({ error: error.message || "MAL token refresh failed." }, { status: 401 })
    }
  }

  try {
    const [animeList, mangaList] = await Promise.all([
      fetchList(accessToken, "ANIME"),
      fetchList(accessToken, "MANGA"),
    ])

    const entries = [...buildEntries(animeList, "ANIME"), ...buildEntries(mangaList, "MANGA")].filter(
      (entry) => Number.isFinite(entry.sourceId),
    )

    const response = NextResponse.json({ entries })
    if (refreshedMeta) {
      const newExpiresAt = Date.now() + refreshedMeta.expiresIn * 1000
      response.cookies.set("mal_access_token", refreshedMeta.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: refreshedMeta.expiresIn,
      })
      response.cookies.set("mal_refresh_token", refreshedMeta.refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      })
      response.cookies.set("mal_expires_at", String(newExpiresAt), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: refreshedMeta.expiresIn,
      })
    }
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to fetch MAL list." }, { status: 500 })
  }
}
