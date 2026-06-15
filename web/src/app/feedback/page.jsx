"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Loader2, MessageSquarePlus } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import useAuth from "@/hooks/useAuth"
import client from "@/lib/client"

const CATEGORIES = [
  { id: "bug", label: "🐛 Bug" },
  { id: "idea", label: "💡 Idea / feature" },
  { id: "general", label: "💬 General" },
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
      <main className="mx-auto max-w-xl px-4 pb-20 pt-24 md:px-6 lg:pt-28">
        <header className="animate-rise">
          <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">フィードバック</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Send feedback</h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            Found a bug or have an idea? We&apos;re in beta and read everything. 🙏
          </p>
        </header>

        {done ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="size-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Feedback sent</h2>
            <p className="mt-1 text-sm text-muted-foreground">Thanks for helping make Hikari better.</p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={() => { setDone(false); setMessage("") }}>
                Send another
              </Button>
              <Button asChild>
                <Link href="/">Back home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      category === c.id
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Your message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened, or what would you love to see?"
                className="min-h-32"
                maxLength={2000}
                required
              />
            </div>

            {!user ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional, so we can follow up)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            ) : null}

            <Button type="submit" disabled={submitting || !message.trim()} className="w-full gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
              Send feedback
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}
