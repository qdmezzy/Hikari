export function collectionExport(collection, items) {
  return {
    format: "hikari-collection", version: 1,
    collection: { name: collection.name, description: collection.description || "" },
    titles: items.map(item => ({ anilistId: Number(item.media_id), type: item.media_type || "ANIME", title: item.media?.title?.english || item.media?.title?.romaji || null })),
  }
}

export function downloadJson(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename.replace(/[^a-z0-9._-]/gi, "-")
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
