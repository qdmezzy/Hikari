"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Eye, EyeOff } from "lucide-react"
import { AccountRecoveryFrame } from "@/components/layout/AccountRecoveryFrame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSafeNextPath, buildLoginPath } from "@/lib/safe-navigation.mjs"
import client from "@/lib/client"

export default function ResetPasswordPage() {
  const [password,setPassword]=useState("")
  const [confirm,setConfirm]=useState("")
  const [show,setShow]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [done,setDone]=useState(false)
  const [ready,setReady]=useState(false)
  const [checking,setChecking]=useState(true)
  const [next,setNext]=useState("/")
  useEffect(()=>{
    let active=true
    setNext(getSafeNextPath(new URLSearchParams(window.location.search).get("next")))
    client.auth.getSession().then(({data})=>{if(active){setReady(Boolean(data?.session));setChecking(false)}}).catch(()=>{if(active)setChecking(false)})
    const {data}=client.auth.onAuthStateChange((event)=>{
      if(active && (event==="PASSWORD_RECOVERY" || event==="SIGNED_IN")){setReady(true);setChecking(false)}
      if(active && event==="SIGNED_OUT")setReady(false)
    })
    return ()=>{active=false;data?.subscription?.unsubscribe()}
  },[])
  const submit=async(event)=>{
    event.preventDefault()
    if(!ready || busy)return
    setError("")
    if(password.length<8)return setError("Use at least 8 characters.")
    if(password!==confirm)return setError("Your passwords don’t match.")
    setBusy(true)
    try {
      const {error}=await client.auth.updateUser({password})
      if(error)throw error
      setDone(true);setPassword("");setConfirm("")
    } catch(error) {setError(error.message || "Your password could not be updated. Please try again.")}
    finally {setBusy(false)}
  }
  return <AccountRecoveryFrame loginHref={buildLoginPath(next)}>
    {done ? <div className="hk-recovery-success" role="status"><Check size={28}/><div><h1>Password updated</h1><p>Your new password is ready. You can return to where you left off.</p></div><Button asChild><Link href={next}>Continue to Hikari</Link></Button></div> : <><h1>Set a new password</h1><p>Choose a password you don’t use on another account.</p>{checking ? <p role="status" className="mt-5">Checking your reset link…</p> : !ready ? <p role="alert">Open the reset link from your email to continue. <Link className="underline" href={"/forgot-password?next="+encodeURIComponent(next)}>Request a new link</Link>.</p>:null}{error ? <p role="alert">{error}</p>:null}
      <form onSubmit={submit}><div><Label htmlFor="new-password">New password</Label><div className="relative"><Input id="new-password" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} disabled={!ready || busy} className="pr-12"/><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={show ? "Hide passwords" : "Show passwords"} onClick={()=>setShow(value=>!value)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><p>At least 8 characters.</p></div><div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={!ready || busy}/></div><Button type="submit" disabled={!ready || busy}>{busy ? "Updating password…" : "Update password"}</Button></form>
    </>}
  </AccountRecoveryFrame>
}
