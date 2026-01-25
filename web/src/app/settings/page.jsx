"use client"

import { useEffect, useRef, useState } from "react"
import { Navigation } from "@/components/Navigation"
import RequireAuth from "@/components/RequireAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Bell, Shield, Palette, Link2, Eye, EyeOff, Save } from "lucide-react"
import useAuth from "@/hooks/useAuth"
import { useTheme } from "next-themes"
import client from "@/lib/client"

export default function SettingsPage() {
  const { user } = useAuth()
  const [spoilersOff, setSpoilersOff] = useState(true)
  const { theme, setTheme } = useTheme()
  const [displayName, setDisplayName] = useState("")
  const [handle, setHandle] = useState("")
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [website, setWebsite] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarPath, setAvatarPath] = useState("")
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileSaved, setProfileSaved] = useState(false)
  const [mutedIds, setMutedIds] = useState([])
  const [mutedUsers, setMutedUsers] = useState([])
  const [mutedLoading, setMutedLoading] = useState(false)
  const [mutedError, setMutedError] = useState("")
  const [notifyEpisodes, setNotifyEpisodes] = useState(true)
  const [notifyPreAir, setNotifyPreAir] = useState(true)
  const [notifyDigest, setNotifyDigest] = useState(false)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const fileInputRef = useRef(null)
  const avatarBucket = process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || "avatars"

  useEffect(() => {
    setDisplayName(user?.user_metadata?.display_name || "")
    setHandle(user?.user_metadata?.username || user?.user_metadata?.handle || "")
    setBio(user?.user_metadata?.bio || "")
    setLocation(user?.user_metadata?.location || "")
    setWebsite(user?.user_metadata?.website || "")
    setAvatarUrl(user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || "")
    setAvatarPath(user?.user_metadata?.avatar_path || "")
    setSpoilersOff(user?.user_metadata?.spoilers_off ?? true)
    setNotifyEpisodes(user?.user_metadata?.notify_episode ?? true)
    setNotifyPreAir(user?.user_metadata?.notify_pre_air ?? true)
    setNotifyDigest(user?.user_metadata?.notify_digest ?? false)
    const nextMuted = Array.isArray(user?.user_metadata?.muted_user_ids)
      ? user.user_metadata.muted_user_ids.map((id) => String(id))
      : []
    setMutedIds(nextMuted)
  }, [user])

  const normalizeHandle = (value) => {
    return value.replace(/^@/, "").replace(/\s+/g, "")
  }

  const shortId = (value) => {
    if (!value) return ""
    return `${value.slice(0, 6)}...${value.slice(-4)}`
  }

  const loadMutedUsers = async (ids) => {
    if (!user || typeof window === "undefined") return
    if (!ids.length) {
      setMutedUsers([])
      setMutedLoading(false)
      return
    }

    setMutedLoading(true)
    setMutedError("")

    const { data, error } = await client
      .from("social_posts")
      .select("user_id, user_display_name, user_handle, user_avatar_url, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Failed to load muted users:", error)
      setMutedError(error.message || "Could not load muted users.")
      setMutedLoading(false)
      return
    }

    const byId = new Map()
    ;(data || []).forEach((row) => {
      if (!row.user_id || byId.has(row.user_id)) return
      byId.set(row.user_id, {
        userId: row.user_id,
        displayName: row.user_display_name || "Unknown user",
        handle: row.user_handle ? `@${row.user_handle}` : shortId(row.user_id),
        avatarUrl: row.user_avatar_url || "",
      })
    })

    const nextUsers = ids.map((id) => {
      return (
        byId.get(id) || {
          userId: id,
          displayName: "Unknown user",
          handle: shortId(id),
          avatarUrl: "",
        }
      )
    })

    setMutedUsers(nextUsers)
    setMutedLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadMutedUsers(mutedIds)
  }, [user, mutedIds])

  const handleSaveProfile = async () => {
    if (!user) return
    setSavingProfile(true)
    setProfileError("")
    setProfileSaved(false)

    const nextHandle = normalizeHandle(handle.trim())
    const { error } = await client.auth.updateUser({
      data: {
        display_name: displayName.trim() || null,
        username: nextHandle || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
      },
    })

    if (error) {
      setProfileError(error.message || "Could not save profile.")
      setSavingProfile(false)
      return
    }

    setProfileSaved(true)
    setSavingProfile(false)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const handleAvatarSelect = async (event) => {
    if (!user) return
    const file = event.target.files?.[0]
    if (!file) return

    setAvatarError("")

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setAvatarError("Avatar must be smaller than 2MB.")
      return
    }

    setAvatarUploading(true)
    const fileExt = file.name.split(".").pop() || "png"
    const filePath = `${user.id}/${Date.now()}.${fileExt}`

    try {
      if (avatarPath) {
        await client.storage.from(avatarBucket).remove([avatarPath])
      }

      const { error: uploadError } = await client.storage
        .from(avatarBucket)
        .upload(filePath, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        throw uploadError
      }

      const { data } = client.storage.from(avatarBucket).getPublicUrl(filePath)
      const publicUrl = data?.publicUrl

      const { error: updateError } = await client.auth.updateUser({
        data: { avatar_url: publicUrl, avatar_path: filePath },
      })

      if (updateError) {
        throw updateError
      }

      setAvatarUrl(publicUrl || "")
      setAvatarPath(filePath)
    } catch (error) {
      console.error("Failed to upload avatar:", error)
      const message = String(error?.message || "")
      if (message.toLowerCase().includes("bucket not found")) {
        setAvatarError(`Storage bucket "${avatarBucket}" not found. Create it in Supabase Storage.`)
      } else if (message.toLowerCase().includes("row-level security") || message.toLowerCase().includes("policy")) {
        setAvatarError("Storage policy blocked the upload. Enable INSERT/UPDATE/DELETE policies for avatars.")
      } else {
        setAvatarError("Could not upload avatar.")
      }
    } finally {
      setAvatarUploading(false)
      if (event.target) event.target.value = ""
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user) return
    setAvatarError("")
    setAvatarUploading(true)
    try {
      if (avatarPath) {
        await client.storage.from(avatarBucket).remove([avatarPath])
      }
      const { error } = await client.auth.updateUser({
        data: { avatar_url: null, avatar_path: null },
      })
      if (error) {
        throw error
      }
      setAvatarUrl("")
      setAvatarPath("")
    } catch (error) {
      console.error("Failed to remove avatar:", error)
      const message = String(error?.message || "")
      if (message.toLowerCase().includes("bucket not found")) {
        setAvatarError(`Storage bucket "${avatarBucket}" not found. Create it in Supabase Storage.`)
      } else if (message.toLowerCase().includes("row-level security") || message.toLowerCase().includes("policy")) {
        setAvatarError("Storage policy blocked the removal. Enable DELETE policies for avatars.")
      } else {
        setAvatarError("Could not remove avatar.")
      }
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleUnmute = async (targetId) => {
    if (!user) return
    const nextIds = mutedIds.filter((id) => id !== targetId)
    setMutedError("")
    const { error } = await client.auth.updateUser({ data: { muted_user_ids: nextIds } })
    if (error) {
      console.error("Failed to unmute user:", error)
      setMutedError(error.message || "Could not unmute user.")
      return
    }
    setMutedIds(nextIds)
    setMutedUsers((prev) => prev.filter((entry) => entry.userId !== targetId))
  }

  const updatePreference = async (key, value) => {
    if (!user) return
    const { error } = await client.auth.updateUser({ data: { [key]: value } })
    if (error) {
      console.error("Failed to update preference:", error)
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="pb-20 pt-16 md:pb-8">
          <div className="px-4 py-8 md:px-8">
            <div className="mx-auto max-w-4xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Settings</h1>
              <p className="text-muted-foreground">Manage your account and preferences</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-secondary md:w-auto md:grid-cols-5">
                <TabsTrigger value="profile" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden md:inline">Profile</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="hidden md:inline">Notifications</span>
                </TabsTrigger>
                <TabsTrigger value="spoilers" className="gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="hidden md:inline">Spoilers</span>
                </TabsTrigger>
                <TabsTrigger value="appearance" className="gap-2">
                  <Palette className="h-4 w-4" />
                  <span className="hidden md:inline">Appearance</span>
                </TabsTrigger>
                <TabsTrigger value="connections" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  <span className="hidden md:inline">Connections</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>Update your personal information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold text-foreground">
                            {user?.user_metadata?.display_name?.[0] || user?.email?.[0] || "U"}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarSelect}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={avatarUploading}
                          >
                            {avatarUploading ? "Uploading..." : "Change Avatar"}
                          </Button>
                          {avatarUrl ? (
                            <Button
                              variant="ghost"
                              onClick={handleRemoveAvatar}
                              disabled={avatarUploading}
                              className="text-destructive hover:text-destructive"
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                        {avatarError ? (
                          <p className="text-xs text-red-400">{avatarError}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="display-name">Name</Label>
                        <Input
                          id="display-name"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="Ray"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="handle">Handle</Label>
                        <Input
                          id="handle"
                          value={handle}
                          onChange={(event) => setHandle(event.target.value)}
                          placeholder="@ray"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        placeholder="Tell us about yourself..."
                        className="min-h-24"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={location}
                          onChange={(event) => setLocation(event.target.value)}
                          placeholder="City, Country"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={website}
                          onChange={(event) => setWebsite(event.target.value)}
                          placeholder="https://"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button className="gap-2" onClick={handleSaveProfile} disabled={savingProfile}>
                      <Save className="h-4 w-4" />
                        {savingProfile ? "Saving..." : "Save Changes"}
                      </Button>
                      {profileSaved && <span className="text-xs text-emerald-400">Saved</span>}
                      {profileError && <span className="text-xs text-red-400">{profileError}</span>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card mt-6">
                  <CardHeader>
                    <CardTitle>Muted Users</CardTitle>
                    <CardDescription>Manage the people you muted in Social.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {mutedLoading ? (
                      <p className="text-sm text-muted-foreground">Loading muted users...</p>
                    ) : mutedError ? (
                      <p className="text-sm text-red-400">{mutedError}</p>
                    ) : mutedUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No muted users.</p>
                    ) : (
                      <div className="space-y-3">
                        {mutedUsers.map((entry) => (
                          <div
                            key={entry.userId}
                            className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                                {entry.avatarUrl ? (
                                  <img
                                    src={entry.avatarUrl}
                                    alt={entry.displayName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    {entry.displayName.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{entry.displayName}</p>
                                <p className="text-xs text-muted-foreground">{entry.handle}</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleUnmute(entry.userId)}>
                              Unmute
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Choose what notifications you receive</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Episode Reminders</p>
                        <p className="text-sm text-muted-foreground">Get notified when new episodes air</p>
                      </div>
                      <Switch
                        checked={notifyEpisodes}
                        onCheckedChange={async (value) => {
                          setNotifyEpisodes(value)
                          setSavingNotifications(true)
                          await updatePreference("notify_episode", value)
                          setSavingNotifications(false)
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">30 Minutes Before</p>
                        <p className="text-sm text-muted-foreground">Reminder before episode airs</p>
                      </div>
                      <Switch
                        checked={notifyPreAir}
                        onCheckedChange={async (value) => {
                          setNotifyPreAir(value)
                          setSavingNotifications(true)
                          await updatePreference("notify_pre_air", value)
                          setSavingNotifications(false)
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Daily Digest</p>
                        <p className="text-sm text-muted-foreground">Summary of today's airing shows</p>
                      </div>
                      <Switch
                        checked={notifyDigest}
                        onCheckedChange={async (value) => {
                          setNotifyDigest(value)
                          setSavingNotifications(true)
                          await updatePreference("notify_digest", value)
                          setSavingNotifications(false)
                        }}
                      />
                    </div>
                    {savingNotifications ? (
                      <p className="text-xs text-muted-foreground">Saving preferences...</p>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="spoilers">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle>Spoiler Protection</CardTitle>
                    <CardDescription>Control how spoilers are displayed</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                      <div className="flex items-center gap-3">
                        {spoilersOff ? <EyeOff className="h-6 w-6 text-primary" /> : <Eye className="h-6 w-6 text-muted-foreground" />}
                        <div>
                          <p className="font-medium text-foreground">Spoiler Protection {spoilersOff ? "On" : "Off"}</p>
                          <p className="text-sm text-muted-foreground">
                            {spoilersOff ? "Spoiler content is hidden by default" : "All content is visible"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={spoilersOff}
                        onCheckedChange={(value) => {
                          setSpoilersOff(value)
                          updatePreference("spoilers_off", value)
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="appearance">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Customize how Hikari looks</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="connections">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle>Connected Accounts</CardTitle>
                    <CardDescription>Manage your external list imports</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">MyAnimeList</p>
                        <p className="text-sm text-muted-foreground">
                          Connect via OAuth or import your MAL XML.
                        </p>
                      </div>
                      <Button asChild>
                        <a href="/api/mal/authorize?returnTo=/import">Connect</a>
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">AniList</p>
                        <p className="text-sm text-muted-foreground">Import using your AniList username.</p>
                      </div>
                      <Button asChild variant="outline">
                        <a href="/import">Go to Import</a>
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">Kitsu</p>
                        <p className="text-sm text-muted-foreground">Import from a Kitsu JSON export.</p>
                      </div>
                      <Button asChild variant="outline">
                        <a href="/import">Go to Import</a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
