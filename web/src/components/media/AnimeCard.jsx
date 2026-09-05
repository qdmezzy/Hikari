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
    <article className={cn("hk-catalog-card", className)}>
      <div className="hk-catalog-cover">
        <Link href={href} aria-label={`Open ${title}`}>
          <img src={normalizedAnime?.coverImage?.extraLarge || normalizedAnime?.coverImage?.large || "/placeholder.svg"} alt="" loading="lazy" />
        </Link>
        {onQuickAdd ? <button type="button" onClick={() => onQuickAdd(normalizedAnime)} disabled={quickState === "adding" || quickState === "added"} aria-label={`${quickState === "added" ? "Already in your list:" : "Add to list:"} ${title}`}>
          {quickState === "adding" ? <Loader2 size={16} className="animate-spin" /> : quickState === "added" ? <Check size={16} /> : <Plus size={16} />}
        </button> : null}
      </div>
      <div className="hk-catalog-meta"><span>{normalizedAnime?.type === "MANGA" ? "MANGA" : "ANIME"}{normalizedAnime?.startDate?.year ? ` / ${normalizedAnime.startDate.year}` : ""}</span>{rating ? <span><Star size={10} fill="currentColor" />{rating}</span> : null}</div>
      <h3><Link href={href}>{title}</Link></h3>
      {normalizedAnime?.title?.native && normalizedAnime.title.native !== title ? <p className="hk-catalog-native" lang="ja">{normalizedAnime.title.native}</p> : null}
      <p className="hk-catalog-details">{episodeCount ? `${episodeCount} ${normalizedAnime?.type === "MANGA" ? episodeCount === 1 ? "chapter" : "chapters" : episodeCount === 1 ? "episode" : "episodes"}` : formatAniListStatus(normalizedAnime?.status)}{getPrimaryStudio(normalizedAnime) ? ` · ${getPrimaryStudio(normalizedAnime)}` : ""}</p>
      {watchLink?.url ? <a className="hk-catalog-stream" href={watchLink.url} target="_blank" rel="noreferrer"><Play size={10} />Watch on {watchLink.site}</a> : null}
    </article>
  )
})
