"use client"

import { useHomeData } from "@/hooks/useHomeData"
import { HomeScreen } from "@/components/home/HomeScreen"

export default function HomePage() {
  return <HomeScreen data={useHomeData()} />
}
