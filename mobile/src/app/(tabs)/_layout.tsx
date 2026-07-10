import React from "react"
import { Tabs } from "expo-router"
import { TabBar } from "@/components/layout/TabBar"

export default function TabsLayout() {
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
