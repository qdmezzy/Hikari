import { redirect } from "next/navigation"

export default async function AnimeRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/media/${id}`)
}
