import crypto from "crypto"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSafeNextPath } from "@/lib/safe-navigation.mjs"

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID
const MAL_REDIRECT_URI = process.env.MAL_REDIRECT_URI

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const createVerifier = () => base64UrlEncode(crypto.randomBytes(32))

const createChallenge = (verifier: string) =>
  base64UrlEncode(crypto.createHash("sha256").update(verifier).digest())

export async function GET(req: Request) {
  if (!MAL_CLIENT_ID || !MAL_REDIRECT_URI) {
    return NextResponse.json(
      { error: "Missing MAL_CLIENT_ID or MAL_REDIRECT_URI." },
      { status: 500 },
    )
  }

  const url = new URL(req.url)
  const returnTo = getSafeNextPath(url.searchParams.get("returnTo"), "/import")
  const state = base64UrlEncode(crypto.randomBytes(16))
  const verifier = createVerifier()
  const challenge = createChallenge(verifier)

  const authUrl = new URL("https://myanimelist.net/v1/oauth2/authorize")
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("client_id", MAL_CLIENT_ID)
  authUrl.searchParams.set("code_challenge", challenge)
  authUrl.searchParams.set("code_challenge_method", "S256")
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("redirect_uri", MAL_REDIRECT_URI)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set("mal_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  })
  response.cookies.set("mal_verifier", verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  })
  response.cookies.set("mal_return_to", returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  })

  return response
}
