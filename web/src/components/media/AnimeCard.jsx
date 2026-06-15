"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Loader2, Play, Plus, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  formatAniListStatus,
  getEpisodeCount,
  getMediaHref,
  getMediaTitle,
  getPreferredStreamingLink,
  getPrimaryStudio,
} from "@/lib/anilist"

const createAnimeFromLegacyProps = ({
  id,
  title,
  image,
  episodes,
  currentEpisode,
  rating,
  type = "anime",
  watchUrl,
  watchLabel,
}) => ({
  id,
  title: { english: title, romaji: title },
  coverImage: { extraLarge: image, large: image },
  averageScore: Number.isFinite(Number(rating)) ? Number(rating) * 10 : null,
  episodes,
  chapters: type === "manga" ? episodes : undefined,
  currentEpisode,
  type: type?.toUpperCase?.() || "ANIME",
  externalLinks: watchUrl
    ? [
        {
          site: String(watchLabel || "Watch").replace(/^Watch on\s+/i, ""),
          url: watchUrl,
          type: "STREAMING",
        },
      ]
    : [],
})

export const AnimeCard = React.memo(function AnimeCard({
  anime,
  index = 0,
  quickState = "idle",
  onQuickAdd,
  className,
  ...legacyProps
}) {
  const normalizedAnime = anime || createAnimeFromLegacyProps(legacyProps)
  const title = getMediaTitle(normalizedAnime)
  const rating = normalizedAnime?.averageScore
    ? Number((normalizedAnime.averageScore / 10).toFixed(1))
    : null
  const episodeCount = getEpisodeCount(normalizedAnime) || normalizedAnime?.chapters
  const watchLink = getPreferredStreamingLink(normalizedAnime)
  const href = getMediaHref(normalizedAnime)
  const meta = [normalizedAnime?.startDate?.year, getPrimaryStudio(normalizedAnime)]
    .filter(Boolean)
    .join(" · ")

  return (
    <article
      className={cn(
        "group animate-rise card-elevated overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_44px_-22px_rgba(16,24,40,0.35)]",
        className,
      )}
      style={{ animationDelay: `${Math.min(index * 35, 400)}ms` }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <Link href={href} className="absolute inset-0 z-10" aria-label={`Open ${title}`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizedAnime?.coverImage?.extraLarge || normalizedAnime?.coverImage?.large || "/placeholder.svg"}
          alt={title}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Top badges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
          <span className="rounded-full bg-foreground/75 px-2.5 py-1 text-[11px] font-medium text-background backdrop-blur-sm">
            {episodeCount
              ? `${episodeCount} ${normalizedAnime?.type === "MANGA" ? "ch" : "eps"}`
              : formatAniListStatus(normalizedAnime?.status)}
          </span>
          {rating ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm">
              <Star className="size-3 fill-chart-3 text-chart-3" />
              {rating}
            </span>
          ) : null}
        </div>

        {/* Quick add */}
        {onQuickAdd ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onQuickAdd(normalizedAnime)
            }}
            aria-label="Add to list"
            className="absolute bottom-2.5 right-2.5 z-20 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur-sm transition-all duration-300 hover:bg-primary hover:text-primary-foreground sm:opacity-0 sm:group-hover:opacity-100"
          >
            {quickState === "adding" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : quickState === "added" ? (
              <Check className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
          </button>
        ) : null}
      </div>

      {/* Info panel */}
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {title}
        </h3>
        {meta ? <p className="truncate text-xs text-muted-foreground">{meta}</p> : null}
        {watchLink?.url ? (
          <a
            href={watchLink.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="relative z-20 mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/60 px-2.5 py-1.5 text-[11px] font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            <Play className="size-3 shrink-0 fill-primary text-primary" />
            <span className="truncate">Watch on {watchLink.site}</span>
          </a>
        ) : (
          <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            View details
          </span>
        )}
      </div>
    </article>
  )
})
