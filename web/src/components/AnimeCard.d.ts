import * as React from "react"

export type AnimeCardProps = {
  id: string | number
  title: string
  image: string
  episodes?: number
  currentEpisode?: number
  rating?: number
  type?: string
  showProgress?: boolean
  className?: string
  index?: number
  watchUrl?: string
  watchLabel?: string
}

export const AnimeCard: React.ComponentType<AnimeCardProps>
