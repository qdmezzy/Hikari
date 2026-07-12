import React, { useCallback } from "react"
import { View } from "react-native"
import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"
import { Stack, usePathname, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider"
import { AuthProvider, useAuth } from "@/hooks/useAuth"

SplashScreen.preventAutoHideAsync().catch(() => {})

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"]

/** Signed-out users belong on the login screen — always. */
function AuthGate() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    if (loading) return
    const onAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))
    if (!user && !onAuthRoute) {
      router.replace("/login")
    }
  }, [user, loading, pathname, router])

  return null
}

function AppShell() {
  const { tokens, isDark } = useTheme()

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthProvider>
        <AuthGate />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.background },
            animation: "slide_from_right",
            animationDuration: 280,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="anime/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="search" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="calendar" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="login" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="register" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="forgot-password" options={{ animation: "slide_from_right" }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Geist — primary sans (matches web's Geist from next/font/google).
    Geist: require("../../assets/fonts/Geist-Regular.ttf"),
    GeistMedium: require("../../assets/fonts/Geist-Medium.ttf"),
    GeistSemiBold: require("../../assets/fonts/Geist-SemiBold.ttf"),
    GeistBold: require("../../assets/fonts/Geist-Bold.ttf"),
    GeistBlack: require("../../assets/fonts/Geist-Black.ttf"),
    // Noto Sans JP — kana/kanji flourishes (ヒカリ, 視聴中, etc.).
    NotoSansJP: require("../../assets/fonts/NotoSansJP-Regular.otf"),
    NotoSansJPBold: require("../../assets/fonts/NotoSansJP-Bold.otf"),
  })

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ThemeProvider defaultMode="dark">
          <AppShell />
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  )
}
