import type { Metadata } from "next";
import { SharedList } from "./SharedList";

export const metadata: Metadata = { title: "Shared anime list — Hikari" };

export default async function ListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SharedList slug={slug} />;
}
