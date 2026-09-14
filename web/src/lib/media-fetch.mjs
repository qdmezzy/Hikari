// Only a successful, complete upstream response may be treated as an empty result.
export async function fetchMediaBatches(ids, fetchBatch) {
  const found = new Map()
  const requested = new Set(ids)
  for (let index = 0; index < ids.length; index += 50) {
    const response = await fetchBatch(ids.slice(index, index + 50))
    if (!response.ok) throw new Error("The catalog is temporarily unavailable")
    const json = await response.json()
    if (json?.errors?.length || !Array.isArray(json?.data?.Page?.media)) {
      throw new Error("The catalog returned an incomplete response")
    }
    for (const media of json.data.Page.media) {
      if (requested.has(media?.id)) found.set(media.id, media)
    }
  }
  return [...found.values()]
}
