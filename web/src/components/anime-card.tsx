"use client"

import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getMediaHref } from "@/lib/anilist"
import { Star } from "lucide-react"
import { useState } from "react"

interface AnimeCardProps {
  id: string
  title: string
  image: string
  episodes?: number
  currentEpisode?: number
  rating?: number
  type?: "anime" | "manga"
  showProgress?: boolean
  className?: string
  index?: number
}

export function AnimeCard({
  id,
  title,
  image,
  episodes,
  currentEpisode,
  rating,
  type = "anime",
  showProgress = false,
  className,
  index = 0,
}: AnimeCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const progress = currentEpisode && episodes ? (currentEpisode / episodes) * 100 : 0

  return (
    <Link
      href={getMediaHref(id, title)}
      className={cn(
        "group relative block overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,24,0.98)_0%,rgba(5,9,14,1)_100%)] shadow-[0_18px_44px_rgba(0,0,0,0.35)] transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_28px_64px_rgba(4,14,24,0.55)]",
        className,
      )}
      style={{
        animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        animationDelay: `${index * 60}ms`,
        opacity: 0,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={image || "/placeholder.svg?height=400&width=300"}
          alt={title}
          fill
          className={cn("object-cover transition-all duration-700", isHovered && "scale-110")}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        <div
          className={cn(
            "absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_42%),linear-gradient(180deg,rgba(4,10,18,0.08)_0%,rgba(4,10,18,0.34)_40%,rgba(3,6,10,0.95)_100%)] transition-opacity duration-500",
            isHovered ? "opacity-100" : "opacity-85",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          {episodes ? (
            <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
              {currentEpisode ? `${currentEpisode}/${episodes}` : `${episodes}`} {type === "anime" ? "eps" : "ch"}
            </span>
          ) : (
            <span />
          )}
          {rating ? (
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>{rating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3
            className="line-clamp-2 text-sm font-semibold text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.9)] transition-colors duration-500 group-hover:text-primary"
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            {title}
          </h3>
          <p className="mt-1 text-xs text-white/65 drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]">
            {type === "anime" ? "Anime" : "Manga"}
            {episodes ? ` / ${episodes} ${type === "anime" ? "episodes" : "chapters"}` : ""}
          </p>
        </div>
      </div>

      {showProgress && progress > 0 ? (
        <div className="absolute inset-x-4 bottom-0 overflow-hidden rounded-t-full">
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-300 to-accent transition-all duration-1000"
              style={{
                width: `${progress}%`,
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
        </div>
      ) : null}
    </Link>
  )
}

