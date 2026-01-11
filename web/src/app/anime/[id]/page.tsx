import { notFound } from "next/navigation";


async function getMedia(id: number) {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: MEDIA_BY_ID, variables: { id } }),
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok) return null;
    if (json?.errors) return null;

    return json?.data?.Media ?? null;
  } catch {
    return null;
  }
}

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


export default async function AnimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) notFound();

  return <div>Anime ID: {id}</div>;
}

