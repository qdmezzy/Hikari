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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace"

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

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeSection, setActiveSection] = React.useState("profile")
  const [bannerOpen, setBannerOpen] = React.useState(false)
  const [bannerDraft, setBannerDraft] = React.useState("")
  React.useEffect(() => {
    const syncSection = () => {
      const requested = new URLSearchParams(window.location.search).get("section")
      setActiveSection(sections.some(section => section.id === requested) ? requested : "profile")
    }
    syncSection()
    window.addEventListener("popstate", syncSection)
    return () => window.removeEventListener("popstate", syncSection)
  }, [])
  const navigateSection = (id) => {
    setActiveSection(id)
    const url = new URL(window.location.href)
    url.searchParams.set("section", id)
    window.history.pushState(null, "", url)
  }
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
    setBannerDraft(profile.bannerImage || "")
    setBannerOpen(true)
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

  const handleDeleteAccount = async () => {
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
  }

  const activeLabel = sections.find(section => section.id === activeSection)?.label || "Profile"
  const descriptions = {
    profile: "Make yourself at home. Tell people a little about you.",
    privacy: "Your profile, your audience. Choose what you share.",
    notifications: "Keep the updates you want. Quiet the rest.",
    display: "Settle into a look that feels like yours.",
    lists: "Set up your everyday tracking preferences.",
    content: "Decide what you want to see, and what stays hidden.",
    "import-export": "Bring your library with you, or take a copy along.",
    account: "Sign-in methods, security, and account management.",
  }

  return (
    <RequireAuth>
      <div className="hikari-revamp hikari-settings min-h-screen">
        <Navigation />
        <main className="hk-settings">
          <header className="hk-settings-masthead"><div><p className="hk-page-jp" lang="ja">設定</p><h1>Settings</h1></div><Link href="/profile">Your profile <ChevronRight size={15}/></Link></header>
          <nav className="hk-settings-sections" aria-label="Settings sections">{sections.map(section=><button key={section.id} type="button" aria-current={activeSection===section.id?"page":undefined} onClick={()=>navigateSection(section.id)}>{section.label}</button>)}</nav>
          <div className="hk-settings-current"><h2>{activeLabel}</h2></div>
          {saveError?<p role="alert" className="rv-error">{saveError}</p>:null}
          {saveMessage?<p role="status" className="hk-settings-note">{saveMessage}</p>:null}
          <SettingsWorkspace model={{activeSection, profile, privacy, notifications, display, listSettings, content, user, avatarUrl, avatarUploading, avatarError, fileInputRef, handleAvatarSelected, handleRemoveAvatar, handleBannerPrompt, updateProfileState, updatePrivacyState, updateNotificationState, updateDisplayState, updateListSettingsState, updateContentState, mutedUsers, mutedLoading, mutedError, handleUnmuteUser, accentColors, customLists, handleExportSettings, providerOptions, linkedProviders, connectionPending, connectionError, connectionMessage, handleDisconnectProvider, handleConnectProvider, logout, onDeleteAccount:handleDeleteAccount}}/>
          {hasChanges?<div className="hk-settings-save" role="region" aria-label="Unsaved settings"><p>Unsaved changes</p><div><Button variant="ghost" onClick={handleDiscardChanges} disabled={saving}>Discard</Button><Button onClick={handleSaveAll} disabled={saving}>{saving?"Saving…":"Save changes"}</Button></div></div>:null}
        </main>
        <Dialog open={bannerOpen} onOpenChange={setBannerOpen}>
          <DialogContent>
            <form onSubmit={event => { event.preventDefault(); updateProfileState({ bannerImage: bannerDraft.trim() }); setBannerOpen(false) }}>
              <DialogHeader><DialogTitle>Profile cover</DialogTitle><DialogDescription>Use a landscape image. Leave the address blank to remove your cover.</DialogDescription></DialogHeader>
              <div className="space-y-3 py-6"><Label htmlFor="banner-url">Image address</Label><Input id="banner-url" type="url" pattern="https?://.+" placeholder="https://…" value={bannerDraft} onChange={event => setBannerDraft(event.target.value)} />{bannerDraft.startsWith("https://") ? <img src={bannerDraft} alt="Cover preview" className="h-36 w-full rounded-md object-cover" /> : null}</div>
              <DialogFooter><Button variant="outline" type="button" onClick={() => setBannerOpen(false)}>Cancel</Button><Button type="submit">Use this cover</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RequireAuth>
  )
}
