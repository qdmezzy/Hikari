"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Bug, Check, Heart, Lightbulb, Loader2, MessageCircle, MessageSquarePlus, Send } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"
import { PersonalUpdates } from "@/components/common/PersonalUpdates"

const discordCommunityUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/discord-bot"

const CATEGORIES = [
  {
    id: "bug",
    label: "Bug",
    desc: "Something's broken or acting weird",
    icon: Bug,
    accent: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    placeholder: "What happened? What did you expect instead? Steps to reproduce help a ton.",
  },
  {
    id: "idea",
    label: "Idea",
    desc: "A feature or improvement",
    icon: Lightbulb,
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    placeholder: "What would you love to see in Hikari?",
  },
  {
    id: "general",
    label: "General",
    desc: "Anything else on your mind",
    icon: MessageCircle,
    accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    placeholder: "Tell us what's up.",
  },
]

export default function FeedbackPage() {
  const { user } = useAuth()
  const [category, setCategory] = useState("bug")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user])

  const active = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0]

  const submit = async (e) => {
    e.preventDefault()
    if (!message.trim() || submitting) return
    setSubmitting(true)
    try {
      const { error } = await client.from("feedback").insert({
        user_id: user?.id || null,
        email: email.trim() || null,
        category,
        message: message.trim(),
        page_url: typeof window !== "undefined" ? window.location.href : null,
      })
      if (error) throw error
      setDone(true)
      toast.success("Thanks — feedback sent!")
    } catch (err) {
      toast.error(err?.message || "Couldn't send feedback. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="hikari-revamp min-h-screen bg-background"><Navigation/><main className="rv-main rv-container hk-feedback">
    <header className="hk-personal-heading"><div><span className="hk-page-jp" lang="ja">ご意見・お問い合わせ</span><h1>Feedback</h1><p>Report a problem or suggest something Hikari should do better.</p></div></header>
    <div className="hk-feedback-layout"><div>{done ? <section className="hk-feedback-received" role="status"><Check size={25}/><h2>Message received.</h2><p>Your feedback has been sent.</p><Button variant="outline" onClick={()=>{setDone(false);setMessage("")}}>Write another message</Button></section> : <form onSubmit={submit}>
      <fieldset disabled={submitting}><legend>What would you like to share?</legend><div className="hk-feedback-types">{CATEGORIES.map(item=><label key={item.id} data-selected={category===item.id}><input type="radio" name="feedback-category" value={item.id} checked={category===item.id} onChange={()=>setCategory(item.id)}/><span>{item.label}</span></label>)}</div></fieldset>
      <div className="hk-feedback-field"><Label htmlFor="feedback-message">Your message</Label><Textarea id="feedback-message" value={message} onChange={e=>setMessage(e.target.value)} placeholder={active.placeholder} rows={9} required maxLength={5000} disabled={submitting}/><small>{message.length.toLocaleString()} / 5,000</small></div>
      <div className="hk-feedback-field"><Label htmlFor="feedback-email">Email <span>· optional</span></Label><Input type="email" autoComplete="email" id="feedback-email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="If we need to follow up" disabled={submitting}/><p>Only used to follow up on this message.</p></div>
      <footer><p>Please don’t include passwords or other sensitive information.</p><Button type="submit" disabled={submitting || !message.trim()}>{submitting ? "Sending…" : "Send feedback"}<Send size={14}/></Button></footer>
    </form>}</div><aside><span lang="ja">改善のために</span><h2>A useful bug report</h2><ol><li>What were you trying to do?</li><li>What happened instead?</li><li>Which page and device were you using?</li></ol><hr/><h2>Looking for a conversation?</h2><p>You can also talk with the community on Discord.</p><Link href={discordCommunityUrl}>Visit the Discord ↗</Link></aside></div>
    <PersonalUpdates userId={user?.id} kind="feedback" revision={Number(done)}/>
  </main></div>
}
