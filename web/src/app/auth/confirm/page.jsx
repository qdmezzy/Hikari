"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react"
import { AccountRecoveryFrame } from "@/components/layout/AccountRecoveryFrame"
import { Button } from "@/components/ui/button"
import { getSafeNextPath } from "@/lib/safe-navigation.mjs"
import client from "@/lib/client"

export default function AuthConfirmPage() {
  const [state, setState] = useState("checking")
  const [next, setNext] = useState("/")

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get("token_hash")
    const type = params.get("type")
    const safeNext = getSafeNextPath(params.get("next"))
    setNext(safeNext)

    if (!tokenHash || !["email", "recovery", "invite", "magiclink", "email_change", "reauthentication"].includes(type)) {
      setState("invalid")
      return () => { active = false }
    }

    client.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (active) setState(error ? "invalid" : type === "recovery" ? "recovery" : "confirmed")
    }).catch(() => {
      if (active) setState("invalid")
    })

    return () => { active = false }
  }, [])

  useEffect(() => {
    if (state !== "confirmed") return
    const timer = window.setTimeout(() => { window.location.assign(next) }, 900)
    return () => window.clearTimeout(timer)
  }, [state, next])

  const content = state === "checking"
    ? <><LoaderCircle className="animate-spin" size={28}/><div><h1>Confirming your email</h1><p>Just a moment while we finish setting up your Hikari account.</p></div></>
    : state === "confirmed"
      ? <><CheckCircle2 size={28}/><div><h1>You’re all set</h1><p>Your email is confirmed. Taking you back to Hikari now.</p></div><Button asChild><Link href={next}>Continue to Hikari</Link></Button></>
      : state === "recovery"
        ? <><CheckCircle2 size={28}/><div><h1>Choose a new password</h1><p>Your reset link is ready. Set a new password for your Hikari account.</p></div><Button asChild><Link href={next}>Set a new password</Link></Button></>
        : <><CircleAlert size={28}/><div><h1>This link has expired</h1><p>For your security, Hikari links work once and expire. Request a fresh link and try again.</p></div><Button asChild><Link href="/forgot-password">Request a new link</Link></Button></>

  return <AccountRecoveryFrame loginHref="/login">
    <div className="hk-recovery-success" role="status">{content}</div>
  </AccountRecoveryFrame>
}
