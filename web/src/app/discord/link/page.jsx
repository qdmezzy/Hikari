"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, ShieldAlert, Sparkles } from "lucide-react";
import client from "@/lib/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STATUS_META = {
  idle: {
    title: "Preparing Link Flow",
    description: "Setting up secure handoff between Discord and Hikari.",
    badge: "Initializing",
    Icon: Sparkles,
    tone: "text-primary",
  },
  linking: {
    title: "Linking Your Account",
    description: "Verifying your session and connecting Discord.",
    badge: "Processing",
    Icon: LoaderCircle,
    tone: "text-primary",
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

  const toneBg =
    status === "success"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "error"
        ? "bg-destructive/15 text-destructive"
        : "bg-[#5865F2]/15 text-[#8b95f5]";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -left-1/3 -top-1/3 size-[70%] animate-pulse rounded-full bg-gradient-to-br from-[#5865F2]/25 via-primary/15 to-transparent blur-3xl"
          style={{ animationDuration: "9s" }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/3 size-[60%] animate-pulse rounded-full bg-gradient-to-tl from-accent/20 to-transparent blur-3xl"
          style={{ animationDuration: "11s", animationDelay: "2s" }}
        />
      </div>

      <div className="relative w-full max-w-md animate-pop-in">
        <Link href="/" className="mb-7 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hikari-wordmark.svg" alt="Hikari" className="h-14 w-auto" />
        </Link>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-8 text-center shadow-[0_24px_70px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className={cn("mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl", toneBg)}>
            <StateIcon className={cn("size-8", status === "linking" && "animate-spin")} />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">
            Discord × Hikari
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{meta.title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-muted-foreground">{bodyText}</p>

          {discordUserId && status !== "error" ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left">
              <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/15 text-[#8b95f5]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
                  <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{discordName || "Discord user"}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{discordUserId}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            {loadingSession ? (
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking your session…
              </div>
            ) : !sessionUser ? (
              <Button asChild className="h-11 w-full">
                <Link href={nextLoginUrl}>Sign in to continue</Link>
              </Button>
            ) : status === "success" ? (
              <>
                <Button asChild className="h-11 w-full">
                  <Link href="/profile">Open profile</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href="/">Done</Link>
                </Button>
              </>
            ) : status === "error" ? (
              <Button className="h-11 w-full" onClick={() => window.location.reload()}>
                Try again
              </Button>
            ) : (
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 px-3 py-2.5 text-sm text-[#8b95f5]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Linking your account…
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
