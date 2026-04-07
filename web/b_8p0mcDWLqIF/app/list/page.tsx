"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Header } from "@/components/header"
import { AnimeDecorations } from "@/components/anime-decorations"
import { Play, Pause, CheckCircle2, Clock, Star, Trash2, Edit3, ChevronDown, MoreHorizontal, Eye, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Image from "next/image"

const watchingList = [
  { id: 1, title: "Frieren: Beyond Journey's End", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg", currentEp: 20, totalEp: 28, rating: 9, status: "watching", lastWatched: "2 hours ago" },
  { id: 2, title: "Solo Leveling", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png", currentEp: 8, totalEp: 12, rating: 8.5, status: "watching", lastWatched: "Yesterday" },
  { id: 3, title: "Demon Slayer: Hashira Training", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145139-rRimpHGWLhym.png", currentEp: 4, totalEp: 8, rating: null, status: "watching", lastWatched: "3 days ago" },
]

const completedList = [
  { id: 4, title: "Attack on Titan Final", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131681-ODIRpBIbR5Eu.jpg", currentEp: 20, totalEp: 20, rating: 10, status: "completed", completedDate: "Mar 15, 2024" },
  { id: 5, title: "Chainsaw Man", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FlochcFsyoF4.png", currentEp: 12, totalEp: 12, rating: 9, status: "completed", completedDate: "Feb 28, 2024" },
  { id: 6, title: "Bocchi the Rock!", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-5Y8rYzg982sq.png", currentEp: 12, totalEp: 12, rating: 9.5, status: "completed", completedDate: "Feb 10, 2024" },
  { id: 7, title: "Jujutsu Kaisen S2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-5fa4ZBbW4dqA.jpg", currentEp: 23, totalEp: 23, rating: 9, status: "completed", completedDate: "Jan 20, 2024" },
]

const plannedList = [
  { id: 8, title: "Oshi no Ko S2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png", totalEp: 13, status: "planned", addedDate: "Apr 1, 2024" },
  { id: 9, title: "Dandadan", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-2ldCj6QywuOa.jpg", totalEp: 12, status: "planned", addedDate: "Mar 28, 2024" },
]

const pausedList = [
  { id: 10, title: "Blue Lock", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137822-4dVWMSHLpGf6.jpg", currentEp: 15, totalEp: 24, rating: 8, status: "paused", pausedDate: "Mar 1, 2024" },
]

const droppedList = [
  { id: 11, title: "Spy x Family S2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx142838-ECZSqfknAqAT.jpg", currentEp: 6, totalEp: 12, rating: 6, status: "dropped", droppedDate: "Feb 5, 2024" },
]

type AnimeItem = typeof watchingList[0] | typeof completedList[0] | typeof plannedList[0] | typeof pausedList[0] | typeof droppedList[0]

export default function ListPage() {
  const searchParams = useSearchParams()
  const statusParam = searchParams.get("status")
  
  // Map URL status to tab ID
  const statusToTab: Record<string, string> = {
    "watching": "watching",
    "completed": "completed",
    "plan-to-watch": "planned",
    "on-hold": "paused",
    "dropped": "dropped"
  }
  
  const initialTab = statusParam ? (statusToTab[statusParam] || "watching") : "watching"
  const [activeTab, setActiveTab] = useState(initialTab)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])
  
  // Update tab when URL changes
  useEffect(() => {
    if (statusParam && statusToTab[statusParam]) {
      setActiveTab(statusToTab[statusParam])
    }
  }, [statusParam])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "watching": return <Play className="w-4 h-4" />
      case "completed": return <CheckCircle2 className="w-4 h-4" />
      case "planned": return <Clock className="w-4 h-4" />
      case "paused": return <Pause className="w-4 h-4" />
      case "dropped": return <Trash2 className="w-4 h-4" />
      default: return <Eye className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "watching": return "text-green-500 bg-green-500/10"
      case "completed": return "text-accent bg-accent/10"
      case "planned": return "text-blue-500 bg-blue-500/10"
      case "paused": return "text-yellow-500 bg-yellow-500/10"
      case "dropped": return "text-red-500 bg-red-500/10"
      default: return "text-muted-foreground bg-muted"
    }
  }

  const AnimeCard = ({ anime, showProgress = false }: { anime: AnimeItem, showProgress?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-card p-4 flex gap-4 group hover:border-accent/50 transition-all"
    >
      <div className="relative w-20 h-28 md:w-24 md:h-32 rounded-lg overflow-hidden flex-shrink-0">
        <Image
          src={anime.cover}
          alt={anime.title}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-xs">
            <Play className="w-3 h-3 mr-1" fill="white" />
            Watch
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground text-lg group-hover:text-accent transition-colors line-clamp-1">
              {anime.title}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="flex-shrink-0 h-8 w-8 p-0">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Entry
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Play className="w-4 h-4 mr-2" />
                  Update Progress
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Completed
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Pause className="w-4 h-4 mr-2" />
                  Mark Paused
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove from List
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            {"currentEp" in anime && (
              <span>Ep {anime.currentEp}/{anime.totalEp}</span>
            )}
            {"totalEp" in anime && !("currentEp" in anime) && (
              <span>{anime.totalEp} episodes</span>
            )}
            {"rating" in anime && anime.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                <span>{anime.rating}</span>
              </div>
            )}
          </div>

          {"lastWatched" in anime && (
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Last watched {anime.lastWatched}
            </p>
          )}
          {"completedDate" in anime && (
            <p className="text-xs text-muted-foreground mt-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Completed {anime.completedDate}
            </p>
          )}
          {"addedDate" in anime && (
            <p className="text-xs text-muted-foreground mt-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Added {anime.addedDate}
            </p>
          )}
        </div>

        {showProgress && "currentEp" in anime && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{Math.round((anime.currentEp / anime.totalEp) * 100)}%</span>
            </div>
            <Progress value={(anime.currentEp / anime.totalEp) * 100} className="h-1.5" />
          </div>
        )}
      </div>
    </motion.div>
  )

  const tabs = [
    { id: "watching", label: "Watching", count: watchingList.length, list: watchingList },
    { id: "completed", label: "Completed", count: completedList.length, list: completedList },
    { id: "planned", label: "Plan to Watch", count: plannedList.length, list: plannedList },
    { id: "paused", label: "On Hold", count: pausedList.length, list: pausedList },
    { id: "dropped", label: "Dropped", count: droppedList.length, list: droppedList },
  ]

  const currentList = tabs.find(t => t.id === activeTab)?.list || []

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimeDecorations variant="sparse" />
      <Header />
      
      <main className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">My Anime List</h1>
            <p className="text-muted-foreground">Track and manage your anime collection</p>
          </motion.div>

          {/* Stats Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8"
          >
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`glass-card p-4 text-center transition-all duration-300 hover:scale-105 ${
                  activeTab === tab.id ? "border-accent ring-2 ring-accent/20" : ""
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${getStatusColor(tab.id)} flex items-center justify-center mx-auto mb-2`}>
                  {getStatusIcon(tab.id)}
                </div>
                <div className="text-2xl font-bold text-foreground">{tab.count}</div>
                <div className="text-xs text-muted-foreground">{tab.label}</div>
              </button>
            ))}
          </motion.div>

          {/* Tabs and List */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b border-border/50 p-0 mb-6 overflow-x-auto rounded-none h-auto">
              {tabs.map(tab => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  {getStatusIcon(tab.id)}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {tab.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {tabs.map(tab => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {tab.list.length > 0 ? (
                      tab.list.map((anime, index) => (
                        <AnimeCard 
                          key={anime.id} 
                          anime={anime} 
                          showProgress={tab.id === "watching" || tab.id === "paused"}
                        />
                      ))
                    ) : (
                      <div className="glass-card p-12 text-center">
                        <div className={`w-16 h-16 rounded-full ${getStatusColor(tab.id)} flex items-center justify-center mx-auto mb-4`}>
                          {getStatusIcon(tab.id)}
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">No anime here yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Start adding anime to your {tab.label.toLowerCase()} list
                        </p>
                        <Button className="bg-accent hover:bg-accent/90">
                          Browse Anime
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </TabsContent>
              ))}
          </Tabs>
        </div>
      </main>
    </div>
  )
}
