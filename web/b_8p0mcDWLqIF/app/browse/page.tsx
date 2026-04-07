"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { AnimeDecorations } from "@/components/anime-decorations"
import { Search, Filter, Grid, List, Star, Heart, Plus, ChevronDown, X, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Image from "next/image"

const genres = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", 
  "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural"
]

const animeList = [
  { id: 1, title: "Frieren: Beyond Journey's End", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg", rating: 9.1, episodes: 28, status: "Airing", year: 2023, genres: ["Adventure", "Fantasy"], studio: "Madhouse" },
  { id: 2, title: "Solo Leveling", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png", rating: 8.7, episodes: 12, status: "Completed", year: 2024, genres: ["Action", "Fantasy"], studio: "A-1 Pictures" },
  { id: 3, title: "Demon Slayer: Hashira Training", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145139-rRimpHGWLhym.png", rating: 8.9, episodes: 8, status: "Airing", year: 2024, genres: ["Action", "Supernatural"], studio: "ufotable" },
  { id: 4, title: "Jujutsu Kaisen Season 2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-5fa4ZBbW4dqA.jpg", rating: 8.8, episodes: 23, status: "Completed", year: 2023, genres: ["Action", "Supernatural"], studio: "MAPPA" },
  { id: 5, title: "Oshi no Ko", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png", rating: 8.9, episodes: 11, status: "Completed", year: 2023, genres: ["Drama", "Supernatural"], studio: "Doga Kobo" },
  { id: 6, title: "Spy x Family Season 2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx142838-ECZSqfknAqAT.jpg", rating: 8.5, episodes: 12, status: "Completed", year: 2023, genres: ["Action", "Comedy"], studio: "Wit Studio" },
  { id: 7, title: "Attack on Titan Final", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131681-ODIRpBIbR5Eu.jpg", rating: 9.0, episodes: 20, status: "Completed", year: 2023, genres: ["Action", "Drama"], studio: "MAPPA" },
  { id: 8, title: "Chainsaw Man", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FlochcFsyoF4.png", rating: 8.6, episodes: 12, status: "Completed", year: 2022, genres: ["Action", "Supernatural"], studio: "MAPPA" },
  { id: 9, title: "Bocchi the Rock!", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-5Y8rYzg982sq.png", rating: 8.8, episodes: 12, status: "Completed", year: 2022, genres: ["Comedy", "Slice of Life"], studio: "CloverWorks" },
  { id: 10, title: "Blue Lock", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137822-4dVWMSHLpGf6.jpg", rating: 8.3, episodes: 24, status: "Completed", year: 2022, genres: ["Sports", "Drama"], studio: "8bit" },
  { id: 11, title: "Vinland Saga S2", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx136430-f8Iza5GEynBR.jpg", rating: 9.0, episodes: 24, status: "Completed", year: 2023, genres: ["Action", "Adventure"], studio: "MAPPA" },
  { id: 12, title: "Mob Psycho 100 III", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140439-5Fv4E6XxMxqu.jpg", rating: 8.9, episodes: 12, status: "Completed", year: 2022, genres: ["Action", "Comedy"], studio: "Bones" },
]

export default function BrowsePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("popularity")
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    )
  }

  const filteredAnime = animeList.filter(anime => {
    const matchesSearch = anime.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGenres = selectedGenres.length === 0 || selectedGenres.some(g => anime.genres.includes(g))
    return matchesSearch && matchesGenres
  })

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimeDecorations variant="sparse" />
      <Header />
      
      <main className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Browse Anime</h1>
            <p className="text-muted-foreground">Discover new anime to add to your watchlist</p>
          </motion.div>

          {/* Search and Filters Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-card p-4 mb-6"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full lg:w-48 bg-background/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popularity">Popularity</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="alphabetical">A-Z</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
                <Button
                  size="sm"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  onClick={() => setViewMode("grid")}
                  className="px-3"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  onClick={() => setViewMode("list")}
                  className="px-3"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile Filter Button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {selectedGenres.length > 0 && (
                      <Badge className="ml-2 bg-accent">{selectedGenres.length}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Genres</h4>
                    <div className="space-y-2">
                      {genres.map(genre => (
                        <div key={genre} className="flex items-center gap-2">
                          <Checkbox
                            id={`mobile-${genre}`}
                            checked={selectedGenres.includes(genre)}
                            onCheckedChange={() => toggleGenre(genre)}
                          />
                          <label htmlFor={`mobile-${genre}`} className="text-sm cursor-pointer">
                            {genre}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Genre Tags - Desktop */}
            <div className="hidden lg:flex flex-wrap gap-2 mt-4">
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedGenres.includes(genre)
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {/* Active Filters */}
            {selectedGenres.length > 0 && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                <span className="text-sm text-muted-foreground">Active:</span>
                {selectedGenres.map(genre => (
                  <Badge
                    key={genre}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedGenres([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              </div>
            )}
          </motion.div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredAnime.length} anime
          </p>

          {/* Anime Grid/List */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredAnime.map((anime, index) => (
                <motion.div
                  key={anime.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  onMouseEnter={() => setHoveredCard(anime.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:shadow-accent/20 transition-all duration-300 group-hover:scale-[1.02]">
                    <Image
                      src={anime.cover}
                      alt={anime.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Rating */}
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                      <span className="text-xs font-semibold text-white">{anime.rating}</span>
                    </div>

                    {/* Hover Actions */}
                    {hoveredCard === anime.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute inset-x-0 bottom-12 p-3 flex gap-2"
                      >
                        <Button size="sm" className="flex-1 bg-accent hover:bg-accent/90 text-xs">
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                        <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm">
                          <Heart className="w-3 h-3" />
                        </Button>
                      </motion.div>
                    )}

                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="font-semibold text-white text-sm line-clamp-2 drop-shadow-lg">
                        {anime.title}
                      </h3>
                      <p className="text-xs text-white/70 mt-1">{anime.year} · {anime.episodes} eps</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnime.map((anime, index) => (
                <motion.div
                  key={anime.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, x: isLoaded ? 0 : -20 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  className="glass-card p-4 flex gap-4 group cursor-pointer hover:border-accent/50 transition-all"
                >
                  <div className="relative w-20 h-28 md:w-24 md:h-32 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={anime.cover}
                      alt={anime.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg group-hover:text-accent transition-colors line-clamp-1">
                        {anime.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {anime.studio} · {anime.year} · {anime.episodes} episodes
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {anime.genres.map(genre => (
                          <Badge key={genre} variant="outline" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                        <span className="font-semibold text-foreground">{anime.rating}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Heart className="w-4 h-4" />
                        </Button>
                        <Button size="sm" className="bg-accent hover:bg-accent/90">
                          <Plus className="w-4 h-4 mr-1" />
                          Add to List
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Load More */}
          <div className="flex justify-center mt-12">
            <Button variant="outline" size="lg" className="px-8">
              Load More
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
