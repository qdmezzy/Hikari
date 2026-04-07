"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { use } from "react"
import { motion } from "framer-motion"
import { 
  MapPin,
  Calendar,
  Link as LinkIcon,
  Clock,
  Trophy,
  Star,
  Play,
  CheckCircle,
  Crown,
  ExternalLink,
  ArrowLeft,
  Tv,
  Heart
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Mock user data for public view
const publicUsers: Record<string, typeof mockUser> = {
  "sakura_cc": {
    name: "Sakura Kinomoto",
    username: "sakura_cc",
    avatar: "https://i.pravatar.cc/300?u=sakura",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    bio: "Anime enthusiast and manga collector. Currently on a quest to watch every Ghibli film. Love slice of life and fantasy genres!",
    location: "Tokyo, Japan",
    website: "https://myanimelist.net/sakura",
    joinedDate: "March 2023",
    isPremium: true,
    level: 42,
    stats: {
      watching: 12,
      completed: 247,
      onHold: 8,
      dropped: 3,
      planToWatch: 89,
      totalEpisodes: 4521,
      daysWatched: 75.3,
      meanScore: 8.4,
    },
    favorites: [
      { title: "Your Name", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21519-fPhvy69sBOIs.png", score: 10 },
      { title: "Spirited Away", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199-eGMfXA2S82nL.jpg", score: 10 },
      { title: "Attack on Titan", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg", score: 9 },
      { title: "Steins;Gate", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-7pdcVzgV63jQ.jpg", score: 10 },
    ],
    recentlyCompleted: [
      { title: "Frieren: Beyond Journey's End", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg", score: 10 },
      { title: "Jujutsu Kaisen S2", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-5fa4ZBbW4dqA.jpg", score: 9 },
      { title: "Solo Leveling", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png", score: 9 },
    ]
  }
}

const mockUser = publicUsers["sakura_cc"]

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = use(params)
  const [isLoaded, setIsLoaded] = React.useState(false)
  
  const user = publicUsers[resolvedParams.username] || mockUser

  React.useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/" className="text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Hikari
          </Link>
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href="/register">
              Join Hikari
            </Link>
          </Button>
        </div>
      </header>
      
      {/* Banner Section */}
      <div className="relative h-56 sm:h-72 md:h-80 overflow-hidden pt-16">
        <Image 
          src={user.banner}
          alt="Profile banner"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Back button */}
        <div className="absolute top-20 left-4">
          <Button variant="ghost" size="sm" className="bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 rounded-full" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="relative -mt-24">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Avatar - centered */}
            <div className="relative inline-block mb-4">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-background overflow-hidden bg-muted shadow-2xl mx-auto">
                <Image 
                  src={user.avatar}
                  alt={user.name}
                  fill
                  className="object-cover"
                />
              </div>
              {user.isPremium && (
                <div className="absolute bottom-2 right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-background">
                  <Crown className="h-4 w-4 text-white" />
                </div>
              )}
            </div>

            {/* User Info - centered */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">{user.name}</h1>
              {user.isPremium && (
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
                  Premium
                </Badge>
              )}
            </div>
            
            <p className="text-muted-foreground mb-3">@{user.username}</p>
            
            {user.bio && (
              <p className="text-foreground/80 max-w-xl mx-auto mb-4 leading-relaxed text-sm sm:text-base">
                {user.bio}
              </p>
            )}
            
            {/* Meta info - centered */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground mb-8">
              {user.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {user.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Joined {user.joinedDate}
              </span>
              {user.website && (
                <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                  <LinkIcon className="h-4 w-4" />
                  Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </motion.div>

          {/* Stats Row - Simple inline design */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-wrap justify-center gap-6 sm:gap-10 py-6 border-y border-border/50 mb-8"
          >
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{user.stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{user.stats.watching}</p>
              <p className="text-xs text-muted-foreground">Watching</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{user.stats.daysWatched}</p>
              <p className="text-xs text-muted-foreground">Days</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{user.stats.totalEpisodes.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Episodes</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{user.stats.meanScore}</p>
              </div>
              <p className="text-xs text-muted-foreground">Avg Score</p>
            </div>
          </motion.div>

          {/* Favorites Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Favorites
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {user.favorites.map((anime, i) => (
                <div key={i} className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-muted">
                  <Image
                    src={anime.image}
                    alt={anime.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium line-clamp-1">{anime.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recently Completed Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="pb-12"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Recently Completed
            </h2>
            <div className="space-y-3">
              {user.recentlyCompleted.map((anime, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-card/50 border border-border/50">
                  <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <Image
                      src={anime.image}
                      alt={anime.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{anime.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs text-muted-foreground">{anime.score}/10</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center pb-12"
          >
            <p className="text-muted-foreground text-sm mb-4">Track your anime journey with Hikari</p>
            <Button size="lg" className="rounded-full px-8" asChild>
              <Link href="/register">
                Create Your Profile
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
