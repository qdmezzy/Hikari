// AniList relationships describe connections, not a recommended viewing order.
// https://docs.anilist.co/reference/enum/mediarelation
const labels = {
  PREQUEL: "Prequel", SEQUEL: "Sequel", SUMMARY: "Recap", COMPILATION: "Compilation",
  PARENT: "Parent story", SIDE_STORY: "Side story", SPIN_OFF: "Spin-off",
  ADAPTATION: "Adaptation", SOURCE: "Source material", ALTERNATIVE: "Alternative version",
  CHARACTER: "Shared characters", SAME_UNIVERSE: "Same universe", CONTAINS: "Contains", OTHER: "Related title",
}

export function mediaRelations(edges = []) {
  const seen = new Set()
  return edges.flatMap(edge => {
    const media = edge?.node
    if (!Number.isSafeInteger(media?.id) || media.id <= 0 || media.isAdult || seen.has(media.id)) return []
    seen.add(media.id)
    return [{
      id: media.id,
      title: media.title?.english || media.title?.romaji || media.title?.native || "Untitled",
      cover: media.coverImage?.large || "/placeholder.svg",
      relation: labels[edge.relationType] || "Related title",
      format: media.format === "MOVIE" ? "Film" : media.type === "MANGA" ? "Manga" : "Anime",
      year: Number.isInteger(media.startDate?.year) && media.startDate.year > 0 ? media.startDate.year : null,
    }]
  })
}
