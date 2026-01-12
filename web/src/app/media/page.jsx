import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

const MEDIA_BY_ID = `
query ($id: Int) {
  Media(id: $id) {
    id
    type
    title { romaji english }
    coverImage { extraLarge }
    description
    episodes
    chapters
    averageScore
    genres
  }
}
`;

async function getMedia(id) {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: MEDIA_BY_ID, variables: { id } }),
    });

    const json = await res.json();

    if (!res.ok) return null;
    if (json?.errors) return null;

    return json?.data?.Media ?? null;
  } catch {
    return null;
  }
}

export default function MediaPage() {
  const { id: rawId } = useParams()
  const id = Number(rawId)
  const [media, setMedia] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    
    getMedia(id).then(data => {
      setMedia(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (!media) return <div style={{ padding: 24 }}>Not found</div>

  const title = media.title.english || media.title.romaji;
  const type = media.type === "ANIME" ? `${media.episodes ?? "?"} Episodes` : `${media.chapters ?? "?"} Chapters`;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
        {/* Cover Image */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={media.coverImage.extraLarge}
            alt={title}
            style={{
              width: 300,
              height: 450,
              objectFit: 'cover',
              borderRadius: 12,
            }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>{title}</h1>
          <p style={{ color: '#666', marginBottom: 16 }}>
            {type} • {media.averageScore ? `Score: ${media.averageScore}/100` : 'No score yet'}
          </p>

          {media.genres && media.genres.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {media.genres.map((genre) => (
                  <span
                    key={genre}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#f0f0f0',
                      borderRadius: 20,
                      fontSize: 14,
                    }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {media.description && (
            <div style={{ lineHeight: 1.6, color: '#333' }}>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Description</h2>
              <div dangerouslySetInnerHTML={{ __html: media.description }} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
