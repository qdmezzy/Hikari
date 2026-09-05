import { ThreadView } from "./ThreadView";
export default async function CommunityThreadPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ThreadView id={id} />; }
