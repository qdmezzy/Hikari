"use client"

import useAuth from "@/hooks/useAuth"
import { Header } from "@/components/header"

export function Navigation() {
  const { user, logout } = useAuth()

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.username ||
    user?.user_metadata?.handle ||
    user?.email ||
    "User"

  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.handle ||
    displayName

  const headerUser = user
    ? {
        name: displayName,
        avatar: user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || undefined,
        username,
        isPremium: user?.user_metadata?.is_premium === true || user?.user_metadata?.isPremium === true,
      }
    : null

  return <Header user={headerUser} onLogout={logout} />
}