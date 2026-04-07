"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, ShieldAlert, Sparkles, X } from "lucide-react";
import client from "@/lib/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_META = {
  idle: {
    title: "Preparing Link Flow",
    description: "Setting up secure handoff between Discord and Hikari.",
    badge: "Initializing",
    Icon: Sparkles,
    tone: "text-cyan-300",
  },
  linking: {
    title: "Linking Your Account",
    description: "Verifying your session and connecting Discord.",
    badge: "Processing",
    Icon: LoaderCircle,
    tone: "text-cyan-300",
  },
  success: {
    title: "Discord Linked",
    description: "Your Discord account is now connected. Return to Discord and run /profile.",
    badge: "Connected",
    Icon: CheckCircle2,
    tone: "text-emerald-300",
  },
  error: {
    title: "Link Failed",
    description: "We could not complete your Discord link request.",
    badge: "Action Needed",
    Icon: ShieldAlert,
    tone: "text-rose-300",
  },
};

export default function DiscordLinkPage() {
  const searchParams = useSearchParams();
  const discordUserId = (searchParams.get("discord_id") || "").trim();
  const discordName = (searchParams.get("discord_name") || "").trim();

  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSessionUser(data?.session?.user || null);
      setLoadingSession(false);
    };

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const runLink = async () => {
      if (loadingSession || !sessionUser) return;
      if (!discordUserId) {
        setStatus("error");
        setError("Missing Discord user id in link URL.");
        return;
      }

      setStatus("linking");
      setError("");

      const {
        data: { session },
      } = await client.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        setStatus("error");
        setError("Could not get a valid session token. Please sign in again.");
        return;
      }

      try {
        const res = await fetch("/api/discord/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            discord_user_id: discordUserId,
            discord_name: discordName,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!active) return;

        if (!res.ok || !json?.ok) {
          setStatus("error");
          setError(json?.error || "Failed to link Discord account.");
          return;
        }

        setStatus("success");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError(String(err || "Failed to link Discord account."));
      }
    };

    runLink();

    return () => {
      active = false;
    };
  }, [loadingSession, sessionUser, discordUserId, discordName]);

  const nextLoginUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (discordUserId) params.set("discord_id", discordUserId);
    if (discordName) params.set("discord_name", discordName);
    const nextPath = `/discord/link${params.toString() ? `?${params.toString()}` : ""}`;
    return `/login?next=${encodeURIComponent(nextPath)}`;
  }, [discordUserId, discordName]);

  const meta = STATUS_META[status] || STATUS_META.idle;
  const StateIcon = meta.Icon;
  const bodyText = status === "error" && error ? error : meta.description;

  return (
    <main className="relative min-h-screen bg-background">
      <Navigation />

      <div className="pointer-events-none absolute inset-0 z-[1]">
        <div className="min-h-screen pt-24">
          <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
            <div className="mb-6 h-8 w-52 rounded-xl bg-secondary/60" />
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl border border-border/60 bg-card/70" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="h-14 rounded-2xl border border-border/60 bg-card/70" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl border border-border/60 bg-card/70" />
                ))}
              </div>
              <div className="space-y-4">
                <div className="h-44 rounded-2xl border border-border/60 bg-card/70" />
                <div className="h-32 rounded-2xl border border-border/60 bg-card/70" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-[2] bg-background/50 backdrop-blur-md" />

      <div className="relative z-[3] flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-md animate-pop-in rounded-2xl border border-white/10 bg-[#060814]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/55">Discord Link</p>
              <h1 className="mt-1 text-xl font-semibold text-white">{meta.title}</h1>
            </div>
            <Button asChild size="icon-sm" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white">
              <Link href="/" aria-label="Close">
                <X className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mb-4">
            <Badge className={`border border-white/15 bg-white/5 ${meta.tone}`}>
              <StateIcon className={`mr-1.5 h-3.5 w-3.5 ${status === "linking" ? "animate-spin" : ""}`} />
              {meta.badge}
            </Badge>
          </div>

          <p className="text-sm leading-relaxed text-white/75">{bodyText}</p>

          {discordUserId ? (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70">
              <p className="break-all">
                Discord ID: <span className="font-mono text-white/85">{discordUserId}</span>
              </p>
              <p className="mt-1">
                Discord User: <span className="text-white/85">{discordName || "Unknown"}</span>
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {loadingSession ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking session...
              </div>
            ) : !sessionUser ? (
              <Button asChild>
                <Link href={nextLoginUrl}>Sign In to Continue</Link>
              </Button>
            ) : status === "success" ? (
              <>
                <Button asChild>
                  <Link href="/profile">Open Profile</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
                  <Link href="/">Done</Link>
                </Button>
              </>
            ) : status === "error" ? (
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-200">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Linking...
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
