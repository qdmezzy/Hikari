"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Header } from "@/components/header"
import useAuth from "@/hooks/useAuth"
import { 
  Search, Clock, Star, Play, Heart, Plus, ChevronRight, 
  Sparkles, Flame, Calendar, Crown, Eye, Zap, X, ExternalLink, Compass
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Link from "next/link"
import Image from "next/image"

// Featured anime for hero carousel
const featuredAnime = [
  { 
    id: 154587, 
    title: "Frieren: Beyond Journey's End", 
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    rating: 9.1, 
    episodes: 28, 
    description: "After the Demon King's defeat, the hero's party disbands. Frieren, an elf mage, reflects on her journey and the fleeting nature of human life.",
    genres: ["Adventure", "Fantasy", "Drama"],
    studio: "Madhouse"
  },
  { 
    id: 151807, 
    title: "Solo Leveling", 
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-37yfQA3ym8PA.jpg",
    rating: 8.7, 
    episodes: 12,
    description: "In a world where hunters battle monsters, Sung Jinwoo is the weakest E-rank hunter. Until a mysterious quest grants him the power to level up infinitely.",
    genres: ["Action", "Fantasy", "Adventure"],
    studio: "A-1 Pictures"
  },
  { 
    id: 150672, 
    title: "Oshi no Ko", 
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/150672-ISwoA9IW4Sjk.jpg",
    rating: 8.9, 
    episodes: 11,
    description: "A doctor who was a fan of a famous idol reincarnates as her son. Now he must navigate the dark side of the entertainment industry.",
    genres: ["Drama", "Supernatural", "Mystery"],
    studio: "Doga Kobo"
  },
]

const trendingAnime = [
  { id: 154587, title: "Frieren: Beyond Journey's End", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg", rating: 9.1, episodes: 28, status: "Airing", genres: ["Adventure", "Fantasy"], rank: 1, description: "An elf mage reflects on her journey after defeating the Demon King." },
  { id: 151807, title: "Solo Leveling", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png", rating: 8.7, episodes: 12, status: "Completed", genres: ["Action", "Fantasy"], rank: 2, description: "The weakest hunter gains the power to level up infinitely." },
  { id: 145139, title: "Demon Slayer: Hashira Training", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145139-rRimpHGWLhym.png", rating: 8.9, episodes: 8, status: "Airing", genres: ["Action", "Supernatural"], rank: 3, description: "Tanjiro and the demon slayers train with the Hashira." },
  { id: 145064, title: "Jujutsu Kaisen Season 2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-5fa4ZBbW4dqA.jpg", rating: 8.8, episodes: 23, status: "Completed", genres: ["Action", "Supernatural"], rank: 4, description: "Yuji and his friends face powerful curses in Shibuya." },
  { id: 150672, title: "Oshi no Ko", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png", rating: 8.9, episodes: 11, status: "Completed", genres: ["Drama", "Supernatural"], rank: 5, description: "A doctor reincarnates as an idol's son." },
  { id: 142838, title: "Spy x Family Season 2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx142838-ECZSqfknAqAT.jpg", rating: 8.5, episodes: 12, status: "Completed", genres: ["Action", "Comedy"], rank: 6, description: "The Forger family continues their chaotic adventures." },
]

const continueWatching = [
  { id: 131681, title: "Attack on Titan Final", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131681-ODIRpBIbR5Eu.jpg", progress: 85, currentEp: 17, totalEp: 20, nextEpIn: "2 days" },
  { id: 127230, title: "Chainsaw Man", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FlochcFsyoF4.png", progress: 60, currentEp: 7, totalEp: 12, nextEpIn: null },
  { id: 130003, title: "Bocchi the Rock!", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-5Y8rYzg982sq.png", progress: 40, currentEp: 5, totalEp: 12, nextEpIn: null },
]

const seasonalAnime = [
  { id: 137822, title: "Blue Lock Season 2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137822-4dVWMSHLpGf6.jpg", day: "Saturday", time: "23:30", isToday: true },
  { id: 171018, title: "Dandadan", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-2ldCj6QywuOa.jpg", day: "Thursday", time: "21:00", isToday: false },
  { id: 108632, title: "Re:Zero Season 3", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx108632-oCWk2FLm0kAt.jpg", day: "Wednesday", time: "20:30", isToday: false },
  { id: 146065, title: "Mushoku Tensei S2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx146065-K8u9t2X3d5xV.png", day: "Sunday", time: "22:00", isToday: false },
]

type AnimeItem = {
  id: number
  title: string
  cover: string
  rating?: number
  episodes?: number
  status?: string
  genres?: string[]
  rank?: number
  description?: string
  banner?: string
  studio?: string
}

export default function HomePage() {
  const { user, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [currentFeatured, setCurrentFeatured] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null)

  useEffect(() => {
    setIsLoaded(true)
    const interval = setInterval(() => {
      setCurrentFeatured((prev) => (prev + 1) % featuredAnime.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const featured = featuredAnime[currentFeatured]

  const handleAnimeClick = (anime: AnimeItem) => {
    setSelectedAnime(anime)
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-[30%] -right-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-accent/15 via-primary/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full bg-gradient-radial from-sparkle/5 to-transparent blur-2xl" />
      </div>

      <Header user={user} onLogout={logout} />
      
      <main className="relative z-10">
        {/* Epic Hero Section with Featured Anime */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden">
          {/* Banner Background */}
          <AnimatePresence>
            <motion.div
              key={featured.id}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <Image
                src={featured.banner}
                alt={featured.title}
                fill
                className="object-cover"
                priority
              />
              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background" />
            </motion.div>
          </AnimatePresence>

          {/* Hero Content */}
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Info */}
              <AnimatePresence>
                <motion.div
                  key={featured.id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Badges - Cleaner minimal design */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-medium">
                      <Flame className="w-3.5 h-3.5" />
                      Trending
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 backdrop-blur-sm text-foreground/90 text-sm font-medium">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {featured.rating}
                    </span>
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-foreground/10 backdrop-blur-sm text-foreground/70 text-sm">
                      {featured.studio}
                    </span>
                  </div>

                  {/* Title */}
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight">
                    <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent drop-shadow-lg">
                      {featured.title}
                    </span>
                  </h1>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-2">
                    {featured.genres.map((genre) => (
                      <span 
                        key={genre} 
                        className="px-3 py-1 rounded-full text-sm bg-card/50 backdrop-blur-sm border border-border/50 text-foreground/80"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                    {featured.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-accent" />
                      <span className="text-muted-foreground">{featured.episodes} Episodes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-accent" />
                      <span className="text-muted-foreground">2.4M Tracking</span>
                    </div>
                  </div>

                  {/* CTAs - Fixed: No more "Watch Now" */}
                  <div className="flex flex-wrap gap-4 pt-4">
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 shadow-lg shadow-primary/25 group"
                      onClick={() => handleAnimeClick(featured)}
                    >
                      <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                      Add to List
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="border-2 border-foreground/20 hover:bg-foreground/10 backdrop-blur-sm group"
                      onClick={() => handleAnimeClick(featured)}
                    >
                      <Eye className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                      View Details
                    </Button>
                    <Button size="lg" variant="ghost" className="hover:bg-red-500/10 hover:text-red-400 group">
                      <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>

{/* Right Side - Featured Cover Card */}
          <div className="hidden lg:flex justify-center">
            <AnimatePresence>
              <motion.div
                key={featured.id}
                initial={{ opacity: 0, y: 30, rotateY: -15 }}
                    animate={{ opacity: 1, y: 0, rotateY: 0 }}
                    exit={{ opacity: 0, y: -30, rotateY: 15 }}
                    transition={{ duration: 0.6 }}
                    className="relative cursor-pointer"
                    onClick={() => handleAnimeClick(featured)}
                  >
                    {/* Glow Effect */}
                    <div className="absolute -inset-4 bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40 rounded-3xl blur-2xl opacity-60" />
                    
                    {/* Card */}
                    <div className="relative w-72 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 hover:scale-105 transition-transform duration-300">
                      <Image
                        src={featured.cover}
                        alt={featured.title}
                        fill
                        className="object-cover"
                      />
                      {/* Shine Effect */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] animate-shimmer" />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Carousel Indicators */}
            <div className="flex items-center justify-center gap-3 mt-12">
              {featuredAnime.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentFeatured(index)}
                  className={`relative h-1.5 rounded-full transition-all duration-500 ${
                    index === currentFeatured 
                      ? "w-12 bg-gradient-to-r from-primary to-accent" 
                      : "w-6 bg-foreground/20 hover:bg-foreground/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Quick Search Bar - No keyboard shortcut */}
        <section className="relative -mt-8 px-4 z-20">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative flex items-center bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
                <Search className="absolute left-5 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for anime, manga, characters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-14 pr-32 py-7 text-lg bg-transparent border-0 focus-visible:ring-0 placeholder:text-muted-foreground/60"
                />
                <div className="absolute right-3 flex items-center gap-2">
                  <Link href={searchQuery ? `/search?q=${encodeURIComponent(searchQuery)}` : "/search"}>
                    <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg">
                      <Zap className="w-4 h-4 mr-2" />
                      Search
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Continue Watching Section */}
        <section className="px-4 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Play className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Continue Watching</h2>
                  <p className="text-sm text-muted-foreground">Pick up where you left off</p>
                </div>
              </div>
              <Link href="/list" className="text-accent hover:text-accent/80 flex items-center gap-1 text-sm font-medium group">
                View All 
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {continueWatching.map((anime, index) => (
                <Link key={anime.id} href={`/anime/${anime.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group cursor-pointer"
                >
                  <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                    <div className="flex gap-4 p-4">
                      {/* Cover */}
                      <div className="relative w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                        <Image
                          src={anime.cover}
                          alt={anime.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Plus className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h3 className="font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                            {anime.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Episode {anime.currentEp} of {anime.totalEp}
                          </p>
                          {anime.nextEpIn && (
                            <Badge variant="outline" className="mt-2 text-xs border-green-500/30 text-green-500 bg-green-500/10">
                              <Clock className="w-3 h-3 mr-1" />
                              Next in {anime.nextEpIn}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="space-y-2 mt-3">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${anime.progress}%` }}
                              transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{anime.progress}% complete</span>
                            <span>{anime.totalEp - anime.currentEp} left</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Section */}
        <section className="px-4 py-16 relative">
          {/* Section Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
          
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Flame className="w-6 h-6 text-orange-500" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Trending Now</h2>
                  <p className="text-sm text-muted-foreground">Most popular this season</p>
                </div>
              </div>
              <Link href="/browse" className="text-accent hover:text-accent/80 flex items-center gap-1 text-sm font-medium group">
                Browse All 
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {trendingAnime.map((anime, index) => (
                <Link key={anime.id} href={`/anime/${anime.id}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  onMouseEnter={() => setHoveredCard(anime.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg group-hover:shadow-2xl group-hover:shadow-primary/20 transition-all duration-300 group-hover:-translate-y-2">
                    <Image
                      src={anime.cover}
                      alt={anime.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    
                    {/* Rank Badge */}
                    <div className="absolute top-3 left-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shadow-lg ${
                        anime.rank === 1 ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white" :
                        anime.rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800" :
                        anime.rank === 3 ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white" :
                        "bg-card/80 backdrop-blur-sm text-foreground"
                      }`}>
                        {anime.rank}
                      </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                      <span className="text-xs font-bold text-white">{anime.rating}</span>
                    </div>

                    {/* Status Badge */}
                    <Badge 
                      className={`absolute top-12 right-3 text-[10px] ${
                        anime.status === "Airing" 
                          ? "bg-green-500 hover:bg-green-500 text-white" 
                          : "bg-accent/90 hover:bg-accent text-white"
                      }`}
                    >
                      {anime.status}
                    </Badge>

                    {/* Hover Actions - Fixed: No more AnimatePresence issues */}
                    {hoveredCard === anime.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute inset-x-0 bottom-16 p-3 flex gap-2 justify-center"
                      >
                        <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="sm" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm">
                          <Heart className="w-4 h-4" />
                        </Button>
                        <Button size="sm" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    )}

                    {/* Title & Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-bold text-white text-sm line-clamp-2 drop-shadow-lg mb-1">
                        {anime.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-white/70">
                        <span>{anime.episodes} eps</span>
                        <span className="w-1 h-1 rounded-full bg-white/50" />
                        <span>{anime.genres[0]}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Airing Schedule Section */}
        <section className="px-4 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-purple-500" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Airing Schedule</h2>
                  <p className="text-sm text-muted-foreground">Don&apos;t miss your favorite shows</p>
                </div>
              </div>
              <Link href="/schedule" className="text-accent hover:text-accent/80 flex items-center gap-1 text-sm font-medium group">
                Full Schedule 
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {seasonalAnime.map((anime, index) => (
                <motion.div
                  key={anime.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: isLoaded ? 1 : 0, x: isLoaded ? 0 : -30 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className={`group cursor-pointer relative ${anime.isToday ? 'ring-2 ring-green-500/50' : ''}`}
                  onClick={() => handleAnimeClick(anime as AnimeItem)}
                >
                  {anime.isToday && (
                    <div className="absolute -top-2 left-4 z-10">
                      <Badge className="bg-green-500 text-white text-[10px] shadow-lg">
                        <Zap className="w-3 h-3 mr-1" />
                        Airing Today
                      </Badge>
                    </div>
                  )}
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden hover:border-accent/50 hover:shadow-xl transition-all duration-300 p-4 flex gap-4">
                    <div className="relative w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                      <Image
                        src={anime.cover}
                        alt={anime.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <h3 className="font-bold text-foreground text-sm line-clamp-2 group-hover:text-accent transition-colors">
                        {anime.title}
                      </h3>
                      <div className="space-y-2">
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10">
                          {anime.day}
                        </Badge>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {anime.time}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section - Fixed: No more "Get Started" confusion */}
        <section className="px-4 py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20" />
          <div className="max-w-4xl mx-auto relative text-center">
            <Badge className="mb-6 bg-gradient-to-r from-primary to-accent text-white border-0">
              <Sparkles className="w-3 h-3 mr-1" />
              Join the Community
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black text-foreground mb-4">
              Track anime <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">spoiler-free</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              The anime tracker that actually gets it. AI recommendations, one-tap tracking, and a community that respects your watch progress.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-8 shadow-lg shadow-primary/25">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Tracking Free
                </Button>
              </Link>
              <Link href="/discover">
                <Button size="lg" variant="outline" className="border-2 border-foreground/20 hover:bg-foreground/10 backdrop-blur-sm">
                  <Compass className="w-5 h-5 mr-2" />
                  Discover Feed
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <span className="text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Hikari
                </span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Your ultimate anime tracking companion. Discover, track, and share your anime journey.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Explore</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/browse" className="hover:text-accent transition-colors">Browse Anime</Link></li>
                <li><Link href="/seasonal" className="hover:text-accent transition-colors">Seasonal</Link></li>
                <li><Link href="/discover" className="hover:text-accent transition-colors">Discover Feed</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Community</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/reviews" className="hover:text-accent transition-colors">Reviews</Link></li>
                <li><Link href="/recommendations" className="hover:text-accent transition-colors">AI Recommendations</Link></li>
                <li><a href="https://discord.gg/hikari" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-1">Discord <ExternalLink className="w-3 h-3" /></a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Account</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-accent transition-colors">Login</Link></li>
                <li><Link href="/register" className="hover:text-accent transition-colors">Sign Up</Link></li>
                <li><Link href="/profile" className="hover:text-accent transition-colors">Profile</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Made with love for anime fans everywhere
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-accent transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-accent transition-colors">Terms</Link>
              <Link href="/about" className="hover:text-accent transition-colors">About</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Anime Detail Modal */}
      <Dialog open={!!selectedAnime} onOpenChange={(open) => !open && setSelectedAnime(null)}>
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-border/50">
          {selectedAnime && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">{selectedAnime.title}</DialogTitle>
                <DialogDescription className="sr-only">
                  Details and information about {selectedAnime.title}
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-6">
                <div className="relative w-40 aspect-[3/4] rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                  <Image
                    src={selectedAnime.cover}
                    alt={selectedAnime.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedAnime.genres?.map((genre) => (
                      <Badge key={genre} variant="outline" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                    {selectedAnime.rating && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        {selectedAnime.rating}
                      </Badge>
                    )}
                    {selectedAnime.status && (
                      <Badge className={selectedAnime.status === "Airing" ? "bg-green-500/20 text-green-400" : "bg-accent/20 text-accent"}>
                        {selectedAnime.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {selectedAnime.description || "No description available."}
                  </p>
                  {selectedAnime.episodes && (
                    <p className="text-sm text-muted-foreground">
                      <Play className="w-4 h-4 inline mr-1" />
                      {selectedAnime.episodes} Episodes
                    </p>
                  )}
                  <div className="flex gap-3 pt-4">
                    <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 flex-1">
                      <Plus className="w-4 h-4 mr-2" />
                      Add to List
                    </Button>
                    <Button variant="outline">
                      <Heart className="w-4 h-4" />
                    </Button>
                    <Link href={`/anime/${selectedAnime.id}`}>
                      <Button variant="outline">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Full Page
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
