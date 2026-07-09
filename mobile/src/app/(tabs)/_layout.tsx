import React from "react"
import { Tabs } from "expo-router"
import { TabBar } from "@/components/layout/TabBar"

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="lists" />
      <Tabs.Screen name="calendar" />
    </Tabs>
  )
}
