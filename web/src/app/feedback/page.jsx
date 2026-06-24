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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="relative mx-auto max-w-2xl px-4 pb-24 pt-24 md:px-6 lg:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

        <header className="relative animate-rise text-center">
          <p className="font-jp text-sm font-medium tracking-[0.34em] text-primary/70">フィードバック</p>
          <h1 className="mt-2 text-balance text-4xl font-black tracking-tight md:text-5xl">
            Help shape <span className="text-gradient">Hikari</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-muted-foreground">
            We&apos;re in beta and read every single message. Found a bug, got an idea, or just want to say hi? 🌸
          </p>
        </header>

        {done ? (
          <div className="relative mt-10 flex flex-col items-center rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.07] p-10 text-center backdrop-blur-sm">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Check className="size-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Feedback sent 🙏</h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Thank you for helping make Hikari better. We genuinely read these.
            </p>
            <div className="mt-6 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDone(false)
                  setMessage("")
                }}
              >
                Send another
              </Button>
              <Button asChild>
                <Link href="/">Back home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="relative mt-10 space-y-7 rounded-3xl border border-border/50 bg-card/60 p-6 shadow-xl shadow-black/5 backdrop-blur-sm md:p-8"
          >
            <div className="space-y-3">
              <Label className="text-sm font-semibold">What's this about?</Label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon
                  const selected = category === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={cn(
                        "group flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-all",
                        selected
                          ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/30"
                          : "border-border/60 bg-background/40 hover:border-primary/30 hover:bg-background/70",
                      )}
                    >
                      <span className={cn("flex size-9 items-center justify-center rounded-xl border", c.accent)}>
                        <Icon className="size-4.5" />
                      </span>
                      <span className="font-semibold text-foreground">{c.label}</span>
                      <span className="text-xs leading-snug text-muted-foreground">{c.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message" className="text-sm font-semibold">
                  Your message
                </Label>
                <span className="text-xs text-muted-foreground">{message.length}/2000</span>
              </div>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={active.placeholder}
                className="min-h-36 resize-none rounded-2xl"
                maxLength={2000}
                required
              />
            </div>

            {!user ? (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">
                  Email <span className="font-normal text-muted-foreground">(optional — so we can follow up)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-2xl"
                />
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Heart className="size-3.5 text-primary/70" />
                Sending as <span className="font-medium text-foreground">{user.email}</span>
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !message.trim()}
              className="w-full gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent text-white"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send feedback
            </Button>
          </form>
        )}

        <p className="relative mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <MessageSquarePlus className="size-3.5" />
          You can also reach us in the{" "}
          <Link href="/discord/link" className="text-primary hover:underline">
            Hikari Discord
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
