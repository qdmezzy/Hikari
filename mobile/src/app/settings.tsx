import React from "react"
import { View, Pressable, ScrollView, Linking, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import Constants from "expo-constants"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, spacing } from "@/theme/tokens"
import { Text, Card } from "@/components/primitives"
import { BackButton } from "@/components/layout/BackButton"
import { useAuth } from "@/hooks/useAuth"
import { buildUserProfile } from "@/lib/social"

const WEB_URL = "https://hikari.rest"

interface RowDef {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  label: string
  detail?: string
  onPress?: () => void
  destructive?: boolean
  chevron?: boolean
}

function SettingsRow({ row, isLast }: { row: RowDef; isLast: boolean }) {
  const { tokens } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        row.onPress?.()
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[3],
        paddingHorizontal: spacing[4],
        paddingVertical: 14,
        backgroundColor: pressed ? tokens.secondary : "transparent",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: tokens.border,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radii.md,
          backgroundColor: `${row.iconColor}22`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={row.icon} size={17} color={row.iconColor} />
      </View>
      <Text
        size="base"
        weight="medium"
        style={{ flex: 1, color: row.destructive ? tokens.destructive : tokens.foreground }}
      >
        {row.label}
      </Text>
      {row.detail ? (
        <Text size="sm" muted>
          {row.detail}
        </Text>
      ) : null}
      {row.chevron !== false && !row.destructive ? (
        <Ionicons name="chevron-forward" size={16} color={tokens.mutedForeground} />
      ) : null}
    </Pressable>
  )
}

function SettingsGroup({ rows }: { rows: RowDef[] }) {
  return (
    <Card glass="subtle" style={{ padding: 0, overflow: "hidden" }}>
      {rows.map((row, index) => (
        <SettingsRow key={row.label} row={row} isLast={index === rows.length - 1} />
      ))}
    </Card>
  )
}

export default function SettingsScreen() {
  const { tokens, isDark, toggle } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, logout } = useAuth()
  const profile = buildUserProfile(user)
  const version = Constants.expoConfig?.version ?? "1.0.0"

  const openWeb = (path: string) => Linking.openURL(`${WEB_URL}${path}`).catch(() => {})

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout()
          router.replace("/")
        },
      },
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: spacing[5],
        paddingBottom: 120,
        gap: spacing[5],
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <BackButton />
        <Text size="xl" weight="bold" style={{ color: tokens.foreground }}>
          Settings
        </Text>
      </View>

      {/* Account. */}
      <SettingsGroup
        rows={[
          {
            icon: "person",
            iconColor: tokens.accent,
            label: "Account",
            detail: user ? profile.handle : "Signed out",
            onPress: () => (user ? openWeb("/settings") : router.push("/login")),
          },
          {
            icon: "color-palette",
            iconColor: "#a78bfa",
            label: "Appearance",
            detail: isDark ? "Dark" : "Light",
            onPress: toggle,
            chevron: false,
          },
          {
            icon: "notifications",
            iconColor: "#fb923c",
            label: "Notifications",
            onPress: () => openWeb("/settings"),
          },
        ]}
      />

      {/* App. */}
      <SettingsGroup
        rows={[
          {
            icon: "calendar",
            iconColor: "#22c55e",
            label: "Airing Schedule",
            onPress: () => router.push("/calendar"),
          },
          {
            icon: "logo-discord",
            iconColor: tokens.discord,
            label: "Join the Discord",
            onPress: () => openWeb("/discord"),
          },
          {
            icon: "chatbox-ellipses",
            iconColor: "#7dd3fc",
            label: "Send Feedback",
            onPress: () => openWeb("/feedback"),
          },
        ]}
      />

      {/* About. */}
      <SettingsGroup
        rows={[
          {
            icon: "globe",
            iconColor: tokens.glacierDeep,
            label: "Open Hikari on the Web",
            onPress: () => openWeb(""),
          },
          {
            icon: "document-text",
            iconColor: tokens.mutedForeground,
            label: "Terms of Service",
            onPress: () => openWeb("/terms"),
          },
          {
            icon: "shield-checkmark",
            iconColor: tokens.mutedForeground,
            label: "Privacy Policy",
            onPress: () => openWeb("/privacy"),
          },
        ]}
      />

      {/* Log out. */}
      {user ? (
        <SettingsGroup
          rows={[
            {
              icon: "power",
              iconColor: tokens.destructive,
              label: "Log Out",
              destructive: true,
              onPress: handleLogout,
            },
          ]}
        />
      ) : null}

      <Text size="xs" muted style={{ textAlign: "center" }}>
        Hikari Mobile v{version}
      </Text>
    </ScrollView>
  )
}
