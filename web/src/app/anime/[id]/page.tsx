import { redirect } from "next/navigation"

export default function AnimeRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/media/${params.id}`)
}
