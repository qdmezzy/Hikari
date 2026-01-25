export const parseVideoUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace("www.", "")

    if (host === "youtu.be") {
      const id = url.pathname.slice(1)
      if (!id) return null
      return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
    }

    if (host.includes("youtube.com")) {
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.replace("/shorts/", "").split("/")[0]
        if (!id) return null
        return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
      }
      const id = url.searchParams.get("v")
      if (!id) return null
      return { site: "youtube", id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
    }

    return null
  } catch {
    return null
  }
}
