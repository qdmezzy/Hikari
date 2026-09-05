import { notFound } from "next/navigation";
import { anime } from "../../lib/data";
import { DetailsView } from "./DetailsView";

export default async function AnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = anime.find((item) => item.id === Number(id));
  if (!entry) notFound();
  return <DetailsView entry={entry} />;
}
