"use client"

import * as React from "react"
import useAuth from "@/hooks/useAuth"
import { Header } from "@/components/header"

export const Navigation = React.memo(function Navigation() {
  const { user, logout, loading } = useAuth()

  const displayName = React.useMemo(
    () =>
      user?.user_metadata?.display_name ||
      user?.user_metadata?.username ||
      user?.user_metadata?.handle ||
      user?.email ||
      "User",
    [user],
  )

  const username = React.useMemo(
    () => user?.user_metadata?.username || user?.user_metadata?.handle || displayName,
    [displayName, user],
  )

  const headerUser = React.useMemo(
    () =>
      user
        ? {
            name: displayName,
            avatar: user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || undefined,
            username,
            isPremium: user?.user_metadata?.is_premium === true || user?.user_metadata?.isPremium === true,
          }
        : null,
    [displayName, user, username],
  )

  return <Header user={headerUser} authUser={user} authLoading={loading} onLogout={logout} />
})
