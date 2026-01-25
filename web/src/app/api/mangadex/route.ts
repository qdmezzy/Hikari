import { NextResponse } from "next/server"

const MANGADEX_BASE_URL = "https://api.mangadex.org"

const parseChapterNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

const formatChapterValue = (value: number | null) => {
  if (value === null) return null
  const rounded = Math.round(value * 10) / 10
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return String(Math.round(rounded))
  }
  return String(rounded)
}

const getMaxChapterFromAggregate = (aggregate: any) => {
  const volumes = aggregate?.volumes || {}
  let maxChapter: number | null = null

  Object.values(volumes).forEach((volume: any) => {
    const chapters = volume?.chapters || {}
    Object.keys(chapters).forEach((chapterKey) => {
      const parsed = parseChapterNumber(chapterKey)
      if (parsed === null) return
      if (maxChapter === null || parsed > maxChapter) {
        maxChapter = parsed
      }
    })
  })

  return maxChapter
}

const fetchJson = async (url: string) => {
  const res = await fetch(url, { method: "GET" })
  const data = await res.json()
  return { res, data }
}

export async function POST(req: Request) {
  try {
    const { title, mangadexId } = await req.json()

    if (!title && !mangadexId) {
      return NextResponse.json({ error: "Missing title or mangadexId" }, { status: 400 })
    }

    let mangaId = mangadexId as string | null
    let mangaData: any = null

    if (!mangaId && title) {
      const params = new URLSearchParams()
      params.set("title", title)
      params.set("limit", "5")
      params.set("order[relevance]", "desc")
      const { res, data } = await fetchJson(`${MANGADEX_BASE_URL}/manga?${params.toString()}`)
      if (!res.ok) {
        return NextResponse.json({ error: "MangaDex search failed", details: data }, { status: res.status })
      }
      const firstMatch = data?.data?.[0]
      mangaId = firstMatch?.id || null
      mangaData = firstMatch || null
    }

    if (!mangaId) {
      return NextResponse.json({ error: "No MangaDex match found" }, { status: 404 })
    }

    if (!mangaData) {
      const { res, data } = await fetchJson(`${MANGADEX_BASE_URL}/manga/${mangaId}`)
      if (!res.ok) {
        return NextResponse.json({ error: "MangaDex lookup failed", details: data }, { status: res.status })
      }
      mangaData = data?.data || null
    }

    let aggregateMax = null
    try {
      const aggregateUrl = `${MANGADEX_BASE_URL}/manga/${mangaId}/aggregate?translatedLanguage[]=en`
      const { data: aggregateData } = await fetchJson(aggregateUrl)
      aggregateMax = getMaxChapterFromAggregate(aggregateData)
    } catch {
      aggregateMax = null
    }

    const lastChapter = parseChapterNumber(mangaData?.attributes?.lastChapter)
    const candidates = [aggregateMax, lastChapter].filter((value) => Number.isFinite(value)) as number[]
    const maxChapter = candidates.length ? Math.max(...candidates) : null

    return NextResponse.json({
      mangadexId: mangaId,
      chapterCount: maxChapter,
      chapterCountDisplay: formatChapterValue(maxChapter),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "MangaDex proxy failed", details: String(error) },
      { status: 500 },
    )
  }
}
