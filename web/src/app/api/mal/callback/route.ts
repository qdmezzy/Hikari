import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSafeNextPath } from "@/lib/safe-navigation.mjs"

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID
const MAL_CLIENT_SECRET = process.env.MAL_CLIENT_SECRET
const MAL_REDIRECT_URI = process.env.MAL_REDIRECT_URI

const redirectWithStatus = (req: Request, returnTo: string, status: string) => {
  const origin = new URL(req.url).origin
  const target = new URL(getSafeNextPath(returnTo, "/import"), origin)
  target.searchParams.set("mal", status)
  return NextResponse.redirect(target.toString())
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  const cookieStore = await cookies()
  const storedState = cookieStore.get("mal_state")?.value
  const verifier = cookieStore.get("mal_verifier")?.value
  const returnTo = getSafeNextPath(cookieStore.get("mal_return_to")?.value, "/import")

  if (!code || !state || !storedState || !verifier || state !== storedState) {
    return redirectWithStatus(req, returnTo, "error")
  }

  if (!MAL_CLIENT_ID || !MAL_CLIENT_SECRET || !MAL_REDIRECT_URI) {
    return NextResponse.json(
      { error: "Missing MAL_CLIENT_ID, MAL_CLIENT_SECRET, or MAL_REDIRECT_URI." },
      { status: 500 },
    )
  }

  const body = new URLSearchParams({
    client_id: MAL_CLIENT_ID,
    client_secret: MAL_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: MAL_REDIRECT_URI,
  })

  const tokenRes = await fetch("https://myanimelist.net/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok) {
    return redirectWithStatus(req, returnTo, "error")
  }

  const response = redirectWithStatus(req, returnTo, "connected")
  const expiresIn = Number(tokenJson?.expires_in) || 3600
  const expiresAt = Date.now() + expiresIn * 1000

  response.cookies.set("mal_access_token", tokenJson.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: expiresIn,
  })
  response.cookies.set("mal_refresh_token", tokenJson.refresh_token || "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  response.cookies.set("mal_expires_at", String(expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: expiresIn,
  })

  response.cookies.delete("mal_state")
  response.cookies.delete("mal_verifier")
  response.cookies.delete("mal_return_to")

  return response
}
