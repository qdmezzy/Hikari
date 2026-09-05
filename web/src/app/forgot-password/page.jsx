"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { AccountRecoveryFrame } from "@/components/layout/AccountRecoveryFrame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSafeNextPath, buildLoginPath } from "@/lib/safe-navigation.mjs"
import client from "@/lib/client"

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState("")
  const [submitted,setSubmitted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [next,setNext]=useState("/")
  useEffect(()=>{setNext(getSafeNextPath(new URLSearchParams(window.location.search).get("next")))},[])
  const submit=async(event)=>{
    event.preventDefault()
    if(busy)return
    setBusy(true);setError("")
    try {
      const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+"/reset-password?next="+encodeURIComponent(next)})
      if(error)throw error
      setSubmitted(true)
    } catch(error) {setError(error.message || "The reset link could not be sent. Please try again.")}
    finally {setBusy(false)}
  }
  return <AccountRecoveryFrame loginHref={buildLoginPath(next)}>
    {submitted ? <div className="hk-recovery-success" role="status"><Check size={28}/><div><h1>Check your inbox</h1><p>If an account exists for <strong>{email}</strong>, you’ll receive a password reset link. Check your spam folder too.</p></div><Button variant="outline" onClick={()=>{setSubmitted(false);setError("")}}>Use another email</Button></div> : <><h1>Forgot your password?</h1><p>Enter the email you use for Hikari. We’ll send you a link to set a new password.</p>{error ? <p role="alert">{error}</p>:null}<form onSubmit={submit}><div><Label htmlFor="recovery-email">Email address</Label><Input id="recovery-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy}/></div><Button type="submit" disabled={busy || !email.trim()}>{busy ? "Sending reset link…" : "Send reset link"}</Button></form></>}
  </AccountRecoveryFrame>
}
