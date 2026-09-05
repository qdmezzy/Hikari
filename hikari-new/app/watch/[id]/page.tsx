import { redirect } from "next/navigation";

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/anime/${id}`);
}
