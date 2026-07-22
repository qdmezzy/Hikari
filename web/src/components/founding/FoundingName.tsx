"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useFoundingIdentity } from "@/hooks/useFoundingIdentity"
import { FoundingBadge } from "@/components/founding/FoundingBadge"

type FoundingNameProps = {
  handle?: string | null
  memberNumber?: number | null
  children: ReactNode
  className?: string
  showBadge?: boolean
  compactBadge?: boolean
}

export function FoundingName({
  handle,
  memberNumber: initialMemberNumber,
  children,
  className,
  showBadge = true,
  compactBadge = false,
}: FoundingNameProps) {
  const memberNumber = useFoundingIdentity(handle, initialMemberNumber)
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span
        className={cn("min-w-0", memberNumber && "font-semibold text-amber-800 dark:text-amber-300")}
      >
        {children}
      </span>
      {memberNumber && showBadge ? <FoundingBadge memberNumber={memberNumber} compact={compactBadge} /> : null}
    </span>
  )
}
