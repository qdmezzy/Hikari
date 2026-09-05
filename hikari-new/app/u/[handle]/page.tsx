import { PublicProfile } from "./PublicProfile";

export default async function UserProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <PublicProfile handle={handle} />;
}
