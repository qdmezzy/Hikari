"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import useAuth from "@/hooks/useAuth"
import { needsAuthOnboarding } from "@/lib/auth-onboarding"

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(pathname || "/")
      router.replace(`/login?next=${next}`)
    }
    if (!loading && user && pathname !== "/onboarding" && needsAuthOnboarding(user)) {
      const next = encodeURIComponent(pathname || "/dashboard")
      router.replace(`/onboarding?next=${next}`)
    }
  }, [loading, user, router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!user) return null
  if (pathname !== "/onboarding" && needsAuthOnboarding(user)) return null

  return children
}
