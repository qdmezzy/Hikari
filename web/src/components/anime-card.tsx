"use client"

import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Plus, Play, Star, Bookmark, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const [isAdded, setIsAdded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const progress = currentEpisode && episodes ? (currentEpisode / episodes) * 100 : 0

  return (
    <Link
      href={`/anime/${id}`}
      className={cn("group relative flex flex-col overflow-hidden rounded-xl bg-card", className)}
      style={{
        animation: "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        animationDelay: `${index * 60}ms`,
        opacity: 0,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-xl">
        <Image
          src={image || "/placeholder.svg?height=400&width=300"}
          alt={title}
          fill
          className={cn("object-cover transition-all duration-700", isHovered && "scale-110")}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        {/* Overlay gradient */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent transition-opacity duration-500",
            isHovered ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        {/* Rating Badge */}
        {rating && (
          <div
            className={cn(
              "absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-background/80 backdrop-blur-sm px-2 py-1 transition-all duration-500",
              isHovered ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0",
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Quick Actions */}
        <div
          className={cn(
            "absolute bottom-2 left-2 right-2 flex items-center gap-2 transition-all duration-500",
            isHovered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <Button
            size="sm"
            className={cn(
              "flex-1 gap-1 h-8 text-xs transition-all duration-500 btn-press",
              isAdded ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-primary/90 hover:bg-primary",
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            onClick={(e) => {
              e.preventDefault()
              setIsAdded(!isAdded)
            }}
          >
            {isAdded ? (
              <>
                <Check className="h-3 w-3" />
                Added
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Add
              </>
            )}
          </Button>
          {showProgress && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1 h-8 text-xs bg-secondary/90 btn-press transition-all duration-500"
              style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
              onClick={(e) => e.preventDefault()}
            >
              <Play className="h-3 w-3" />
              +1
            </Button>
          )}
        </div>

        {/* Bookmark indicator */}
        {isAdded && (
          <div
            className="absolute top-0 left-3"
            style={{ animation: "scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            <div className="w-6 h-8 bg-primary rounded-b-sm flex items-end justify-center pb-1">
              <Bookmark className="h-3 w-3 text-primary-foreground fill-current" />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3
          className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-500"
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {title}
        </h3>
        {episodes && (
          <p className="mt-1 text-xs text-muted-foreground">
            {currentEpisode ? `${currentEpisode}/${episodes}` : `${episodes}`} {type === "anime" ? "eps" : "ch"}
          </p>
        )}

        {/* Progress Bar */}
        {showProgress && progress > 0 && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
              style={{
                width: `${progress}%`,
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
        )}
      </div>
    </Link>
  )
}
