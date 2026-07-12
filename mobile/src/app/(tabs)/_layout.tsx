import React, { useEffect, useRef } from "react"
import { Tabs, useRouter } from "expo-router"
import { TabBar } from "@/components/layout/TabBar"
import { useAuth } from "@/hooks/useAuth"

export default function TabsLayout() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const redirected = useRef(false)

  // One-shot guard: fires at most once, so a re-render of this (possibly
  // backgrounded) layout can never emit another navigation event — repeat
  // navigations while the login screen is focused dismiss its keyboard.
  useEffect(() => {
    if (!loading && !user && !redirected.current) {
      redirected.current = true
      router.replace("/login")
    }
  }, [loading, user, router])

  if (loading || !user) return null

  return (
    <Tabs
      tabBar={() => <TabBar />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="manga" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
