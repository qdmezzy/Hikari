import React, { useState } from "react"
import { View, TextInput, type TextInputProps, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/theme/ThemeProvider"
import { radii, fontSizes } from "@/theme/tokens"
import { Text } from "./Text"

export interface TextFieldProps extends Omit<TextInputProps, "placeholderTextColor"> {
  label?: string
  /** Left icon name (Ionicons outline set). */
  icon?: keyof typeof Ionicons.glyphMap
  /** When set, renders a password show/hide toggle. */
  secure?: boolean
  error?: string
  helper?: string
  rightAccessory?: React.ReactNode
}

/**
 * Form text field mirroring the web's styled Input:
 * left icon, focus glow ring, password eye toggle, destructive error state.
 */
export function TextField({
  label,
  icon,
  secure = false,
  error,
  helper,
  rightAccessory,
  value,
  onChangeText,
  onFocus,
  onBlur,
  style,
  ...rest
}: TextFieldProps) {
  const { tokens } = useTheme()
  const [focused, setFocused] = useState(false)
  const [reveal, setReveal] = useState(false)

  const isSecure = secure && !reveal
  const borderColor = error ? tokens.destructive : focused ? `${tokens.primary}88` : tokens.border
  const iconColor = error ? tokens.destructive : focused ? tokens.primary : tokens.mutedForeground

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text size="sm" weight="medium" style={{ color: tokens.foreground }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 56,
          paddingHorizontal: 16,
          borderRadius: radii.xl,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: `${tokens.muted}66`,
          ...(focused
            ? {
                shadowColor: tokens.primary,
                shadowOpacity: 0.25,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
                elevation: 2,
              }
            : {}),
        }}
      >
        {icon ? (
          <Ionicons name={icon} size={20} color={iconColor} style={{ marginRight: 12 }} />
        ) : null}

        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          secureTextEntry={isSecure}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            {
              flex: 1,
              color: tokens.foreground,
              fontFamily: "Geist",
              fontSize: fontSizes.base,
              padding: 0,
            },
            style,
          ]}
        />

        {secure ? (
          <Pressable
            onPress={() => setReveal((r) => !r)}
            hitSlop={12}
            style={{ padding: 4, marginLeft: 8 }}
          >
            <Ionicons
              name={reveal ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={tokens.mutedForeground}
            />
          </Pressable>
        ) : null}

        {rightAccessory}
      </View>

      {error ? (
        <Text size="sm" style={{ color: tokens.destructive }}>{error}</Text>
      ) : helper ? (
        <Text size="sm" muted>{helper}</Text>
      ) : null}
    </View>
  )
}
