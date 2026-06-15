import * as React from "react"

export type AnimeCardProps = {
  anime?: any
  id?: string | number
  title?: string
  image?: string
  episodes?: number
  currentEpisode?: number
  rating?: number
  type?: string
  showProgress?: boolean
  className?: string
  index?: number
  watchUrl?: string
  watchLabel?: string
  quickState?: "idle" | "adding" | "added"
  onQuickAdd?: (anime: any) => void
}

export const AnimeCard: React.ComponentType<AnimeCardProps>
