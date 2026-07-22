import Link from "next/link"
import { LockKeyhole, Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { FoundingBadge } from "@/components/founding/FoundingBadge"

type Founder = {
  memberNumber: number
  displayName: string
  handle: string
  avatarUrl?: string | null
}

type FoundingGridProps = {
  members: Founder[]
  claimedNumbers: number[]
}

export function FoundingGrid({ members, claimedNumbers }: FoundingGridProps) {
  const byNumber = new Map(members.map((member) => [member.memberNumber, member]))
  const claimed = new Set(claimedNumbers)
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Founding 25 positions">
      {Array.from({ length: 25 }, (_, index) => index + 1).map((number) => {
        const member = byNumber.get(number)
        if (member) {
          return (
            <Link key={number} href={`/u/${encodeURIComponent(member.handle)}`} className="group focus-visible:outline-none">
              <Card className="h-full border-amber-500/25 bg-gradient-to-br from-amber-100/80 via-card to-card transition group-hover:-translate-y-1 group-hover:border-amber-500/50 group-focus-visible:ring-2 group-focus-visible:ring-amber-500 dark:from-amber-400/10">
                <CardContent className="flex h-full flex-col items-center p-4 text-center">
                  <Avatar className="mb-3 size-14 ring-2 ring-amber-500/30">
                    <AvatarImage src={member.avatarUrl || undefined} alt={`${member.displayName}'s avatar`} />
                    <AvatarFallback className="bg-amber-500/15 font-bold text-amber-800 dark:text-amber-200">
                      {member.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="line-clamp-1 font-semibold text-amber-900 dark:text-amber-200">{member.displayName}</p>
                  <p className="mb-3 line-clamp-1 text-xs text-muted-foreground">@{member.handle}</p>
                  <FoundingBadge memberNumber={number} className="mt-auto" />
                </CardContent>
              </Card>
            </Link>
          )
        }

        const isClaimed = claimed.has(number)
        return (
          <Card key={number} className="border-dashed border-border/70 bg-card/35">
            <CardContent className="flex min-h-44 flex-col items-center justify-center p-4 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground">
                {isClaimed ? <LockKeyhole className="size-5" aria-hidden="true" /> : <Sparkles className="size-5" aria-hidden="true" />}
              </div>
              <p className="font-medium">{isClaimed ? "Reserved founder" : "Mystery position"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Founding member #{number}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
