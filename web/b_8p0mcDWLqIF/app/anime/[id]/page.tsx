"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { 
  Star, Heart, Plus, Play, Clock, Calendar, Users, 
  ChevronRight, ExternalLink, Check, Bookmark
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import Image from "next/image"
import { use } from "react"
import useAuth from "@/hooks/useAuth"

// Mock anime data - in real app this would be fetched from AniList API
const animeData: Record<string, {
  id: number
  title: string
  titleJapanese: string
  cover: string
  banner: string
  rating: number
  episodes: number
  status: string
  genres: string[]
  description: string
  studio: string
  season: string
  year: number
  popularity: number
  favorites: number
  duration: string
  source: string
}> = {
  "154587": {
    id: 154587,
    title: "Frieren: Beyond Journey's End",
    titleJapanese: "Sousou no Frieren",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    rating: 9.1,
    episodes: 28,
    status: "Airing",
    genres: ["Adventure", "Fantasy", "Drama"],
    description: "After the Demon King's defeat, the hero's party disbands. Frieren, an elf mage, reflects on her journey and the fleeting nature of human life. As she embarks on a new journey to learn more about humanity, she discovers the meaning of connections she never fully appreciated.",
    studio: "Madhouse",
    season: "Fall",
    year: 2023,
    popularity: 245678,
    favorites: 34521,
    duration: "24 min",
    source: "Manga"
  },
  "151807": {
    id: 151807,
    title: "Solo Leveling",
    titleJapanese: "Ore dake Level Up na Ken",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-37yfQA3ym8PA.jpg",
    rating: 8.7,
    episodes: 12,
    status: "Completed",
    genres: ["Action", "Fantasy", "Adventure"],
    description: "In a world where hunters battle monsters, Sung Jinwoo is the weakest E-rank hunter. Until a mysterious quest grants him the power to level up infinitely. Follow his journey from the weakest to the strongest hunter.",
    studio: "A-1 Pictures",
    season: "Winter",
    year: 2024,
    popularity: 312456,
    favorites: 45678,
    duration: "24 min",
    source: "Web Novel"
  },
  "150672": {
    id: 150672,
    title: "Oshi no Ko",
    titleJapanese: "Oshi no Ko",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/150672-ISwoA9IW4Sjk.jpg",
    rating: 8.9,
    episodes: 11,
    status: "Completed",
    genres: ["Drama", "Supernatural", "Mystery"],
    description: "A doctor who was a fan of a famous idol reincarnates as her son. Now he must navigate the dark side of the entertainment industry while uncovering the truth behind his mother's death.",
    studio: "Doga Kobo",
    season: "Spring",
    year: 2023,
    popularity: 287654,
    favorites: 39876,
    duration: "90 min / 24 min",
    source: "Manga"
  },
  "145139": {
    id: 145139,
    title: "Demon Slayer: Hashira Training Arc",
    titleJapanese: "Kimetsu no Yaiba: Hashira Geiko-hen",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145139-rRimpHGWLhym.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/145139-V01Prh6HxPmE.jpg",
    rating: 8.9,
    episodes: 8,
    status: "Airing",
    genres: ["Action", "Supernatural", "Fantasy"],
    description: "Tanjiro and the demon slayers undergo intense training with the Hashira to prepare for the final battle against Muzan Kibutsuji.",
    studio: "ufotable",
    season: "Spring",
    year: 2024,
    popularity: 198765,
    favorites: 28765,
    duration: "24 min",
    source: "Manga"
  },
  "145064": {
    id: 145064,
    title: "Jujutsu Kaisen Season 2",
    titleJapanese: "Jujutsu Kaisen 2nd Season",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-5fa4ZBbW4dqA.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/145064-S7qAgxf6kMrW.jpg",
    rating: 8.8,
    episodes: 23,
    status: "Completed",
    genres: ["Action", "Supernatural"],
    description: "The past of Gojo Satoru and Geto Suguru unfolds, followed by the Shibuya Incident where Yuji and the jujutsu sorcerers face their greatest challenge yet.",
    studio: "MAPPA",
    season: "Summer",
    year: 2023,
    popularity: 345678,
    favorites: 56789,
    duration: "24 min",
    source: "Manga"
  },
  "142838": {
    id: 142838,
    title: "Spy x Family Season 2",
    titleJapanese: "Spy x Family Season 2",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx142838-ECZSqfknAqAT.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/142838-tynIEnAlsNWz.jpg",
    rating: 8.5,
    episodes: 12,
    status: "Completed",
    genres: ["Action", "Comedy", "Slice of Life"],
    description: "The Forger family continues their chaotic daily life as Loid, Yor, and Anya each maintain their secret identities while growing closer as a family.",
    studio: "Wit Studio",
    season: "Fall",
    year: 2023,
    popularity: 267890,
    favorites: 34567,
    duration: "24 min",
    source: "Manga"
  },
  "131681": {
    id: 131681,
    title: "Attack on Titan: The Final Season",
    titleJapanese: "Shingeki no Kyojin: The Final Season",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131681-ODIRpBIbR5Eu.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/131681-Zzeq4PLWJCL2.jpg",
    rating: 9.0,
    episodes: 20,
    status: "Completed",
    genres: ["Action", "Drama", "Fantasy"],
    description: "The epic conclusion to the Attack on Titan saga. Eren's true intentions are finally revealed as the world faces the Rumbling.",
    studio: "MAPPA",
    season: "Winter",
    year: 2024,
    popularity: 456789,
    favorites: 78901,
    duration: "24 min",
    source: "Manga"
  },
  "127230": {
    id: 127230,
    title: "Chainsaw Man",
    titleJapanese: "Chainsaw Man",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FlochcFsyoF4.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/127230-1Rb9kG6z5gRK.jpg",
    rating: 8.6,
    episodes: 12,
    status: "Completed",
    genres: ["Action", "Horror", "Supernatural"],
    description: "Denji, a young man with a devil dog companion, becomes a hybrid devil-human and joins the Public Safety Devil Hunters.",
    studio: "MAPPA",
    season: "Fall",
    year: 2022,
    popularity: 398765,
    favorites: 67890,
    duration: "24 min",
    source: "Manga"
  },
  "130003": {
    id: 130003,
    title: "Bocchi the Rock!",
    titleJapanese: "Bocchi the Rock!",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-5Y8rYzg982sq.png",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/130003-z7NMnkYNwt66.jpg",
    rating: 8.8,
    episodes: 12,
    status: "Completed",
    genres: ["Comedy", "Music", "Slice of Life"],
    description: "Hitori Goto is a lonely high schooler who learned guitar to become a rockstar. When she joins a band, she must overcome her social anxiety.",
    studio: "CloverWorks",
    season: "Fall",
    year: 2022,
    popularity: 234567,
    favorites: 45678,
    duration: "24 min",
    source: "Manga"
  }
}

// Default anime for unknown IDs
const defaultAnime = {
  id: 0,
  title: "Unknown Anime",
  titleJapanese: "Unknown",
  cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg",
  banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
  rating: 0,
  episodes: 0,
  status: "Unknown",
  genres: ["Unknown"],
  description: "No description available.",
  studio: "Unknown",
  season: "Unknown",
  year: 2024,
  popularity: 0,
  favorites: 0,
  duration: "Unknown",
  source: "Unknown"
}

export default function AnimePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { user, logout } = useAuth()
  const anime = animeData[resolvedParams.id] || { ...defaultAnime, id: parseInt(resolvedParams.id) }
  
  const [isInList, setIsInList] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [listStatus, setListStatus] = useState<string>("plan_to_watch")
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={logout} />
      
      {/* Banner */}
      <div className="relative h-[50vh] overflow-hidden">
        <Image
          src={anime.banner}
          alt={anime.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 -mt-64">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cover & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
            transition={{ duration: 0.5 }}
            className="flex-shrink-0"
          >
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40 rounded-3xl blur-xl opacity-60" />
              
              {/* Cover */}
              <div className="relative w-56 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                <Image
                  src={anime.cover}
                  alt={anime.title}
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              {isInList ? (
                <Select value={listStatus} onValueChange={setListStatus}>
                  <SelectTrigger className="w-full h-12 bg-gradient-to-r from-primary to-accent text-white border-0">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="watching">Watching</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="plan_to_watch">Plan to Watch</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Button 
                  className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/25"
                  onClick={() => setIsInList(true)}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add to List
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className={`w-full h-12 ${isFavorite ? 'bg-red-500/10 border-red-500/50 text-red-400' : ''}`}
                onClick={() => setIsFavorite(!isFavorite)}
              >
                <Heart className={`w-5 h-5 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                {isFavorite ? 'Favorited' : 'Add to Favorites'}
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Popularity</span>
                <span className="text-foreground font-medium">#{anime.popularity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Favorites</span>
                <span className="text-foreground font-medium">{anime.favorites.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 space-y-6"
          >
            {/* Title */}
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-foreground mb-2">
                {anime.title}
              </h1>
              <p className="text-lg text-muted-foreground">{anime.titleJapanese}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1">
                <Star className="w-4 h-4 mr-1 fill-current" />
                {anime.rating} / 10
              </Badge>
              <Badge className={`px-3 py-1 ${
                anime.status === "Airing" 
                  ? "bg-green-500/20 text-green-400 border-green-500/30" 
                  : "bg-accent/20 text-accent border-accent/30"
              }`}>
                {anime.status}
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Play className="w-4 h-4 mr-1" />
                {anime.episodes} Episodes
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Clock className="w-4 h-4 mr-1" />
                {anime.duration}
              </Badge>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {anime.genres.map((genre) => (
                <Link key={genre} href={`/browse?genre=${genre.toLowerCase()}`}>
                  <Badge 
                    variant="outline" 
                    className="px-4 py-2 hover:bg-primary/10 hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    {genre}
                  </Badge>
                </Link>
              ))}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Studio", value: anime.studio, icon: Users },
                { label: "Season", value: `${anime.season} ${anime.year}`, icon: Calendar },
                { label: "Source", value: anime.source, icon: Bookmark },
                { label: "Duration", value: anime.duration, icon: Clock },
              ].map((item) => (
                <div key={item.label} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <item.icon className="w-4 h-4" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  <span className="font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="mt-8">
              <TabsList className="bg-card/50 backdrop-blur-sm border border-border/50 p-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="episodes">Episodes</TabsTrigger>
                <TabsTrigger value="characters">Characters</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-6">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-foreground mb-4">Synopsis</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {anime.description}
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="episodes" className="mt-6">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-foreground mb-4">Episodes</h3>
                  <div className="space-y-3">
                    {Array.from({ length: Math.min(anime.episodes, 10) }, (_, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {i + 1}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Episode {i + 1}</div>
                            <div className="text-sm text-muted-foreground">{anime.duration}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    ))}
                    {anime.episodes > 10 && (
                      <Button variant="outline" className="w-full">
                        View All {anime.episodes} Episodes
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="characters" className="mt-6">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 text-center text-muted-foreground">
                  Character information coming soon...
                </div>
              </TabsContent>
              
              <TabsContent value="reviews" className="mt-6">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 text-center text-muted-foreground">
                  No reviews yet. Be the first to review!
                </div>
              </TabsContent>
            </Tabs>

            {/* External Links */}
            <div className="flex flex-wrap gap-3 pt-4">
              <a 
                href={`https://anilist.co/anime/${anime.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  AniList
                </Button>
              </a>
              <a 
                href={`https://myanimelist.net/anime/${anime.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  MyAnimeList
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Spacing */}
      <div className="h-24" />
    </div>
  )
}
