import Link from "next/link";

type Media = {
  id: number;
  type: "ANIME" | "MANGA";
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string };
  format: string | null;
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null;
};

export function MediaCard({ media }: { media: Media }) {
  const title = media.title.english || media.title.romaji;

  const sub =
    media.type === "ANIME"
      ? `${media.format || "Anime"} · ${media.episodes ?? "?"} eps`
      : `${media.format || "Manga"} · ${media.chapters ?? "?"} ch`;

  return (
    <Link href={`/anime/${media.id}`} className="block">
      <div className="w-full max-w-[200px] rounded-xl border border-neutral-200 overflow-hidden bg-white hover:shadow-sm transition">
        <div className="w-full aspect-[2/3] bg-neutral-200">
          <img
            src={media.coverImage.large}
            alt={title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="p-3">
          <div className="font-semibold line-clamp-2">{title}</div>
          <div className="text-sm text-neutral-600 mt-1">{sub}</div>
          {media.averageScore ? (
            <div className="text-sm text-neutral-500 mt-1">
              Score {media.averageScore}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
