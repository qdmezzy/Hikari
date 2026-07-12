import React from "react"
import { Redirect, Tabs } from "expo-router"
import { TabBar } from "@/components/layout/TabBar"
import { useAuth } from "@/hooks/useAuth"

export default function TabsLayout() {
  const { user, loading } = useAuth()

  // Signed-out users belong on the login screen — declarative redirect so
  // navigation state is never mutated imperatively from a root effect.
  if (loading) return null
  if (!user) return <Redirect href="/login" />

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
