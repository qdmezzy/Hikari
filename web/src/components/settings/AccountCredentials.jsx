"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import client from "@/lib/client"

export function AccountCredentials({ currentEmail }) {
  const [editing, setEditing] = useState(null)
  const [email, setEmail] = useState("")
  const [emailBusy, setEmailBusy] = useState(false)

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [passwordBusy, setPasswordBusy] = useState(false)

  const submitEmail = async (e) => {
    e.preventDefault()
    const next = email.trim()
    if (!next || emailBusy) return
    if (next.toLowerCase() === String(currentEmail || "").toLowerCase()) {
      toast.error("That's already your email.")
      return
    }
    setEmailBusy(true)
    const { error } = await client.auth.updateUser({ email: next })
    setEmailBusy(false)
    if (error) {
      toast.error(error.message || "Couldn't update your email.")
      return
    }
    setEmail("")
    setEditing(null)
    toast.success("Check your inbox — confirm the change from both your old and new email.")
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    if (passwordBusy) return
    if (password.length < 8) {
      toast.error("Use at least 8 characters.")
      return
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.")
      return
    }
    setPasswordBusy(true)
    const { error } = await client.auth.updateUser({ password })
    setPasswordBusy(false)
    if (error) {
      toast.error(error.message || "Couldn't update your password.")
      return
    }
    setPassword("")
    setConfirm("")
    setEditing(null)
    toast.success("Password updated.")
  }

  return <>
    <div className="hk-settings-linkrow"><div><strong>Change email</strong><p>You'll confirm the new address by email.</p></div><Button variant="outline" onClick={()=>setEditing("email")}>Change…</Button></div>
    <div className="hk-settings-linkrow"><div><strong>Password</strong><p>Update the password you use with email sign-in.</p></div><Button variant="outline" onClick={()=>setEditing("password")}>Change…</Button></div>
    <Dialog open={Boolean(editing)} onOpenChange={open=>{if(!open&&!emailBusy&&!passwordBusy){setEditing(null);setEmail("");setPassword("");setConfirm("")}}}>
      <DialogContent><DialogHeader><DialogTitle>{editing==="email"?"Change email":"Change password"}</DialogTitle><DialogDescription>{editing==="email"?"Confirm the change from your email inbox.":"Use at least 8 characters. This updates your sign-in password immediately."}</DialogDescription></DialogHeader>
        {editing==="email"?<form onSubmit={submitEmail}><div className="space-y-3 py-5"><Label htmlFor="change-email">New email address</Label><Input id="change-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div><DialogFooter><Button type="button" variant="outline" disabled={emailBusy} onClick={()=>setEditing(null)}>Cancel</Button><Button type="submit" disabled={emailBusy||!email.trim()}>{emailBusy?"Sending…":"Send confirmation"}</Button></DialogFooter></form>:<form onSubmit={submitPassword}><div className="space-y-4 py-5"><div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)}/></div></div><DialogFooter><Button type="button" variant="outline" disabled={passwordBusy} onClick={()=>{setEditing(null);setPassword("");setConfirm("")}}>Cancel</Button><Button type="submit" disabled={passwordBusy||!password||!confirm}>{passwordBusy?"Updating…":"Update password"}</Button></DialogFooter></form>}
      </DialogContent>
    </Dialog>
  </>
}
