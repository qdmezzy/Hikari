"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Users, TrendingUp, UserPlus } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import { addNotification } from "@/lib/notifications-store"
import { emitSocialFollowing, subscribeSocialFollowing, subscribeSocialPosts } from "@/lib/social-events"
import { fetchFollowingIds, fetchSocialPosts, toggleFollow } from "@/lib/social-service"

export function SocialSidebar() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [posts, setPosts] = useState([])
  const [following, setFollowing] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadError, setLoadError] = useState("")
  const mutedIds = useMemo(() => {
    const ids = Array.isArray(user?.user_metadata?.muted_user_ids)
      ? user.user_metadata.muted_user_ids
      : []
    return ids.map((value) => String(value))
  }, [user])

  useEffect(() => {
    let active = true

    const loadPosts = async () => {
      setLoadingPosts(true)
      setLoadError("")
      try {
        const data = await fetchSocialPosts(user?.id)
        if (active) {
          setPosts(data)
        }
      } catch (error) {
        if (active) {
          setPosts([])
          setLoadError(error.message || "Could not load social posts.")
        }
      } finally {
        if (active) {
          setLoadingPosts(false)
        }
      }
    }

    loadPosts()
    const unsubscribe = subscribeSocialPosts(loadPosts)
    return () => {
      active = false
      unsubscribe()
    }
  }, [user?.id])

  useEffect(() => {
    let active = true

    const loadFollowing = async () => {
      if (!user) {
        setFollowing([])
        return
      }
      try {
        const ids = await fetchFollowingIds(user.id)
        if (active) {
          setFollowing(ids)
        }
      } catch (error) {
        if (active) {
          setFollowing([])
        }
      }
    }

    loadFollowing()
    const unsubscribe = subscribeSocialFollowing(loadFollowing)
    return () => {
      active = false
      unsubscribe()
    }
  }, [user?.id])

  const trendingTopics = useMemo(() => {
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      if (mutedIds.includes(String(post.user_id))) return acc
      if (!post.fandom) return acc
      const key = post.fandom.trim()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .map(([name, count]) => ({
        tag: `#${name.replace(/\s+/g, "")}`,
        posts: Number(count) || 0,
      }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 3)
  }, [posts])

  const activeFandoms = useMemo(() => {
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      if (mutedIds.includes(String(post.user_id))) return acc
      if (!post.fandom) return acc
      const key = post.fandom.trim()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        posts: Number(count) || 0,
      }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 3)
  }, [posts])

  const suggestedUsers = useMemo(() => {
    const map = new Map()
    posts.forEach((post) => {
      if (mutedIds.includes(String(post.user_id))) return
      if (!post.user_id || post.user_id === user?.id) return
      if (map.has(post.user_id)) return
      map.set(post.user_id, {
        id: post.user_id,
        name: post.user_display_name || "User",
        handle: post.user_handle,
        avatar: post.user_display_name?.slice(0, 1).toUpperCase() || "U",
      })
    })
    return Array.from(map.values())
  }, [posts, user?.id, mutedIds])

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return suggestedUsers
    const query = searchQuery.toLowerCase()
    return suggestedUsers.filter(
      (item) =>
        item.name.toLowerCase().includes(query) || (item.handle || "").toLowerCase().includes(query),
    )
  }, [suggestedUsers, searchQuery])

  const handleToggleFollow = async (userId, handle) => {
    if (!user) return
    const isFollowing = following.includes(userId)
    const next = isFollowing ? following.filter((id) => id !== userId) : [...following, userId]
    setFollowing(next)
    emitSocialFollowing()

    try {
      await toggleFollow({ followerId: user.id, followingId: userId, isFollowing })
      addNotification(user.id, {
        title: isFollowing ? "Unfollowed" : "Following",
        message: `${isFollowing ? "You unfollowed" : "You followed"} ${handle}.`,
        type: "follow",
      })
    } catch (error) {
      setFollowing(isFollowing ? [...following, userId] : following.filter((id) => id !== userId))
    }
  }

  return (
    <div className="space-y-5 sticky top-24">
      <div className="relative animate-slide-up">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-black/40 border-white/10 h-9 text-sm transition-smooth focus:ring-2 focus:ring-pink-500/20"
        />
      </div>

      <Card className="border border-white/10 bg-black/40 animate-slide-up stagger-1 shadow-lg shadow-black/20">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-pink-500" />
            Trending
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-1">
          {loadingPosts ? (
            <p className="text-xs text-muted-foreground py-2">Loading topics...</p>
          ) : loadError ? (
            <p className="text-xs text-muted-foreground py-2">{loadError}</p>
          ) : trendingTopics.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No trending topics yet.</p>
          ) : (
            trendingTopics.map((topic) => (
              <div
                key={topic.tag}
                className="flex items-center justify-between cursor-pointer hover:bg-secondary/50 -mx-1 px-2 py-1.5 rounded-lg transition-smooth"
              >
                <span className="text-sm font-medium">{topic.tag}</span>
                <span className="text-xs text-muted-foreground">{topic.posts}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-black/40 animate-slide-up stagger-2 shadow-lg shadow-black/20">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Active Fandoms
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-1">
          {loadingPosts ? (
            <p className="text-xs text-muted-foreground py-2">Loading fandoms...</p>
          ) : loadError ? (
            <p className="text-xs text-muted-foreground py-2">{loadError}</p>
          ) : activeFandoms.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No fandom activity yet.</p>
          ) : (
            activeFandoms.map((fandom) => (
              <div
                key={fandom.name}
                className="flex items-center justify-between cursor-pointer hover:bg-secondary/50 -mx-1 px-2 py-1.5 rounded-lg transition-smooth"
              >
                <div>
                  <p className="text-sm font-medium">{fandom.name}</p>
                  <p className="text-xs text-muted-foreground">{fandom.posts} posts</p>
                </div>
                <Badge variant="secondary" className="text-[10px] text-green-400 px-1.5">
                  Active
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-black/40 animate-slide-up stagger-3 shadow-lg shadow-black/20">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-purple-400" />
            Who to Follow
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          {loadingPosts ? (
            <p className="text-xs text-muted-foreground py-2">Loading suggestions...</p>
          ) : loadError ? (
            <p className="text-xs text-muted-foreground py-2">{loadError}</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No suggestions yet.</p>
          ) : (
            filteredUsers.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-xs">
                    {entry.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{entry.handle}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full h-7 px-3 text-xs bg-transparent transition-smooth hover:bg-pink-500/10 hover:text-pink-400 hover:border-pink-500/50"
                  onClick={() => handleToggleFollow(entry.id, entry.handle)}
                >
                  {following.includes(entry.id) ? "Following" : "Follow"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
