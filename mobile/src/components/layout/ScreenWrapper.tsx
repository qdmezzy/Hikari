import React from "react"
import { ScrollView, type ScrollViewProps, View, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/theme/ThemeProvider"

/**
 * Screen scaffold handling top safe-area inset + background. Use `headerless`
 * for full-bleed screens (Discover feed) that manage their own layout.
 */
export function ScreenWrapper({
  children,
  style,
  contentContainerStyle,
  headerless = false,
  ...rest
}: ScrollViewProps & { headerless?: boolean }) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      {...rest}
      style={[{ flex: 1, backgroundColor: tokens.background }, style]}
      contentContainerStyle={[
        {
          paddingTop: headerless ? 0 : insets.top + 8,
          flexGrow: 1,
        },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

export function FixedScreen({
  children,
  style,
  headerless = false,
}: {
  children: React.ReactNode
  style?: ViewStyle
  headerless?: boolean
}) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        { flex: 1, backgroundColor: tokens.background, paddingTop: headerless ? 0 : insets.top + 8 },
        style,
      ]}
    >
      {children}
    </View>
  )
}
