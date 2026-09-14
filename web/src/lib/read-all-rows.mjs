// Keyset pagination avoids the default row cap and offset shifts on deletion.
// The key must be unique within the caller's filtered query and ordered ascending.
// This is not a transaction snapshot: concurrent additions may require a refresh.
/**
 * @param {() => any} makeQuery
 * @param {{key?: string, pageSize?: number, maxPages?: number, isActive?: () => boolean}} options
 */
export async function readAllRows(makeQuery, { key = "id", pageSize = 250, maxPages = 400, isActive = () => true } = {}) {
  const rows = [], seen = new Set()
  let cursor
  try {
    for (let page = 0; page < maxPages; page++) {
      if (!isActive()) throw new Error("Read cancelled")
      let query = makeQuery().order(key, { ascending: true }).limit(pageSize)
      if (cursor !== undefined) query = query.gt(key, cursor)
      const { data, error } = await query
      if (error) throw error
      if (!Array.isArray(data)) throw new Error("Incomplete database response")
      if (!data.length) return { data: rows, error: null }
      for (const row of data) {
        const value = row?.[key]
        if (value == null || seen.has(value)) throw new Error("Records changed during loading; retry")
        seen.add(value)
        rows.push(row)
      }
      cursor = data.at(-1)[key]
      // Always read to an empty page, even if the server caps below pageSize.
    }
    throw new Error("This list is too large to load safely in one view")
  } catch (error) {
    return { data: null, error }
  }
}
