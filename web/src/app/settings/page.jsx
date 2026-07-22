"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Bell,
  Calendar,
  Camera,
  ChevronRight,
  Crown,
  Download,
  Eye,
  Globe,
  Heart,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Palette,
  Play,
  Save,
  Shield,
  Smartphone,
  Star,
  Trash2,
  Upload,
  User,
  Volume2,
} from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import { useTheme } from "next-themes"
import { saveAccentColor } from "@/lib/accent"
import { saveAppearance } from "@/lib/appearance"
import client from "@/lib/client"
import { toast } from "sonner"
import { checkHandleAvailability, isHandleTakenError, normalizeHandle, upsertPublicProfile } from "@/lib/public-profile"
import { AccountCredentials } from "@/components/settings/AccountCredentials"

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "display", label: "Appearance", icon: Palette },
  { id: "lists", label: "Lists", icon: Play },
  { id: "content", label: "Content", icon: Eye },
  { id: "import-export", label: "Import / Export", icon: Download },
  { id: "account", label: "Account", icon: Lock },
]

const defaultPublicListVisibility = {
  watching: true,
  rewatching: true,
  completed: true,
  plan_to_watch: true,
  on_hold: true,
  dropped: true,
}

const normalizePublicListVisibility = (value) => {
  const next = { ...defaultPublicListVisibility }
  if (!value || typeof value !== "object") return next
  Object.keys(next).forEach((key) => {
    if (typeof value[key] === "boolean") next[key] = value[key]
  })
  return next
}

const buildVisibilityFromPrivacy = (privacy) => ({
  watching: privacy.showWatching,
  rewatching: privacy.showWatching,
  completed: privacy.showCompleted,
  plan_to_watch: privacy.showPlanned,
  on_hold: privacy.showOnHold,
  dropped: privacy.showDropped,
})

const isHideFromProfileSchemaError = (error) => {
  const code = String(error?.code || "")
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase()
  return code === "42703" || code === "PGRST204" || text.includes("hide_from_profile")
}

const defaultProfile = {
  displayName: "",
  username: "",
  email: "",
  bio: "",
  location: "",
  website: "",
  birthday: "",
  gender: "prefer-not-to-say",
  bannerImage: "",
}

const defaultPrivacy = {
  publicProfile: true,
  showActivity: true,
  showStats: true,
  showFavorites: true,
  showWatching: true,
  showCompleted: true,
  showPlanned: true,
  showOnHold: true,
  showDropped: true,
  showScores: true,
  showProgressDates: true,
  allowMessages: "everyone",
  allowComments: "everyone",
  showOnline: true,
  showLastSeen: true,
  hideFromSearch: false,
}

const defaultNotifications = {
  emailEnabled: true,
  pushEnabled: true,
  emailNewEpisode: true,
  emailWeeklyDigest: false,
  emailRecommendations: false,
  emailFriendActivity: true,
  emailComments: true,
  emailMessages: true,
  emailAnnouncements: true,
  pushNewEpisode: true,
  pushAiring: true,
  pushFriendActivity: false,
  pushComments: true,
  pushMessages: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
}

const defaultDisplay = {
  theme: "system",
  accentColor: "banana",
  language: "en",
  timezone: "auto",
  dateFormat: "relative",
  titleLanguage: "romaji",
  scoreFormat: "10point",
  defaultListView: "grid",
  cardsPerRow: 5,
  showTrailers: true,
  autoplayTrailers: false,
  reduceMotion: false,
  highContrast: false,
}

const defaultListSettings = {
  defaultStatus: "watching",
  confirmStatusChange: true,
  autoAddToList: true,
  showProgressBar: true,
  showAiringCountdown: true,
  enableRewatchTracking: true,
  splitSeasons: true,
  mergeSequels: false,
  sortBy: "last-updated",
  sortDirection: "desc",
}

const defaultContent = {
  adultContent: false,
  showSpoilers: "hide",
  blurNSFW: true,
  autoSkipIntro: false,
  autoSkipOutro: false,
  autoNextEpisode: true,
  videoQuality: "auto",
  subtitleLanguage: "en",
  dubLanguage: "none",
}

const defaultAccount = {
  twoFactorEnabled: false,
}

function SettingsPanel({ title, description, children, className = "" }) {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm", className)}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({ id, label, desc, checked, onChange, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-start gap-3">
        {Icon ? <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" /> : null}
        <div>
          <Label htmlFor={id} className="font-medium">
            {label}
          </Label>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeSection, setActiveSection] = React.useState("profile")
  const [hasChanges, setHasChanges] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState("")
  const [saveMessage, setSaveMessage] = React.useState("")

  const [profile, setProfile] = React.useState(defaultProfile)
  const [privacy, setPrivacy] = React.useState(defaultPrivacy)
  const [notifications, setNotifications] = React.useState(defaultNotifications)
  const [display, setDisplay] = React.useState(defaultDisplay)
  const [listSettings, setListSettings] = React.useState(defaultListSettings)
  const [content, setContent] = React.useState(defaultContent)
  const [account, setAccount] = React.useState(defaultAccount)

  const [avatarUrl, setAvatarUrl] = React.useState("")
  const [avatarPath, setAvatarPath] = React.useState("")
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState("")
  const [mutedIds, setMutedIds] = React.useState([])
  const [mutedUsers, setMutedUsers] = React.useState([])
  const [mutedLoading, setMutedLoading] = React.useState(false)
  const [mutedError, setMutedError] = React.useState("")
  const [customLists, setCustomLists] = React.useState([])
  const [connectedIdentities, setConnectedIdentities] = React.useState([])
  const [connectionPending, setConnectionPending] = React.useState("")
  const [connectionMessage, setConnectionMessage] = React.useState("")
  const [connectionError, setConnectionError] = React.useState("")

  const fileInputRef = React.useRef(null)
  const avatarBucket = process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || "avatars"

  const resetFromUser = React.useCallback(
    (sourceUser) => {
      const metadata = sourceUser?.user_metadata || {}
      const handle = metadata.username || metadata.handle || sourceUser?.email?.split("@")[0] || ""
      const visibility = normalizePublicListVisibility(metadata.public_list_visibility)

      setProfile({
        displayName: metadata.display_name || metadata.full_name || sourceUser?.email?.split("@")[0] || "",
        username: handle,
        email: sourceUser?.email || "",
        bio: metadata.bio || "",
        location: metadata.location || "",
        website: metadata.website || "",
        birthday: metadata.birthday || "",
        gender: metadata.gender || "prefer-not-to-say",
        bannerImage: metadata.banner_url || "",
      })

      setPrivacy({
        publicProfile: metadata.public_profile ?? true,
        showActivity: metadata.show_watch_activity ?? true,
        showStats: metadata.show_stats ?? true,
        showFavorites: metadata.show_favorites ?? true,
        showWatching: visibility.watching || visibility.rewatching,
        showCompleted: visibility.completed,
        showPlanned: visibility.plan_to_watch,
        showOnHold: visibility.on_hold,
        showDropped: visibility.dropped,
        showScores: metadata.show_scores ?? true,
        showProgressDates: metadata.show_progress_dates ?? true,
        allowMessages: metadata.allow_messages || "everyone",
        allowComments: metadata.allow_comments || "everyone",
        showOnline: metadata.show_online_status ?? true,
        showLastSeen: metadata.show_last_seen ?? true,
        hideFromSearch: metadata.hide_from_search ?? false,
      })

      setNotifications({
        ...defaultNotifications,
        ...(metadata.notification_preferences || {}),
        emailEnabled: metadata.email_notifications ?? true,
        pushEnabled: metadata.push_notifications ?? true,
        emailNewEpisode: metadata.notify_episode ?? true,
        pushNewEpisode: metadata.notify_episode ?? true,
        pushAiring: metadata.notify_pre_air ?? true,
        emailWeeklyDigest: metadata.notify_digest ?? false,
      })

      setDisplay({
        ...defaultDisplay,
        ...(metadata.display_settings || {}),
        theme: metadata.theme || theme || "system",
        language: metadata.language || "en",
        scoreFormat: metadata.score_format || defaultDisplay.scoreFormat,
      })

      setListSettings({
        ...defaultListSettings,
        ...(metadata.list_settings || {}),
      })

      setContent({
        ...defaultContent,
        ...(metadata.content_settings || {}),
        adultContent: metadata.adult_content ?? defaultContent.adultContent,
        showSpoilers: metadata.spoilers_off === false ? metadata.content_settings?.showSpoilers || "blur" : "hide",
      })

      setAccount({
        ...defaultAccount,
        ...(metadata.account_settings || {}),
        twoFactorEnabled: metadata.two_factor_enabled ?? false,
      })

      setAvatarUrl(metadata.avatar_url || metadata.avatar || "")
      setAvatarPath(metadata.avatar_path || "")
      setMutedIds(
        Array.isArray(metadata.muted_user_ids) ? metadata.muted_user_ids.map((id) => String(id)) : [],
      )
      setHasChanges(false)
      setSaveError("")
    },
    [theme],
  )

  React.useEffect(() => {
    resetFromUser(user)
  }, [user, resetFromUser])

  // Apply + persist the accent color whenever it changes (on load from saved
  // settings and on every swatch click), so the choice takes effect live.
  React.useEffect(() => {
    saveAccentColor(display.accentColor)
  }, [display.accentColor])

  // Apply + persist reduce-motion / high-contrast live.
  React.useEffect(() => {
    saveAppearance({ reduceMotion: display.reduceMotion, highContrast: display.highContrast })
  }, [display.reduceMotion, display.highContrast])

  React.useEffect(() => {
    const next = Array.isArray(user?.identities) ? user.identities : []
    setConnectedIdentities(next)
  }, [user?.identities])

  React.useEffect(() => {
    if (!user) return
    let active = true

    const loadUserIdentities = async () => {
      const { data, error } = await client.auth.getUserIdentities()
      if (!active || error) return
      setConnectedIdentities(data?.identities || [])
    }

    loadUserIdentities()
    return () => {
      active = false
    }
  }, [user?.id])

  React.useEffect(() => {
    if (!user) return
    let active = true

    const loadLists = async () => {
      const { data, error } = await client
        .from("custom_lists")
        .select("id, name, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!active || error) return
      setCustomLists(data || [])
    }

    loadLists()
    return () => {
      active = false
    }
  }, [user?.id])

  const shortId = (value) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "")

  const loadMutedUsers = React.useCallback(
    async (ids) => {
      if (!user || !ids.length) {
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

      setMutedUsers(
        ids.map((id) => byId.get(id) || { userId: id, displayName: "Unknown user", handle: shortId(id), avatarUrl: "" }),
      )
      setMutedLoading(false)
    },
    [user],
  )

  React.useEffect(() => {
    if (!user) return
    loadMutedUsers(mutedIds)
  }, [user, mutedIds, loadMutedUsers])

  const markChanged = React.useCallback(() => {
    setHasChanges(true)
    setSaveMessage("")
    setSaveError("")
  }, [])

  const applyPublicListVisibility = React.useCallback(
    async (visibility) => {
      if (!user?.id) return
      for (const [status, isVisible] of Object.entries(visibility)) {
        const { error } = await client
          .from("list_entries")
          .update({ hide_from_profile: !isVisible })
          .eq("user_id", user.id)
          .eq("status", status)

        if (error && !isHideFromProfileSchemaError(error)) {
          throw error
        }
      }
    },
    [user?.id],
  )

  const updateProfileState = (patch) => {
    setProfile((current) => ({ ...current, ...patch }))
    markChanged()
  }

  const updatePrivacyState = (patch) => {
    setPrivacy((current) => ({ ...current, ...patch }))
    markChanged()
  }

  const updateNotificationState = (patch) => {
    setNotifications((current) => ({ ...current, ...patch }))
    markChanged()
  }

  const updateDisplayState = (patch) => {
    setDisplay((current) => ({ ...current, ...patch }))
    markChanged()
  }

  const updateListSettingsState = (patch) => {
    setListSettings((current) => ({ ...current, ...patch }))
    markChanged()
  }

  const updateContentState = (patch) => {
    setContent((current) => ({ ...current, ...patch }))
    markChanged()
  }

  const updateAccountState = (patch) => {
    setAccount((current) => ({ ...current, ...patch }))
    markChanged()
  }

  const headerUser = React.useMemo(
    () => ({
      name: profile.displayName || user?.email?.split("@")[0] || "Hikari User",
      avatar: avatarUrl || undefined,
      username: normalizeHandle(profile.username || user?.user_metadata?.username || user?.email?.split("@")[0] || "user"),
      isPremium: Boolean(user?.user_metadata?.is_premium || user?.user_metadata?.premium),
    }),
    [avatarUrl, profile.displayName, profile.username, user],
  )

  const publicListVisibility = React.useMemo(() => buildVisibilityFromPrivacy(privacy), [privacy])

  const providerOptions = React.useMemo(
    () => [
      { id: "google", label: "Google", description: "Link Google sign in", icon: Mail },
      { id: "discord", label: "Discord", description: "Link Discord sign in", icon: MessageSquare },
    ],
    [],
  )

  const linkedProviders = React.useMemo(() => {
    const map = new Map()
    ;(connectedIdentities || []).forEach((identity) => {
      const key = String(identity?.provider || "").toLowerCase()
      if (key) map.set(key, identity)
    })
    return map
  }, [connectedIdentities])

  const accentColors = [
    { id: "banana", className: "bg-[#faf0c7]" },
    { id: "teal", className: "bg-cyan-400" },
    { id: "blue", className: "bg-sky-500" },
    { id: "purple", className: "bg-violet-500" },
    { id: "pink", className: "bg-fuchsia-500" },
    { id: "orange", className: "bg-orange-500" },
    { id: "green", className: "bg-emerald-500" },
  ]

  const refreshConnectedIdentities = React.useCallback(async () => {
    const { data, error } = await client.auth.getUserIdentities()
    if (!error) {
      setConnectedIdentities(data?.identities || [])
    }
  }, [])

  const handleAvatarSelected = async (event) => {
    const file = event?.target?.files?.[0]
    if (!file || !user?.id) return

    setAvatarUploading(true)
    setAvatarError("")

    try {
      const extension = file.name.split(".").pop() || "jpg"
      const nextPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

      const { error: uploadError } = await client.storage
        .from(avatarBucket)
        .upload(nextPath, file, { cacheControl: "3600", upsert: false })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = client.storage.from(avatarBucket).getPublicUrl(nextPath)

      setAvatarUrl(publicUrl)
      setAvatarPath(nextPath)
      markChanged()
    } catch (error) {
      setAvatarError(error?.message || "Could not upload avatar.")
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveAvatar = async () => {
    if (!avatarUrl && !avatarPath) return

    if (avatarPath) {
      await client.storage.from(avatarBucket).remove([avatarPath])
    }

    setAvatarUrl("")
    setAvatarPath("")
    markChanged()
  }

  const handleBannerPrompt = () => {
    const nextValue = window.prompt("Paste a banner image URL", profile.bannerImage || "")
    if (nextValue === null) return
    updateProfileState({ bannerImage: nextValue.trim() })
  }

  const handleUnmuteUser = async (targetUserId) => {
    if (!user) return

    const nextIds = mutedIds.filter((id) => String(id) !== String(targetUserId))
    setMutedError("")

    const { error } = await client.auth.updateUser({
      data: { muted_user_ids: nextIds },
    })

    if (error) {
      setMutedError(error.message || "Could not update muted users.")
      return
    }

    setMutedIds(nextIds)
    setMutedUsers((current) => current.filter((entry) => String(entry.userId) !== String(targetUserId)))
    setSaveMessage("Muted users updated.")
  }

  const handleConnectProvider = async (provider) => {
    setConnectionPending(provider)
    setConnectionError("")
    setConnectionMessage("")

    const { error } = await client.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/settings`,
      },
    })

    if (error) {
      setConnectionError(error.message || `Could not connect ${provider}.`)
      setConnectionPending("")
      return
    }

    setConnectionPending("")
    setConnectionMessage(`Continue with ${provider} to finish linking that account.`)
  }

  const handleDisconnectProvider = async (provider) => {
    const identity = linkedProviders.get(provider)
    if (!identity) return

    setConnectionPending(provider)
    setConnectionError("")
    setConnectionMessage("")

    const { error } = await client.auth.unlinkIdentity(identity)

    if (error) {
      setConnectionError(error.message || `Could not disconnect ${provider}.`)
      setConnectionPending("")
      return
    }

    await refreshConnectedIdentities()
    setConnectionPending("")
    setConnectionMessage(`${provider[0].toUpperCase()}${provider.slice(1)} disconnected.`)
  }

  const handleExportSettings = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      privacy,
      notifications,
      display,
      listSettings,
      content,
      account,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `hikari-settings-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const handleDiscardChanges = () => {
    resetFromUser(user)
    setSaveMessage("")
    setAvatarError("")
    setConnectionError("")
  }

  const handleSaveAll = async () => {
    if (!user) return

    setSaving(true)
    setSaveError("")
    setSaveMessage("")

    try {
      const normalizedHandle = normalizeHandle(profile.username)
      if (!normalizedHandle) {
        throw new Error("Choose a valid username.")
      }

      const availability = await checkHandleAvailability(normalizedHandle, user.id)
      if (availability.error && !availability.skipped) {
        throw availability.error
      }
      if (!availability.available) {
        throw new Error(`@${normalizedHandle} is already taken.`)
      }

      const nextMetadata = {
        display_name: profile.displayName || user.email?.split("@")[0] || "Hikari User",
        username: normalizedHandle,
        handle: normalizedHandle,
        bio: profile.bio || "",
        location: profile.location || "",
        website: profile.website || "",
        birthday: profile.birthday || "",
        gender: profile.gender || defaultProfile.gender,
        avatar_url: avatarUrl || null,
        avatar_path: avatarPath || null,
        banner_url: profile.bannerImage || null,
        public_profile: privacy.publicProfile,
        show_watch_activity: privacy.showActivity,
        show_stats: privacy.showStats,
        show_favorites: privacy.showFavorites,
        show_scores: privacy.showScores,
        show_progress_dates: privacy.showProgressDates,
        show_online_status: privacy.showOnline,
        show_last_seen: privacy.showLastSeen,
        hide_from_search: privacy.hideFromSearch,
        allow_messages: privacy.allowMessages,
        allow_comments: privacy.allowComments,
        public_list_visibility: publicListVisibility,
        email_notifications: notifications.emailEnabled,
        push_notifications: notifications.pushEnabled,
        notify_episode: notifications.emailNewEpisode || notifications.pushNewEpisode,
        notify_pre_air: notifications.pushAiring,
        notify_digest: notifications.emailWeeklyDigest,
        notification_preferences: notifications,
        theme: display.theme,
        language: display.language,
        score_format: display.scoreFormat,
        display_settings: display,
        list_settings: listSettings,
        content_settings: {
          ...content,
          showSpoilers: content.showSpoilers,
        },
        adult_content: content.adultContent,
        spoilers_off: content.showSpoilers === "hide",
        account_settings: account,
        two_factor_enabled: account.twoFactorEnabled,
        muted_user_ids: mutedIds,
      }

      const { data, error } = await client.auth.updateUser({
        data: nextMetadata,
      })

      if (error) throw error

      const profileResult = await upsertPublicProfile(user, {
        handle: normalizedHandle,
        display_name: nextMetadata.display_name,
        avatar_url: avatarUrl || null,
        banner_url: profile.bannerImage || null,
        bio: profile.bio || null,
        location: profile.location || null,
        website: profile.website || null,
        show_online_status: privacy.showOnline,
        show_watch_activity: privacy.showActivity,
        public_profile: privacy.publicProfile,
        show_stats: privacy.showStats,
      })

      if (profileResult?.error) {
        if (isHandleTakenError(profileResult.error)) {
          throw new Error(`@${normalizedHandle} is already taken.`)
        }
        throw profileResult.error
      }

      await applyPublicListVisibility(publicListVisibility)
      setTheme(display.theme)
      setHasChanges(false)
      setSaveMessage("Settings saved.")

      if (data?.user) {
        resetFromUser(data.user)
      }
    } catch (error) {
      setSaveError(error?.message || "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  const renderSectionContent = () => {
    if (activeSection === "profile") {
      return (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm">
            <div
              className="relative h-32 bg-gradient-to-br from-primary/25 via-accent/15 to-card sm:h-44"
              style={
                profile.bannerImage
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(8,12,22,0.15), rgba(8,12,22,0.65)), url(${profile.bannerImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute right-3 top-3 gap-1.5 bg-background/70 backdrop-blur hover:bg-background/90"
                onClick={handleBannerPrompt}
              >
                <Camera className="h-3.5 w-3.5" />
                Change banner
              </Button>
            </div>

            <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative -mt-12 shrink-0">
                  <div className="size-24 overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-lg">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={profile.displayName || "Profile avatar"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 text-3xl font-bold text-primary">
                        {(profile.displayName || user?.email || "H").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Change avatar"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1.5 -right-1.5 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card transition hover:scale-105"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="min-w-0 pb-1">
                  <h2 className="truncate text-xl font-bold tracking-tight text-foreground">
                    {profile.displayName || "Your profile"}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    @{normalizeHandle(profile.username || "user") || "user"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {avatarUploading ? "Uploading…" : "Upload avatar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleRemoveAvatar}
                  disabled={!avatarUrl && !avatarPath}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelected}
            />

            {avatarError ? <p className="px-5 pb-4 text-sm text-destructive">{avatarError}</p> : null}
          </div>

          <SettingsPanel title="Basic information" description="This appears on your public profile.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={profile.displayName}
                  onChange={(event) => updateProfileState({ displayName: event.target.value })}
                  className="h-11 rounded-xl border-border/60 bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profile.username}
                  onChange={(event) => updateProfileState({ username: event.target.value })}
                  className="h-11 rounded-xl border-border/60 bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="h-11 rounded-xl border-border/60 bg-background/40 text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={profile.website}
                  onChange={(event) => updateProfileState({ website: event.target.value })}
                  placeholder="https://your-site.com"
                  className="h-11 rounded-xl border-border/60 bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={profile.location}
                  onChange={(event) => updateProfileState({ location: event.target.value })}
                  placeholder="City, Country"
                  className="h-11 rounded-xl border-border/60 bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={profile.birthday}
                  onChange={(event) => updateProfileState({ birthday: event.target.value })}
                  className="h-11 rounded-xl border-border/60 bg-background/50"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  maxLength={240}
                  value={profile.bio}
                  onChange={(event) => updateProfileState({ bio: event.target.value })}
                  placeholder="Tell people what you're into."
                  className="resize-none rounded-2xl border-border/60 bg-background/50"
                />
                <p className="text-xs text-muted-foreground">{profile.bio.length}/240</p>
              </div>
            </div>
          </SettingsPanel>
        </div>
      )
    }

    if (activeSection === "privacy") {
      return (
        <div className="space-y-6">
          <SettingsPanel title="Profile Visibility" description="Choose what people can see on your public page.">
            <div className="space-y-4">
              <ToggleRow
                id="public-profile"
                label="Public profile"
                desc="Keep your public share page turned on."
                checked={privacy.publicProfile}
                onChange={(checked) => updatePrivacyState({ publicProfile: checked })}
                icon={Globe}
              />
              <ToggleRow
                id="show-activity"
                label="Show activity"
                desc="Let people see your recent watch or read activity."
                checked={privacy.showActivity}
                onChange={(checked) => updatePrivacyState({ showActivity: checked })}
                icon={Play}
              />
              <ToggleRow
                id="show-stats"
                label="Show stats"
                desc="Display your totals, hours watched, and score data."
                checked={privacy.showStats}
                onChange={(checked) => updatePrivacyState({ showStats: checked })}
                icon={Star}
              />
              <ToggleRow
                id="show-favorites"
                label="Show favorites"
                desc="Expose your favorite titles on the share page."
                checked={privacy.showFavorites}
                onChange={(checked) => updatePrivacyState({ showFavorites: checked })}
                icon={Heart}
              />
              <ToggleRow
                id="show-scores"
                label="Show scores"
                desc="Include your ratings wherever they appear publicly."
                checked={privacy.showScores}
                onChange={(checked) => updatePrivacyState({ showScores: checked })}
                icon={Star}
              />
            </div>
          </SettingsPanel>

          <SettingsPanel title="Public Lists" description="Choose which list statuses show up on your public profile.">
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                id="show-watching"
                label="Watching / Reading"
                desc="Show active titles."
                checked={privacy.showWatching}
                onChange={(checked) => updatePrivacyState({ showWatching: checked })}
                icon={Play}
              />
              <ToggleRow
                id="show-completed"
                label="Completed / Read"
                desc="Show finished titles."
                checked={privacy.showCompleted}
                onChange={(checked) => updatePrivacyState({ showCompleted: checked })}
                icon={Save}
              />
              <ToggleRow
                id="show-planned"
                label="Planned"
                desc="Show planned titles."
                checked={privacy.showPlanned}
                onChange={(checked) => updatePrivacyState({ showPlanned: checked })}
                icon={Calendar}
              />
              <ToggleRow
                id="show-onhold"
                label="On Hold"
                desc="Show paused titles."
                checked={privacy.showOnHold}
                onChange={(checked) => updatePrivacyState({ showOnHold: checked })}
                icon={Volume2}
              />
              <ToggleRow
                id="show-dropped"
                label="Dropped"
                desc="Show dropped titles."
                checked={privacy.showDropped}
                onChange={(checked) => updatePrivacyState({ showDropped: checked })}
                icon={Trash2}
              />
            </div>
          </SettingsPanel>

          <SettingsPanel title="Privacy Controls" description="These apply to your account presence across the site.">
            <div className="space-y-4">
              <ToggleRow
                id="show-online"
                label="Show online status"
                desc="Let people see when you are online."
                checked={privacy.showOnline}
                onChange={(checked) => updatePrivacyState({ showOnline: checked })}
                icon={User}
              />
              <ToggleRow
                id="show-last-seen"
                label="Show last seen"
                desc="Display when you were last active."
                checked={privacy.showLastSeen}
                onChange={(checked) => updatePrivacyState({ showLastSeen: checked })}
                icon={Calendar}
              />
              <ToggleRow
                id="hide-search"
                label="Hide from search"
                desc="Keep your profile out of user search results."
                checked={privacy.hideFromSearch}
                onChange={(checked) => updatePrivacyState({ hideFromSearch: checked })}
                icon={Lock}
              />
            </div>

            <div className="grid gap-4 pt-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Who can message you</Label>
                <Select value={privacy.allowMessages} onValueChange={(value) => updatePrivacyState({ allowMessages: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="followers">Followers only</SelectItem>
                    <SelectItem value="nobody">Nobody</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Who can comment</Label>
                <Select value={privacy.allowComments} onValueChange={(value) => updatePrivacyState({ allowComments: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="followers">Followers only</SelectItem>
                    <SelectItem value="nobody">Nobody</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Muted Users" description="Unmute people directly from settings.">
            {mutedLoading ? (
              <p className="text-sm text-muted-foreground">Loading muted users...</p>
            ) : mutedUsers.length ? (
              <div className="space-y-3">
                {mutedUsers.map((entry) => (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 overflow-hidden rounded-full bg-muted">
                        {entry.avatarUrl ? (
                          <img src={entry.avatarUrl} alt={entry.displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-foreground">
                            {entry.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{entry.displayName}</p>
                        <p className="text-sm text-muted-foreground">{entry.handle}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-border/60 bg-background/50"
                      onClick={() => handleUnmuteUser(entry.userId)}
                    >
                      Unmute
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You do not have any muted users right now.</p>
            )}

            {mutedError ? <p className="mt-4 text-sm text-destructive">{mutedError}</p> : null}
          </SettingsPanel>
        </div>
      )
    }

    if (activeSection === "notifications") {
      return (
        <div className="space-y-6">
          <SettingsPanel title="Notification Channels" description="Turn email and push delivery on or off.">
            <div className="space-y-4">
              <ToggleRow
                id="email-enabled"
                label="Email notifications"
                desc="Allow emails for the notification types below."
                checked={notifications.emailEnabled}
                onChange={(checked) => updateNotificationState({ emailEnabled: checked })}
                icon={Mail}
              />
              <ToggleRow
                id="push-enabled"
                label="Push notifications"
                desc="Allow site or mobile push notifications."
                checked={notifications.pushEnabled}
                onChange={(checked) => updateNotificationState({ pushEnabled: checked })}
                icon={Smartphone}
              />
            </div>
          </SettingsPanel>

          <SettingsPanel title="What You Get Notified About" description="Match the alerts you actually care about.">
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                id="email-new-episode"
                label="New episode emails"
                desc="Email me about new episodes."
                checked={notifications.emailNewEpisode}
                onChange={(checked) => updateNotificationState({ emailNewEpisode: checked })}
                icon={Bell}
              />
              <ToggleRow
                id="push-new-episode"
                label="New episode push"
                desc="Push alert for newly available episodes."
                checked={notifications.pushNewEpisode}
                onChange={(checked) => updateNotificationState({ pushNewEpisode: checked })}
                icon={Bell}
              />
              <ToggleRow
                id="push-airing"
                label="Pre-air reminders"
                desc="Get reminders before something airs."
                checked={notifications.pushAiring}
                onChange={(checked) => updateNotificationState({ pushAiring: checked })}
                icon={Calendar}
              />
              <ToggleRow
                id="email-digest"
                label="Weekly digest"
                desc="Weekly summary of your activity and updates."
                checked={notifications.emailWeeklyDigest}
                onChange={(checked) => updateNotificationState({ emailWeeklyDigest: checked })}
                icon={Mail}
              />
              <ToggleRow
                id="friend-activity"
                label="Friend activity"
                desc="Updates when people you follow post or log progress."
                checked={notifications.emailFriendActivity}
                onChange={(checked) =>
                  updateNotificationState({ emailFriendActivity: checked, pushFriendActivity: checked })
                }
                icon={User}
              />
              <ToggleRow
                id="messages"
                label="Messages and comments"
                desc="Alerts for replies, comments, and direct messages."
                checked={notifications.pushMessages}
                onChange={(checked) =>
                  updateNotificationState({
                    pushMessages: checked,
                    emailMessages: checked,
                    pushComments: checked,
                    emailComments: checked,
                  })
                }
                icon={MessageSquare}
              />
            </div>
          </SettingsPanel>

          <SettingsPanel title="Quiet Hours" description="Silence push notifications overnight.">
            <div className="space-y-4">
              <ToggleRow
                id="quiet-hours"
                label="Enable quiet hours"
                desc="Pause push notifications during the hours below."
                checked={notifications.quietHoursEnabled}
                onChange={(checked) => updateNotificationState({ quietHoursEnabled: checked })}
                icon={Volume2}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quiet hours start</Label>
                  <Input
                    type="time"
                    value={notifications.quietHoursStart}
                    onChange={(event) => updateNotificationState({ quietHoursStart: event.target.value })}
                    className="h-11 rounded-xl border-border/60 bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quiet hours end</Label>
                  <Input
                    type="time"
                    value={notifications.quietHoursEnd}
                    onChange={(event) => updateNotificationState({ quietHoursEnd: event.target.value })}
                    className="h-11 rounded-xl border-border/60 bg-background/50"
                  />
                </div>
              </div>
            </div>
          </SettingsPanel>
        </div>
      )
    }

    if (activeSection === "display") {
      return (
        <div className="space-y-6">
          <SettingsPanel title="Theme" description="Make the settings page match the rest of your Hikari look.">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
                { id: "system", label: "System" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    updateDisplayState({ theme: option.id })
                    setTheme(option.id)
                  }}
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition",
                    display.theme === option.id
                      ? "border-primary/70 bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-sm">Use {option.label.toLowerCase()} mode.</p>
                </button>
              ))}
            </div>

            <div className="pt-4">
              <Label className="mb-3 block">Accent color</Label>
              <div className="flex flex-wrap gap-3">
                {accentColors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => updateDisplayState({ accentColor: color.id })}
                    className={cn(
                      "flex items-center gap-3 rounded-full border px-3 py-2 transition",
                      display.accentColor === color.id
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/60 bg-background/40",
                    )}
                  >
                    <span className={cn("h-4 w-4 rounded-full", color.className)} />
                    <span className="text-sm font-medium capitalize">{color.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Display Preferences" description="Control title language, score format, and card layout.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={display.language} onValueChange={(value) => updateDisplayState({ language: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title language</Label>
                <Select value={display.titleLanguage} onValueChange={(value) => updateDisplayState({ titleLanguage: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="romaji">Romaji</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="native">Native</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Score format</Label>
                <Select value={display.scoreFormat} onValueChange={(value) => updateDisplayState({ scoreFormat: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10point">10 Point</SelectItem>
                    <SelectItem value="100point">100 Point</SelectItem>
                    <SelectItem value="5star">5 Star</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default list view</Label>
                <Select value={display.defaultListView} onValueChange={(value) => updateDisplayState({ defaultListView: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="list">List</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-5">
              <div className="mb-3 flex items-center justify-between">
                <Label>Cards per row</Label>
                <span className="text-sm text-muted-foreground">{display.cardsPerRow}</span>
              </div>
              <input
                type="range"
                min={3}
                max={8}
                step={1}
                value={display.cardsPerRow}
                onChange={(event) => updateDisplayState({ cardsPerRow: Number(event.target.value) || 5 })}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
            </div>

            <div className="space-y-4 pt-5">
              <ToggleRow
                id="reduce-motion"
                label="Reduce motion"
                desc="Tone down animations across the app."
                checked={display.reduceMotion}
                onChange={(checked) => updateDisplayState({ reduceMotion: checked })}
                icon={Palette}
              />
              <ToggleRow
                id="high-contrast"
                label="High contrast"
                desc="Stronger borders and brighter text for readability."
                checked={display.highContrast}
                onChange={(checked) => updateDisplayState({ highContrast: checked })}
                icon={Eye}
              />
              <ToggleRow
                id="show-trailers"
                label="Show trailers"
                desc="Display trailer blocks where available."
                checked={display.showTrailers}
                onChange={(checked) => updateDisplayState({ showTrailers: checked })}
                icon={Play}
              />
              <ToggleRow
                id="autoplay-trailers"
                label="Autoplay trailers"
                desc="Autoplay muted trailers when supported."
                checked={display.autoplayTrailers}
                onChange={(checked) => updateDisplayState({ autoplayTrailers: checked })}
                icon={Play}
              />
            </div>
          </SettingsPanel>
        </div>
      )
    }

    if (activeSection === "lists") {
      return (
        <div className="space-y-6">
          <SettingsPanel title="Default List Behavior" description="Set how Hikari handles new entries and sorts your library.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Default status</Label>
                <Select value={listSettings.defaultStatus} onValueChange={(value) => updateListSettingsState({ defaultStatus: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="watching">Watching</SelectItem>
                    <SelectItem value="plan_to_watch">Plan to Watch</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort by</Label>
                <Select value={listSettings.sortBy} onValueChange={(value) => updateListSettingsState({ sortBy: value })}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last-updated">Last updated</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="score">Score</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort direction</Label>
                <Select
                  value={listSettings.sortDirection}
                  onValueChange={(value) => updateListSettingsState({ sortDirection: value })}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-5">
              <ToggleRow
                id="confirm-status-change"
                label="Confirm status changes"
                desc="Ask before moving something between statuses."
                checked={listSettings.confirmStatusChange}
                onChange={(checked) => updateListSettingsState({ confirmStatusChange: checked })}
                icon={Shield}
              />
              <ToggleRow
                id="auto-add-to-list"
                label="Auto-add to list"
                desc="Add titles to your library when you start them."
                checked={listSettings.autoAddToList}
                onChange={(checked) => updateListSettingsState({ autoAddToList: checked })}
                icon={Play}
              />
              <ToggleRow
                id="show-progress-bar"
                label="Show progress bar"
                desc="Keep progress bars on cards and rows."
                checked={listSettings.showProgressBar}
                onChange={(checked) => updateListSettingsState({ showProgressBar: checked })}
                icon={Save}
              />
              <ToggleRow
                id="show-airing-countdown"
                label="Show airing countdown"
                desc="Show the next episode countdown when available."
                checked={listSettings.showAiringCountdown}
                onChange={(checked) => updateListSettingsState({ showAiringCountdown: checked })}
                icon={Calendar}
              />
            </div>
          </SettingsPanel>

          <SettingsPanel title="Custom Lists" description="Manage your custom list collections.">
            {customLists.length ? (
              <div className="space-y-3">
                {customLists.map((list) => (
                  <div
                    key={list.id}
                    className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/40 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{list.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Updated {new Date(list.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <Button asChild variant="outline" className="rounded-full border-border/60 bg-background/50">
                      <Link href="/lists">Open</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You have not made any custom lists yet.</p>
            )}
          </SettingsPanel>
        </div>
      )
    }

    if (activeSection === "content") {
      return (
        <div className="space-y-6">
          <SettingsPanel title="Content Filters" description="Choose how spoilers and adult titles are handled.">
            <div className="space-y-4">
              <ToggleRow
                id="adult-content"
                label="Adult content"
                desc="Allow 18+ titles in search and recommendations."
                checked={content.adultContent}
                onChange={(checked) => updateContentState({ adultContent: checked })}
                icon={Eye}
              />
              <ToggleRow
                id="blur-nsfw"
                label="Blur NSFW art"
                desc="Blur sensitive covers until you hover or open them."
                checked={content.blurNSFW}
                onChange={(checked) => updateContentState({ blurNSFW: checked })}
                icon={Eye}
              />
            </div>

            <div className="space-y-2 pt-4">
              <Label>Spoiler handling</Label>
              <Select value={content.showSpoilers} onValueChange={(value) => updateContentState({ showSpoilers: value })}>
                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hide">Hide spoilers</SelectItem>
                  <SelectItem value="blur">Blur spoilers</SelectItem>
                  <SelectItem value="show">Show spoilers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingsPanel>

        </div>
      )
    }

    if (activeSection === "import-export") {
      return (
        <div className="space-y-6">
          <SettingsPanel title="Import" description="Bring your lists in from the services you already use.">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { href: "/import?source=mal", label: "MyAnimeList", icon: Download },
                { href: "/import?source=anilist", label: "AniList", icon: Download },
                { href: "/import?source=kitsu", label: "Kitsu", icon: Download },
                { href: "/import", label: "Open Import Center", icon: ChevronRight },
              ].map((item) => (
                <Button
                  key={item.label}
                  asChild
                  variant="outline"
                  className="h-14 justify-start rounded-2xl border-border/60 bg-background/40 px-4"
                >
                  <Link href={item.href}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </div>
          </SettingsPanel>

          <SettingsPanel title="Export" description="Download a copy of your settings right now.">
            <div className="flex flex-wrap gap-3">
              <Button type="button" className="rounded-full px-5" onClick={handleExportSettings}>
                <Download className="h-4 w-4" />
                Export settings JSON
              </Button>
              <Button asChild type="button" variant="outline" className="rounded-full border-border/60 bg-background/50 px-5">
                <Link href="/lists">Open my full lists</Link>
              </Button>
            </div>
          </SettingsPanel>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <SettingsPanel title="Security" description="Manage your sign-in methods and account security.">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Account email</p>
              <p className="mt-2 font-medium text-foreground">{user?.email || "No email on file"}</p>
            </div>
          </div>
        </SettingsPanel>

        <AccountCredentials currentEmail={user?.email} />

        <SettingsPanel title="Connected Providers" description="Link or unlink the providers you use to sign in.">
          <div className="space-y-3">
            {providerOptions.map((provider) => {
              const connected = linkedProviders.has(provider.id)
              return (
                <div
                  key={provider.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-background/40 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70">
                      <provider.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{provider.label}</p>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={connected ? "outline" : "default"}
                    className={cn(
                      "rounded-full px-5",
                      connected ? "border-border/60 bg-background/50" : "",
                    )}
                    disabled={connectionPending === provider.id}
                    onClick={() =>
                      connected ? handleDisconnectProvider(provider.id) : handleConnectProvider(provider.id)
                    }
                  >
                    {connectionPending === provider.id
                      ? "Working..."
                      : connected
                        ? "Disconnect"
                        : "Connect"}
                  </Button>
                </div>
              )
            })}
          </div>

          {connectionError ? <p className="mt-4 text-sm text-destructive">{connectionError}</p> : null}
          {connectionMessage ? <p className="mt-4 text-sm text-primary">{connectionMessage}</p> : null}
        </SettingsPanel>

        <SettingsPanel title="Plan" description="Manage your current plan and premium access.">
          <div className="flex flex-col gap-4 rounded-[28px] border border-amber-500/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(34,211,238,0.08))] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <Crown className="h-4 w-4 text-amber-400" />
                {headerUser.isPremium ? "Premium active" : "Free plan"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {headerUser.isPremium
                  ? "Your premium perks stay linked to this account."
                  : "Upgrade later if you want premium-only perks."}
              </p>
            </div>

            <Button asChild className="rounded-full px-5">
              <Link href="/premium">Open Premium</Link>
            </Button>
          </div>
        </SettingsPanel>

        <SettingsPanel title="Danger Zone" description="Low-frequency account actions live here.">
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-2xl"
              onClick={logout}
            >
              <Lock className="h-4 w-4" />
              Sign out
            </Button>

            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-destructive">Delete account</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently delete your account, profile, lists, reviews, and posts. This cannot be undone.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (typeof window === "undefined") return
                  const confirmed = window.confirm(
                    "Delete your Hikari account and all your data permanently? This cannot be undone.",
                  )
                  if (!confirmed) return
                  try {
                    const { data } = await client.auth.getSession()
                    const accessToken = data?.session?.access_token
                    if (!accessToken) {
                      toast.error("Please sign in again, then retry.")
                      return
                    }
                    const res = await fetch("/api/account/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ access_token: accessToken }),
                    })
                    const json = await res.json().catch(() => ({}))
                    if (!res.ok || !json?.ok) {
                      toast.error(json?.error || "Couldn't delete your account.")
                      return
                    }
                    toast.success("Your account has been deleted.")
                    await client.auth.signOut().catch(() => {})
                    window.location.assign("/")
                  } catch (err) {
                    toast.error(err?.message || "Couldn't delete your account.")
                  }
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                Delete my account
              </Button>
            </div>
          </div>
        </SettingsPanel>
      </div>
    )
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        {hasChanges ? (
          <motion.div
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed left-0 right-0 top-16 z-40 border-b border-primary/20 bg-primary/10 backdrop-blur-xl"
          >
            <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">You have unsaved settings changes.</p>
                <p className="text-sm text-muted-foreground">Save to update your live Hikari account and public profile.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-border/60 bg-background/50"
                  onClick={handleDiscardChanges}
                >
                  Discard
                </Button>
                <Button type="button" className="rounded-full px-5" onClick={handleSaveAll} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}

        <main className="container mx-auto px-4 pb-16 pt-24">
          <header className="mb-8 animate-rise">
            <p className="font-jp text-sm font-medium tracking-[0.3em] text-primary/70">設定</p>
            <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
            <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
              Manage your account, public profile, notifications, and appearance.
            </p>
          </header>

          {saveError ? (
            <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          ) : null}

          {saveMessage ? (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {saveMessage}
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <nav className="space-y-1 rounded-2xl border border-border/50 bg-card/60 p-2 backdrop-blur-sm">
                {sections.map((section) => {
                  const active = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <section.icon className="size-4 shrink-0" />
                      {section.label}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              {renderSectionContent()}
            </motion.div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
