export function mediaLengthLabel(media = {}) {
  if (media.type === "MANGA") return Number(media.chapters) > 0 ? `${media.chapters} ${Number(media.chapters) === 1 ? "chapter" : "chapters"}` : "Chapters unannounced"
  if (media.format === "MOVIE") return Number(media.duration) > 0 ? `Film · ${media.duration} min` : "Film"
  return Number(media.episodes) > 0 ? `${media.episodes} ${Number(media.episodes) === 1 ? "episode" : "episodes"}` : "Episodes unannounced"
}
